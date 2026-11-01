/**
 * Jellyfin library sync.
 *
 * Mirrors every Jellyfin movie and TV library into the existing video
 * library tables (PlexLibrarySection / PlexMovie / PlexTVShow / PlexSeason /
 * PlexEpisode and their guid/genre/media child tables). The table names are
 * historical: rows are keyed by the Jellyfin item id (`ratingKey`) and the
 * Jellyfin library id (`sectionKey`). All Up Next / custom order logic reads
 * from these tables.
 *
 * Jellyfin collections (BoxSets) are synced into MediaCollection /
 * MediaCollectionItem. A collection can contain movies, series and other
 * collections; each movie/show row also gets a flattened JSON `collections`
 * array containing every collection it belongs to directly or through a
 * nested collection.
 *
 * On first run, rows that came from the old Plex video sync (numeric rating
 * keys) are remapped to Jellyfin ids in CustomOrderItem / WatchLog and then
 * purged.
 */
const prisma = require('./prismaClient');
const jellyfin = require('./services/jellyfinService');
const {
  isJellyfinId,
  ticksToMs,
  dateToUnixSeconds,
  providerIdsToGuids
} = require('./services/jellyfinService');

const MOVIE_FIELDS = 'ProviderIds,Path,Overview,Genres,Studios,DateCreated,PremiereDate,ProductionYear,OfficialRating,CommunityRating,CriticRating,MediaSources,Taglines,Tags,SortName,ImageTags,BackdropImageTags';
const SERIES_FIELDS = 'ProviderIds,Path,Overview,Genres,DateCreated,PremiereDate,ProductionYear,SortName,ImageTags,BackdropImageTags,ChildCount,RecursiveItemCount';
const SEASON_FIELDS = 'ProviderIds,Overview,DateCreated,PremiereDate,ImageTags';
const EPISODE_FIELDS = 'ProviderIds,Path,Overview,DateCreated,PremiereDate,SortName,ImageTags,MediaSources';

const BATCH_SIZE = 200;
const CHILD_CONCURRENCY = 8;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function datePart(value) {
  if (!value) return null;
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

function primaryImage(item) {
  return item?.ImageTags?.Primary ? `/Items/${item.Id}/Images/Primary` : null;
}

function backdropImage(item) {
  return item?.BackdropImageTags?.length ? `/Items/${item.Id}/Images/Backdrop` : null;
}

function watchState(item) {
  const ud = item.UserData || {};
  const played = !!ud.Played;
  return {
    viewCount: played ? Math.max(1, ud.PlayCount || 0) : 0,
    lastViewedAt: dateToUnixSeconds(ud.LastPlayedDate)
  };
}

function mediaFromItem(item) {
  const source = (item.MediaSources || [])[0];
  if (!source) return null;
  const streams = source.MediaStreams || [];
  const video = streams.find(s => s.Type === 'Video');
  const audio = streams.find(s => s.Type === 'Audio' && s.IsDefault) || streams.find(s => s.Type === 'Audio');
  let resolution = null;
  if (video?.Height) {
    const h = video.Height;
    resolution = h >= 2000 ? '4k' : h >= 1000 ? '1080' : h >= 700 ? '720' : h >= 560 ? '576' : h >= 470 ? '480' : 'sd';
  }
  return {
    id_value: source.Id || item.Id,
    duration: ticksToMs(source.RunTimeTicks ?? item.RunTimeTicks),
    bitrate: source.Bitrate ? Math.round(source.Bitrate / 1000) : null,
    width: video?.Width ?? null,
    height: video?.Height ?? null,
    aspectRatio: video?.Width && video?.Height ? Math.round((video.Width / video.Height) * 100) / 100 : null,
    audioChannels: audio?.Channels ?? null,
    audioCodec: audio?.Codec ?? null,
    videoCodec: video?.Codec ?? null,
    videoResolution: resolution,
    container: source.Container ?? null,
    videoFrameRate: video?.RealFrameRate ? String(Math.round(video.RealFrameRate * 1000) / 1000) : null,
    optimizedForStreaming: null,
    selected: null
  };
}

function sameValue(a, b) {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  return a === b;
}

function changedFields(existing, data) {
  const diff = {};
  for (const [k, v] of Object.entries(data)) {
    if (!sameValue(existing[k], v)) diff[k] = v;
  }
  return diff;
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

class JellyfinSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastResult = null;
  }

  // ---------------------------------------------------------------------------
  // Generic helpers
  // ---------------------------------------------------------------------------

  /**
   * Insert new rows / update changed rows for a video model keyed by ratingKey.
   */
  async upsertRows(model, rows, existingByKey, stats) {
    const toCreate = [];
    const updates = [];
    for (const row of rows) {
      const existing = existingByKey.get(row.ratingKey);
      if (!existing) {
        toCreate.push(row);
      } else {
        const diff = changedFields(existing, row);
        if (Object.keys(diff).length) updates.push({ ratingKey: row.ratingKey, diff });
      }
    }
    for (const batch of chunk(toCreate, BATCH_SIZE)) {
      await model.createMany({ data: batch });
    }
    for (const batch of chunk(updates, BATCH_SIZE)) {
      await prisma.$transaction(batch.map(u => model.update({ where: { ratingKey: u.ratingKey }, data: { ...u.diff, lastSyncedAt: undefined } })));
    }
    stats.created += toCreate.length;
    stats.updated += updates.length;
  }

  /**
   * Replace child rows (guids, genres, media) for items whose desired set
   * differs from what is stored.
   */
  async syncChildRows(model, field, desiredByKey, signatureFn, keys) {
    if (!keys.length) return 0;
    const existing = [];
    for (const batch of chunk(keys, 900)) {
      existing.push(...await model.findMany({ where: { [field]: { in: batch } } }));
    }
    const existingByKey = new Map();
    for (const row of existing) {
      const k = row[field];
      if (!existingByKey.has(k)) existingByKey.set(k, []);
      existingByKey.get(k).push(row);
    }
    const toDeleteKeys = [];
    const toCreate = [];
    for (const key of keys) {
      const desired = desiredByKey.get(key) || [];
      const current = existingByKey.get(key) || [];
      const a = desired.map(signatureFn).sort().join('|');
      const b = current.map(signatureFn).sort().join('|');
      if (a !== b) {
        if (current.length) toDeleteKeys.push(key);
        for (const d of desired) toCreate.push({ ...d, [field]: key });
      }
    }
    for (const batch of chunk(toDeleteKeys, 900)) {
      await model.deleteMany({ where: { [field]: { in: batch } } });
    }
    for (const batch of chunk(toCreate, 500)) {
      await model.createMany({ data: batch });
    }
    return toDeleteKeys.length + toCreate.length;
  }

  async loadExisting(model, select) {
    const rows = await model.findMany({ select: { ratingKey: true, ...select } });
    return new Map(rows.map(r => [r.ratingKey, r]));
  }

  // ---------------------------------------------------------------------------
  // Libraries
  // ---------------------------------------------------------------------------

  async syncLibraries() {
    const libraries = await jellyfin.getVideoLibraries();
    for (const lib of libraries) {
      const type = lib.CollectionType === 'movies' ? 'movie' : 'show';
      await prisma.plexLibrarySection.upsert({
        where: { sectionKey: lib.ItemId },
        update: { title: lib.Name, type, agent: 'jellyfin', uuid: lib.ItemId, hidden: 0 },
        create: { sectionKey: lib.ItemId, title: lib.Name, type, agent: 'jellyfin', uuid: lib.ItemId, hidden: 0 }
      });
    }
    return libraries;
  }

  // ---------------------------------------------------------------------------
  // Collections (BoxSets) - nested, mixed movie/series
  // ---------------------------------------------------------------------------

  async fetchCollectionGraph() {
    const boxsets = await jellyfin.getCollections();
    const children = await mapWithConcurrency(boxsets, CHILD_CONCURRENCY, async (boxset) => {
      try {
        return await jellyfin.getAllItems({ ParentId: boxset.Id, Fields: 'SortName' });
      } catch (error) {
        console.warn(`⚠️ Failed to load children for collection ${boxset.Name}:`, error.message);
        return [];
      }
    });
    const collections = new Map();
    boxsets.forEach((b, i) => {
      collections.set(b.Id, {
        id: b.Id,
        name: b.Name,
        sortName: b.SortName || null,
        overview: b.Overview || null,
        thumb: primaryImage(b),
        children: children[i].map((c, idx) => ({
          id: c.Id,
          type: c.Type === 'BoxSet' ? 'collection' : c.Type === 'Series' ? 'show' : c.Type === 'Movie' ? 'movie' : null,
          sortOrder: idx
        })).filter(c => c.type)
      });
    });
    return collections;
  }

  /**
   * For every movie/series id, return the sorted list of collection names it
   * belongs to - directly or via any ancestor collection. Cycles are ignored.
   */
  static computeFlattenedMemberships(collections) {
    const parentsOf = new Map(); // collection id -> Set(parent collection ids)
    for (const col of collections.values()) {
      for (const child of col.children) {
        if (child.type !== 'collection') continue;
        if (!parentsOf.has(child.id)) parentsOf.set(child.id, new Set());
        parentsOf.get(child.id).add(col.id);
      }
    }
    const ancestorCache = new Map();
    const ancestorsOf = (colId) => {
      if (ancestorCache.has(colId)) return ancestorCache.get(colId);
      const seen = new Set([colId]);
      const stack = [colId];
      while (stack.length) {
        const cur = stack.pop();
        for (const p of parentsOf.get(cur) || []) {
          if (!seen.has(p)) {
            seen.add(p);
            stack.push(p);
          }
        }
      }
      ancestorCache.set(colId, seen);
      return seen;
    };

    const memberships = new Map(); // item id -> Set(collection names)
    for (const col of collections.values()) {
      for (const child of col.children) {
        if (child.type === 'collection') continue;
        if (!memberships.has(child.id)) memberships.set(child.id, new Set());
        const names = memberships.get(child.id);
        for (const ancestorId of ancestorsOf(col.id)) {
          const ancestor = collections.get(ancestorId);
          if (ancestor) names.add(ancestor.name);
        }
      }
    }
    const result = new Map();
    for (const [id, names] of memberships) {
      result.set(id, JSON.stringify([...names].sort((a, b) => a.localeCompare(b))));
    }
    return result;
  }

  async persistCollections(collections) {
    const existing = await prisma.mediaCollection.findMany();
    const existingByJf = new Map(existing.map(c => [c.jellyfinId, c]));
    const now = new Date();

    for (const col of collections.values()) {
      const data = {
        name: col.name,
        sortName: col.sortName,
        overview: col.overview,
        thumb: col.thumb,
        childCount: col.children.length,
        removed: false,
        lastSyncedAt: now
      };
      if (existingByJf.has(col.id)) {
        await prisma.mediaCollection.update({ where: { jellyfinId: col.id }, data });
      } else {
        const created = await prisma.mediaCollection.create({ data: { jellyfinId: col.id, ...data } });
        existingByJf.set(col.id, created);
      }
    }

    const removedIds = existing.filter(c => !collections.has(c.jellyfinId) && !c.removed).map(c => c.id);
    if (removedIds.length) {
      await prisma.mediaCollection.updateMany({ where: { id: { in: removedIds } }, data: { removed: true } });
      await prisma.mediaCollectionItem.deleteMany({ where: { collectionId: { in: removedIds } } });
    }

    // Rebuild membership rows (cheap: a few thousand rows at most)
    const activeIds = [...collections.keys()].map(id => existingByJf.get(id).id);
    for (const batch of chunk(activeIds, 900)) {
      await prisma.mediaCollectionItem.deleteMany({ where: { collectionId: { in: batch } } });
    }
    const rows = [];
    for (const col of collections.values()) {
      const parentId = existingByJf.get(col.id).id;
      const seenKeys = new Set();
      for (const child of col.children) {
        if (seenKeys.has(child.id)) continue;
        seenKeys.add(child.id);
        rows.push({
          collectionId: parentId,
          itemType: child.type,
          itemKey: child.id,
          childCollectionId: child.type === 'collection' ? (existingByJf.get(child.id)?.id ?? null) : null,
          sortOrder: child.sortOrder
        });
      }
    }
    for (const batch of chunk(rows, 500)) {
      await prisma.mediaCollectionItem.createMany({ data: batch });
    }
    return { collections: collections.size, items: rows.length, removed: removedIds.length };
  }

  // ---------------------------------------------------------------------------
  // Movies
  // ---------------------------------------------------------------------------

  buildMovieRow(item, lib, collectionsJson) {
    return {
      ratingKey: item.Id,
      title: item.Name || 'Untitled',
      year: item.ProductionYear ?? null,
      summary: item.Overview ?? null,
      thumb: primaryImage(item),
      art: backdropImage(item),
      ...watchState(item),
      addedAt: dateToUnixSeconds(item.DateCreated),
      collections: collectionsJson || null,
      sectionKey: lib.ItemId,
      originallyAvailableAt: datePart(item.PremiereDate),
      contentRating: item.OfficialRating ?? null,
      duration: ticksToMs(item.RunTimeTicks),
      guid: `jellyfin://movie/${item.Id}`,
      key: `/Items/${item.Id}`,
      librarySectionKey: lib.ItemId,
      librarySectionTitle: lib.Name,
      rating: item.CriticRating != null ? item.CriticRating / 10 : null,
      audienceRating: item.CommunityRating ?? null,
      studio: item.Studios?.[0]?.Name ?? null,
      tagline: item.Taglines?.[0] ?? null,
      titleSort: item.SortName ?? null,
      type: 'movie',
      removed: false
    };
  }

  async syncMovies(libraries, memberships, stats, seen) {
    const existing = await this.loadExisting(prisma.plexMovie, {
      title: true, year: true, summary: true, thumb: true, art: true, viewCount: true, lastViewedAt: true,
      addedAt: true, collections: true, sectionKey: true, originallyAvailableAt: true, contentRating: true,
      duration: true, guid: true, key: true, librarySectionKey: true, librarySectionTitle: true, rating: true,
      audienceRating: true, studio: true, tagline: true, titleSort: true, type: true, removed: true
    });
    for (const lib of libraries.filter(l => l.CollectionType === 'movies')) {
      const items = await jellyfin.getAllItems({ ParentId: lib.ItemId, IncludeItemTypes: 'Movie', Recursive: true, Fields: MOVIE_FIELDS });
      console.log(`🎬 Jellyfin library "${lib.Name}": ${items.length} movies`);
      const rows = [];
      const guids = new Map();
      const genres = new Map();
      const labels = new Map();
      const media = new Map();
      for (const item of items) {
        if (seen.movies.has(item.Id)) continue;
        seen.movies.add(item.Id);
        rows.push(this.buildMovieRow(item, lib, memberships.get(item.Id)));
        guids.set(item.Id, providerIdsToGuids(item.ProviderIds).map(id_value => ({ id_value })));
        genres.set(item.Id, (item.Genres || []).map(tag => ({ tag })));
        labels.set(item.Id, [...new Set(item.Tags || [])].map(tag => ({ tag })));
        const m = mediaFromItem(item);
        media.set(item.Id, m ? [m] : []);
      }
      await this.upsertRows(prisma.plexMovie, rows, existing, stats.movies);
      const keys = rows.map(r => r.ratingKey);
      await this.syncChildRows(prisma.plexGuid, 'movieRatingKey', guids, g => g.id_value, keys);
      await this.syncChildRows(prisma.plexGenre, 'movieRatingKey', genres, g => g.tag, keys);
      await this.syncChildRows(prisma.plexLabel, 'movieRatingKey', labels, l => l.tag, keys);
      await this.syncChildRows(prisma.plexMedia, 'movieRatingKey', media, m => `${m.id_value}:${m.container}:${m.videoCodec}:${m.width}:${m.duration}`, keys);
      stats.movies.total += rows.length;
    }
  }

  // ---------------------------------------------------------------------------
  // TV
  // ---------------------------------------------------------------------------

  async syncTV(libraries, memberships, stats, seen) {
    const existingShows = await this.loadExisting(prisma.plexTVShow, {
      title: true, year: true, summary: true, thumb: true, art: true, leafCount: true, viewedLeafCount: true,
      addedAt: true, collections: true, sectionKey: true, childCount: true, guid: true, key: true,
      lastViewedAt: true, type: true, viewCount: true, removed: true
    });
    const existingSeasons = await this.loadExisting(prisma.plexSeason, {
      title: true, index: true, showRatingKey: true, leafCount: true, viewedLeafCount: true, addedAt: true,
      guid: true, key: true, lastViewedAt: true, librarySectionKey: true, librarySectionTitle: true,
      parentIndex: true, parentKey: true, parentRatingKey: true, parentThumb: true, parentTitle: true,
      summary: true, thumb: true, type: true, viewCount: true, removed: true
    });
    const existingEpisodes = await this.loadExisting(prisma.plexEpisode, {
      title: true, index: true, seasonIndex: true, showTitle: true, seasonRatingKey: true, viewCount: true,
      lastViewedAt: true, addedAt: true, summary: true, thumb: true, originallyAvailableAt: true, duration: true,
      grandparentKey: true, grandparentRatingKey: true, grandparentThumb: true, grandparentTitle: true,
      guid: true, key: true, librarySectionKey: true, librarySectionTitle: true, parentIndex: true,
      parentKey: true, parentRatingKey: true, parentThumb: true, parentTitle: true, titleSort: true,
      type: true, removed: true
    });

    for (const lib of libraries.filter(l => l.CollectionType === 'tvshows')) {
      const [series, seasons, episodes] = [
        await jellyfin.getAllItems({ ParentId: lib.ItemId, IncludeItemTypes: 'Series', Recursive: true, Fields: SERIES_FIELDS }),
        await jellyfin.getAllItems({ ParentId: lib.ItemId, IncludeItemTypes: 'Season', Recursive: true, Fields: SEASON_FIELDS }),
        await jellyfin.getAllItems({ ParentId: lib.ItemId, IncludeItemTypes: 'Episode', Recursive: true, Fields: EPISODE_FIELDS }, { pageSize: 1000 })
      ];
      console.log(`📺 Jellyfin library "${lib.Name}": ${series.length} series, ${seasons.length} seasons, ${episodes.length} episodes`);

      const seriesById = new Map(series.map(s => [s.Id, s]));
      // Like seasons, an episode's SeriesId can reference a series item the
      // series query does not return (duplicate folders for the same show).
      // Alias those to the listed series of the same name, or fetch the item.
      const seriesKey = name => normalizeTitle(String(name || '').replace(/\s*\(\d{4}\)\s*$/, ''));
      const seriesByName = new Map();
      for (const s of series) {
        const key = seriesKey(s.Name);
        if (!seriesByName.has(key)) seriesByName.set(key, s);
      }
      const seriesAlias = new Map();
      for (const ep of episodes) {
        if (!ep.SeriesId || seriesById.has(ep.SeriesId) || seriesAlias.has(ep.SeriesId)) continue;
        if (ep.LocationType === 'Virtual' || ep.IndexNumber == null) continue;
        let target = seriesByName.get(seriesKey(ep.SeriesName)) || null;
        if (!target) {
          try {
            const item = await jellyfin.getItem(ep.SeriesId);
            if (item?.Type === 'Series') {
              target = item;
              seriesById.set(item.Id, item);
              series.push(item);
            }
          } catch (error) {
            console.warn(`⚠️ Could not load series ${ep.SeriesName} (${ep.SeriesId}):`, error.message);
          }
        }
        seriesAlias.set(ep.SeriesId, target);
      }
      const resolveSeries = id => seriesById.get(id) || seriesAlias.get(id) || null;
      const seasonById = new Map(seasons.filter(s => seriesById.has(s.SeriesId)).map(s => [s.Id, s]));
      const seasonBySeriesIndex = new Map();
      for (const s of seasonById.values()) {
        const key = `${s.SeriesId}|${s.IndexNumber ?? 0}`;
        if (!seasonBySeriesIndex.has(key)) seasonBySeriesIndex.set(key, s);
      }
      // Jellyfin can report an episode's SeasonId as a season item that is not
      // returned by the season query (duplicate/stale season folders). Resolve
      // those to the series' season with the same number, or synthesize one.
      const resolveSeason = (ep) => {
        if (seasonById.has(ep.SeasonId)) return seasonById.get(ep.SeasonId);
        const show = resolveSeries(ep.SeriesId);
        if (!show) return null;
        const index = ep.ParentIndexNumber ?? 0;
        const key = `${show.Id}|${index}`;
        if (!seasonBySeriesIndex.has(key)) {
          const id = ep.SeasonId || null;
          if (!id) return null;
          const synthetic = { Id: id, SeriesId: show.Id, IndexNumber: index, Name: ep.SeasonName || `Season ${index}` };
          seasonById.set(id, synthetic);
          seasonBySeriesIndex.set(key, synthetic);
        }
        return seasonBySeriesIndex.get(key);
      };

      // Episode rows + per-season / per-series rollups
      const episodeRows = [];
      const episodeGuids = new Map();
      const episodeMedia = new Map();
      const seasonAgg = new Map();
      const seriesAgg = new Map();
      const bump = (map, key, watched, lastViewedAt) => {
        if (!map.has(key)) map.set(key, { leaf: 0, viewed: 0, lastViewedAt: null });
        const agg = map.get(key);
        agg.leaf += 1;
        if (watched) agg.viewed += 1;
        if (lastViewedAt && (!agg.lastViewedAt || lastViewedAt > agg.lastViewedAt)) agg.lastViewedAt = lastViewedAt;
      };
      const skipped = { virtual: 0, unnumbered: 0, orphan: 0 };
      for (const ep of episodes) {
        if (seen.episodes.has(ep.Id)) continue;
        if (ep.LocationType === 'Virtual') { skipped.virtual++; continue; }
        if (ep.IndexNumber == null) { skipped.unnumbered++; continue; }
        const season = resolveSeason(ep);
        if (!season) { skipped.orphan++; continue; }
        seen.episodes.add(ep.Id);
        const show = seriesById.get(season.SeriesId) || resolveSeries(ep.SeriesId);
        const ws = watchState(ep);
        bump(seasonAgg, season.Id, ws.viewCount > 0, ws.lastViewedAt);
        bump(seriesAgg, show.Id, ws.viewCount > 0, ws.lastViewedAt);
        episodeRows.push({
          ratingKey: ep.Id,
          title: ep.Name || `Episode ${ep.IndexNumber}`,
          index: ep.IndexNumber,
          seasonIndex: ep.ParentIndexNumber ?? season.IndexNumber ?? 0,
          showTitle: show.Name,
          seasonRatingKey: season.Id,
          ...ws,
          addedAt: dateToUnixSeconds(ep.DateCreated),
          summary: ep.Overview ?? null,
          thumb: primaryImage(ep),
          originallyAvailableAt: datePart(ep.PremiereDate),
          duration: ticksToMs(ep.RunTimeTicks),
          grandparentKey: `/Items/${show.Id}`,
          grandparentRatingKey: show.Id,
          grandparentThumb: primaryImage(show),
          grandparentTitle: show.Name,
          guid: `jellyfin://episode/${ep.Id}`,
          key: `/Items/${ep.Id}`,
          librarySectionKey: lib.ItemId,
          librarySectionTitle: lib.Name,
          parentIndex: season.IndexNumber ?? 0,
          parentKey: `/Items/${season.Id}`,
          parentRatingKey: season.Id,
          parentThumb: primaryImage(season) || primaryImage(show),
          parentTitle: season.Name,
          titleSort: ep.SortName ?? null,
          type: 'episode',
          removed: false
        });
        episodeGuids.set(ep.Id, providerIdsToGuids(ep.ProviderIds).map(id_value => ({ id_value })));
        const m = mediaFromItem(ep);
        episodeMedia.set(ep.Id, m ? [m] : []);
      }
      if (skipped.virtual || skipped.unnumbered || skipped.orphan) {
        console.log(`   ↳ skipped episodes: ${skipped.virtual} virtual (missing), ${skipped.unnumbered} unnumbered, ${skipped.orphan} without a series`);
      }

      // Series rows
      const showRows = [];
      const showGuids = new Map();
      const showGenres = new Map();
      for (const s of series) {
        if (seen.shows.has(s.Id)) continue;
        seen.shows.add(s.Id);
        const agg = seriesAgg.get(s.Id) || { leaf: 0, viewed: 0, lastViewedAt: null };
        const ud = s.UserData || {};
        showRows.push({
          ratingKey: s.Id,
          title: s.Name || 'Untitled',
          year: s.ProductionYear ?? null,
          summary: s.Overview ?? null,
          thumb: primaryImage(s),
          art: backdropImage(s),
          leafCount: agg.leaf,
          viewedLeafCount: agg.viewed,
          addedAt: dateToUnixSeconds(s.DateCreated),
          collections: memberships.get(s.Id) || null,
          sectionKey: lib.ItemId,
          childCount: s.ChildCount ?? null,
          guid: `jellyfin://show/${s.Id}`,
          key: `/Items/${s.Id}`,
          lastViewedAt: agg.lastViewedAt ?? dateToUnixSeconds(ud.LastPlayedDate),
          type: 'show',
          viewCount: agg.viewed,
          removed: false
        });
        showGuids.set(s.Id, providerIdsToGuids(s.ProviderIds).map(id_value => ({ id_value })));
        showGenres.set(s.Id, (s.Genres || []).map(tag => ({ tag })));
      }
      await this.upsertRows(prisma.plexTVShow, showRows, existingShows, stats.shows);
      const showKeys = showRows.map(r => r.ratingKey);
      await this.syncChildRows(prisma.plexGuid, 'showRatingKey', showGuids, g => g.id_value, showKeys);
      await this.syncChildRows(prisma.plexGenre, 'showRatingKey', showGenres, g => g.tag, showKeys);
      stats.shows.total += showRows.length;

      // Season rows
      const seasonRows = [];
      for (const season of seasonById.values()) {
        if (seen.seasons.has(season.Id)) continue;
        seen.seasons.add(season.Id);
        const show = seriesById.get(season.SeriesId);
        const agg = seasonAgg.get(season.Id) || { leaf: 0, viewed: 0, lastViewedAt: null };
        seasonRows.push({
          ratingKey: season.Id,
          title: season.Name || `Season ${season.IndexNumber ?? 0}`,
          index: season.IndexNumber ?? 0,
          showRatingKey: show.Id,
          leafCount: agg.leaf,
          viewedLeafCount: agg.viewed,
          addedAt: dateToUnixSeconds(season.DateCreated),
          guid: `jellyfin://season/${season.Id}`,
          key: `/Items/${season.Id}`,
          lastViewedAt: agg.lastViewedAt,
          librarySectionKey: lib.ItemId,
          librarySectionTitle: lib.Name,
          parentIndex: null,
          parentKey: `/Items/${show.Id}`,
          parentRatingKey: show.Id,
          parentThumb: primaryImage(show),
          parentTitle: show.Name,
          summary: season.Overview ?? null,
          thumb: primaryImage(season) || primaryImage(show),
          type: 'season',
          viewCount: agg.viewed,
          removed: false
        });
      }
      await this.upsertRows(prisma.plexSeason, seasonRows, existingSeasons, stats.seasons);
      stats.seasons.total += seasonRows.length;

      await this.upsertRows(prisma.plexEpisode, episodeRows, existingEpisodes, stats.episodes);
      const episodeKeys = episodeRows.map(r => r.ratingKey);
      await this.syncChildRows(prisma.plexGuid, 'episodeRatingKey', episodeGuids, g => g.id_value, episodeKeys);
      await this.syncChildRows(prisma.plexMedia, 'episodeRatingKey', episodeMedia, m => `${m.id_value}:${m.container}:${m.videoCodec}:${m.width}:${m.duration}`, episodeKeys);
      stats.episodes.total += episodeRows.length;
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy Plex video rows -> Jellyfin
  // ---------------------------------------------------------------------------

  async buildLegacyKeyMap() {
    const map = new Map(); // legacy plex ratingKey -> { key, type }

    const legacyMovies = (await prisma.plexMovie.findMany({ select: { ratingKey: true, title: true, year: true, guids: { select: { id_value: true } } } }))
      .filter(m => !isJellyfinId(m.ratingKey));
    const legacyShows = (await prisma.plexTVShow.findMany({ select: { ratingKey: true, title: true, year: true, guids: { select: { id_value: true } } } }))
      .filter(s => !isJellyfinId(s.ratingKey));
    const legacyEpisodes = (await prisma.plexEpisode.findMany({ select: { ratingKey: true, showTitle: true, seasonIndex: true, index: true, guids: { select: { id_value: true } } } }))
      .filter(e => !isJellyfinId(e.ratingKey));
    if (!legacyMovies.length && !legacyShows.length && !legacyEpisodes.length) {
      return { map, legacy: { movies: [], shows: [], episodes: [], seasons: [] } };
    }

    const jfGuids = await prisma.plexGuid.findMany({
      where: { OR: [{ movieRatingKey: { not: null } }, { showRatingKey: { not: null } }, { episodeRatingKey: { not: null } }] },
      select: { movieRatingKey: true, showRatingKey: true, episodeRatingKey: true, id_value: true }
    });
    const guidIndex = { movie: new Map(), show: new Map(), episode: new Map() };
    for (const g of jfGuids) {
      if (g.movieRatingKey && isJellyfinId(g.movieRatingKey)) guidIndex.movie.set(g.id_value, g.movieRatingKey);
      if (g.showRatingKey && isJellyfinId(g.showRatingKey)) guidIndex.show.set(g.id_value, g.showRatingKey);
      if (g.episodeRatingKey && isJellyfinId(g.episodeRatingKey)) guidIndex.episode.set(g.id_value, g.episodeRatingKey);
    }

    const jfMovies = (await prisma.plexMovie.findMany({ where: { removed: false }, select: { ratingKey: true, title: true, year: true } }))
      .filter(m => isJellyfinId(m.ratingKey));
    const movieByTitleYear = new Map();
    for (const m of jfMovies) movieByTitleYear.set(`${normalizeTitle(m.title)}|${m.year ?? ''}`, m.ratingKey);

    const jfShows = (await prisma.plexTVShow.findMany({ where: { removed: false }, select: { ratingKey: true, title: true } }))
      .filter(s => isJellyfinId(s.ratingKey));
    const showByTitle = new Map(jfShows.map(s => [normalizeTitle(s.title), s.ratingKey]));

    const jfEpisodes = (await prisma.plexEpisode.findMany({ where: { removed: false }, select: { ratingKey: true, showTitle: true, seasonIndex: true, index: true } }))
      .filter(e => isJellyfinId(e.ratingKey));
    const episodeBySxe = new Map(jfEpisodes.map(e => [`${normalizeTitle(e.showTitle)}|${e.seasonIndex}|${e.index}`, e.ratingKey]));

    const byGuid = (index, guids) => {
      for (const prefix of ['imdb://', 'tmdb://', 'tvdb://']) {
        const g = guids.find(x => x.id_value.startsWith(prefix));
        if (g && index.has(g.id_value)) return index.get(g.id_value);
      }
      return null;
    };

    for (const m of legacyMovies) {
      const key = byGuid(guidIndex.movie, m.guids) || movieByTitleYear.get(`${normalizeTitle(m.title)}|${m.year ?? ''}`);
      if (key) map.set(m.ratingKey, { key, type: 'movie' });
    }
    for (const s of legacyShows) {
      const key = byGuid(guidIndex.show, s.guids) || showByTitle.get(normalizeTitle(s.title));
      if (key) map.set(s.ratingKey, { key, type: 'show' });
    }
    for (const e of legacyEpisodes) {
      const key = episodeBySxe.get(`${normalizeTitle(e.showTitle)}|${e.seasonIndex}|${e.index}`) || byGuid(guidIndex.episode, e.guids);
      if (key) map.set(e.ratingKey, { key, type: 'episode' });
    }

    const legacySeasons = (await prisma.plexSeason.findMany({ select: { ratingKey: true } })).filter(s => !isJellyfinId(s.ratingKey));
    return {
      map,
      legacy: {
        movies: legacyMovies.map(m => m.ratingKey),
        shows: legacyShows.map(s => s.ratingKey),
        episodes: legacyEpisodes.map(e => e.ratingKey),
        seasons: legacySeasons.map(s => s.ratingKey)
      }
    };
  }

  async migrateLegacyPlexVideo() {
    const { map, legacy } = await this.buildLegacyKeyMap();
    const total = legacy.movies.length + legacy.shows.length + legacy.episodes.length + legacy.seasons.length;
    const result = { remappedCustomOrderItems: 0, remappedWatchLogs: 0, purgedMovies: 0, purgedShows: 0, purgedSeasons: 0, purgedEpisodes: 0, unmatched: 0 };
    if (total === 0) return result;
    console.log(`🔁 Migrating legacy Plex video rows to Jellyfin (${legacy.movies.length} movies, ${legacy.shows.length} shows, ${legacy.episodes.length} episodes)`);

    const coItems = await prisma.customOrderItem.findMany({ where: { plexKey: { not: null } }, select: { id: true, plexKey: true, sourceProvider: true } });
    for (const item of coItems) {
      if (isJellyfinId(item.plexKey) || item.plexKey.startsWith('tvdb-')) continue;
      const target = map.get(item.plexKey);
      if (target) {
        await prisma.customOrderItem.update({ where: { id: item.id }, data: { plexKey: target.key, sourceProvider: 'jellyfin' } });
        result.remappedCustomOrderItems++;
      } else if (/^\d+$/.test(item.plexKey)) {
        result.unmatched++;
        console.warn(`⚠️ No Jellyfin match for custom order item ${item.id} (legacy Plex key ${item.plexKey})`);
      }
    }
    const logs = await prisma.watchLog.findMany({ where: { plexKey: { not: null } }, select: { id: true, plexKey: true } });
    for (const log of logs) {
      if (isJellyfinId(log.plexKey)) continue;
      const target = map.get(log.plexKey);
      if (target) {
        await prisma.watchLog.update({ where: { id: log.id }, data: { plexKey: target.key } });
        result.remappedWatchLogs++;
      }
    }

    // Purge the legacy Plex video rows and their child data
    const childTables = {
      movie: ['plexDirector', 'plexGenre', 'plexProducer', 'plexWriter', 'plexRole', 'plexCountry', 'plexRating', 'plexGuid', 'plexMedia', 'plexImage', 'plexUltraBlurColor', 'plexLabel'],
      episode: ['plexDirector', 'plexWriter', 'plexRole', 'plexRating', 'plexGuid', 'plexMedia', 'plexImage', 'plexUltraBlurColor'],
      season: ['plexGuid', 'plexImage', 'plexUltraBlurColor'],
      show: ['plexGenre', 'plexGuid', 'plexImage', 'plexUltraBlurColor', 'plexLabel']
    };
    // Set-based deletes: Jellyfin ids are always 32 chars, legacy Plex keys never are.
    // (Per-batch deleteMany would full-scan the large unindexed child tables repeatedly.)
    const purge = async (keys, type, parentTable) => {
      if (!keys.length) return 0;
      const legacyKeys = `SELECT "ratingKey" FROM "${parentTable}" WHERE length("ratingKey") <> 32`;
      for (const model of childTables[type]) {
        const table = model.charAt(0).toUpperCase() + model.slice(1);
        try {
          await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "${type}RatingKey" IN (${legacyKeys})`);
        } catch (error) {
          console.warn(`Failed purging ${table} for legacy ${type}s:`, error.message);
        }
      }
      return prisma.$executeRawUnsafe(`DELETE FROM "${parentTable}" WHERE length("ratingKey") <> 32`);
    };
    result.purgedEpisodes = await purge(legacy.episodes, 'episode', 'PlexEpisode');
    result.purgedSeasons = await purge(legacy.seasons, 'season', 'PlexSeason');
    result.purgedShows = await purge(legacy.shows, 'show', 'PlexTVShow');
    result.purgedMovies = await purge(legacy.movies, 'movie', 'PlexMovie');

    // Remove legacy Plex video library sections that no longer have content
    const legacySections = await prisma.plexLibrarySection.findMany({ where: { type: { in: ['movie', 'show'] } } });
    for (const section of legacySections) {
      if (section.agent === 'jellyfin') continue;
      const [movies, shows] = await Promise.all([
        prisma.plexMovie.count({ where: { sectionKey: section.sectionKey } }),
        prisma.plexTVShow.count({ where: { sectionKey: section.sectionKey } })
      ]);
      if (movies === 0 && shows === 0) {
        await prisma.plexLibrarySection.delete({ where: { sectionKey: section.sectionKey } }).catch(() => {});
      }
    }

    console.log('✅ Legacy Plex video migration complete:', result);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Removal marking
  // ---------------------------------------------------------------------------

  async markRemoved(model, seenSet) {
    const rows = await model.findMany({ where: { removed: false }, select: { ratingKey: true } });
    const missing = rows.map(r => r.ratingKey).filter(k => isJellyfinId(k) && !seenSet.has(k));
    for (const batch of chunk(missing, 900)) {
      await model.updateMany({ where: { ratingKey: { in: batch } }, data: { removed: true } });
    }
    return missing.length;
  }

  // ---------------------------------------------------------------------------
  // Custom order reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Heal missing library keys on custom order movie/episode items (metadata
   * match) and mark items watched when Jellyfin reports them as played.
   */
  async reconcileCustomOrderWatchStates() {
    try {
      let changed = 0;
      const candidates = await prisma.customOrderItem.findMany({
        where: { mediaType: { in: ['episode', 'movie'] } },
        select: { id: true, mediaType: true, plexKey: true, seriesTitle: true, seasonNumber: true, episodeNumber: true, title: true, isWatched: true }
      });
      // Items whose key is missing, a TVDB placeholder, a legacy Plex key, or a
      // Jellyfin id that no longer exists in the library need relinking.
      const liveKeys = { episode: new Set(), movie: new Set() };
      const jfKeys = type => candidates.filter(i => i.mediaType === type && i.plexKey && isJellyfinId(i.plexKey)).map(i => i.plexKey);
      for (const batch of chunk(jfKeys('episode'), 900)) {
        (await prisma.plexEpisode.findMany({ where: { ratingKey: { in: batch }, removed: false }, select: { ratingKey: true } })).forEach(r => liveKeys.episode.add(r.ratingKey));
      }
      for (const batch of chunk(jfKeys('movie'), 900)) {
        (await prisma.plexMovie.findMany({ where: { ratingKey: { in: batch }, removed: false }, select: { ratingKey: true } })).forEach(r => liveKeys.movie.add(r.ratingKey));
      }
      const unkeyed = candidates.filter(i => !i.plexKey || !liveKeys[i.mediaType].has(i.plexKey));
      if (unkeyed.length) {
        const episodes = await prisma.plexEpisode.findMany({ where: { removed: false }, select: { ratingKey: true, showTitle: true, seasonIndex: true, index: true, viewCount: true } });
        const epIndex = new Map(episodes.map(e => [`${normalizeTitle(e.showTitle)}|${e.seasonIndex}|${e.index}`, e]));
        const movies = await prisma.plexMovie.findMany({ where: { removed: false }, select: { ratingKey: true, title: true, viewCount: true } });
        const movieIndex = new Map();
        for (const m of movies) {
          const k = normalizeTitle(m.title);
          if (!movieIndex.has(k)) movieIndex.set(k, m);
        }
        for (const item of unkeyed) {
          let match = null;
          if (item.mediaType === 'episode' && item.seriesTitle && item.seasonNumber != null && item.episodeNumber != null) {
            match = epIndex.get(`${normalizeTitle(item.seriesTitle)}|${item.seasonNumber}|${item.episodeNumber}`);
          } else if (item.mediaType === 'movie' && item.title) {
            match = movieIndex.get(normalizeTitle(item.title));
          }
          if (match) {
            if (item.plexKey && item.plexKey !== match.ratingKey) {
              console.log(`🔗 Relinked custom order item ${item.id} (${item.mediaType} "${item.title}") from ${item.plexKey} to Jellyfin ${match.ratingKey}`);
            }
            await prisma.customOrderItem.update({
              where: { id: item.id },
              data: {
                plexKey: match.ratingKey,
                sourceProvider: 'jellyfin',
                ...(!item.isWatched && match.viewCount > 0 ? { isWatched: true } : {})
              }
            });
            changed++;
          }
        }
      }

      const unwatched = await prisma.customOrderItem.findMany({
        where: { isWatched: false, plexKey: { not: null }, mediaType: { in: ['episode', 'movie'] } },
        select: { id: true, plexKey: true, mediaType: true }
      });
      const epKeys = unwatched.filter(i => i.mediaType === 'episode').map(i => i.plexKey);
      const mvKeys = unwatched.filter(i => i.mediaType === 'movie').map(i => i.plexKey);
      const watched = new Set();
      for (const batch of chunk(epKeys, 900)) {
        (await prisma.plexEpisode.findMany({ where: { ratingKey: { in: batch }, viewCount: { gt: 0 } }, select: { ratingKey: true } })).forEach(r => watched.add(`episode:${r.ratingKey}`));
      }
      for (const batch of chunk(mvKeys, 900)) {
        (await prisma.plexMovie.findMany({ where: { ratingKey: { in: batch }, viewCount: { gt: 0 } }, select: { ratingKey: true } })).forEach(r => watched.add(`movie:${r.ratingKey}`));
      }
      const toMark = unwatched.filter(i => watched.has(`${i.mediaType}:${i.plexKey}`)).map(i => i.id);
      if (toMark.length) {
        await prisma.customOrderItem.updateMany({ where: { id: { in: toMark } }, data: { isWatched: true } });
      }
      return changed + toMark.length;
    } catch (error) {
      console.warn('Custom order reconciliation failed:', error.message);
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  async fullSync(trigger = 'manual') {
    if (this.isSyncing) {
      throw new Error('A Jellyfin sync is already running');
    }
    this.isSyncing = true;
    const startTime = Date.now();
    const startedAt = new Date(startTime);
    const newStats = () => ({ created: 0, updated: 0, total: 0 });
    const stats = { movies: newStats(), shows: newStats(), seasons: newStats(), episodes: newStats() };
    const seen = { movies: new Set(), shows: new Set(), seasons: new Set(), episodes: new Set() };

    try {
      console.log('🟣 Starting Jellyfin library sync...');
      const libraries = await this.syncLibraries();
      if (!libraries.length) throw new Error('No Jellyfin movie or TV libraries found');

      console.log('📚 Loading Jellyfin collections...');
      const collectionGraph = await this.fetchCollectionGraph();
      const memberships = JellyfinSyncService.computeFlattenedMemberships(collectionGraph);

      await this.syncMovies(libraries, memberships, stats, seen);
      await this.syncTV(libraries, memberships, stats, seen);

      const collectionResult = await this.persistCollections(collectionGraph);

      // Clear collection lists on items that are no longer in any collection
      await prisma.plexMovie.updateMany({ where: { ratingKey: { notIn: [...memberships.keys()].filter(k => seen.movies.has(k)) }, collections: { not: null } }, data: { collections: null } }).catch(() => {});
      await prisma.plexTVShow.updateMany({ where: { ratingKey: { notIn: [...memberships.keys()].filter(k => seen.shows.has(k)) }, collections: { not: null } }, data: { collections: null } }).catch(() => {});

      const cleanup = {
        movies: await this.markRemoved(prisma.plexMovie, seen.movies),
        shows: await this.markRemoved(prisma.plexTVShow, seen.shows),
        seasons: await this.markRemoved(prisma.plexSeason, seen.seasons),
        episodes: await this.markRemoved(prisma.plexEpisode, seen.episodes)
      };

      let legacy = null;
      if (seen.movies.size + seen.episodes.size > 0) {
        legacy = await this.migrateLegacyPlexVideo();
      }

      const reconciled = await this.reconcileCustomOrderWatchStates();

      try {
        const ArtworkCacheService = require('./artworkCacheService');
        await new ArtworkCacheService().refreshEpisodeSeasonArtwork();
      } catch (error) {
        console.warn('Failed to refresh custom order season artwork:', error.message);
      }

      const durationSeconds = (Date.now() - startTime) / 1000;
      const summary = `Libraries: ${libraries.length}, Movies: ${stats.movies.total} (+${stats.movies.created}/~${stats.movies.updated}), Shows: ${stats.shows.total} (+${stats.shows.created}/~${stats.shows.updated}), Seasons: ${stats.seasons.total}, Episodes: ${stats.episodes.total} (+${stats.episodes.created}/~${stats.episodes.updated}), Collections: ${collectionResult.collections}, Removed: movies ${cleanup.movies}, shows ${cleanup.shows}, episodes ${cleanup.episodes}, Custom order reconciled: ${reconciled}`;
      console.log(`✅ Jellyfin sync complete in ${durationSeconds}s - ${summary}`);

      const result = {
        success: true,
        provider: 'jellyfin',
        libraries: libraries.map(l => ({ id: l.ItemId, name: l.Name, type: l.CollectionType })),
        sections: libraries.length,
        totalItems: stats.movies.total + stats.shows.total + stats.episodes.total,
        added: stats.movies.created + stats.shows.created + stats.seasons.created + stats.episodes.created,
        updated: stats.movies.updated + stats.shows.updated + stats.seasons.updated + stats.episodes.updated,
        removed: cleanup.movies + cleanup.shows + cleanup.seasons + cleanup.episodes,
        totalMovies: stats.movies.total,
        totalShows: stats.shows.total,
        totalSeasons: stats.seasons.total,
        totalEpisodes: stats.episodes.total,
        stats,
        collections: collectionResult,
        cleanup,
        legacyMigration: legacy,
        customOrderReconciled: reconciled,
        duration: `${durationSeconds}s`,
        timestamp: new Date().toISOString()
      };

      await prisma.plexSyncRunLog.create({
        data: {
          provider: 'jellyfin',
          startedAt,
          completedAt: new Date(),
          durationSeconds,
          trigger,
          success: true,
          sections: libraries.length,
          totalShows: stats.shows.total,
          totalMovies: stats.movies.total,
          totalArtists: 0,
          cleanupEpisodes: cleanup.episodes,
          cleanupSeasons: cleanup.seasons,
          cleanupShows: cleanup.shows,
          cleanupMovies: cleanup.movies,
          summary
        }
      }).catch(err => console.warn('Failed to persist Jellyfin sync run log:', err.message));

      this.lastResult = result;
      return result;
    } catch (error) {
      console.error('❌ Jellyfin sync failed:', error);
      await prisma.plexSyncRunLog.create({
        data: {
          provider: 'jellyfin',
          startedAt,
          completedAt: new Date(),
          durationSeconds: (Date.now() - startTime) / 1000,
          trigger,
          success: false,
          summary: 'Jellyfin sync failed before completion',
          error: error.message
        }
      }).catch(() => {});
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  async getSyncStatus() {
    const [sections, movies, shows, seasons, episodes, collections, lastRun] = await Promise.all([
      prisma.plexLibrarySection.findMany({ where: { agent: 'jellyfin' }, select: { sectionKey: true, title: true, type: true } }),
      prisma.plexMovie.count({ where: { removed: false } }),
      prisma.plexTVShow.count({ where: { removed: false } }),
      prisma.plexSeason.count({ where: { removed: false } }),
      prisma.plexEpisode.count({ where: { removed: false } }),
      prisma.mediaCollection.count({ where: { removed: false } }),
      prisma.plexSyncRunLog.findFirst({ where: { provider: 'jellyfin' }, orderBy: { startedAt: 'desc' } })
    ]);
    return {
      provider: 'jellyfin',
      isSyncing: this.isSyncing,
      sections: sections.length,
      libraries: sections,
      movies,
      shows,
      seasons,
      episodes,
      collections,
      lastSync: lastRun?.completedAt || null,
      lastRun
    };
  }
}

const instance = new JellyfinSyncService();
module.exports = instance;
module.exports.JellyfinSyncService = JellyfinSyncService;
