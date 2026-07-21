const express = require('express');
const router = express.Router();
const { asyncHandler, sendBadRequest, sendNotFound } = require('../utils/responses');
const prisma = require('../prismaClient');

/**
 * Watch progress / resume-position tracking for the Radarr/Sonarr-backed
 * library. Replaces "Plex viewOffset/viewCount" as the source of truth for
 * resume position and watched state for movies/episodes played directly
 * from our own streaming service. See
 * SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 4).
 */

const VALID_MEDIA_TYPES = new Set(['movie', 'episode']);

function buildWhere(mediaType, id) {
  return mediaType === 'movie' ? { movieId: id } : { episodeId: id };
}

// GET /api/watch-progress/:mediaType/:id - current resume position / completion state
router.get('/:mediaType/:id', asyncHandler(async (req, res) => {
  const { mediaType } = req.params;
  const id = Number.parseInt(req.params.id, 10);

  if (!VALID_MEDIA_TYPES.has(mediaType)) return sendBadRequest(res, 'mediaType must be "movie" or "episode"');
  if (!Number.isFinite(id)) return sendBadRequest(res, 'Invalid id');

  const progress = await prisma.watchProgress.findUnique({ where: buildWhere(mediaType, id) });
  if (!progress) {
    return res.json({ mediaType, id, positionSeconds: 0, durationSeconds: null, completed: false });
  }

  res.json(progress);
}));

// POST /api/watch-progress/heartbeat - periodic position update from the player
// Body: { mediaType: "movie"|"episode", id: number, positionSeconds: number, durationSeconds?: number }
router.post('/heartbeat', asyncHandler(async (req, res) => {
  const { mediaType, id, positionSeconds, durationSeconds } = req.body || {};
  const numericId = Number.parseInt(id, 10);
  const numericPosition = Number.parseInt(positionSeconds, 10);

  if (!VALID_MEDIA_TYPES.has(mediaType)) return sendBadRequest(res, 'mediaType must be "movie" or "episode"');
  if (!Number.isFinite(numericId)) return sendBadRequest(res, 'id is required');
  if (!Number.isFinite(numericPosition) || numericPosition < 0) return sendBadRequest(res, 'positionSeconds must be a non-negative number');

  if (mediaType === 'movie') {
    const movie = await prisma.movie.findUnique({ where: { id: numericId } });
    if (!movie || movie.removed) return sendNotFound(res, 'Movie not found');
  } else {
    const episode = await prisma.episode.findUnique({ where: { id: numericId } });
    if (!episode || episode.removed) return sendNotFound(res, 'Episode not found');
  }

  const data = {
    mediaType,
    movieId: mediaType === 'movie' ? numericId : null,
    episodeId: mediaType === 'episode' ? numericId : null,
    positionSeconds: numericPosition,
    durationSeconds: Number.isFinite(Number(durationSeconds)) ? Number(durationSeconds) : undefined,
  };

  const progress = await prisma.watchProgress.upsert({
    where: buildWhere(mediaType, numericId),
    create: data,
    update: data,
  });

  res.json({ success: true, progress });
}));

// POST /api/watch-progress/:mediaType/:id/complete - mark an item as fully watched
router.post('/:mediaType/:id/complete', asyncHandler(async (req, res) => {
  const { mediaType } = req.params;
  const id = Number.parseInt(req.params.id, 10);

  if (!VALID_MEDIA_TYPES.has(mediaType)) return sendBadRequest(res, 'mediaType must be "movie" or "episode"');
  if (!Number.isFinite(id)) return sendBadRequest(res, 'Invalid id');

  const data = {
    mediaType,
    movieId: mediaType === 'movie' ? id : null,
    episodeId: mediaType === 'episode' ? id : null,
    completed: true,
    positionSeconds: 0,
  };

  const progress = await prisma.watchProgress.upsert({
    where: buildWhere(mediaType, id),
    create: data,
    update: { completed: true },
  });

  res.json({ success: true, progress });
}));

module.exports = router;
