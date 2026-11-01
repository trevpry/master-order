const JELLYFIN_ID = /^[0-9a-f]{32}$/i;

/**
 * Resolve the Jellyfin series id for a TV episode Up Next payload. Works for both
 * general TV picks (ratingKey = series, episodeRatingKey = episode) and custom-order
 * episodes (ratingKey = episode).
 */
async function resolveEpisodeSeriesKey(media, prisma) {
  const isEpisodeRow = media.customOrderMediaType === 'episode' || !!media.grandparentRatingKey;
  const episodeKey = media.episodeRatingKey || (isEpisodeRow ? media.ratingKey : null) || media.plexKey;

  if (episodeKey && JELLYFIN_ID.test(String(episodeKey))) {
    const row = await prisma.plexEpisode.findUnique({
      where: { ratingKey: String(episodeKey) },
      select: { grandparentRatingKey: true, showTitle: true, grandparentTitle: true }
    });
    if (row?.grandparentRatingKey) return row.grandparentRatingKey;
  }

  const candidate = media.grandparentRatingKey || media.seriesRatingKey || (isEpisodeRow ? null : media.ratingKey);
  if (candidate && JELLYFIN_ID.test(String(candidate))) return String(candidate);

  const title = media.grandparentTitle || media.seriesTitle || (isEpisodeRow ? null : media.title);
  if (!title) return null;
  const show = await prisma.plexTVShow.findFirst({ where: { title }, select: { ratingKey: true } });
  return show?.ratingKey || null;
}

/**
 * Jellyfin collections (BoxSets) containing an item, nearest first, followed by every
 * ancestor collection (collections can contain other collections).
 */
async function getCollectionsForItem(itemKey, prisma, { exclude = [] } = {}) {
  const excluded = new Set(exclude.filter(Boolean).map((name) => name.toLowerCase()));
  const result = [];
  const seen = new Set();

  let frontier = (await prisma.mediaCollectionItem.findMany({
    where: { itemKey: String(itemKey) },
    include: { collection: true },
    orderBy: { collectionId: 'asc' }
  })).map((link) => link.collection);

  for (let depth = 0; frontier.length > 0 && depth < 10; depth++) {
    const next = [];
    for (const collection of frontier) {
      if (!collection || collection.removed || seen.has(collection.id)) continue;
      seen.add(collection.id);
      if (!excluded.has(String(collection.name).toLowerCase())) {
        result.push({
          id: collection.id,
          jellyfinId: collection.jellyfinId,
          title: collection.name,
          thumb: collection.thumb || `/Items/${collection.jellyfinId}/Images/Primary`,
          depth
        });
      }
      next.push(collection.id);
    }
    if (next.length === 0) break;
    frontier = (await prisma.mediaCollectionItem.findMany({
      where: { childCollectionId: { in: next } },
      include: { collection: true },
      orderBy: { collectionId: 'asc' }
    })).map((link) => link.collection);
  }

  return result;
}

/**
 * Attach the movie's or episode series' Jellyfin collections (plus parent
 * collections), excluding the Up Next settings collection.
 */
async function applyCollectionArtwork(media, prisma = require('../prismaClient')) {
  if (!media || media.libraryProvider === 'arr') return media;
  const isEpisode = media.type === 'episode' || media.customOrderMediaType === 'episode';
  const isMovie = media.type === 'movie' || media.customOrderMediaType === 'movie' || media.orderType === 'MOVIES_GENERAL';
  if (!isEpisode && !isMovie) return media;
  try {
    const itemKey = isEpisode
      ? await resolveEpisodeSeriesKey(media, prisma)
      : [media.plexKey, media.ratingKey].find(key => key && JELLYFIN_ID.test(String(key)));
    if (!itemKey) return media;
    const settings = await prisma.settings.findUnique({ where: { id: 1 }, select: { collectionName: true } });
    media.collectionArtwork = await getCollectionsForItem(itemKey, prisma, {
      exclude: [settings?.collectionName]
    });
  } catch (error) {
    console.warn('Failed to resolve collection artwork:', error.message);
  }
  return media;
}

module.exports = { applyCollectionArtwork, getCollectionsForItem, resolveEpisodeSeriesKey };
