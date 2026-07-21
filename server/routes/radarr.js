const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');

const RadarrSyncService = require('../services/radarrSyncService');
const LibraryBackgroundSyncService = require('../services/libraryBackgroundSyncService');

const radarrSyncService = new RadarrSyncService();
const backgroundSyncService = new LibraryBackgroundSyncService({
  providerName: 'radarr',
  syncService: radarrSyncService,
  intervalSettingsKey: 'radarrSyncInterval',
});

// ===== SYNC OPERATIONS =====

// POST /api/radarr/sync - Manual Radarr sync
router.post('/sync', asyncHandler(async (req, res) => {
  console.log('Starting manual Radarr sync...');
  const result = await radarrSyncService.fullSync('manual');
  res.json({
    success: true,
    message: `Radarr sync completed successfully in ${result.duration}`,
    results: result,
  });
}));

// GET /api/radarr/sync-log - Get recent Radarr sync run summaries
router.get('/sync-log', asyncHandler(async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 25;

  const logs = await prisma.librarySyncRunLog.findMany({
    where: { provider: 'radarr' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json(logs);
}));

// GET /api/radarr/sync-status - Get Radarr sync/config status
router.get('/sync-status', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();

  res.json({
    backgroundSync: backgroundSyncService.getSyncStatus(),
    configuration: {
      radarrUrlConfigured: !!(settings?.radarrUrl || process.env.RADARR_URL),
      radarrApiKeyConfigured: !!(settings?.radarrApiKey || process.env.RADARR_API_KEY),
    },
  });
}));

// POST /api/radarr/background-sync/start
router.post('/background-sync/start', asyncHandler(async (req, res) => {
  await backgroundSyncService.start();
  res.json({ message: 'Radarr background sync service started successfully' });
}));

// POST /api/radarr/background-sync/stop
router.post('/background-sync/stop', asyncHandler(async (req, res) => {
  await backgroundSyncService.stop();
  res.json({ message: 'Radarr background sync service stopped successfully' });
}));

// POST /api/radarr/background-sync/force-now
router.post('/background-sync/force-now', asyncHandler(async (req, res) => {
  const result = await backgroundSyncService.forceSyncNow();
  res.json({ message: 'Radarr background sync completed', result });
}));

// GET /api/radarr/test-connection
router.get('/test-connection', asyncHandler(async (req, res) => {
  const result = await radarrSyncService.testConnection();
  res.json({ success: true, message: 'Radarr connection successful', ...result });
}));

// ===== WEBHOOK =====

// POST /api/radarr/webhook - Receive Radarr "Connect" webhook notifications
// (Download, MovieFileDelete, MovieDelete, Rename, etc.) and trigger an
// async re-sync so the library stays fresh without waiting for the next
// scheduled poll. See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md Phase 1.
router.post('/webhook', asyncHandler(async (req, res) => {
  const eventType = req.body?.eventType || 'Unknown';
  console.log(`📡 Received Radarr webhook: ${eventType}`);

  // Acknowledge immediately; Radarr doesn't need to wait for the sync to finish.
  res.json({ success: true, message: `Webhook received (${eventType}), sync queued` });

  // Fire-and-forget re-sync; errors are logged (and recorded in LibrarySyncRunLog).
  radarrSyncService.fullSync(`webhook:${eventType}`).catch((error) => {
    console.error(`Radarr webhook-triggered sync failed for event ${eventType}:`, error.message);
  });
}));

module.exports = router;
