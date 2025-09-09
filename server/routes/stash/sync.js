const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { initializeStashSyncService, getActiveStashService, getActiveSyncService, getSyncServiceType } = require('./shared');

const prisma = new PrismaClient();

// POST /sync - Manual full sync endpoint
router.post('/', async (req, res) => {
  try {
    await initializeStashSyncService();
    
    const activeSyncService = getActiveSyncService();
    if (!activeSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured',
        message: 'Please configure Stash URL in settings'
      });
    }
    
    const syncServiceType = getSyncServiceType();
    
    // Check if background sync is in progress (if available)
    // Note: This requires access to stashBackgroundSync from main scope
    // TODO: Consider moving background sync check to shared utilities
    
    console.log(`Starting manual Stash full sync (${syncServiceType})...`);
    const startTime = Date.now();
    
    // Use optimized sync if available, fallback to legacy
    const results = syncServiceType === 'optimized' && activeSyncService.fullSyncOptimized
      ? await activeSyncService.fullSyncOptimized()
      : await activeSyncService.fullSync();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Manual Stash sync (${syncServiceType}) completed in ${duration}s`);
    
    res.json({
      success: true,
      message: `Stash sync (${syncServiceType}) completed successfully in ${duration}s`,
      syncType: syncServiceType,
      duration: duration,
      results: results,
      performanceImprovement: results?.performanceImprovement || null
    });
  } catch (error) {
    const syncServiceType = getSyncServiceType();
    console.error(`Error during manual Stash sync (${syncServiceType}):`, error);
    res.status(500).json({ 
      error: 'Stash sync failed',
      message: error.message,
      syncType: syncServiceType,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /sync/config - Sync configuration endpoint
router.get('/config', async (req, res) => {
  try {
    await initializeStashSyncService();
    const syncServiceType = getSyncServiceType();
    const stashSyncService = getActiveStashService();
    const stashSyncServiceOptimized = getActiveStashService('optimized');
    
    res.json({
      success: true,
      syncType: syncServiceType,
      availableTypes: ['legacy', 'optimized'],
      services: {
        legacy: !!stashSyncService,
        optimized: !!stashSyncServiceOptimized
      },
      configuration: {
        optimizedPageSize: stashSyncServiceOptimized?.pageSize || 500,
        legacyPageSize: 250,
        memoryCache: syncServiceType === 'optimized' ? 'enabled' : 'disabled',
        parallelSync: syncServiceType === 'optimized' ? 'enabled' : 'disabled',
        batchTransactions: syncServiceType === 'optimized' ? 'enabled' : 'disabled'
      }
    });
  } catch (error) {
    console.error('Error getting sync configuration:', error);
    res.status(500).json({
      error: 'Failed to get sync configuration',
      message: error.message
    });
  }
});

// POST /sync/benchmark - Sync benchmark endpoint
router.post('/benchmark', async (req, res) => {
  try {
    await initializeStashSyncService();
    
    const stashSyncService = getActiveStashService('legacy');
    const stashSyncServiceOptimized = getActiveStashService('optimized');
    
    if (!stashSyncService || !stashSyncServiceOptimized) {
      return res.status(400).json({ 
        error: 'Stash sync services not configured',
        message: 'Please configure Stash URL in settings'
      });
    }
    
    const { testType = 'tags', pageCount = 2 } = req.body;
    
    console.log(`Starting sync performance benchmark (${testType}, ${pageCount} pages)...`);
    
    // Test legacy sync
    console.log('🐌 Testing legacy sync performance...');
    const legacyStart = Date.now();
    let legacyCount = 0;
    
    for (let page = 1; page <= pageCount; page++) {
      let result;
      switch (testType) {
        case 'tags':
          result = await stashSyncService.syncTags(page, 100); // Smaller page size for testing
          legacyCount += result.tags.length;
          break;
        case 'studios':
          result = await stashSyncService.syncStudios(page, 100);
          legacyCount += result.studios.length;
          break;
        case 'performers':
          result = await stashSyncService.syncPerformers(page, 100);
          legacyCount += result.performers.length;
          break;
        default:
          throw new Error(`Unsupported test type: ${testType}`);
      }
    }
    
    const legacyTime = Date.now() - legacyStart;
    
    // Test optimized sync
    console.log('🚀 Testing optimized sync performance...');
    const optimizedStart = Date.now();
    let optimizedCount = 0;
    
    for (let page = 1; page <= pageCount; page++) {
      let result;
      switch (testType) {
        case 'tags':
          result = await stashSyncServiceOptimized.syncTagsOptimized(page);
          optimizedCount += result.tags.length;
          break;
        case 'studios':
          result = await stashSyncServiceOptimized.syncStudiosOptimized(page);
          optimizedCount += result.studios.length;
          break;
        case 'performers':
          result = await stashSyncServiceOptimized.syncPerformersOptimized(page);
          optimizedCount += result.performers.length;
          break;
        default:
          throw new Error(`Unsupported test type: ${testType}`);
      }
    }
    
    const optimizedTime = Date.now() - optimizedStart;
    
    // Calculate performance improvement
    const speedup = (legacyTime / optimizedTime).toFixed(2);
    const timeSaved = legacyTime - optimizedTime;
    const timeSavedPercent = ((timeSaved / legacyTime) * 100).toFixed(1);
    
    console.log(`✅ Benchmark completed - ${speedup}x speedup achieved`);
    
    res.json({
      success: true,
      benchmark: {
        testType,
        pageCount,
        legacy: {
          timeMs: legacyTime,
          count: legacyCount,
          itemsPerSecond: (legacyCount / (legacyTime / 1000)).toFixed(2)
        },
        optimized: {
          timeMs: optimizedTime,
          count: optimizedCount,
          itemsPerSecond: (optimizedCount / (optimizedTime / 1000)).toFixed(2)
        },
        improvement: {
          speedupMultiplier: parseFloat(speedup),
          timeSavedMs: timeSaved,
          timeSavedPercent: parseFloat(timeSavedPercent),
          summary: `${speedup}x faster (${timeSavedPercent}% time saved)`
        }
      }
    });
    
  } catch (error) {
    console.error('Error during sync benchmark:', error);
    res.status(500).json({
      error: 'Benchmark failed',
      message: error.message
    });
  }
});

// POST /sync/scenes - Sync scenes endpoint
router.post('/scenes', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash scenes sync (page ${page})...`);
    
    const results = await stashSyncService.syncScenes(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.scenes.length} scenes from page ${page}`,
      results: {
        synced: results.scenes.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash scenes:', error);
    res.status(500).json({ 
      error: 'Stash scenes sync failed',
      message: error.message 
    });
  }
});

// POST /sync/performers - Sync performers endpoint
router.post('/performers', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash performers sync (page ${page})...`);
    
    const results = await stashSyncService.syncPerformers(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.performers.length} performers from page ${page}`,
      results: {
        synced: results.performers.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash performers:', error);
    res.status(500).json({ 
      error: 'Stash performers sync failed',
      message: error.message 
    });
  }
});

// POST /sync/studios - Sync studios endpoint
router.post('/studios', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash studios sync (page ${page})...`);
    
    const results = await stashSyncService.syncStudios(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.studios.length} studios from page ${page}`,
      results: {
        synced: results.studios.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash studios:', error);
    res.status(500).json({ 
      error: 'Stash studios sync failed',
      message: error.message 
    });
  }
});

// POST /sync/tags - Sync tags endpoint
router.post('/tags', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash tags sync (page ${page})...`);
    
    const results = await stashSyncService.syncTags(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.tags.length} tags from page ${page}`,
      results: {
        synced: results.tags.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash tags:', error);
    res.status(500).json({ 
      error: 'Stash tags sync failed',
      message: error.message 
    });
  }
});

// POST /sync/galleries - Sync galleries endpoint
router.post('/galleries', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash galleries sync (page ${page})...`);
    
    const results = await stashSyncService.syncGalleries(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.galleries.length} galleries from page ${page}`,
      results: {
        synced: results.galleries.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash galleries:', error);
    res.status(500).json({ 
      error: 'Stash galleries sync failed',
      message: error.message 
    });
  }
});

// POST /sync/images - Sync images endpoint
router.post('/images', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash standalone images sync (page ${page})...`);
    
    const results = await stashSyncService.syncAllImages(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.images.length} standalone images from page ${page}`,
      results: {
        synced: results.images.length,
        hasMore: results.hasMore,
        total: results.total,
        page: results.page
      }
    });
  } catch (error) {
    console.error('Error syncing Stash standalone images:', error);
    res.status(500).json({ 
      error: 'Stash standalone images sync failed',
      message: error.message 
    });
  }
});

// GET /sync/status - Get Stash sync status
router.get('/status', async (req, res) => {
  try {
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();
    
    // Note: Background sync status would need to be passed from main scope
    // TODO: Consider refactoring background sync to be part of shared utilities
    const backgroundSyncStatus = null; // stashBackgroundSync ? stashBackgroundSync.getSyncStatus() : null;
    
    res.json({
      backgroundSync: backgroundSyncStatus,
      serviceInitialized: !!stashSyncService,
      configuration: {
        stashUrlConfigured: !!(await prisma.settings.findFirst())?.stashUrl,
        stashApiKeyConfigured: !!(await prisma.settings.findFirst())?.stashApiKey
      }
    });
  } catch (error) {
    console.error('Error getting Stash sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

module.exports = router;
