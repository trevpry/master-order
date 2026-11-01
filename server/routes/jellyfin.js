/**
 * Jellyfin integration routes (/api/jellyfin).
 *
 * Movies and TV are served by Jellyfin. Library data lives in the shared
 * video tables (populated by jellyfinSyncService), so DB-backed endpoints such
 * as /api/plex/tv-browser, /movie-browser, /up-next and /media/:key keep
 * working unchanged and are also exposed here.
 */
const express = require('express');
const router = express.Router();
const { sendBadRequest, sendServerError, sendSuccess, asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');
const jellyfin = require('../services/jellyfinService');
const { ticksToMs } = require('../services/jellyfinService');
const jellyfinSyncService = require('../jellyfinSyncService');
const jellyfinBackgroundSync = require('../services/jellyfinBackgroundSync');
const jellyfinPlayer = require('../services/jellyfinPlayerService');
const { clearSettingsCache } = require('../databaseUtils');

// ===== CONNECTION / CONFIG =====

router.get('/test-connection', asyncHandler(async (req, res) => {
  if (!(await jellyfin.isConfigured())) {
    return res.status(400).json({ success: false, error: 'Jellyfin not configured', message: 'Set the Jellyfin URL and API key in settings' });
  }
  const result = await jellyfin.testConnection();
  res.json({ success: true, message: `Connected to Jellyfin server ${result.serverName} (${result.version})`, ...result });
}));

// Test arbitrary credentials before saving them
router.post('/test-connection', asyncHandler(async (req, res) => {
  const { url, apiKey } = req.body || {};
  if (!url || !apiKey) return sendBadRequest(res, 'url and apiKey are required');
  const { JellyfinService } = require('../services/jellyfinService');
  const svc = new JellyfinService({ url, apiKey });
  try {
    const result = await svc.testConnection();
    const users = await svc.getUsers();
    res.json({ success: true, message: `Connected to Jellyfin server ${result.serverName} (${result.version})`, ...result, users: users.map(u => ({ id: u.Id, name: u.Name, isAdministrator: !!u.Policy?.IsAdministrator })) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.response?.statusText || error.message });
  }
}));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await jellyfin.getUsers();
  res.json(users.map(u => ({ id: u.Id, name: u.Name, title: u.Name, isAdministrator: !!u.Policy?.IsAdministrator })));
}));

router.get('/libraries', asyncHandler(async (req, res) => {
  const libraries = await jellyfin.getVideoLibraries();
  res.json(libraries.map(l => ({ id: l.ItemId, name: l.Name, type: l.CollectionType === 'movies' ? 'movie' : 'show' })));
}));

// ===== SYNC =====

router.post('/sync', asyncHandler(async (req, res) => {
  if (!(await jellyfin.isConfigured())) {
    return res.status(400).json({ error: 'Jellyfin not configured', message: 'Please configure the Jellyfin URL and API key in settings' });
  }
  if (jellyfinSyncService.isSyncing) {
    return res.status(409).json({ error: 'A Jellyfin sync is already running' });
  }
  const startTime = Date.now();
  const results = await jellyfinSyncService.fullSync('manual');
  const duration = (Date.now() - startTime) / 1000;
  res.json({ success: true, message: `Jellyfin sync completed successfully in ${duration}s`, duration, results });
}));

router.get('/sync-log', asyncHandler(async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 25;
  const logs = await prisma.plexSyncRunLog.findMany({
    where: { provider: 'jellyfin' },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  res.json(logs);
}));

router.get('/sync-status', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();
  const status = await jellyfinSyncService.getSyncStatus();
  res.json({
    ...status,
    backgroundSync: jellyfinBackgroundSync.getSyncStatus(),
    configuration: {
      jellyfinUrlConfigured: !!settings?.jellyfinUrl,
      jellyfinApiKeyConfigured: !!settings?.jellyfinApiKey,
      jellyfinUserConfigured: !!settings?.jellyfinUserId
    }
  });
}));

router.get('/background-sync-status', asyncHandler(async (req, res) => {
  res.json(jellyfinBackgroundSync.getSyncStatus());
}));

router.post('/background-sync/start', asyncHandler(async (req, res) => {
  await jellyfinBackgroundSync.start();
  res.json({ message: 'Jellyfin background sync service started successfully' });
}));

router.post('/background-sync/stop', asyncHandler(async (req, res) => {
  await jellyfinBackgroundSync.stop();
  res.json({ message: 'Jellyfin background sync service stopped successfully' });
}));

router.post('/background-sync/force-now', asyncHandler(async (req, res) => {
  const result = await jellyfinBackgroundSync.forceSyncNow();
  res.json({ message: 'Jellyfin background sync completed', result });
}));

// ===== COLLECTIONS =====

// Unified collection list (movies and series share collections in Jellyfin)
router.get('/collections', asyncHandler(async (req, res) => {
  const collections = await prisma.mediaCollection.findMany({
    where: { removed: false },
    orderBy: { name: 'asc' },
    select: { name: true }
  });
  const names = [...new Set(collections.map(c => c.name))].sort((a, b) => a.localeCompare(b));
  res.json(names.map(name => ({ value: name, label: name })));
}));

// Collection graph with direct and nested membership
router.get('/collections/tree', asyncHandler(async (req, res) => {
  const collections = await prisma.mediaCollection.findMany({
    where: { removed: false },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { name: 'asc' }
  });
  const byJfId = new Map(collections.map(c => [c.jellyfinId, c]));
  const childCollectionIds = new Set();
  const nodes = collections.map(c => {
    const childCollections = c.items.filter(i => i.itemType === 'collection').map(i => i.itemKey);
    childCollections.forEach(id => childCollectionIds.add(id));
    return {
      id: c.jellyfinId,
      name: c.name,
      thumb: c.thumb,
      movieCount: c.items.filter(i => i.itemType === 'movie').length,
      showCount: c.items.filter(i => i.itemType === 'show').length,
      childCollections: childCollections.filter(id => byJfId.has(id)).map(id => ({ id, name: byJfId.get(id).name }))
    };
  });
  res.json({ collections: nodes, rootIds: nodes.filter(n => !childCollectionIds.has(n.id)).map(n => n.id) });
}));

// Every movie and show in a collection, including nested collections
router.get('/collections/:name/items', asyncHandler(async (req, res) => {
  const name = req.params.name;
  const needle = JSON.stringify(name);
  const [movies, shows] = await Promise.all([
    prisma.plexMovie.findMany({ where: { removed: false, collections: { contains: needle } }, select: { ratingKey: true, title: true, year: true, thumb: true, viewCount: true, originallyAvailableAt: true }, orderBy: { originallyAvailableAt: 'asc' } }),
    prisma.plexTVShow.findMany({ where: { removed: false, collections: { contains: needle } }, select: { ratingKey: true, title: true, year: true, thumb: true, leafCount: true, viewedLeafCount: true }, orderBy: { title: 'asc' } })
  ]);
  res.json({ name, movies, shows });
}));

// ===== PLAYERS / PLAYBACK =====

router.get('/players', asyncHandler(async (req, res) => {
  const players = await jellyfinPlayer.getPlayers();
  res.json(players.map(p => ({
    value: p.machineIdentifier,
    label: `${p.name} (${p.product})${p.userName ? ` - ${p.userName}` : ''}`,
    ...p
  })));
}));

router.get('/sessions', asyncHandler(async (req, res) => {
  res.json(await jellyfinPlayer.getAllSessions());
}));

router.get('/selected-player', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();
  res.json({ selectedPlayer: settings?.selectedPlayer || null, playerName: settings?.selectedPlexPlayerName || null });
}));

router.post('/play', asyncHandler(async (req, res) => {
  const { ratingKey, itemId, offset = 0, playerId } = req.body || {};
  const id = itemId || ratingKey;
  if (!id) return sendBadRequest(res, 'Missing ratingKey/itemId parameter');
  // offset is seconds (legacy Plex API contract)
  const result = await jellyfinPlayer.playMedia(playerId, String(id), Number(offset || 0) * 1000);
  if (result?.success !== true) {
    return sendServerError(res, typeof result?.error === 'string' ? result.error : 'Jellyfin player did not accept the playback command');
  }
  sendSuccess(res, result);
}));

router.post('/control/:action', asyncHandler(async (req, res) => {
  const { action } = req.params;
  const validActions = ['play', 'pause', 'stop', 'skipNext', 'skipPrevious', 'seekTo'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action', validActions });
  }
  res.json(await jellyfinPlayer.controlPlayback(req.body?.playerId, action, req.body || {}));
}));

router.get('/device-status/:deviceId', asyncHandler(async (req, res) => {
  res.json(await jellyfinPlayer.getDeviceStatus(req.params.deviceId));
}));

// ===== WATCH STATE =====

router.post('/items/:itemId/played', asyncHandler(async (req, res) => {
  const { markJellyfinItemWatched } = require('../services/jellyfinWatchState');
  res.json(await markJellyfinItemWatched(req.params.itemId, true));
}));

router.delete('/items/:itemId/played', asyncHandler(async (req, res) => {
  const { markJellyfinItemWatched } = require('../services/jellyfinWatchState');
  res.json(await markJellyfinItemWatched(req.params.itemId, false));
}));

// ===== PLAYBACK INFO (Android in-app player) =====

// Returns stream URLs and reporting info for an item. Clients authenticate to
// Jellyfin directly with the returned token.
router.get('/playback/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const cfg = await jellyfin.getConfig();
  const item = await jellyfin.getItem(itemId);
  const source = (item.MediaSources || [])[0];
  res.json({
    itemId,
    title: item.Name,
    type: item.Type,
    seriesTitle: item.SeriesName || null,
    seasonNumber: item.ParentIndexNumber ?? null,
    episodeNumber: item.IndexNumber ?? null,
    durationMs: ticksToMs(item.RunTimeTicks),
    resumePositionMs: ticksToMs(item.UserData?.PlaybackPositionTicks) || 0,
    played: !!item.UserData?.Played,
    mediaSourceId: source?.Id || itemId,
    container: source?.Container || null,
    serverUrl: cfg.url,
    userId: await jellyfin.getUserId(),
    directStreamUrl: await jellyfin.getStreamUrl(itemId, { mediaSourceId: source?.Id }),
    hlsUrl: await jellyfin.getHlsUrl(itemId, { mediaSourceId: source?.Id })
  });
}));

// Settings changes affecting Jellyfin should drop cached settings
router.post('/refresh-config', asyncHandler(async (req, res) => {
  clearSettingsCache();
  res.json({ success: true });
}));

module.exports = router;
