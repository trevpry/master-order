const prisma = require('../prismaClient');

const JELLYFIN_ID = /^[0-9a-f]{32}$/i;

/**
 * Resolve the Jellyfin season artwork path (relative, e.g. /Items/{seasonId}/Images/Primary)
 * for a TV episode. Falls back to the series image when the season has no artwork.
 */
async function resolveSeasonArtworkPath({ episodeRatingKey, seriesRatingKey, seriesTitle, seasonNumber } = {}) {
  try {
    if (episodeRatingKey && JELLYFIN_ID.test(String(episodeRatingKey))) {
      const episode = await prisma.plexEpisode.findUnique({
        where: { ratingKey: String(episodeRatingKey) },
        select: { parentThumb: true, seasonRatingKey: true, seasonIndex: true, grandparentRatingKey: true, grandparentThumb: true }
      });
      if (episode) {
        const season = episode.seasonRatingKey
          ? await prisma.plexSeason.findUnique({ where: { ratingKey: episode.seasonRatingKey }, select: { thumb: true } })
          : null;
        const path = season?.thumb || episode.parentThumb || episode.grandparentThumb;
        if (path) return path;
        seriesRatingKey = seriesRatingKey || episode.grandparentRatingKey;
        if (seasonNumber == null) seasonNumber = episode.seasonIndex;
      }
    }

    const index = Number(seasonNumber);
    if (!Number.isFinite(index)) return null;

    let showRatingKey = seriesRatingKey && JELLYFIN_ID.test(String(seriesRatingKey)) ? String(seriesRatingKey) : null;
    if (!showRatingKey && seriesTitle) {
      const show = await prisma.plexTVShow.findFirst({ where: { title: seriesTitle }, select: { ratingKey: true } });
      showRatingKey = show?.ratingKey || null;
    }
    if (!showRatingKey) return null;

    const season = await prisma.plexSeason.findFirst({
      where: { showRatingKey, index },
      select: { thumb: true }
    });
    return season?.thumb || null;
  } catch (error) {
    console.warn('Failed to resolve Jellyfin season artwork:', error.message);
    return null;
  }
}

function isEpisodeResult(media) {
  if (!media || media.libraryProvider === 'arr') return false;
  return media.type === 'episode' || media.customOrderMediaType === 'episode';
}

/**
 * Attach `seasonArtwork` (and use it as `thumb`) on an Up Next / media payload for a TV episode.
 */
async function applySeasonArtwork(media) {
  if (!isEpisodeResult(media)) return media;
  const isEpisodeRow = media.customOrderMediaType === 'episode' || !!media.grandparentRatingKey;
  const seasonArtwork = await resolveSeasonArtworkPath({
    episodeRatingKey: media.episodeRatingKey || (isEpisodeRow ? media.ratingKey : null) || media.plexKey,
    seriesRatingKey: media.grandparentRatingKey || (isEpisodeRow ? null : media.ratingKey),
    seriesTitle: media.grandparentTitle || (isEpisodeRow ? null : media.title),
    seasonNumber: media.currentSeason ?? media.parentIndex ?? media.seasonNumber
  });
  if (seasonArtwork) {
    media.seasonArtwork = seasonArtwork;
    media.thumb = seasonArtwork;
  }
  return media;
}

const backdropCache = new Map();
const BACKDROP_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Resolve the Jellyfin backdrop path for an item: its own backdrop, otherwise the
 * backdrop Jellyfin inherits from a parent (e.g. a season without backdrops uses the series).
 */
async function resolveItemBackdropPath(itemId, fallbackPath = null) {
  if (!itemId || !JELLYFIN_ID.test(String(itemId))) return fallbackPath;
  const cached = backdropCache.get(itemId);
  if (cached && Date.now() - cached.at < BACKDROP_TTL_MS) return cached.path || fallbackPath;
  try {
    const jellyfin = require('../services/jellyfinService');
    const item = await jellyfin.getItem(itemId);
    let path = null;
    if (item?.BackdropImageTags?.length) {
      path = `/Items/${item.Id}/Images/Backdrop`;
    } else if (item?.ParentBackdropItemId && item?.ParentBackdropImageTags?.length) {
      path = `/Items/${item.ParentBackdropItemId}/Images/Backdrop`;
    }
    backdropCache.set(itemId, { path, at: Date.now() });
    return path || fallbackPath;
  } catch (error) {
    console.warn(`Failed to resolve Jellyfin backdrop for ${itemId}:`, error.message);
    return fallbackPath;
  }
}

/**
 * Attach `backgroundArt` (relative Jellyfin backdrop path) for TV episodes (season backdrop,
 * inheriting the series backdrop) and movies.
 */
async function applyBackgroundArtwork(media) {
  if (!media || media.libraryProvider === 'arr') return media;
  try {
    if (isEpisodeResult(media)) {
      const isEpisodeRow = media.customOrderMediaType === 'episode' || !!media.grandparentRatingKey;
      const episodeKey = media.episodeRatingKey || (isEpisodeRow ? media.ratingKey : null) || media.plexKey;
      let seasonKey = null;
      let showKey = media.grandparentRatingKey || (isEpisodeRow ? null : media.ratingKey);
      if (episodeKey && JELLYFIN_ID.test(String(episodeKey))) {
        const episode = await prisma.plexEpisode.findUnique({
          where: { ratingKey: String(episodeKey) },
          select: { seasonRatingKey: true, grandparentRatingKey: true }
        });
        seasonKey = episode?.seasonRatingKey || null;
        showKey = showKey || episode?.grandparentRatingKey;
      }
      const show = showKey && JELLYFIN_ID.test(String(showKey))
        ? await prisma.plexTVShow.findUnique({ where: { ratingKey: String(showKey) }, select: { art: true } })
        : null;
      const backgroundArt = await resolveItemBackdropPath(seasonKey || showKey, show?.art || null);
      if (backgroundArt) media.backgroundArt = backgroundArt;
      return media;
    }

    const isMovie = media.type === 'movie' || media.customOrderMediaType === 'movie' || media.orderType === 'MOVIES_GENERAL';
    if (isMovie) {
      const movieKey = [media.plexKey, media.ratingKey].find(key => key && JELLYFIN_ID.test(String(key)));
      const fallback = typeof media.art === 'string' && media.art.startsWith('/Items/') ? media.art : null;
      const backgroundArt = movieKey ? await resolveItemBackdropPath(movieKey, fallback) : fallback;
      if (backgroundArt) media.backgroundArt = backgroundArt;
    }
  } catch (error) {
    console.warn('Failed to resolve background artwork:', error.message);
  }
  return media;
}

module.exports = { resolveSeasonArtworkPath, applySeasonArtwork, applyBackgroundArtwork, resolveItemBackdropPath };

