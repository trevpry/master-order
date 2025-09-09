/**
 * Core Routes Router Factory
 * Modular router that combines all core application domains
 * Phase 4 Modularization: Extracted from monolithic remaining_routes.js (5,248 lines → 8 modules)
 */

const express = require('express');

// Import modular route creators
const createMusicRoutes = require('./music');
const createSessionTrackingRoutes = require('./sessionTracking');
const createBackgroundRoutes = require('./backgrounds');
const createWatchStatsRoutes = require('./watchStats');
const createSearchRoutes = require('./search');
const createDebugRoutes = require('./debug');
const createLegacyAndroidRoutes = require('./legacyAndroid');
const createMediaControlRoutes = require('./mediaControl');

/**
 * Create complete core router with all remaining domains
 * @param {object} options - Configuration options
 * @returns {express.Router} Complete core router
 */
function createCoreRouter(options = {}) {
  const router = express.Router();
  
  // Initialize database client
  const prisma = require('../../prismaClient');
  
  // Initialize services
  const WatchStatsRoutes = require('../watchStatsRoutes');
  const watchLogService = require('../../watchLogService');
  const StatisticsService = require('../../services/statisticsService');
  const artworkCache = require('../../artworkCacheService');
  
  // Create service instances
  const watchLogServiceInstance = new (require('../../watchLogService'))(prisma);
  const statisticsService = new StatisticsService(prisma, watchLogServiceInstance);
  const watchStatsRoutes = new WatchStatsRoutes(watchLogServiceInstance, statisticsService);
  
  // Prepare service dependencies
  const services = {
    watchStatsRoutes,
    artworkCache
  };
  
  console.log('Core router: Mounting modular routes...');
  
  // Mount modular routes by domain
  
  // Music management (largest domain - 23 routes)
  router.use('/', createMusicRoutes(prisma, services));
  
  // Session tracking (reading/viewing)
  router.use('/', createSessionTrackingRoutes(prisma));
  
  // Background galleries and images
  router.use('/', createBackgroundRoutes(prisma));
  
  // Watch statistics and logging
  router.use('/', createWatchStatsRoutes(prisma, services));
  
  // Search functionality
  router.use('/', createSearchRoutes(prisma));
  
  // Debug utilities
  router.use('/', createDebugRoutes(prisma));
  
  // Legacy Android routes (to be deprecated)
  router.use('/', createLegacyAndroidRoutes(prisma));
  
  // Media control and custom orders
  router.use('/', createMediaControlRoutes(prisma, services));
  
  console.log('Core router: All 8 modules mounted successfully');
  
  return router;
}

module.exports = createCoreRouter;
