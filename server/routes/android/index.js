/**
 * Android Routes Router Factory
 * Modular router that c  // Gallery and playlist services
  router.use('/', createGalleryPlaylistRoutes(prisma));
  
  // Weather services
  router.use('/', createWeatherRoutes());
  
  console.log('Android router: All 8 modules mounted successfully');nes all Android companion app domains
 * Phase 3 Modularization: Extracted from monolithic android.js (1,340 lines → 8 modules)
 */

const express = require('express');

// Import modular route creators
const createContentDiscoveryRoutes = require('./contentDiscovery');
const createActivityTrackingRoutes = require('./activityTracking');
const createPlaybackControlRoutes = require('./playbackControl');
const createReadingSessionRoutes = require('./readingSession');
const createHistoryPlusReadingSessionRoutes = require('./historyPlusReadingSession');
const createStashIntegrationRoutes = require('./stashIntegration');
const createStashSceneDeletionRoutes = require('./stashSceneDeletion');
const createStashTagRoutes = require('./stashTags');
const createStashClipTagRoutes = require('./stashClipTags');
const createStashClipPerformerTagRoutes = require('./stashClipPerformerTags');
const createStashPerformerRoutes = require('./stashPerformer');
const createViewingSessionRoutes = require('./viewingSession');
const createGalleryPlaylistRoutes = require('./galleryPlaylist');
const createWeatherRoutes = require('./weather');
const createCustomOrdersRoutes = require('./customOrders');

/**
 * Create complete Android router with core modules
 * @param {object} options - Configuration options
 * @param {object} options.io - Socket.io instance for WebSocket events
 * @returns {express.Router} Complete Android router
 */
function createAndroidRouter(options = {}) {
  const router = express.Router();
  const { io } = options;
  
  // Initialize database client
  const prisma = require('../../prismaClient');
  
  // Initialize core services
  const getNextEpisode = require('../../getNextEpisode');
  const getNextMovie = require('../../getNextMovie');
  const { getNextCustomOrder } = require('../../getNextCustomOrder');
  
  // Prepare service dependencies
  const services = {
    getNextEpisode,
    getNextMovie,
    getNextCustomOrder
  };
  
  console.log('Android router: Mounting modular routes...');
  
  // Mount modular routes
  
  // Content discovery
  router.use('/', createContentDiscoveryRoutes(services));
  
  // Activity tracking
  router.use('/', createActivityTrackingRoutes(prisma));
  
  // Playback control
  router.use('/', createPlaybackControlRoutes());
  
  // Reading session management
  router.use('/', createReadingSessionRoutes(prisma));
  
  // History Plus reading session management
  router.use('/', createHistoryPlusReadingSessionRoutes(prisma));
  
  // Stash integration
  router.use('/', createStashIntegrationRoutes(prisma, io));

  // Stash scene deletion by clipId
  router.use('/', createStashSceneDeletionRoutes(prisma));

  // Stash tag management (hierarchy + CRUD)
  router.use('/', createStashTagRoutes());

  // Stash clip tag assignment
  router.use('/', createStashClipTagRoutes());

  // Stash clip-performer tag assignment (three-way relationship)
  router.use('/', createStashClipPerformerTagRoutes(prisma));

  // Stash performer detail
  router.use('/', createStashPerformerRoutes());
  
  // Viewing session management
  router.use('/', createViewingSessionRoutes(prisma));
  
  // Gallery and playlist services
  router.use('/', createGalleryPlaylistRoutes(prisma));
  
  // Weather services
  router.use('/', createWeatherRoutes());
  
  // Custom orders browsing
  router.use('/', createCustomOrdersRoutes(prisma));
  
  console.log('Android router: All 14 modules mounted successfully');
  
  return router;
}

module.exports = createAndroidRouter;
