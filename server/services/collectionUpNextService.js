const prisma = require('../prismaClient');
const PlexDatabaseService = require('../plexDatabaseService');
const { getIgnoredCollections, isInIgnoredCollection } = require('../utils/collectionSettings');

function releaseTime(item) {
  const date = Date.parse(item.originallyAvailableAt);
  if (Number.isFinite(date)) return date;
  return item.year ? Date.UTC(item.year, 0, 1) : Infinity;
}

async function selectCollectionUpNext(seed, db = prisma) {
  if (!seed?.ratingKey || !/^[0-9a-f]{32}$/i.test(seed.ratingKey) || seed.libraryProvider === 'arr') return seed;
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const ignored = getIgnoredCollections(settings || {});
  const excluded = new Set([settings?.collectionName, ...ignored].filter(Boolean).map(name => name.toLowerCase()));
  const collections = await db.mediaCollection.findMany({
    where: { removed: false },
    include: { items: true }
  });
  const byId = new Map(collections.map(collection => [collection.id, collection]));
  const roots = new Set();
  const pending = collections.filter(collection =>
    seed.selectedCollectionName
      ? collection.name === seed.selectedCollectionName
      : collection.items.some(item => item.itemKey === seed.ratingKey)
  ).map(collection => collection.id);
  const ancestors = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    const collection = byId.get(id);
    if (!excluded.has(collection.name.toLowerCase())) roots.add(id);
    if (!seed.selectedCollectionName) {
      for (const parent of collections) {
        if (parent.items.some(item => item.childCollectionId === id)) pending.push(parent.id);
      }
    }
  }
  if (!roots.size) return seed;

  const keys = new Set([seed.ratingKey]);
  const visited = new Set();
  const descendants = [...roots];
  while (descendants.length) {
    const id = descendants.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const collection = byId.get(id);
    if (!collection || excluded.has(collection.name.toLowerCase())) continue;
    for (const item of collection.items) {
      if (item.itemType === 'collection') descendants.push(item.childCollectionId);
      else keys.add(item.itemKey);
    }
  }

  const [movies, shows] = await Promise.all([
    db.plexMovie.findMany({ where: { ratingKey: { in: [...keys] }, removed: false } }),
    db.plexTVShow.findMany({ where: { ratingKey: { in: [...keys] }, removed: false } })
  ]);
  const customItems = await db.customOrderItem.findMany({
    where: {
      customOrder: { isActive: true },
      OR: [
        { plexKey: { in: [...keys] } },
        { mediaType: 'episode', seriesTitle: { in: shows.map(show => show.title) } }
      ]
    },
    select: { plexKey: true, seriesTitle: true, mediaType: true }
  });
  const eligible = item => !isInIgnoredCollection(item.collections, ignored) &&
    !customItems.some(custom => custom.plexKey === item.ratingKey ||
      (custom.mediaType === 'episode' && custom.seriesTitle === item.title));
  const candidates = movies.filter(movie => eligible(movie) && !(movie.viewCount > 0))
    .map(movie => ({ media: { ...movie, type: 'movie', libraryType: 'movie', orderType: 'MOVIES_GENERAL' }, date: releaseTime(movie) }));
  const plexDb = new PlexDatabaseService(db);
  for (const show of shows.filter(eligible)) {
    // Episode rows, not potentially stale show/season counters, determine what is unplayed.
    const episode = await plexDb.getNextUnwatchedEpisode(show.ratingKey);
    if (!episode) continue;
    candidates.push({
      date: releaseTime(episode),
      media: {
        ...show,
        type: 'episode',
        libraryType: 'tv',
        orderType: 'TV_GENERAL',
        episodeRatingKey: episode.ratingKey,
        episodeTitle: episode.title,
        nextEpisodeTitle: episode.title,
        seasonNumber: episode.seasonNumber,
        currentSeason: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
        currentEpisode: episode.episodeNumber,
        seasonTitle: episode.seasonTitle,
        totalEpisodesInSeason: episode.totalEpisodesInSeason,
        duration: episode.duration,
        summary: episode.summary || show.summary
      }
    });
  }
  candidates.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.media.title.localeCompare(b.media.title) || a.media.ratingKey.localeCompare(b.media.ratingKey);
  });
  if (!candidates.length) return {
    error: 'No unplayed collection items available',
    message: 'No unplayed collection items available',
    orderType: seed.orderType || 'TV_GENERAL'
  };
  return {
    ...candidates[0].media,
    ...(seed.selectedCollectionName && {
      selectedCollectionName: seed.selectedCollectionName,
      selectedViaPartiallyWatchedPriority: seed.selectedViaPartiallyWatchedPriority,
      skipCollectionExpansion: true
    }),
    otherCollections: [...roots].map(id => ({ title: byId.get(id).name, items: [] }))
  };
}

module.exports = { selectCollectionUpNext };
