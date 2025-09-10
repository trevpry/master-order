/**
 * Health & Monitoring Routes
 * Part of Eddie Life Management - System Health & Diagnostics Module
 * 
 * Handles system health checks, service diagnostics, and monitoring endpoints
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/responses');

// Use shared Prisma client and services
const prisma = require('../prismaClient');

/**
 * GET /api/health - Main system health check endpoint
 * Used by Docker and monitoring systems to verify service status
 */
router.get('/', asyncHandler(async (req, res) => {
  // Check database connection
  await prisma.$queryRaw`SELECT 1`;
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
}));

/**
 * GET /api/health/debug/stash-service - Stash service configuration diagnostic
 * Tests Stash service initialization and configuration status
 */
router.get('/debug/stash-service', asyncHandler(async (req, res) => {
  const { getSettings } = require('../databaseUtils');
  const settings = await getSettings();
  
  console.log('🔍 Debug: Manual Stash service test');
  console.log('   - Settings:', JSON.stringify(settings, null, 2));
  
  // Prioritize database settings for debug response (consistent with runtime behavior)
  const finalStashUrl = (settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                        process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3)?.replace(/\/+$/, '');
  
  const result = {
    settingsLoaded: !!settings,
    databaseStashUrl: settings?.stashUrl || null,
    environmentStashUrl: process.env.STASH_URL || null,
    finalStashUrl: finalStashUrl || null,
    stashApiKey: !!settings?.stashApiKey,
    globalServiceExists: !!global.stashService,
    globalServiceConfigured: global.stashService ? global.stashService.isConfigured() : false
  };
  
  console.log('   - Debug result:', result);
  
  res.json(result);
}));

/**
 * GET /api/health/debug/plex - Plex connection and endpoint testing
 * Tests various Plex API endpoints and connection status
 */
router.get('/debug/plex', asyncHandler(async (req, res) => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    endpoints: {}
  };

  // Get the global plexPlayer service
  const plexPlayer = global.plexPlayer;
  if (!plexPlayer) {
    return res.status(500).json({
      error: 'Plex player service not initialized',
      timestamp: new Date().toISOString()
    });
  }

  // Test basic connection
  try {
    const connectionTest = await plexPlayer.testConnection();
    debugInfo.connection = connectionTest;
  } catch (error) {
    debugInfo.connection = { success: false, error: error.message };
  }

  // Test /clients endpoint
  try {
    const players = await plexPlayer.getPlayers();
    debugInfo.endpoints.clients = {
      success: true,
      playerCount: players.length,
      players: players
    };
  } catch (error) {
    debugInfo.endpoints.clients = {
      success: false,
      error: error.message
    };
  }

  // Test alternative methods
  try {
    const altPlayers = await plexPlayer.getPlayersAlternative();
    debugInfo.endpoints.alternative = {
      success: true,
      playerCount: altPlayers.length,
      players: altPlayers
    };
  } catch (error) {
    debugInfo.endpoints.alternative = {
      success: false,
      error: error.message
    };
  }

  res.json(debugInfo);
}));

/**
 * GET /api/health/debug/stash-clips - Stash clip statistics and diagnostic information
 * Provides detailed statistics about Stash clips for monitoring and debugging
 */
router.get('/debug/stash-clips', asyncHandler(async (req, res) => {
  const totalClips = await prisma.stashClip.count();
  const watchedClips = await prisma.stashClip.count({ where: { watched: true } });
  const unwatchedClips = await prisma.stashClip.count({ where: { watched: false } });
  
  const clipsByScene = await prisma.stashClip.groupBy({
    by: ['sceneId'],
    _count: {
      id: true
    },
    orderBy: {
      _count: {
        id: 'desc'
      }
    }
  });
  
  const sceneDetails = await Promise.all(
    clipsByScene.slice(0, 10).map(async (group) => {
      const scene = await prisma.stashScene.findUnique({
        where: { id: group.sceneId },
        select: { id: true, title: true, duration: true }
      });
      const sceneWatched = await prisma.stashClip.count({
        where: { sceneId: group.sceneId, watched: true }
      });
      const sceneUnwatched = await prisma.stashClip.count({
        where: { sceneId: group.sceneId, watched: false }
      });
      return {
        scene,
        totalClips: group._count.id,
        watchedClips: sceneWatched,
        unwatchedClips: sceneUnwatched
      };
    })
  );
  
  res.json({
    totalClips,
    watchedClips,
    unwatchedClips,
    topScenesWithClips: sceneDetails
  });
}));

module.exports = router;
