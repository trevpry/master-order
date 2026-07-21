const express = require('express');
const router = express.Router();
const { asyncHandler, sendBadRequest } = require('../utils/responses');
const streamingService = require('../services/streamingService');

const VALID_MEDIA_TYPES = new Set(['movie', 'episode']);

function assertValidMediaType(mediaType) {
  if (!VALID_MEDIA_TYPES.has(mediaType)) {
    const error = new Error('mediaType must be "movie" or "episode"');
    error.statusCode = 400;
    throw error;
  }
}

// GET /api/stream/sessions - list active transcode sessions (debug/admin)
router.get('/sessions', asyncHandler(async (req, res) => {
  res.json(streamingService.listSessions());
}));

// GET /api/stream/session/:sessionId/:file - serve an HLS playlist/segment for an active session
router.get('/session/:sessionId/:file', asyncHandler(async (req, res) => {
  const { sessionId, file } = req.params;
  const filePath = streamingService.getSessionFilePath(sessionId, file);

  res.setHeader('Content-Type', file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t');
  res.sendFile(filePath);
}));

// DELETE /api/stream/session/:sessionId - stop and clean up an HLS transcode session
router.delete('/session/:sessionId', asyncHandler(async (req, res) => {
  const stopped = streamingService.stopSession(req.params.sessionId);
  res.json({ success: true, stopped });
}));

// GET /api/stream/:mediaType/:id/info - probed technical metadata + recommended playback mode
router.get('/:mediaType/:id/info', asyncHandler(async (req, res) => {
  const { mediaType, id } = req.params;
  assertValidMediaType(mediaType);

  const { item } = await streamingService.getPlayableItem(mediaType, id);
  res.json(streamingService.getStreamInfo(item));
}));

// GET /api/stream/:mediaType/:id/direct - direct-play the original file (Range-aware)
router.get('/:mediaType/:id/direct', asyncHandler(async (req, res) => {
  const { mediaType, id } = req.params;
  assertValidMediaType(mediaType);

  const { filePath } = await streamingService.getPlayableItem(mediaType, id);
  streamingService.streamDirect(req, res, filePath);
}));

// GET /api/stream/:mediaType/:id/hls/master.m3u8 - start/reuse an on-demand HLS transcode session
// Optional ?mode=remux|transcode to override the automatic direct/remux/transcode decision.
router.get('/:mediaType/:id/hls/master.m3u8', asyncHandler(async (req, res) => {
  const { mediaType, id } = req.params;
  assertValidMediaType(mediaType);

  const { item, filePath } = await streamingService.getPlayableItem(mediaType, id);

  let mode = req.query.mode;
  if (mode && !['remux', 'transcode'].includes(mode)) {
    return sendBadRequest(res, 'mode must be "remux" or "transcode"');
  }
  if (!mode) {
    const decision = streamingService.decidePlaybackMode(item);
    // The HLS endpoint always transcodes/remuxes - "direct" isn't a valid HLS
    // mode, so fall back to the cheapest still-compatible option.
    mode = decision.mode === 'direct' ? 'remux' : decision.mode;
  }

  const numericId = Number.parseInt(id, 10);
  const session = await streamingService.getOrCreateHlsSession(mediaType, numericId, filePath, mode);
  const playlist = streamingService.getSessionPlaylist(session.sessionId);

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.send(playlist);
}));

module.exports = router;
