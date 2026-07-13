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
    androidMusic: null,
    plexMusicSession: null,
    lastPlexItem: null,
    lastMusicTrack: null,
    lastStashScene: null,
    lastStashClip: null,
    fetchedAt: new Date().toISOString(),
  };

  // ── Android-reported music playback state ────────────────────────────────
  try {
    const androidMusicState = global.androidMusicState;
    if (androidMusicState && androidMusicState.title) {
      results.androidMusic = {
        title: androidMusicState.title,
        artist: androidMusicState.artist || null,
        album: androidMusicState.album || null,
        ratingKey: androidMusicState.ratingKey || null,
        userRating: androidMusicState.userRating ?? null,
        artworkUrl: androidMusicState.artworkUrl || null,
        thumb: androidMusicState.thumb || null,
        parentThumb: androidMusicState.parentThumb || null,
        grandparentThumb: androidMusicState.grandparentThumb || null,
        art: androidMusicState.art || null,
        isPlaying: Boolean(androidMusicState.isPlaying),
        positionMs: androidMusicState.positionMs ?? null,
        durationMs: androidMusicState.durationMs ?? null,
        source: androidMusicState.source || 'android_app',
        appName: androidMusicState.appName || null,
        updatedAt: androidMusicState.updatedAt || null,
      };
    }
  } catch (err) {
    // non-fatal
  }

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
      parentThumb: s.parentThumb || null,
      grandparentThumb: s.grandparentThumb || null,
      art: s.art || null,
      duration: s.duration || null,
      viewOffset: s.viewOffset || null,
      state: s.Player?.state || 'unknown',
      playerTitle: s.Player?.title || null,
      playerDevice: s.Player?.device || null,
      sessionKey: s.sessionKey || null,
      user: s.User?.title || null,
    }));

    // ── Active Plex music session (track playing in any Plex client) ─────────
    // Prefer a playing session; fall back to any paused music session.
    const musicSessions = sessionList.filter(s => s.type === 'track');
    const activeMusicSession =
      musicSessions.find(s => s.Player?.state === 'playing') ||
      musicSessions.find(s => s.Player?.state === 'paused');

    if (activeMusicSession) {
      const s = activeMusicSession;
      results.plexMusicSession = {
        title: s.title,
        artist: s.grandparentTitle || null,
        album: s.parentTitle || null,
        ratingKey: s.ratingKey || null,
        userRating: s.userRating ?? null,
        artworkUrl: null,
        thumb: s.thumb || null,
        parentThumb: s.parentThumb || null,
        grandparentThumb: s.grandparentThumb || null,
        art: s.art || null,
        isPlaying: s.Player?.state === 'playing',
        positionMs: s.viewOffset ?? null,
        durationMs: s.duration ?? null,
        source: 'plex_app',
        appName: s.Player?.title || s.Player?.device || 'Plex',
        updatedAt: new Date().toISOString(),
      };
    }
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
