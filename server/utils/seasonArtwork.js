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

module.exports = { resolveSeasonArtworkPath, applySeasonArtwork };
