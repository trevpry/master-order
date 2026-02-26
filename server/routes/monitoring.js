const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');
const PlexPlayerService = require('../plexPlayerService');

let plexPlayerService = null;

async function getPlexService() {
  if (!plexPlayerService) {
    plexPlayerService = new PlexPlayerService();
  }
  return plexPlayerService;
}

/**
 * GET /api/monitoring
 * Returns current playback state across all sources:
 * - Active Plex sessions (currently playing or paused)
 * - Last played Plex item (TV/movie from WatchLog)
 * - Last played music track (PlexTrack by lastViewedAt)
 * - Last played Stash scene
 * - Last watched Stash clip
 */
router.get('/', asyncHandler(async (req, res) => {
  const results = {
    plexSessions: [],
    plexSessionsError: null,
    lastPlexItem: null,
    lastMusicTrack: null,
    lastStashScene: null,
    lastStashClip: null,
    fetchedAt: new Date().toISOString(),
  };

  // ── Active Plex sessions ─────────────────────────────────────────────────
  try {
    const svc = await getPlexService();
    await svc.initializeClient();
    const raw = await svc.client.query('/status/sessions');
    const sessions = raw?.MediaContainer?.Metadata;
    const sessionList = sessions
      ? Array.isArray(sessions) ? sessions : [sessions]
      : [];

    results.plexSessions = sessionList.map(s => ({
      ratingKey: s.ratingKey,
      type: s.type,
      title: s.title,
      grandparentTitle: s.grandparentTitle || null,
      parentTitle: s.parentTitle || null,
      parentIndex: s.parentIndex || null,   // season
      index: s.index || null,               // episode
      year: s.year || null,
      thumb: s.thumb || s.parentThumb || s.grandparentThumb || null,
      duration: s.duration || null,
      viewOffset: s.viewOffset || null,
      state: s.Player?.state || 'unknown',
      playerTitle: s.Player?.title || null,
      playerDevice: s.Player?.device || null,
      sessionKey: s.sessionKey || null,
      user: s.User?.title || null,
    }));
  } catch (err) {
    results.plexSessionsError = err.message;
  }

  // ── Last played Plex item (TV / movie) ──────────────────────────────────
  try {
    const lastLog = await prisma.watchLog.findFirst({
      where: { mediaType: { in: ['tv', 'movie'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (lastLog) {
      results.lastPlexItem = {
        title: lastLog.title,
        seriesTitle: lastLog.seriesTitle || null,
        seasonNumber: lastLog.seasonNumber || null,
        episodeNumber: lastLog.episodeNumber || null,
        mediaType: lastLog.mediaType,
        plexKey: lastLog.plexKey || null,
        watchedAt: lastLog.createdAt,
      };
    }
  } catch (err) {
    // non-fatal
  }

  // ── Last played music track ──────────────────────────────────────────────
  try {
    const lastTrack = await prisma.plexTrack.findFirst({
      where: { lastViewedAt: { not: null } },
      orderBy: { lastViewedAt: 'desc' },
      include: {
        album: {
          include: { artist: true },
        },
      },
    });
    if (lastTrack) {
      results.lastMusicTrack = {
        ratingKey: lastTrack.ratingKey,
        title: lastTrack.title,
        artist: lastTrack.album?.artist?.title || lastTrack.album?.artist?.userTitle || null,
        album: lastTrack.album?.title || lastTrack.album?.userTitle || null,
        thumb: lastTrack.parentThumb || lastTrack.thumb || null,
        lastViewedAt: lastTrack.lastViewedAt,
        duration: lastTrack.duration,
      };
    }
  } catch (err) {
    // non-fatal
  }

  // ── Last played Stash scene ──────────────────────────────────────────────
  try {
    const lastScene = await prisma.stashScene.findFirst({
      where: { lastPlayedAt: { not: null } },
      orderBy: { lastPlayedAt: 'desc' },
      select: {
        id: true,
        title: true,
        studio: true,
        lastPlayedAt: true,
        duration: true,
        playCount: true,
        userRating: true,
        performers: {
          include: {
            performer: { select: { id: true, name: true } },
          },
          take: 5,
        },
      },
    });
    if (lastScene) {
      results.lastStashScene = {
        id: lastScene.id,
        title: lastScene.title,
        studio: lastScene.studio || null,
        lastPlayedAt: lastScene.lastPlayedAt,
        duration: lastScene.duration,
        playCount: lastScene.playCount || 0,
        userRating: lastScene.userRating || null,
        performers: lastScene.performers.map(p => p.performer?.name).filter(Boolean),
      };
    }
  } catch (err) {
    // non-fatal
  }

  // ── Last watched Stash clip ──────────────────────────────────────────────
  try {
    const lastClip = await prisma.stashClip.findFirst({
      where: { watchedAt: { not: null } },
      orderBy: { watchedAt: 'desc' },
      include: {
        scene: { select: { id: true, title: true, studio: true } },
      },
    });
    if (lastClip) {
      results.lastStashClip = {
        id: lastClip.id,
        clipIndex: lastClip.clipIndex,
        title: lastClip.title || null,
        startTime: lastClip.startTime,
        endTime: lastClip.endTime,
        duration: lastClip.duration,
        watchedAt: lastClip.watchedAt,
        sceneId: lastClip.sceneId,
        sceneTitle: lastClip.scene?.title || null,
        studio: lastClip.scene?.studio || null,
      };
    }
  } catch (err) {
    // non-fatal
  }

  res.json(results);
}));

module.exports = router;
