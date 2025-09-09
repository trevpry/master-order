/**
 * Main Stash Routes Router
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * This router mounts all Stash-related sub-modules for clean modular organization
 */

const express = require('express');

// Factory function to create router with dependencies
function createStashRouter(dependencies = {}) {
  const router = express.Router();
  
  // Import all Stash sub-modules
  const connectionRoutes = require('./connection');
  const imagesRoutes = require('./images');
  const scenesRoutes = require('./scenes');
  const clipsRoutes = require('./clips');
  const syncRoutes = require('./sync');
  const browseRoutes = require('./browse');
  const statsRoutes = require('./stats');

  // Mount sub-module routes with appropriate prefixes  
  router.use('/', connectionRoutes);
  router.use('/images', imagesRoutes);
  router.use('/scenes', scenesRoutes);
  router.use('/clips', clipsRoutes);
  router.use('/sync', syncRoutes);
  router.use('/stats', statsRoutes);

  // Mount browse routes at root level for backward compatibility
  router.use('/', browseRoutes);
  
  // Handle special routes that need dependencies (like WebSocket)
  if (dependencies.io || dependencies.stashBackgroundSync) {
    const specialRoutes = require('./special')(dependencies);
    router.use('/', specialRoutes);
  }

  return router;
}

module.exports = createStashRouter;
