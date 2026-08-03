/**
 * Shared utilities and services for Stash route modules
 * Part of Eddie Life Management - Stash Integration Module
 */

// Import required services and utilities
const prisma = require('../../prismaClient');
const StashSyncService = require('../../stashSyncService');
const StashSyncServiceOptimized = require('../../stashSyncServiceOptimized');
const StashBackgroundSyncService = require('../../stashBackgroundSyncService');

// Shared service instances and configuration
let stashSyncService = null;
let stashSyncServiceOptimized = null;
const stashBackgroundSync = new StashBackgroundSyncService();
const SYNC_SERVICE_TYPE = process.env.STASH_SYNC_OPTIMIZED === 'false' ? 'legacy' : 'optimized';

/**
 * Helper function for getting active sync service
 */
function getActiveSyncService() {
  if (SYNC_SERVICE_TYPE === 'optimized' && stashSyncServiceOptimized) {
    return stashSyncServiceOptimized;
  }
  return stashSyncService;
}

/**
 * Get specific sync service by type
 */
function getActiveStashService(type = null) {
  if (type === 'optimized') {
    return stashSyncServiceOptimized;
  } else if (type === 'legacy') {
    return stashSyncService;
  }
  // Default to current active service
  return getActiveSyncService();
}

/**
 * Get current sync service type
 */
function getSyncServiceType() {
  return SYNC_SERVICE_TYPE;
}

/**
 * Initialize sync services
 */
async function initializeStashSyncService() {
  try {
    // Initialize both services
    stashSyncService = new StashSyncService();
    stashSyncServiceOptimized = new StashSyncServiceOptimized();
    
    console.log('✅ Stash sync services initialized in modular routes');
    console.log('   - Legacy sync service: Available');
    console.log('   - Optimized sync service: Available');
    console.log('   - Active sync type:', SYNC_SERVICE_TYPE);
  } catch (error) {
    console.error('❌ Error initializing Stash sync services:', error.message);
    stashSyncService = null;
    stashSyncServiceOptimized = null;
  }
}

/**
 * Reload any initialized sync services after settings changes.
 */
async function reloadStashSyncServices() {
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  if (stashSyncService?.reloadConfig) {
    await stashSyncService.reloadConfig();
  }

  if (stashSyncServiceOptimized?.reloadConfig) {
    await stashSyncServiceOptimized.reloadConfig();
  }
}

/**
 * Utility function for generating optimized clips
 */
function generateOptimizedClips(sceneId, sceneDuration, clipDuration = 60) {
  const clipsToCreate = [];
  const totalFullClips = Math.floor(sceneDuration / clipDuration);
  const remainingTime = sceneDuration % clipDuration;
  
  // If no clips can be created, return empty array
  if (totalFullClips === 0) {
    return [];
  }
  
  // If there's no remaining time or remaining time is >= 60 seconds, use standard logic
  if (remainingTime === 0 || remainingTime >= 60) {
    for (let i = 0; i < totalFullClips; i++) {
      const startTime = i * clipDuration;
      const endTime = Math.min(startTime + clipDuration, sceneDuration);
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: i,
        startTime: startTime,
        endTime: endTime,
        duration: endTime - startTime,
        watched: false
      });
    }
    
    // Add final partial clip if it's >= 60 seconds
    if (remainingTime >= 60) {
      const startTime = totalFullClips * clipDuration;
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: totalFullClips,
        startTime: startTime,
        endTime: sceneDuration,
        duration: remainingTime,
        watched: false
      });
    }
  } else {
    // Remaining time is < 60 seconds, merge with penultimate clip
    // Create all clips except the last two
    for (let i = 0; i < totalFullClips - 1; i++) {
      const startTime = i * clipDuration;
      const endTime = (i + 1) * clipDuration;
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: i,
        startTime: startTime,
        endTime: endTime,
        duration: clipDuration,
        watched: false
      });
    }
    
    // Create the final extended clip that includes the last full clip + remaining time
    if (totalFullClips >= 1) {
      const startTime = (totalFullClips - 1) * clipDuration;
      const endTime = sceneDuration;
      const extendedDuration = endTime - startTime;
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: totalFullClips - 1,
        startTime: startTime,
        endTime: endTime,
        duration: extendedDuration,
        watched: false
      });
      
      console.log(`🔗 Merged short final clip (${remainingTime}s) with penultimate clip. Final clip duration: ${extendedDuration}s`);
    }
  }
  
  return clipsToCreate;
}

module.exports = {
  prisma,
  stashBackgroundSync,
  SYNC_SERVICE_TYPE,
  getActiveSyncService,
  getActiveStashService,
  getSyncServiceType,
  initializeStashSyncService,
  reloadStashSyncServices,
  generateOptimizedClips
};
