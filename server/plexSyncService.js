// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client

class PlexSyncService {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.plexUrl = null;
    this.plexToken = null;
    this.detailFetchConcurrency = Math.max(1, parseInt(process.env.PLEX_SYNC_DETAIL_CONCURRENCY || '6', 10));
    this.childSyncConcurrency = Math.max(1, parseInt(process.env.PLEX_SYNC_CHILD_CONCURRENCY || '4', 10));
  }

  // Helper function to handle database timeout/connection errors
  async handleDatabaseError(error, operation, itemName, retryCallback) {
    const isDatabaseTimeout = error.code === 'P1008' || // SQLite/Database timeout
                              error.code === 'P1017' || // PostgreSQL connection timeout
                              error.code === 'P2024' || // Connection timeout
                              error.message?.includes('timeout') ||
                              error.message?.includes('connection') ||
                              error.message?.includes('ECONNRESET');
    
    if (isDatabaseTimeout) {
      console.warn(`Database timeout/connection error for ${operation} ${itemName}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await retryCallback();
    } else {
      throw error;
    }
  }

  async ensureConfigLoaded() {
    if (!this.plexUrl || !this.plexToken) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.plexUrl = settings?.plexUrl;
      this.plexToken = settings?.plexToken;
      
      if (!this.plexToken) {
        throw new Error('Plex token not configured. Please set it in the Settings page.');
      }
      if (!this.plexUrl) {
        throw new Error('Plex URL not configured. Please set it in the Settings page.');
      }
    }
  }

  async makeRequest(endpoint) {
    await this.ensureConfigLoaded();
    
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.plexUrl}${endpoint}${separator}X-Plex-Token=${this.plexToken}`;
    console.log(`Making Plex request to: ${url}`);
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      let response;
      try {
        response = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
      } catch (fetchError) {
        clearTimeout(timeout);
        if (attempt < maxRetries && (fetchError.code === 'ECONNRESET' || fetchError.type === 'system')) {
          console.warn(`Plex request failed (attempt ${attempt}/${maxRetries}): ${fetchError.message}. Retrying in ${attempt * 2}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        throw fetchError;
      } finally {
        clearTimeout(timeout);
      }
      
      if (!response.ok) {
        throw new Error(`Plex API request failed: ${response.status} ${response.statusText}`);
      }
      
      const jsonData = await response.json();
      return jsonData;
    }
  }

  parsePlexTimestamp(value) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  getNullableInt(value) {
    const parsedValue = this.parsePlexTimestamp(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  isPlexWatched(viewCount, lastViewedAt) {
    const numericViewCount = this.getNullableInt(viewCount);
    const numericLastViewedAt = this.getNullableInt(lastViewedAt);
    return (numericViewCount ?? 0) > 0 || (numericLastViewedAt ?? 0) > 0;
  }

  normalizeCollectionValue(collectionValue) {
    if (!collectionValue) {
      return null;
    }

    let collectionArray = [];

    if (Array.isArray(collectionValue)) {
      collectionArray = collectionValue;
    } else if (typeof collectionValue === 'string') {
      try {
        const parsed = JSON.parse(collectionValue);
        collectionArray = Array.isArray(parsed) ? parsed : [];
      } catch (_error) {
        collectionArray = [];
      }
    }

    const normalized = collectionArray
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }

        if (entry && typeof entry === 'object') {
          return String(entry.tag || entry.title || '').trim();
        }

        return '';
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return normalized.length ? JSON.stringify(normalized) : null;
  }

  isUnixTimestampCurrent(localValue, plexValue) {
    const localTimestamp = Number.parseInt(localValue, 10);
    const plexTimestamp = this.parsePlexTimestamp(plexValue);
    return Number.isFinite(localTimestamp) && Number.isFinite(plexTimestamp) && localTimestamp === plexTimestamp;
  }

  isDateTimestampCurrent(localValue, plexValue) {
    const plexTimestamp = this.parsePlexTimestamp(plexValue);
    if (!localValue || !Number.isFinite(plexTimestamp)) {
      return false;
    }

    const localTimestamp = Math.floor(new Date(localValue).getTime() / 1000);
    return Number.isFinite(localTimestamp) && localTimestamp === plexTimestamp;
  }

  async mapWithConcurrency(items, limit, worker) {
    if (!items.length) {
      return [];
    }

    const results = new Array(items.length);
    let nextIndex = 0;

    const runWorker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    };

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
  }

  async fetchDetailedMetadataBatch(items, itemLabel) {
    if (!items.length) {
      return new Map();
    }

    const detailedEntries = await this.mapWithConcurrency(items, this.detailFetchConcurrency, async (item) => {
      try {
        const detailData = await this.makeRequest(`/library/metadata/${item.ratingKey}`);
        return [item.ratingKey, detailData.MediaContainer?.Metadata?.[0] || item];
      } catch (error) {
        console.warn(`Failed to fetch detailed metadata for ${itemLabel} ${item.title} (${item.ratingKey}):`, error.message);
        return [item.ratingKey, item];
      }
    });

    return new Map(detailedEntries);
  }  async syncLibrarySections() {
    console.log('Syncing Plex library sections...');
    
    try {
      const data = await this.makeRequest('/library/sections');
      const sections = data.MediaContainer?.Directory || [];
      
      const syncedSections = [];
      
      for (const section of sections) {        
        // Sync TV, Movie, and Music sections
        if (section.type === 'show' || section.type === 'movie' || section.type === 'artist') {        const sectionData = {
          sectionKey: section.key,
          title: section.title,
          type: section.type,
          // Additional fields from Plex API
          agent: section.agent || null,
          allowSync: (section.allowSync && !isNaN(parseInt(section.allowSync))) ? parseInt(section.allowSync) : null,
          art: section.art || null,
          composite: section.composite || null,
          content: typeof section.content === 'string' ? section.content : (section.content ? 'true' : null),
          contentChangedAt: section.contentChangedAt ? parseInt(section.contentChangedAt) : null,
          createdAt_plex: section.createdAt ? parseInt(section.createdAt) : null,
          directory: typeof section.directory === 'string' ? section.directory : (section.directory ? 'true' : null),
          filters: section.filters ? (typeof section.filters === 'string' ? section.filters : JSON.stringify(section.filters)) : null,
          hidden: section.hidden ? parseInt(section.hidden) : null,
          language: section.language || null,
          refreshing: section.refreshing ? parseInt(section.refreshing) : null,
          scannedAt: section.scannedAt ? parseInt(section.scannedAt) : null,
          scanner: section.scanner || null,
          thumb: section.thumb || null,
          updatedAt_plex: section.updatedAt ? parseInt(section.updatedAt) : null,
          uuid: section.uuid || null
        };
          
          const syncedSection = await prisma.plexLibrarySection.upsert({
            where: { sectionKey: section.key },
            update: sectionData,
            create: sectionData
          });
          
          syncedSections.push(syncedSection);
          console.log(`Synced section: ${section.title} (${section.type})`);
        }
      }
      
      return syncedSections;
    } catch (error) {
      console.error('Error syncing library sections:', error);
      throw error;
    }
  }async syncTVShows(sectionKey, watchStatusReconciled = null) {
    console.log(`Syncing TV shows for section ${sectionKey}...`);
    
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all?type=2`);
      const shows = data.MediaContainer?.Metadata || [];
      const existingShows = await prisma.plexTVShow.findMany({
        where: {
          sectionKey,
          ratingKey: { in: shows.map(show => show.ratingKey) }
        },
        select: {
          ratingKey: true,
          updatedAt_plex: true,
          collections: true,
          viewedLeafCount: true,
          viewCount: true,
          lastViewedAt: true
        }
      });
      const existingShowMap = new Map(existingShows.map(show => [show.ratingKey, show]));
      const showsNeedingRefresh = shows.filter(show => !this.isUnixTimestampCurrent(existingShowMap.get(show.ratingKey)?.updatedAt_plex, show.updatedAt));
      const detailedShowMap = await this.fetchDetailedMetadataBatch(showsNeedingRefresh, 'show');
      
      const syncedShows = [];
      
      for (const show of shows) {
        const shouldRefreshShow = !this.isUnixTimestampCurrent(existingShowMap.get(show.ratingKey)?.updatedAt_plex, show.updatedAt);
        const detailedShow = detailedShowMap.get(show.ratingKey) || show;
        const showData = {
          ratingKey: detailedShow.ratingKey,
          title: detailedShow.title,
          year: detailedShow.year ? parseInt(detailedShow.year) : null,
          summary: detailedShow.summary || null,
          thumb: detailedShow.thumb || null,
          art: detailedShow.art || null,
          leafCount: detailedShow.leafCount ? parseInt(detailedShow.leafCount) : null,
          viewedLeafCount: detailedShow.viewedLeafCount ? parseInt(detailedShow.viewedLeafCount) : null,
          addedAt: detailedShow.addedAt ? parseInt(detailedShow.addedAt) : null,
          updatedAt_plex: detailedShow.updatedAt ? parseInt(detailedShow.updatedAt) : null,
          collections: detailedShow.Collection ? JSON.stringify(detailedShow.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields from Plex API
          childCount: detailedShow.childCount ? parseInt(detailedShow.childCount) : null,
          guid: detailedShow.guid || null,
          index: detailedShow.index ? parseInt(detailedShow.index) : null,
          key: detailedShow.key || null,
          lastViewedAt: detailedShow.lastViewedAt ? parseInt(detailedShow.lastViewedAt) : null,
          skipCount: detailedShow.skipCount ? parseInt(detailedShow.skipCount) : null,
          type: detailedShow.type || null,
          viewCount: detailedShow.viewCount ? parseInt(detailedShow.viewCount) : null,
          sectionKey: sectionKey,
          lastSyncedAt: new Date()
        };

        const summaryHasCollections = Object.prototype.hasOwnProperty.call(show, 'Collection');
        const summaryCollections = summaryHasCollections
          ? this.normalizeCollectionValue(show.Collection)
          : null;
        const existingCollections = this.normalizeCollectionValue(existingShowMap.get(show.ratingKey)?.collections);
        const shouldRefreshCollectionsOnly = !shouldRefreshShow && summaryHasCollections && summaryCollections !== existingCollections;

        const summaryViewedLeafCount = this.getNullableInt(show.viewedLeafCount);
        const summaryViewCount = this.getNullableInt(show.viewCount);
        const summaryLastViewedAt = this.getNullableInt(show.lastViewedAt);
        const existingShow = existingShowMap.get(show.ratingKey);
        const shouldRefreshWatchOnly = !shouldRefreshShow && (
          (existingShow?.viewedLeafCount ?? null) !== summaryViewedLeafCount ||
          (existingShow?.viewCount ?? null) !== summaryViewCount ||
          (existingShow?.lastViewedAt ?? null) !== summaryLastViewedAt
        );

        if (shouldRefreshShow) {
          const syncedShow = await prisma.plexTVShow.upsert({
            where: { ratingKey: detailedShow.ratingKey },
            update: showData,
            create: showData
          });
          await this.clearComplexFields(detailedShow.ratingKey, 'show');
          await this.syncComplexFields(detailedShow, 'show', detailedShow.ratingKey);
          syncedShows.push(syncedShow);
        } else if (shouldRefreshCollectionsOnly) {
          await prisma.plexTVShow.update({
            where: { ratingKey: show.ratingKey },
            data: {
              collections: summaryCollections,
              lastSyncedAt: new Date()
            }
          });
          console.log(`📚 Updated collections for TV show: ${show.title}`);
        } else if (shouldRefreshWatchOnly) {
          await prisma.plexTVShow.update({
            where: { ratingKey: show.ratingKey },
            data: {
              viewedLeafCount: summaryViewedLeafCount,
              viewCount: summaryViewCount,
              lastViewedAt: summaryLastViewedAt,
              lastSyncedAt: new Date()
            }
          });
          console.log(`👁️ Updated watch status for TV show: ${show.title}`);
          if (watchStatusReconciled) {
            watchStatusReconciled.shows += 1;
            watchStatusReconciled.total += 1;
          }
        }
        
        // Sync seasons for this show
        await this.syncSeasons(show.ratingKey, detailedShow.title || show.title, watchStatusReconciled);
      }
      
      console.log(`Synced ${syncedShows.length} TV shows`);
      return syncedShows;
    } catch (error) {
      console.error('Error syncing TV shows:', error);
      throw error;
    }
  }  async syncSeasons(showRatingKey, showTitle = null, watchStatusReconciled = null) {
    try {
      const data = await this.makeRequest(`/library/metadata/${showRatingKey}/children`);
      const seasons = data.MediaContainer?.Metadata || [];
      const existingSeasons = await prisma.plexSeason.findMany({
        where: { ratingKey: { in: seasons.map(season => season.ratingKey) } },
        select: {
          ratingKey: true,
          updatedAt_plex: true,
          viewedLeafCount: true,
          viewCount: true,
          lastViewedAt: true
        }
      });
      const existingSeasonMap = new Map(existingSeasons.map(season => [season.ratingKey, season]));
      const seasonsNeedingRefresh = seasons.filter(season => !this.isUnixTimestampCurrent(existingSeasonMap.get(season.ratingKey)?.updatedAt_plex, season.updatedAt));
      const detailedSeasonMap = await this.fetchDetailedMetadataBatch(seasonsNeedingRefresh, 'season');

      for (const season of seasons) {
        const shouldRefreshSeason = !this.isUnixTimestampCurrent(existingSeasonMap.get(season.ratingKey)?.updatedAt_plex, season.updatedAt);
        const detailedSeason = detailedSeasonMap.get(season.ratingKey) || season;

        const seasonData = {
          ratingKey: detailedSeason.ratingKey,
          title: detailedSeason.title,
          index: detailedSeason.index ? parseInt(detailedSeason.index) : 0,
          showRatingKey: showRatingKey,
          leafCount: detailedSeason.leafCount ? parseInt(detailedSeason.leafCount) : null,
          viewedLeafCount: detailedSeason.viewedLeafCount ? parseInt(detailedSeason.viewedLeafCount) : null,
          // Additional fields from Plex API
          addedAt: detailedSeason.addedAt ? parseInt(detailedSeason.addedAt) : null,
          guid: detailedSeason.guid || null,
          key: detailedSeason.key || null,
          lastViewedAt: detailedSeason.lastViewedAt ? parseInt(detailedSeason.lastViewedAt) : null,
          librarySectionID: detailedSeason.librarySectionID ? parseInt(detailedSeason.librarySectionID) : null,
          librarySectionKey: detailedSeason.librarySectionKey || null,
          librarySectionTitle: detailedSeason.librarySectionTitle || null,
          parentGuid: detailedSeason.parentGuid || null,
          parentIndex: detailedSeason.parentIndex ? parseInt(detailedSeason.parentIndex) : null,
          parentKey: detailedSeason.parentKey || null,
          parentRatingKey: detailedSeason.parentRatingKey || null,
          parentThumb: detailedSeason.parentThumb || null,
          parentTitle: detailedSeason.parentTitle || null,
          skipCount: detailedSeason.skipCount ? parseInt(detailedSeason.skipCount) : null,
          summary: detailedSeason.summary || null,
          thumb: detailedSeason.thumb || null,
          type: detailedSeason.type || null,
          updatedAt_plex: detailedSeason.updatedAt ? parseInt(detailedSeason.updatedAt) : null,
          viewCount: detailedSeason.viewCount ? parseInt(detailedSeason.viewCount) : null
        };

        const summaryViewedLeafCount = this.getNullableInt(season.viewedLeafCount);
        const summaryViewCount = this.getNullableInt(season.viewCount);
        const summaryLastViewedAt = this.getNullableInt(season.lastViewedAt);
        const existingSeason = existingSeasonMap.get(season.ratingKey);
        const shouldRefreshWatchOnly = !shouldRefreshSeason && (
          (existingSeason?.viewedLeafCount ?? null) !== summaryViewedLeafCount ||
          (existingSeason?.viewCount ?? null) !== summaryViewCount ||
          (existingSeason?.lastViewedAt ?? null) !== summaryLastViewedAt
        );

        if (shouldRefreshSeason) {
          await prisma.plexSeason.upsert({
            where: { ratingKey: detailedSeason.ratingKey },
            update: seasonData,
            create: seasonData
          });
          await this.clearComplexFields(detailedSeason.ratingKey, 'season');
          await this.syncComplexFields(detailedSeason, 'season', detailedSeason.ratingKey);
        } else if (shouldRefreshWatchOnly) {
          await prisma.plexSeason.update({
            where: { ratingKey: season.ratingKey },
            data: {
              viewedLeafCount: summaryViewedLeafCount,
              viewCount: summaryViewCount,
              lastViewedAt: summaryLastViewedAt
            }
          });
          console.log(`👁️ Updated watch status for season: ${detailedSeason.title}`);
          if (watchStatusReconciled) {
            watchStatusReconciled.seasons += 1;
            watchStatusReconciled.total += 1;
          }
        }
        
        // Sync episodes for this season
        await this.syncEpisodes(detailedSeason.ratingKey, showRatingKey, showTitle, watchStatusReconciled);
      }
    } catch (error) {
      console.error(`Error syncing seasons for show ${showRatingKey}:`, error);
      throw error;
    }
  }
  async syncEpisodes(seasonRatingKey, showRatingKey, showTitle = null, watchStatusReconciled = null) {
    try {
      const data = await this.makeRequest(`/library/metadata/${seasonRatingKey}/children`);
      const episodes = data.MediaContainer?.Metadata || [];
      const resolvedShowTitle = showTitle || (await prisma.plexTVShow.findUnique({
        where: { ratingKey: showRatingKey },
        select: { title: true }
      }))?.title || 'Unknown';
      const existingEpisodes = await prisma.plexEpisode.findMany({
        where: { ratingKey: { in: episodes.map(episode => episode.ratingKey) } },
        select: {
          ratingKey: true,
          updatedAt_plex: true,
          viewCount: true,
          lastViewedAt: true
        }
      });
      const existingEpisodeMap = new Map(existingEpisodes.map(episode => [episode.ratingKey, episode]));
      const episodesNeedingRefresh = episodes.filter(episode => !this.isUnixTimestampCurrent(existingEpisodeMap.get(episode.ratingKey)?.updatedAt_plex, episode.updatedAt));
      const detailedEpisodeMap = await this.fetchDetailedMetadataBatch(episodesNeedingRefresh, 'episode');

      for (const episode of episodes) {
        const shouldRefreshEpisode = !this.isUnixTimestampCurrent(existingEpisodeMap.get(episode.ratingKey)?.updatedAt_plex, episode.updatedAt);
        const detailedEpisode = detailedEpisodeMap.get(episode.ratingKey) || episode;

        const episodeData = {
          ratingKey: detailedEpisode.ratingKey,
          title: detailedEpisode.title,
          index: detailedEpisode.index ? parseInt(detailedEpisode.index) : 0,
          seasonIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : 0,
          showTitle: resolvedShowTitle,
          seasonRatingKey: seasonRatingKey,
          viewCount: detailedEpisode.viewCount ? parseInt(detailedEpisode.viewCount) : null,
          lastViewedAt: detailedEpisode.lastViewedAt ? parseInt(detailedEpisode.lastViewedAt) : null,
          addedAt: detailedEpisode.addedAt ? parseInt(detailedEpisode.addedAt) : null,
          originallyAvailableAt: detailedEpisode.originallyAvailableAt || null,
          summary: detailedEpisode.summary || null,
          thumb: detailedEpisode.thumb || null,
          // Additional fields from Plex API
          duration: detailedEpisode.duration ? parseInt(detailedEpisode.duration) : null,
          grandparentGuid: detailedEpisode.grandparentGuid || null,
          grandparentKey: detailedEpisode.grandparentKey || null,
          grandparentRatingKey: detailedEpisode.grandparentRatingKey || null,
          grandparentThumb: detailedEpisode.grandparentThumb || null,
          grandparentTitle: detailedEpisode.grandparentTitle || null,
          guid: detailedEpisode.guid || null,
          key: detailedEpisode.key || null,
          librarySectionID: detailedEpisode.librarySectionID ? parseInt(detailedEpisode.librarySectionID) : null,
          librarySectionKey: detailedEpisode.librarySectionKey || null,
          librarySectionTitle: detailedEpisode.librarySectionTitle || null,
          parentGuid: detailedEpisode.parentGuid || null,
          parentIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : null,
          parentKey: detailedEpisode.parentKey || null,
          parentRatingKey: detailedEpisode.parentRatingKey || null,
          parentThumb: detailedEpisode.parentThumb || null,
          parentTitle: detailedEpisode.parentTitle || null,
          skipCount: detailedEpisode.skipCount ? parseInt(detailedEpisode.skipCount) : null,
          titleSort: detailedEpisode.titleSort || null,
          type: detailedEpisode.type || null,
          updatedAt_plex: detailedEpisode.updatedAt ? parseInt(detailedEpisode.updatedAt) : null
        };

        const summaryViewCount = this.getNullableInt(episode.viewCount);
        const summaryLastViewedAt = this.getNullableInt(episode.lastViewedAt);
        const existingEpisode = existingEpisodeMap.get(episode.ratingKey);
        const shouldRefreshWatchOnly = !shouldRefreshEpisode && (
          (existingEpisode?.viewCount ?? null) !== summaryViewCount ||
          (existingEpisode?.lastViewedAt ?? null) !== summaryLastViewedAt
        );
        const shouldReconcileCustomOrderWatchState = this.isPlexWatched(detailedEpisode.viewCount ?? episode.viewCount, detailedEpisode.lastViewedAt ?? episode.lastViewedAt);

        if (shouldRefreshEpisode) {
          await prisma.plexEpisode.upsert({
            where: { ratingKey: episode.ratingKey },
            update: episodeData,
            create: episodeData
          });
          await this.clearComplexFields(detailedEpisode.ratingKey, 'episode');
          await this.syncComplexFields(detailedEpisode, 'episode', detailedEpisode.ratingKey);
          await reconcileCustomOrderWatchStateFromPlex(detailedEpisode.ratingKey, 'episode', shouldReconcileCustomOrderWatchState);
        } else if (shouldRefreshWatchOnly) {
          await prisma.plexEpisode.update({
            where: { ratingKey: episode.ratingKey },
            data: {
              viewCount: summaryViewCount,
              lastViewedAt: summaryLastViewedAt
            }
          });
          await reconcileCustomOrderWatchStateFromPlex(episode.ratingKey, 'episode', shouldReconcileCustomOrderWatchState);
          console.log(`👁️ Updated watch status for episode: ${resolvedShowTitle} S${episode.parentIndex || 0}E${episode.index || 0} - ${episode.title}`);
          if (watchStatusReconciled) {
            watchStatusReconciled.episodes += 1;
            watchStatusReconciled.total += 1;
          }
        }
      }
    } catch (error) {
      console.error(`Error syncing episodes for season ${seasonRatingKey}:`, error);
      throw error;
    }
  }  async syncMovies(sectionKey, watchStatusReconciled = null) {
    console.log(`Syncing movies for section ${sectionKey}...`);
    
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all?type=1`);
      const movies = data.MediaContainer?.Metadata || [];
      const existingMovies = await prisma.plexMovie.findMany({
        where: {
          sectionKey,
          ratingKey: { in: movies.map(movie => movie.ratingKey) }
        },
        select: {
          ratingKey: true,
          updatedAt_plex: true,
          collections: true,
          viewCount: true,
          lastViewedAt: true
        }
      });
      const existingMovieMap = new Map(existingMovies.map(movie => [movie.ratingKey, movie]));
      const moviesNeedingRefresh = movies.filter(movie => !this.isUnixTimestampCurrent(existingMovieMap.get(movie.ratingKey)?.updatedAt_plex, movie.updatedAt));
      const detailedMovieMap = await this.fetchDetailedMetadataBatch(moviesNeedingRefresh, 'movie');
      
      const syncedMovies = [];
      
      for (const movie of movies) {
        const shouldRefreshMovie = !this.isUnixTimestampCurrent(existingMovieMap.get(movie.ratingKey)?.updatedAt_plex, movie.updatedAt);
        const detailedMovie = detailedMovieMap.get(movie.ratingKey) || movie;
        const movieData = {
          ratingKey: detailedMovie.ratingKey,
          title: detailedMovie.title,
          year: detailedMovie.year ? parseInt(detailedMovie.year) : null,
          summary: detailedMovie.summary || null,
          thumb: detailedMovie.thumb || null,
          art: detailedMovie.art || null,
          viewCount: detailedMovie.viewCount ? parseInt(detailedMovie.viewCount) : null,
          lastViewedAt: detailedMovie.lastViewedAt ? parseInt(detailedMovie.lastViewedAt) : null,
          addedAt: detailedMovie.addedAt ? parseInt(detailedMovie.addedAt) : null,
          originallyAvailableAt: detailedMovie.originallyAvailableAt || null,
          updatedAt_plex: detailedMovie.updatedAt ? parseInt(detailedMovie.updatedAt) : null,
          collections: detailedMovie.Collection ? JSON.stringify(detailedMovie.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields from Plex API
          audienceRating: detailedMovie.audienceRating ? parseFloat(detailedMovie.audienceRating) : null,
          audienceRatingImage: detailedMovie.audienceRatingImage || null,
          chapterSource: detailedMovie.chapterSource || null,
          contentRating: detailedMovie.contentRating || null,
          duration: detailedMovie.duration ? parseInt(detailedMovie.duration) : null,
          guid: detailedMovie.guid || null,
          key: detailedMovie.key || null,
          librarySectionID: detailedMovie.librarySectionID ? parseInt(detailedMovie.librarySectionID) : null,
          librarySectionKey: detailedMovie.librarySectionKey || null,
          librarySectionTitle: detailedMovie.librarySectionTitle || null,
          primaryExtraKey: detailedMovie.primaryExtraKey || null,
          rating: detailedMovie.rating ? parseFloat(detailedMovie.rating) : null,
          ratingImage: detailedMovie.ratingImage || null,
          skipCount: detailedMovie.skipCount ? parseInt(detailedMovie.skipCount) : null,
          slug: detailedMovie.slug || null,
          studio: detailedMovie.studio || null,
          tagline: detailedMovie.tagline || null,
          titleSort: detailedMovie.titleSort || null,
          type: detailedMovie.type || null,
          sectionKey: sectionKey,
          lastSyncedAt: new Date()
        };

        const summaryHasCollections = Object.prototype.hasOwnProperty.call(movie, 'Collection');
        const summaryCollections = summaryHasCollections
          ? this.normalizeCollectionValue(movie.Collection)
          : null;
        const existingCollections = this.normalizeCollectionValue(existingMovieMap.get(movie.ratingKey)?.collections);
        const shouldRefreshCollectionsOnly = !shouldRefreshMovie && summaryHasCollections && summaryCollections !== existingCollections;

        const summaryViewCount = this.getNullableInt(movie.viewCount);
        const summaryLastViewedAt = this.getNullableInt(movie.lastViewedAt);
        const existingMovie = existingMovieMap.get(movie.ratingKey);
        const shouldRefreshWatchOnly = !shouldRefreshMovie && (
          (existingMovie?.viewCount ?? null) !== summaryViewCount ||
          (existingMovie?.lastViewedAt ?? null) !== summaryLastViewedAt
        );
        const shouldReconcileCustomOrderWatchState = this.isPlexWatched(detailedMovie.viewCount ?? movie.viewCount, detailedMovie.lastViewedAt ?? movie.lastViewedAt);

        if (shouldRefreshMovie) {
          const syncedMovie = await prisma.plexMovie.upsert({
            where: { ratingKey: detailedMovie.ratingKey },
            update: movieData,
            create: movieData
          });
          await this.clearComplexFields(detailedMovie.ratingKey, 'movie');
          await this.syncComplexFields(detailedMovie, 'movie', detailedMovie.ratingKey);
          await reconcileCustomOrderWatchStateFromPlex(detailedMovie.ratingKey, 'movie', shouldReconcileCustomOrderWatchState);
          syncedMovies.push(syncedMovie);
        } else if (shouldRefreshCollectionsOnly) {
          await prisma.plexMovie.update({
            where: { ratingKey: movie.ratingKey },
            data: {
              collections: summaryCollections,
              lastSyncedAt: new Date()
            }
          });
          console.log(`📚 Updated collections for movie: ${movie.title}`);
        } else if (shouldRefreshWatchOnly) {
          await prisma.plexMovie.update({
            where: { ratingKey: movie.ratingKey },
            data: {
              viewCount: summaryViewCount,
              lastViewedAt: summaryLastViewedAt,
              lastSyncedAt: new Date()
            }
          });
          await reconcileCustomOrderWatchStateFromPlex(movie.ratingKey, 'movie', shouldReconcileCustomOrderWatchState);
          console.log(`👁️ Updated watch status for movie: ${movie.title}`);
          if (watchStatusReconciled) {
            watchStatusReconciled.movies += 1;
            watchStatusReconciled.total += 1;
          }
        }
      }
      
      console.log(`Synced ${syncedMovies.length} movies`);
      return syncedMovies;
    } catch (error) {
      console.error('Error syncing movies:', error);
      throw error;
    }
  }

  // Helper methods to sync complex field data
  async syncComplexFields(item, itemType, ratingKey) {
    try {
      const createManyOperations = [];

      const directors = Array.isArray(item.Director) ? item.Director.map((director) => {
        const directorData = {
          tag: director.tag || director.title,
          filter: director.filter || null,
          tagKey: director.tagKey || null,
          thumb: director.thumb || null
        };
        if (itemType === 'movie') directorData.movieRatingKey = ratingKey;
        if (itemType === 'episode') directorData.episodeRatingKey = ratingKey;
        return directorData;
      }).filter(director => director.movieRatingKey || director.episodeRatingKey) : [];
      if (directors.length) createManyOperations.push(prisma.plexDirector.createMany({ data: directors }));

      const genres = Array.isArray(item.Genre) ? item.Genre.map((genre) => {
        const genreData = {
          tag: genre.tag || genre.title,
          filter: genre.filter || null,
          tagKey: genre.tagKey || null,
          thumb: genre.thumb || null
        };
        if (itemType === 'movie') genreData.movieRatingKey = ratingKey;
        if (itemType === 'show') genreData.showRatingKey = ratingKey;
        return genreData;
      }).filter(genre => genre.movieRatingKey || genre.showRatingKey) : [];
      if (genres.length) createManyOperations.push(prisma.plexGenre.createMany({ data: genres }));

      const producers = itemType === 'movie' && Array.isArray(item.Producer)
        ? item.Producer.map((producer) => ({
            movieRatingKey: ratingKey,
            tag: producer.tag || producer.title,
            filter: producer.filter || null,
            tagKey: producer.tagKey || null,
            thumb: producer.thumb || null
          }))
        : [];
      if (producers.length) createManyOperations.push(prisma.plexProducer.createMany({ data: producers }));

      const writers = Array.isArray(item.Writer) ? item.Writer.map((writer) => {
        const writerData = {
          tag: writer.tag || writer.title,
          filter: writer.filter || null,
          tagKey: writer.tagKey || null,
          thumb: writer.thumb || null
        };
        if (itemType === 'movie') writerData.movieRatingKey = ratingKey;
        if (itemType === 'episode') writerData.episodeRatingKey = ratingKey;
        return writerData;
      }).filter(writer => writer.movieRatingKey || writer.episodeRatingKey) : [];
      if (writers.length) createManyOperations.push(prisma.plexWriter.createMany({ data: writers }));

      const roles = Array.isArray(item.Role) ? item.Role.map((role) => {
        const roleData = {
          tag: role.tag || role.title,
          filter: role.filter || null,
          tagKey: role.tagKey || null,
          role: role.role || null,
          thumb: role.thumb || null
        };
        if (itemType === 'movie') roleData.movieRatingKey = ratingKey;
        if (itemType === 'episode') roleData.episodeRatingKey = ratingKey;
        return roleData;
      }).filter(role => role.movieRatingKey || role.episodeRatingKey) : [];
      if (roles.length) createManyOperations.push(prisma.plexRole.createMany({ data: roles }));

      const countries = itemType === 'movie' && Array.isArray(item.Country)
        ? item.Country.map((country) => ({
            movieRatingKey: ratingKey,
            tag: country.tag || country.title,
            filter: country.filter || null,
            tagKey: country.tagKey || null,
            thumb: country.thumb || null
          }))
        : [];
      if (countries.length) createManyOperations.push(prisma.plexCountry.createMany({ data: countries }));

      const ratings = Array.isArray(item.Rating) ? item.Rating.map((rating) => {
        const ratingData = {
          image: rating.image || null,
          value: rating.value ? parseFloat(rating.value) : null,
          type: rating.type || null
        };
        if (itemType === 'movie') ratingData.movieRatingKey = ratingKey;
        if (itemType === 'episode') ratingData.episodeRatingKey = ratingKey;
        return ratingData;
      }).filter(rating => rating.movieRatingKey || rating.episodeRatingKey) : [];
      if (ratings.length) createManyOperations.push(prisma.plexRating.createMany({ data: ratings }));

      const guids = Array.isArray(item.Guid) ? item.Guid.map((guid) => {
        const guidData = { id_value: guid.id || '' };
        if (itemType === 'movie') guidData.movieRatingKey = ratingKey;
        if (itemType === 'show') guidData.showRatingKey = ratingKey;
        if (itemType === 'season') guidData.seasonRatingKey = ratingKey;
        if (itemType === 'episode') guidData.episodeRatingKey = ratingKey;
        return guidData;
      }).filter(guid => guid.movieRatingKey || guid.showRatingKey || guid.seasonRatingKey || guid.episodeRatingKey) : [];
      if (guids.length) createManyOperations.push(prisma.plexGuid.createMany({ data: guids }));

      const mediaRows = Array.isArray(item.Media) ? item.Media.map((media) => {
        const mediaData = {
          id_value: media.id ? String(media.id) : null,
          duration: media.duration ? parseInt(media.duration) : null,
          bitrate: media.bitrate ? parseInt(media.bitrate) : null,
          width: media.width ? parseInt(media.width) : null,
          height: media.height ? parseInt(media.height) : null,
          aspectRatio: media.aspectRatio ? parseFloat(media.aspectRatio) : null,
          audioChannels: media.audioChannels ? parseInt(media.audioChannels) : null,
          audioCodec: media.audioCodec || null,
          videoCodec: media.videoCodec || null,
          videoResolution: media.videoResolution || null,
          container: media.container || null,
          videoFrameRate: media.videoFrameRate || null,
          optimizedForStreaming: media.optimizedForStreaming ? Boolean(media.optimizedForStreaming) : null,
          selected: media.selected ? Boolean(media.selected) : null
        };
        if (itemType === 'movie') mediaData.movieRatingKey = ratingKey;
        if (itemType === 'episode') mediaData.episodeRatingKey = ratingKey;
        return mediaData;
      }).filter(media => media.movieRatingKey || media.episodeRatingKey) : [];
      if (mediaRows.length) createManyOperations.push(prisma.plexMedia.createMany({ data: mediaRows }));

      const images = Array.isArray(item.Image) ? item.Image.map((image) => {
        const imageData = {
          alt: image.alt || null,
          type: image.type || null,
          url: image.url || null
        };
        if (itemType === 'movie') imageData.movieRatingKey = ratingKey;
        if (itemType === 'show') imageData.showRatingKey = ratingKey;
        if (itemType === 'season') imageData.seasonRatingKey = ratingKey;
        if (itemType === 'episode') imageData.episodeRatingKey = ratingKey;
        return imageData;
      }).filter(image => image.movieRatingKey || image.showRatingKey || image.seasonRatingKey || image.episodeRatingKey) : [];
      if (images.length) createManyOperations.push(prisma.plexImage.createMany({ data: images }));

      const labels = Array.isArray(item.Label) ? item.Label.map((label) => {
        const labelData = {
          tag: label.tag || label.title,
          filter: label.filter || null,
          tagKey: label.tagKey || null,
          thumb: label.thumb || null
        };
        if (itemType === 'movie') labelData.movieRatingKey = ratingKey;
        if (itemType === 'show') labelData.showRatingKey = ratingKey;
        return labelData;
      }).filter(label => label.movieRatingKey || label.showRatingKey) : [];
      if (labels.length) createManyOperations.push(prisma.plexLabel.createMany({ data: labels }));

      const blurColors = Array.isArray(item.UltraBlurColors) ? item.UltraBlurColors.map((colors) => {
        const colorData = {
          topLeft: colors.topLeft || null,
          topRight: colors.topRight || null,
          bottomLeft: colors.bottomLeft || null,
          bottomRight: colors.bottomRight || null
        };
        if (itemType === 'movie') colorData.movieRatingKey = ratingKey;
        if (itemType === 'show') colorData.showRatingKey = ratingKey;
        if (itemType === 'season') colorData.seasonRatingKey = ratingKey;
        if (itemType === 'episode') colorData.episodeRatingKey = ratingKey;
        return colorData;
      }).filter(color => color.movieRatingKey || color.showRatingKey || color.seasonRatingKey || color.episodeRatingKey) : [];
      if (blurColors.length) createManyOperations.push(prisma.plexUltraBlurColor.createMany({ data: blurColors }));

      await Promise.all(createManyOperations);
      
    } catch (error) {
      console.warn(`Failed to sync complex fields for ${itemType} ${ratingKey}:`, error.message);
      // Don't throw here - we want the main sync to continue even if complex fields fail
    }
  }
  async clearComplexFields(ratingKey, itemType) {
    try {
      // Clear existing complex field data before re-syncing
      if (itemType === 'movie') {
        await Promise.all([
          prisma.plexDirector.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexGenre.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexProducer.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexWriter.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexRole.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexCountry.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexRating.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexMedia.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexLabel.deleteMany({ where: { movieRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'show') {
        await Promise.all([
          prisma.plexGenre.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexLabel.deleteMany({ where: { showRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'season') {
        await Promise.all([
          prisma.plexGuid.deleteMany({ where: { seasonRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { seasonRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { seasonRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'episode') {
        await Promise.all([
          prisma.plexDirector.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexWriter.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexRole.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexRating.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexMedia.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { episodeRatingKey: ratingKey } })
        ]);
      }
    } catch (error) {
      console.warn(`Failed to clear complex fields for ${itemType} ${ratingKey}:`, error.message);
    }
  }

  async fullSync(trigger = 'manual') {
    console.log('Starting full Plex library sync...');
    const startTime = Date.now();
    const startedAt = new Date(startTime);
    
    try {
      // Step 1: Sync library sections
      const sections = await this.syncLibrarySections();
      
      let totalShows = 0;
      let totalMovies = 0;
      let totalArtists = 0;
      const watchStatusReconciled = {
        shows: 0,
        seasons: 0,
        episodes: 0,
        movies: 0,
        total: 0
      };
      
      // Step 2: Sync content for each section
      for (const section of sections) {
        if (section.type === 'show') {
          const shows = await this.syncTVShows(section.sectionKey, watchStatusReconciled);
          totalShows += shows.length;
        } else if (section.type === 'movie') {
          const movies = await this.syncMovies(section.sectionKey, watchStatusReconciled);
          totalMovies += movies.length;
        } else if (section.type === 'artist') {
          await this.syncMusic(section.sectionKey);
          const artists = await prisma.plexArtist.count({
            where: {
              librarySection: {
                sectionKey: section.sectionKey
              }
            }
          });
          totalArtists += artists;
        }
      }

      // Step 3: Cleanup orphaned entities (similar to Stash sync)
      console.log('🧹 Starting Plex cleanup of orphaned entities...');
      const cleanupResults = await this.cleanupOrphanedEntities();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      const result = {
        success: true,
        sections: sections.length,
        totalShows,
        totalMovies,
        totalArtists,
        watchStatusReconciled,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
        cleanup: cleanupResults // Include cleanup results in response
      };

      const summary = `Sections: ${sections.length}, Shows updated: ${totalShows}, Movies updated: ${totalMovies}, Artists updated: ${totalArtists}, Cleanup total: ${Object.values(cleanupResults).reduce((sum, count) => sum + count, 0)}, Watch status reconciled: total ${watchStatusReconciled.total} (shows ${watchStatusReconciled.shows}, seasons ${watchStatusReconciled.seasons}, episodes ${watchStatusReconciled.episodes}, movies ${watchStatusReconciled.movies})`;
      console.log(`Plex sync update summary: ${summary}`);
      console.log(`👁️ Watch status reconciliation summary: shows=${watchStatusReconciled.shows}, seasons=${watchStatusReconciled.seasons}, episodes=${watchStatusReconciled.episodes}, movies=${watchStatusReconciled.movies}, total=${watchStatusReconciled.total}`);

      try {
        await prisma.plexSyncRunLog.create({
          data: {
            startedAt,
            completedAt: new Date(endTime),
            durationSeconds: duration,
            trigger,
            success: true,
            sections: sections.length,
            totalShows,
            totalMovies,
            totalArtists,
            cleanupEpisodes: cleanupResults.episodes || 0,
            cleanupSeasons: cleanupResults.seasons || 0,
            cleanupShows: cleanupResults.shows || 0,
            cleanupMovies: cleanupResults.movies || 0,
            cleanupArtists: cleanupResults.artists || 0,
            cleanupAlbums: cleanupResults.albums || 0,
            cleanupTracks: cleanupResults.tracks || 0,
            cleanupPlaylists: cleanupResults.playlists || 0,
            cleanupComplexFields: cleanupResults.complexFields || 0,
            summary
          }
        });
      } catch (logError) {
        console.warn('Failed to persist Plex sync run log:', logError.message);
      }
      
      console.log('Full sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('Full sync failed:', error);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      try {
        await prisma.plexSyncRunLog.create({
          data: {
            startedAt,
            completedAt: new Date(endTime),
            durationSeconds: duration,
            trigger,
            success: false,
            summary: 'Sync failed before completion',
            error: error.message
          }
        });
      } catch (logError) {
        console.warn('Failed to persist failed Plex sync run log:', logError.message);
      }

      throw error;
    }
  }

  // ================================
  // COMPREHENSIVE CLEANUP METHODS
  // Similar to Stash cleanup functionality
  // ================================

  /**
   * Clean up entities that no longer exist in Plex
   */
  async cleanupOrphanedEntities() {
    console.log('🧹 Starting comprehensive Plex cleanup...');
    const results = {
      episodes: 0,
      seasons: 0,
      shows: 0,
      movies: 0,
      artists: 0,
      albums: 0,
      tracks: 0,
      playlists: 0,
      complexFields: 0
    };

    try {
      // Step 1: Get all valid entity IDs from Plex
      console.log('🧹 Step 1: Collecting valid entity IDs from Plex...');
      const validPlexIds = await this.getAllValidPlexEntityIds();

      // Step 2: Mark removed content entities (don't delete for stats purposes)
      console.log('🧹 Step 2: Marking removed content entities...');
      results.episodes += await this.markRemovedEpisodes(validPlexIds.episodes);
      results.seasons += await this.markRemovedSeasons(validPlexIds.seasons);
      results.shows += await this.markRemovedShows(validPlexIds.shows);
      results.movies += await this.markRemovedMovies(validPlexIds.movies);
      results.tracks += await this.markRemovedTracks(validPlexIds.tracks);
      results.albums += await this.markRemovedAlbums(validPlexIds.albums);
      results.artists += await this.markRemovedArtists(validPlexIds.artists);
      results.playlists += await this.markRemovedPlaylists(validPlexIds.playlists);

      // Step 3: Clean up complex fields for items that no longer exist in Plex
      console.log('🧹 Step 3: Cleaning complex fields for deleted Plex items...');
      results.complexFields += await this.cleanupComplexFieldsForDeletedItems(validPlexIds);

      const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);
      console.log(`✅ Plex cleanup completed! Removed ${totalCleaned} orphaned entities:`, results);
      
      return results;
    } catch (error) {
      console.error('❌ Error during Plex cleanup:', error);
      throw error;
    }
  }

  /**
   * Get all valid entity IDs from Plex API
   */
  async getAllValidPlexEntityIds() {
    const validIds = {
      shows: new Set(),
      seasons: new Set(),
      episodes: new Set(),
      movies: new Set(),
      artists: new Set(),
      albums: new Set(),
      tracks: new Set(),
      playlists: new Set()
    };

    try {
      // Get library sections
      const sectionsData = await this.makeRequest('/library/sections');
      const sections = sectionsData.MediaContainer?.Directory || [];

      for (const section of sections) {
        if (section.type === 'show') {
          // Get all shows in this section
          const showsData = await this.makeRequest(`/library/sections/${section.key}/all?type=2`);
          const shows = showsData.MediaContainer?.Metadata || [];
          
          for (const show of shows) {
            validIds.shows.add(show.ratingKey);
            
            // Get seasons for this show
            const seasonsData = await this.makeRequest(`/library/metadata/${show.ratingKey}/children`);
            const seasons = seasonsData.MediaContainer?.Metadata || [];
            
            for (const season of seasons) {
              validIds.seasons.add(season.ratingKey);
              
              // Get episodes for this season
              const episodesData = await this.makeRequest(`/library/metadata/${season.ratingKey}/children`);
              const episodes = episodesData.MediaContainer?.Metadata || [];
              
              for (const episode of episodes) {
                validIds.episodes.add(episode.ratingKey);
              }
            }
          }
        } else if (section.type === 'movie') {
          // Get all movies in this section
          const moviesData = await this.makeRequest(`/library/sections/${section.key}/all?type=1`);
          const movies = moviesData.MediaContainer?.Metadata || [];
          
          for (const movie of movies) {
            validIds.movies.add(movie.ratingKey);
          }
        } else if (section.type === 'artist') {
          // Get all artists in this section
          const artistsData = await this.makeRequest(`/library/sections/${section.key}/all?type=8`);
          const artists = artistsData.MediaContainer?.Metadata || [];
          
          for (const artist of artists) {
            validIds.artists.add(artist.ratingKey);
            
            // Get albums for this artist using hybrid approach (same as sync)
            // 1. Get albums from artist's children endpoint
            const childrenData = await this.makeRequest(`/library/metadata/${artist.ratingKey}/children`);
            const childrenAlbums = childrenData.MediaContainer?.Metadata || [];
            
            for (const album of childrenAlbums) {
              validIds.albums.add(album.ratingKey);
              
              // Get tracks for this album
              const tracksData = await this.makeRequest(`/library/metadata/${album.ratingKey}/children`);
              const tracks = tracksData.MediaContainer?.Metadata || [];
              
              for (const track of tracks) {
                validIds.tracks.add(track.ratingKey);
              }
            }
          }
          
          // 2. Also scan section for albums by parentRatingKey (same as sync)
          console.log(`🧹 Section-level album scan for cleanup in section ${section.key}...`);
          const pageSize = 500;
          let start = 0;
          let totalProcessed = 0;
          let totalSize = 0;

          while (true) {
            const page = await this.makeRequest(`/library/sections/${section.key}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
            const pageAlbums = page.MediaContainer?.Metadata || [];
            if (!totalSize) totalSize = page.MediaContainer?.totalSize || 0;

            if (pageAlbums.length === 0) break;

            for (const album of pageAlbums) {
              // Only include albums that belong to artists we've identified
              if (validIds.artists.has(album.parentRatingKey)) {
                validIds.albums.add(album.ratingKey);
                
                // Get tracks for this album
                const tracksData = await this.makeRequest(`/library/metadata/${album.ratingKey}/children`);
                const tracks = tracksData.MediaContainer?.Metadata || [];
                
                for (const track of tracks) {
                  validIds.tracks.add(track.ratingKey);
                }
              }
            }
            
            totalProcessed += pageAlbums.length;
            if (totalSize > 0 && totalProcessed >= totalSize) {
              break;
            }
            
            start += pageSize;
          }
        }
      }

      // Get playlists
      const playlistsData = await this.makeRequest('/playlists');
      const playlists = playlistsData.MediaContainer?.Metadata || [];
      for (const playlist of playlists) {
        validIds.playlists.add(playlist.ratingKey);
      }

      console.log(`📊 Valid Plex entity counts:`, {
        shows: validIds.shows.size,
        seasons: validIds.seasons.size,
        episodes: validIds.episodes.size,
        movies: validIds.movies.size,
        artists: validIds.artists.size,
        albums: validIds.albums.size,
        tracks: validIds.tracks.size,
        playlists: validIds.playlists.size
      });

      return validIds;
    } catch (error) {
      console.error('Error collecting valid Plex entity IDs:', error);
      throw error;
    }
  }

  async markRemovedEpisodes(validEpisodeIds) {
    const localEpisodes = await prisma.plexEpisode.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const episode of localEpisodes) {
      if (!validEpisodeIds.has(episode.ratingKey)) {
        // Mark episode as removed instead of deleting
        await prisma.plexEpisode.update({ 
          where: { ratingKey: episode.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} episodes as removed`);
    }
    return marked;
  }

  async markRemovedSeasons(validSeasonIds) {
    const localSeasons = await prisma.plexSeason.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const season of localSeasons) {
      if (!validSeasonIds.has(season.ratingKey)) {
        // Mark season as removed instead of deleting
        await prisma.plexSeason.update({ 
          where: { ratingKey: season.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} seasons as removed`);
    }
    return marked;
  }

  async markRemovedShows(validShowIds) {
    const localShows = await prisma.plexTVShow.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const show of localShows) {
      if (!validShowIds.has(show.ratingKey)) {
        // Mark show as removed instead of deleting
        await prisma.plexTVShow.update({ 
          where: { ratingKey: show.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} TV shows as removed`);
    }
    return marked;
  }

  async markRemovedMovies(validMovieIds) {
    const localMovies = await prisma.plexMovie.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const movie of localMovies) {
      if (!validMovieIds.has(movie.ratingKey)) {
        // Mark movie as removed instead of deleting
        await prisma.plexMovie.update({ 
          where: { ratingKey: movie.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎬 Marked ${marked} movies as removed`);
    }
    return marked;
  }

  async markRemovedTracks(validTrackIds) {
    const localTracks = await prisma.plexTrack.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const track of localTracks) {
      if (!validTrackIds.has(track.ratingKey)) {
        await prisma.plexTrack.update({ 
          where: { ratingKey: track.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} tracks as removed`);
    }
    return marked;
  }

  async markRemovedAlbums(validAlbumIds) {
    const localAlbums = await prisma.plexAlbum.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const album of localAlbums) {
      if (!validAlbumIds.has(album.ratingKey)) {
        await prisma.plexAlbum.update({ 
          where: { ratingKey: album.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} albums as removed`);
    }
    return marked;
  }

  async markRemovedArtists(validArtistIds) {
    const localArtists = await prisma.plexArtist.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const artist of localArtists) {
      if (!validArtistIds.has(artist.ratingKey)) {
        await prisma.plexArtist.update({ 
          where: { ratingKey: artist.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} artists as removed`);
    }
    return marked;
  }

  async markRemovedPlaylists(validPlaylistIds) {
    const localPlaylists = await prisma.plexPlaylist.findMany({
      select: { ratingKey: true }
    });

    let marked = 0;
    for (const playlist of localPlaylists) {
      if (!validPlaylistIds.has(playlist.ratingKey)) {
        await prisma.plexPlaylist.delete({
          where: { ratingKey: playlist.ratingKey },
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🗑️ Deleted ${marked} playlists that no longer exist in Plex`);
    }
    return marked;
  }

  async cleanupComplexFieldsForDeletedItems(validPlexIds) {
    let totalRemoved = 0;
    
    console.log('🧹 Cleaning complex fields for items deleted from Plex...');

    // Clean up complex fields for movies that don't exist in Plex anymore
    const movieComplexFields = [
      { model: prisma.plexDirector, field: 'movieRatingKey' },
      { model: prisma.plexGenre, field: 'movieRatingKey' },
      { model: prisma.plexProducer, field: 'movieRatingKey' },
      { model: prisma.plexWriter, field: 'movieRatingKey' },
      { model: prisma.plexRole, field: 'movieRatingKey' },
      { model: prisma.plexCountry, field: 'movieRatingKey' },
      { model: prisma.plexRating, field: 'movieRatingKey' },
      { model: prisma.plexGuid, field: 'movieRatingKey' },
      { model: prisma.plexMedia, field: 'movieRatingKey' },
      { model: prisma.plexImage, field: 'movieRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'movieRatingKey' },
      { model: prisma.plexLabel, field: 'movieRatingKey' }
    ];

    for (const { model, field } of movieComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the movie doesn't exist in Plex anymore
          if (!validPlexIds.movies.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted movie ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for movies:`, error.message);
      }
    }

    // Clean up complex fields for episodes that don't exist in Plex anymore
    const episodeComplexFields = [
      { model: prisma.plexDirector, field: 'episodeRatingKey' },
      { model: prisma.plexWriter, field: 'episodeRatingKey' },
      { model: prisma.plexRole, field: 'episodeRatingKey' },
      { model: prisma.plexRating, field: 'episodeRatingKey' },
      { model: prisma.plexGuid, field: 'episodeRatingKey' },
      { model: prisma.plexMedia, field: 'episodeRatingKey' },
      { model: prisma.plexImage, field: 'episodeRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'episodeRatingKey' }
    ];

    for (const { model, field } of episodeComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the episode doesn't exist in Plex anymore
          if (!validPlexIds.episodes.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted episode ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for episodes:`, error.message);
      }
    }

    // Clean up complex fields for shows that don't exist in Plex anymore
    const showComplexFields = [
      { model: prisma.plexGenre, field: 'showRatingKey' },
      { model: prisma.plexGuid, field: 'showRatingKey' },
      { model: prisma.plexImage, field: 'showRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'showRatingKey' },
      { model: prisma.plexLabel, field: 'showRatingKey' }
    ];

    for (const { model, field } of showComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the show doesn't exist in Plex anymore
          if (!validPlexIds.shows.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted show ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for shows:`, error.message);
      }
    }

    if (totalRemoved > 0) {
      console.log(`🗑️ Total removed ${totalRemoved} complex field records for items deleted from Plex`);
    } else {
      console.log(`✅ No orphaned complex fields found - all items still exist in Plex`);
    }
    
    return totalRemoved;
  }

  // ================================
  // END COMPREHENSIVE CLEANUP METHODS
  // ================================

  async getSyncStatus() {
    try {
      const sections = await prisma.plexLibrarySection.count();
      const shows = await prisma.plexTVShow.count();
      const seasons = await prisma.plexSeason.count();
      const episodes = await prisma.plexEpisode.count();
      const movies = await prisma.plexMovie.count();
      const artists = await prisma.plexArtist.count();
      const albums = await prisma.plexAlbum.count();
      const tracks = await prisma.plexTrack.count();
      const playlists = await prisma.plexPlaylist.count();
      
      // Get last sync time
      const lastSyncedShow = await prisma.plexTVShow.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedMovie = await prisma.plexMovie.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedArtist = await prisma.plexArtist.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      
      const lastSync = [lastSyncedShow?.lastSyncedAt, lastSyncedMovie?.lastSyncedAt, lastSyncedArtist?.updatedAt]
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      
      return {
        sections,
        shows,
        seasons,
        episodes,
        movies,
        artists,
        albums,
        tracks,
        playlists,
        lastSync,
        hasData: sections > 0
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }  // Music sync methods
  async syncMusic(sectionKey) {
    console.log(`Syncing music for section ${sectionKey}...`);
    
    try {
      // Sync artists first
      await this.syncArtists(sectionKey);
      
      // Get all artists in this section and sync their albums with batching
      const artists = await prisma.plexArtist.findMany({
        where: {
          librarySection: {
            sectionKey: String(sectionKey)
          }
        },
        orderBy: { title: 'asc' }
      });

      console.log(`🎤 Found ${artists.length} artists. Starting album sync with batching...`);
      
      // Process artists in batches to avoid database timeouts
      const artistBatchSize = 25;
      for (let i = 0; i < artists.length; i += artistBatchSize) {
        const batch = artists.slice(i, i + artistBatchSize);
        console.log(`   Processing artist batch ${Math.floor(i/artistBatchSize) + 1}/${Math.ceil(artists.length/artistBatchSize)} (${batch.length} artists)`);

        await this.mapWithConcurrency(batch, this.childSyncConcurrency, async (artist) => {
          try {
            await this.syncAlbums(sectionKey, artist.ratingKey);
          } catch (error) {
            console.warn(`Failed to sync albums for artist ${artist.title}:`, error.message);
            // Continue with next artist on error
          }
        });
        
        // Small delay between batches
        if (i + artistBatchSize < artists.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Get all albums in this section and sync their tracks with batching
      const albums = await prisma.plexAlbum.findMany({
        where: {
          librarySection: {
            sectionKey: String(sectionKey)
          }
        },
        orderBy: { title: 'asc' }
      });

      console.log(`💿 Found ${albums.length} albums. Starting track sync with batching...`);
      
      // Process albums in batches to avoid database timeouts
      const albumBatchSize = 50;
      for (let i = 0; i < albums.length; i += albumBatchSize) {
        const batch = albums.slice(i, i + albumBatchSize);
        console.log(`   Processing album batch ${Math.floor(i/albumBatchSize) + 1}/${Math.ceil(albums.length/albumBatchSize)} (${batch.length} albums)`);

        await this.mapWithConcurrency(batch, this.childSyncConcurrency, async (album) => {
          try {
            await this.syncTracks(sectionKey, album.ratingKey);
          } catch (error) {
            console.warn(`Failed to sync tracks for album ${album.title}:`, error.message);
            // Continue with next album on error
          }
        });
        
        // Small delay between batches
        if (i + albumBatchSize < albums.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Finally sync playlists
      await this.syncPlaylists(sectionKey);

      console.log(`✅ Music sync completed for section ${sectionKey}`);
    } catch (error) {
      console.error(`❌ Error syncing music for section ${sectionKey}:`, error);
      throw error;
    }
  }

  async syncArtists(sectionKey) {
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all`);
      const artists = data.MediaContainer?.Metadata || [];
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      const existingArtists = await prisma.plexArtist.findMany({
        where: { ratingKey: { in: artists.map(artist => artist.ratingKey) } },
        select: { ratingKey: true, updatedAt: true }
      });
      const existingArtistMap = new Map(existingArtists.map(artist => [artist.ratingKey, artist]));
      const artistsNeedingRefresh = artists.filter(artist => !this.isDateTimestampCurrent(existingArtistMap.get(artist.ratingKey)?.updatedAt, artist.updatedAt));
      const detailedArtistMap = await this.fetchDetailedMetadataBatch(artistsNeedingRefresh, 'artist');

      for (const artist of artists) {
        const shouldRefreshArtist = !this.isDateTimestampCurrent(existingArtistMap.get(artist.ratingKey)?.updatedAt, artist.updatedAt);
        const detailedArtist = detailedArtistMap.get(artist.ratingKey) || artist;

        const artistData = {
          ratingKey: detailedArtist.ratingKey,
          key: detailedArtist.key,
          guid: detailedArtist.guid || null,
          type: detailedArtist.type || 'artist',
          title: detailedArtist.title,
          titleSort: detailedArtist.titleSort || null,
          summary: detailedArtist.summary || null,
          index: detailedArtist.index ? parseInt(detailedArtist.index) : null,
          thumb: detailedArtist.thumb || null,
          art: detailedArtist.art || null,
          addedAt: detailedArtist.addedAt ? new Date(parseInt(detailedArtist.addedAt) * 1000) : null,
          updatedAt: detailedArtist.updatedAt ? new Date(parseInt(detailedArtist.updatedAt) * 1000) : null,
          librarySectionID: section.id,
          collections: detailedArtist.Collection ? JSON.stringify(detailedArtist.Collection.map(c => c.tag || c.title)) : null
        };

        if (shouldRefreshArtist) {
          try {
            await prisma.plexArtist.upsert({
              where: { ratingKey: detailedArtist.ratingKey },
              update: artistData,
              create: artistData
            });
          } catch (error) {
            await this.handleDatabaseError(
              error,
              'artist',
              detailedArtist.title,
              async () => {
                return await prisma.plexArtist.upsert({
                  where: { ratingKey: detailedArtist.ratingKey },
                  update: artistData,
                  create: artistData
                });
              }
            );
          }
        }
      }

      console.log(`✅ Synced ${artists.length} artists for section ${sectionKey}`);
    } catch (error) {
      console.error('Error syncing artists:', error);
      throw error;
    }
  }

  async syncAlbums(sectionKey, artistRatingKey) {
    try {
      // 1. Get albums from artist's children endpoint
      const childrenData = await this.makeRequest(`/library/metadata/${artistRatingKey}/children`);
      const childrenAlbums = childrenData.MediaContainer?.Metadata || [];
      if (childrenAlbums.length > 0) {
        console.log(`ℹ️ Found ${childrenAlbums.length} album(s) via artist children endpoint for artist ${artistRatingKey}.`);
      }

      // 2. Always perform a section-level scan to find albums by parentRatingKey
      const pageSize = 500; // Larger page size for efficiency
      let start = 0;
      let totalProcessed = 0;
      const scannedAlbums = [];
      let totalSize = 0;

      console.log(`ℹ️ Scanning section ${sectionKey} for albums by artist ${artistRatingKey}...`);
      while (true) {
        const page = await this.makeRequest(`/library/sections/${sectionKey}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
        const pageAlbums = page.MediaContainer?.Metadata || [];
        if (!totalSize) totalSize = page.MediaContainer?.totalSize || 0;

        if (pageAlbums.length === 0) break;

        for (const a of pageAlbums) {
          if (String(a.parentRatingKey) === String(artistRatingKey)) {
            scannedAlbums.push(a);
          }
        }
        
        totalProcessed += pageAlbums.length;
        if (totalSize > 0 && totalProcessed >= totalSize) {
          break; // Scanned all albums in the section
        }
        
        start += pageSize;
      }
      
      if (scannedAlbums.length > 0) {
        console.log(`   🔍 Section scan found ${scannedAlbums.length} album(s) for artist ${artistRatingKey} after checking ${totalProcessed} items.`);
      }

      // 3. Combine and deduplicate results
      const allAlbums = new Map();
      [...childrenAlbums, ...scannedAlbums].forEach(album => {
        allAlbums.set(album.ratingKey, album);
      });
      const albums = Array.from(allAlbums.values());
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      const existingAlbums = await prisma.plexAlbum.findMany({
        where: { ratingKey: { in: albums.map(album => album.ratingKey) } },
        select: { ratingKey: true, updatedAt: true }
      });
      const existingAlbumMap = new Map(existingAlbums.map(album => [album.ratingKey, album]));
      const albumsNeedingRefresh = albums.filter(album => !this.isDateTimestampCurrent(existingAlbumMap.get(album.ratingKey)?.updatedAt, album.updatedAt));
      const detailedAlbumMap = await this.fetchDetailedMetadataBatch(albumsNeedingRefresh, 'album');

      for (const album of albums) {
        const shouldRefreshAlbum = !this.isDateTimestampCurrent(existingAlbumMap.get(album.ratingKey)?.updatedAt, album.updatedAt);
        const detailedAlbum = detailedAlbumMap.get(album.ratingKey) || album;

        const albumData = {
          ratingKey: detailedAlbum.ratingKey,
          key: detailedAlbum.key,
          parentRatingKey: detailedAlbum.parentRatingKey || artistRatingKey,
          guid: detailedAlbum.guid || null,
          type: detailedAlbum.type || 'album',
          title: detailedAlbum.title,
          titleSort: detailedAlbum.titleSort || null,
          summary: detailedAlbum.summary || null,
          index: detailedAlbum.index ? parseInt(detailedAlbum.index) : null,
          year: detailedAlbum.year ? parseInt(detailedAlbum.year) : null,
          thumb: detailedAlbum.thumb || null,
          art: detailedAlbum.art || null,
          parentThumb: detailedAlbum.parentThumb || null,
          originallyAvailableAt: detailedAlbum.originallyAvailableAt ? new Date(detailedAlbum.originallyAvailableAt) : null,
          addedAt: detailedAlbum.addedAt ? new Date(parseInt(detailedAlbum.addedAt) * 1000) : null,
          updatedAt: detailedAlbum.updatedAt ? new Date(parseInt(detailedAlbum.updatedAt) * 1000) : null,
          librarySectionID: section.id,
          collections: detailedAlbum.Collection ? JSON.stringify(detailedAlbum.Collection.map(c => c.tag || c.title)) : null
        };

        if (shouldRefreshAlbum) {
          try {
            await prisma.plexAlbum.upsert({
              where: { ratingKey: detailedAlbum.ratingKey },
              update: albumData,
              create: albumData
            });
          } catch (error) {
            await this.handleDatabaseError(
              error,
              'album',
              detailedAlbum.title,
              async () => {
                return await prisma.plexAlbum.upsert({
                  where: { ratingKey: detailedAlbum.ratingKey },
                  update: albumData,
                  create: albumData
                });
              }
            );
          }
        }
      }

      console.log(`✅ Synced ${albums.length} albums for artist ${artistRatingKey}`);
    } catch (error) {
      console.error('Error syncing albums:', error);
      throw error;
    }
  }

  async syncTracks(sectionKey, albumRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${albumRatingKey}/children`);
      const tracks = data.MediaContainer?.Metadata || [];
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      const existingTracks = await prisma.plexTrack.findMany({
        where: { ratingKey: { in: tracks.map(track => track.ratingKey) } },
        select: { ratingKey: true }
      });
      const existingTrackKeys = new Set(existingTracks.map(track => track.ratingKey));
      const newTrackRows = [];

      for (const track of tracks) {
        if (existingTrackKeys.has(track.ratingKey)) {
          continue;
        }

        newTrackRows.push({
          ratingKey: track.ratingKey,
          key: track.key,
          parentRatingKey: track.parentRatingKey || albumRatingKey,
          grandparentRatingKey: track.grandparentRatingKey || null,
          guid: track.guid || null,
          type: track.type || 'track',
          title: track.title,
          titleSort: track.titleSort || null,
          summary: track.summary || null,
          index: track.index ? parseInt(track.index) : null,
          duration: track.duration ? parseInt(track.duration) : null,
          thumb: track.thumb || null,
          art: track.art || null,
          parentThumb: track.parentThumb || null,
          grandparentThumb: track.grandparentThumb || null,
          addedAt: track.addedAt ? new Date(parseInt(track.addedAt) * 1000) : null,
          updatedAt: track.updatedAt ? new Date(parseInt(track.updatedAt) * 1000) : null,
          librarySectionID: section.id
        });
      }

      if (newTrackRows.length > 0) {
        try {
          await prisma.plexTrack.createMany({ data: newTrackRows });
        } catch (error) {
          await this.handleDatabaseError(error, 'track batch', albumRatingKey, async () => {
            await prisma.plexTrack.createMany({ data: newTrackRows });
          });
        }
      }

      console.log(`✅ Tracks for album ${albumRatingKey}: ${newTrackRows.length} added, ${existingTrackKeys.size} skipped (already exist)`);
    } catch (error) {
      console.error('Error syncing tracks:', error);
      throw error;
    }
  }

  async syncPlaylists(sectionKey) {
    try {
      // Try the general playlists endpoint first
      let data;
      try {
        data = await this.makeRequest(`/playlists/all`);
      } catch (error) {
        console.log(`No playlists found at /playlists/all, trying section-specific: ${error.message}`);
        // If that fails, try to get playlists from the root
        try {
          data = await this.makeRequest(`/playlists`);
        } catch (error2) {
          console.log(`No playlists found at /playlists either: ${error2.message}`);
          // If no playlists endpoint works, just log and continue
          console.log(`✅ No playlists found for section ${sectionKey} (this is normal if no playlists exist)`);
          return;
        }
      }
      
      const playlists = data.MediaContainer?.Metadata || [];
      
      // Filter to audio playlists only
      const musicPlaylists = playlists.filter(playlist => 
        playlist.playlistType === 'audio' || 
        !playlist.playlistType // If no type specified, assume it could be music
      );
      
      if (musicPlaylists.length === 0) {
        console.log(`✅ No music playlists found for section ${sectionKey}`);
        return;
      }
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: sectionKey }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      const existingPlaylists = await prisma.plexPlaylist.findMany({
        where: { ratingKey: { in: musicPlaylists.map(playlist => playlist.ratingKey) } },
        select: { ratingKey: true, updatedAt: true }
      });
      const existingPlaylistMap = new Map(existingPlaylists.map(playlist => [playlist.ratingKey, playlist]));
      const playlistsNeedingRefresh = musicPlaylists.filter(playlist => !this.isDateTimestampCurrent(existingPlaylistMap.get(playlist.ratingKey)?.updatedAt, playlist.updatedAt));
      const detailedPlaylistMap = await this.fetchDetailedMetadataBatch(playlistsNeedingRefresh, 'playlist');

      for (const playlist of musicPlaylists) {
        const shouldRefreshPlaylist = !this.isDateTimestampCurrent(existingPlaylistMap.get(playlist.ratingKey)?.updatedAt, playlist.updatedAt);
        const detailedPlaylist = detailedPlaylistMap.get(playlist.ratingKey) || playlist;

        const playlistData = {
          ratingKey: detailedPlaylist.ratingKey,
          key: detailedPlaylist.key,
          guid: detailedPlaylist.guid || null,
          type: detailedPlaylist.type || 'playlist',
          title: detailedPlaylist.title,
          titleSort: detailedPlaylist.titleSort || null,
          summary: detailedPlaylist.summary || null,
          smart: detailedPlaylist.smart === '1' || detailedPlaylist.smart === true,
          playlistType: detailedPlaylist.playlistType || 'audio',
          thumb: detailedPlaylist.thumb || null,
          art: detailedPlaylist.art || null,
          duration: detailedPlaylist.duration ? parseInt(detailedPlaylist.duration) : null,
          leafCount: detailedPlaylist.leafCount ? parseInt(detailedPlaylist.leafCount) : null,
          addedAt: detailedPlaylist.addedAt ? new Date(parseInt(detailedPlaylist.addedAt) * 1000) : null,
          updatedAt: detailedPlaylist.updatedAt ? new Date(parseInt(detailedPlaylist.updatedAt) * 1000) : null,
          librarySectionID: section.id
        };

        if (shouldRefreshPlaylist) {
          await prisma.plexPlaylist.upsert({
            where: { ratingKey: detailedPlaylist.ratingKey },
            update: playlistData,
            create: playlistData
          });
        }

        // Sync playlist items
        await this.syncPlaylistItems(detailedPlaylist.ratingKey);
      }

      console.log(`✅ Synced ${musicPlaylists.length} music playlists for section ${sectionKey}`);
    } catch (error) {
      console.error('Error syncing playlists:', error);
      // Don't throw the error - just log and continue since playlists are optional
      console.log(`⚠️ Continuing sync without playlists for section ${sectionKey}`);
    }
  }

  async syncPlaylistItems(playlistRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${playlistRatingKey}/children`);
      const items = data.MediaContainer?.Metadata || [];

      // Clear existing playlist items
      await prisma.plexPlaylistItem.deleteMany({
        where: { playlistRatingKey: playlistRatingKey }
      });

      if (items.length === 0) {
        return;
      }

      const itemRows = items.map((item, index) => ({
          playlistRatingKey: playlistRatingKey,
          ratingKey: item.ratingKey,
          index: index + 1,
          type: item.type || 'track',
          addedAt: item.addedAt ? new Date(parseInt(item.addedAt) * 1000) : new Date()
        }));

      try {
        await prisma.plexPlaylistItem.createMany({ data: itemRows });
      } catch (error) {
        console.warn(`Failed to sync playlist items for playlist ${playlistRatingKey}:`, error.message);
      }

      console.log(`✅ Synced ${items.length} items for playlist ${playlistRatingKey}`);
    } catch (error) {
      console.error('Error syncing playlist items:', error);
      throw error;
    }
  }
}

module.exports = PlexSyncService;
