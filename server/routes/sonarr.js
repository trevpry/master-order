const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');
const prisma = require('../prismaClient');

const SonarrSyncService = require('../services/sonarrSyncService');
const LibraryBackgroundSyncService = require('../services/libraryBackgroundSyncService');

const sonarrSyncService = new SonarrSyncService();
const backgroundSyncService = new LibraryBackgroundSyncService({
  providerName: 'sonarr',
  syncService: sonarrSyncService,
  intervalSettingsKey: 'sonarrSyncInterval',
});

// ===== SYNC OPERATIONS =====

// POST /api/sonarr/sync - Manual Sonarr sync
router.post('/sync', asyncHandler(async (req, res) => {
  console.log('Starting manual Sonarr sync...');
  const result = await sonarrSyncService.fullSync('manual');
  res.json({
    success: true,
    message: `Sonarr sync completed successfully in ${result.duration}`,
    results: result,
  });
}));

// GET /api/sonarr/sync-log - Get recent Sonarr sync run summaries
router.get('/sync-log', asyncHandler(async (req, res) => {
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 25;

  const logs = await prisma.librarySyncRunLog.findMany({
    where: { provider: 'sonarr' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json(logs);
}));

// GET /api/sonarr/sync-status - Get Sonarr sync/config status
router.get('/sync-status', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findFirst();

  res.json({
    backgroundSync: backgroundSyncService.getSyncStatus(),
    configuration: {
      sonarrUrlConfigured: !!(settings?.sonarrUrl || process.env.SONARR_URL),
      sonarrApiKeyConfigured: !!(settings?.sonarrApiKey || process.env.SONARR_API_KEY),
    },
  });
}));

// POST /api/sonarr/background-sync/start
router.post('/background-sync/start', asyncHandler(async (req, res) => {
  await backgroundSyncService.start();
  res.json({ message: 'Sonarr background sync service started successfully' });
}));

// POST /api/sonarr/background-sync/stop
router.post('/background-sync/stop', asyncHandler(async (req, res) => {
  await backgroundSyncService.stop();
  res.json({ message: 'Sonarr background sync service stopped successfully' });
}));

// POST /api/sonarr/background-sync/force-now
router.post('/background-sync/force-now', asyncHandler(async (req, res) => {
  const result = await backgroundSyncService.forceSyncNow();
  res.json({ message: 'Sonarr background sync completed', result });
}));

// GET /api/sonarr/test-connection
router.get('/test-connection', asyncHandler(async (req, res) => {
  const result = await sonarrSyncService.testConnection();
  res.json({ success: true, message: 'Sonarr connection successful', ...result });
}));

// ===== WEBHOOK =====

// POST /api/sonarr/webhook - Receive Sonarr "Connect" webhook notifications
// (Download, EpisodeFileDelete, SeriesDelete, Rename, etc.) and trigger an
// async re-sync so the library stays fresh without waiting for the next
// scheduled poll. See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md Phase 1.
router.post('/webhook', asyncHandler(async (req, res) => {
  const eventType = req.body?.eventType || 'Unknown';
  console.log(`📡 Received Sonarr webhook: ${eventType}`);

  // Acknowledge immediately; Sonarr doesn't need to wait for the sync to finish.
  res.json({ success: true, message: `Webhook received (${eventType}), sync queued` });

  // Fire-and-forget re-sync; errors are logged (and recorded in LibrarySyncRunLog).
  sonarrSyncService.fullSync(`webhook:${eventType}`).catch((error) => {
    console.error(`Sonarr webhook-triggered sync failed for event ${eventType}:`, error.message);
  });
}));

module.exports = router;
