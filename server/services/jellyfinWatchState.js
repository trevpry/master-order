/**
 * Keeps local movie/episode watch state and Jellyfin's played state in sync.
 * Jellyfin is the source of truth for watch state (every library sync
 * overwrites local viewCount), so anything marked watched in Master Order is
 * also pushed to Jellyfin.
 */
const prisma = require('../prismaClient');
const jellyfin = require('./jellyfinService');
const { isJellyfinId } = require('./jellyfinService');

async function pushPlayedState(itemId, played) {
  if (!isJellyfinId(itemId)) return { pushed: false, reason: 'not a Jellyfin item id' };
  try {
    if (!(await jellyfin.isConfigured())) return { pushed: false, reason: 'Jellyfin not configured' };
    if (played) await jellyfin.markPlayed(itemId);
    else await jellyfin.markUnplayed(itemId);
    return { pushed: true };
  } catch (error) {
    console.warn(`⚠️ Failed to update Jellyfin played state for ${itemId}:`, error.message);
    return { pushed: false, reason: error.message };
  }
}

async function updateLocalState(itemId, played) {
  const data = played
    ? { viewCount: 1, lastViewedAt: Math.floor(Date.now() / 1000) }
    : { viewCount: 0 };
  const episode = await prisma.plexEpisode.findUnique({ where: { ratingKey: itemId }, select: { ratingKey: true, viewCount: true, seasonRatingKey: true, season: { select: { showRatingKey: true } } } });
  if (episode) {
    const wasWatched = (episode.viewCount || 0) > 0;
    await prisma.plexEpisode.update({ where: { ratingKey: itemId }, data });
    if (wasWatched !== played) {
      const delta = played ? 1 : -1;
      await prisma.plexSeason.update({ where: { ratingKey: episode.seasonRatingKey }, data: { viewedLeafCount: { increment: delta } } }).catch(() => {});
      if (episode.season?.showRatingKey) {
        await prisma.plexTVShow.update({ where: { ratingKey: episode.season.showRatingKey }, data: { viewedLeafCount: { increment: delta } } }).catch(() => {});
      }
    }
    return 'episode';
  }
  const movie = await prisma.plexMovie.findUnique({ where: { ratingKey: itemId }, select: { ratingKey: true } });
  if (movie) {
    await prisma.plexMovie.update({ where: { ratingKey: itemId }, data });
    return 'movie';
  }
  return null;
}

async function markJellyfinItemWatched(itemId, played = true) {
  const type = await updateLocalState(itemId, played);
  const remote = await pushPlayedState(itemId, played);
  return { success: true, itemId, type, played, jellyfin: remote };
}

module.exports = { markJellyfinItemWatched, pushPlayedState, updateLocalState };
