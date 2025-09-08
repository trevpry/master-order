const path = require('path');

/**
 * EDDIE LIFE MANAGEMENT - UTILITY FUNCTIONS
 * 
 * This module contains reusable utility functions used throughout the server.
 * These functions are extracted from the main server file to improve organization
 * and maintainability.
 */

/**
 * Generate optimized clips for a scene, merging short final clips with the penultimate clip
 * @param {string} sceneId - The scene ID
 * @param {number} sceneDuration - Total scene duration in seconds
 * @param {number} clipDuration - Desired clip duration (default 60 seconds)
 * @returns {Array} Array of clip objects ready for database insertion
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

/**
 * Helper function for generating a simple hash (used for web video uniqueness)
 * @param {string} str - The string to hash
 * @returns {number} A positive integer hash
 */
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Ensure positive integer
}

/**
 * Helper function to determine upload directory based on environment
 * @param {string} subDir - Optional subdirectory within uploads
 * @returns {string} Full path to the upload directory
 */
function getUploadDirectory(subDir = '') {
  if (process.env.NODE_ENV === 'production') {
    // In production/Docker, use persistent data directory
    const dataDir = process.env.DATA_PATH || '/app/data';
    return path.join(dataDir, 'uploads', subDir);
  } else {
    // In development, use local uploads directory
    return path.join(__dirname, '..', 'uploads', subDir);
  }
}

module.exports = {
  generateOptimizedClips,
  simpleHash,
  getUploadDirectory
};
