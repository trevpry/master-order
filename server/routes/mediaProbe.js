const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');
const MediaProbeService = require('../services/mediaProbeService');

const mediaProbeService = new MediaProbeService();

// GET /api/media-probe/status - counts of probed / unprobed / errored files
router.get('/status', asyncHandler(async (req, res) => {
  const [
    movieHasFile, movieProbed, movieErrored,
    episodeHasFile, episodeProbed, episodeErrored,
  ] = await Promise.all([
    prisma.movie.count({ where: { hasFile: true, removed: false } }),
    prisma.movie.count({ where: { hasFile: true, removed: false, probedAt: { not: null } } }),
    prisma.movie.count({ where: { hasFile: true, removed: false, probeError: { not: null } } }),
    prisma.episode.count({ where: { hasFile: true, removed: false } }),
    prisma.episode.count({ where: { hasFile: true, removed: false, probedAt: { not: null } } }),
    prisma.episode.count({ where: { hasFile: true, removed: false, probeError: { not: null } } }),
  ]);

  res.json({
    movies: { withFile: movieHasFile, probed: movieProbed, unprobed: movieHasFile - movieProbed, errored: movieErrored },
    episodes: { withFile: episodeHasFile, probed: episodeProbed, unprobed: episodeHasFile - episodeProbed, errored: episodeErrored },
  });
}));

// POST /api/media-probe/run - manually (re)probe unprobed files
// Body: { concurrency?: number, limit?: number, force?: boolean }
router.post('/run', asyncHandler(async (req, res) => {
  const concurrency = Number.isFinite(Number(req.body?.concurrency)) ? Number(req.body.concurrency) : 2;
  const limit = Number.isFinite(Number(req.body?.limit)) ? Number(req.body.limit) : 200;
  const force = !!req.body?.force;

  const result = await mediaProbeService.probeAllUnprobed({ concurrency, limit, force });
  res.json({ success: true, result });
}));

module.exports = router;
