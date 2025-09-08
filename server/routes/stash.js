/**
 * Stash Routes
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * Handles all Stash-related API endpoints including:
 * - Image proxy and serving
 * - Connection testing  
 * - Scenes management (CRUD, clips, next)
 * - Clips management (CRUD, playback, reset)
 * - Statistics and analytics
 * - Content browsing (performers, studios, tags, galleries)
 */

const express = require('express');

// Import required services and utilities
const prisma = require('../prismaClient');
const StashSyncService = require('../stashSyncService');
const StashSyncServiceOptimized = require('../stashSyncServiceOptimized');
const StashBackgroundSyncService = require('../stashBackgroundSyncService');

// Create a function that returns a router with io instance
function createStashRouter(io) {
  const router = express.Router();
  
  // Local sync service instances (initialized when needed)
  let stashSyncService = null;
  let stashSyncServiceOptimized = null;
  const stashBackgroundSync = new StashBackgroundSyncService();
  const SYNC_SERVICE_TYPE = process.env.STASH_SYNC_OPTIMIZED === 'false' ? 'legacy' : 'optimized';
  
  // Helper function for getting active sync service
  function getActiveSyncService() {
    if (SYNC_SERVICE_TYPE === 'optimized' && stashSyncServiceOptimized) {
      return stashSyncServiceOptimized;
    }
    return stashSyncService;
  }
  
  // Initialize sync services
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

// Utility function for generating optimized clips
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

// ===== IMAGE PROXY ROUTES =====

// GET /api/stash/image-proxy/* - Proxy images from Stash server  
router.get('/image-proxy/*', async (req, res) => {
  try {
    const imagePath = req.params[0]; // Get everything after /api/stash/image-proxy/
    
    // Get settings using cached database utility
    const { getSettings } = require('../databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.stashUrl) {
      return res.status(500).send('Stash settings not configured');
    }
    
    // Stash serves images through specific GraphQL endpoints or image endpoints
    // We need to extract the image ID from the database and use Stash's image serving API
    
    let imageUrl;
    
    // If the path is already a full HTTP URL, use it directly
    if (imagePath.startsWith('http')) {
      imageUrl = imagePath;
    } else {
      // For file paths, we need to find the image by path and get its ID from Stash
      // Then use Stash's image endpoint: /image/{imageId}/image
      
      // First, try to find the image ID from our database
      const image = await prisma.stashImage.findFirst({
        where: {
          OR: [
            { path: imagePath },
            { path: decodeURIComponent(imagePath) }
          ]
        }
      });
      
      if (image && image.id) {
        // Use Stash's image endpoint with the image ID
        // Normalize the URL to avoid double slashes
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/image/${image.id}/image`;
      } else {
        // Fallback: try to use the path directly (may not work for all cases)
        console.warn(`Could not find image ID for path: ${imagePath}, trying direct path`);
        
        // Remove leading slash if present and normalize base URL
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/${cleanPath}`;
      }
    }
    
    console.log(`Proxying Stash image: ${imageUrl}`);
    
    // Forward the request to Stash
    const axios = require('axios');
    
    const proxyResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });
    
    // Set content type based on response
    const contentType = proxyResponse.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    
    // Add cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the image data to the response
    proxyResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error proxying Stash image:', error.message);
    res.status(500).send('Failed to proxy image from Stash');
  }
});

// ===== CONNECTION TESTING =====

// GET /api/stash/test - Test Stash connection and configuration
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Testing Stash connection...');
    
    if (!stashSyncService) {
      console.log('⚠️ StashSyncService not initialized, initializing now...');
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      console.log('❌ StashSyncService still not available after initialization');
      return res.status(400).json({ 
        success: false, 
        message: 'Stash sync service not configured',
        configured: false
      });
    }

    console.log('🔍 Calling stashSyncService.testConnection()...');
    const version = await stashSyncService.testConnection();
    console.log('✅ Stash connection test successful:', version);
    
    // Get the Stash URL from settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    
    // Prioritize database settings for API response
    const finalStashUrl = (settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                          process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3)?.replace(/\/+$/, '');

    console.log('📋 Stash connection test results:', {
      success: true,
      version: version,
      finalStashUrl,
      hasApiKey: !!(settings?.stashApiKey)
    });
    
    res.json({ 
      success: true, 
      message: 'Stash connection successful',
      configured: true,
      version: version,
      url: finalStashUrl,
      hasApiKey: !!(settings?.stashApiKey)
    });
    
  } catch (error) {
    console.error('❌ Stash connection test failed:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Stash connection failed',
      configured: false
    });
  }
});

// ===== SCENES MANAGEMENT =====

// GET /api/stash/scenes - List all Stash scenes with pagination and filtering
router.get('/scenes', async (req, res) => {
  try {
    const { 
      page = 1, 
      perPage = 50, 
      sortBy = 'date',
      sortOrder = 'desc',
      search,
      performer,
      studio,
      tag,
      minRating,
      maxRating
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build where clause for filtering
    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
        { synopsis: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (performer) {
      where.performers = {
        some: {
          performer: {
            name: { contains: performer, mode: 'insensitive' }
          }
        }
      };
    }
    
    if (studio) {
      where.OR = [
        {
          studioObject: {
            name: { contains: studio, mode: 'insensitive' }
          }
        },
        {
          studio: { contains: studio, mode: 'insensitive' }
        }
      ];
    }
    
    if (tag) {
      where.tags = {
        some: {
          tag: {
            name: { contains: tag, mode: 'insensitive' }
          }
        }
      };
    }
    
    if (minRating) {
      where.rating = { ...where.rating, gte: parseFloat(minRating) };
    }
    
    if (maxRating) {
      where.rating = { ...where.rating, lte: parseFloat(maxRating) };
    }
    
    // Build order by clause
    const orderBy = {};
    if (sortBy === 'title') {
      orderBy.title = sortOrder;
    } else if (sortBy === 'rating') {
      orderBy.rating = sortOrder;
    } else if (sortBy === 'duration') {
      orderBy.duration = sortOrder;
    } else if (sortBy === 'playCount') {
      orderBy.playCount = sortOrder;
    } else {
      orderBy.date = sortOrder;
    }
    
    // Get total count for pagination
    const total = await prisma.stashScene.count({ where });
    
    // Get scenes with relations
    const scenes = await prisma.stashScene.findMany({
      where,
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      },
      orderBy: orderBy,
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedScenes = scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      details: scene.details,
      url: scene.url,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      path: scene.path,
      duration: scene.duration,
      studio: scene.studioObject ? { 
        id: scene.studioObject.id, 
        name: scene.studioObject.name,
        url: scene.studioObject.url,
        image: scene.studioObject.image
      } : scene.studio ? { name: scene.studio } : null,
      code: scene.code,
      director: scene.director,
      synopsis: scene.synopsis,
      // Play status fields
      playCount: scene.playCount,
      lastPlayedAt: scene.lastPlayedAt,
      resumeTime: scene.resumeTime,
      playDuration: scene.playDuration,
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        name: sp.performer.name
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name
      }))
    }));
    
    res.json({
      success: true,
      data: transformedScenes,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash scenes from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash scenes',
      message: error.message 
    });
  }
});

// GET /api/stash/scenes/next - Get random unwatched Stash scene for "Next Stash" functionality
router.get('/scenes/next', async (req, res) => {
  try {
    console.log('🎲 Getting random unwatched scene...');
    
    // Find scenes with play_count = 0 or null, and exclude scenes with "__Watched" tag
    const unwatchedScenes = await prisma.stashScene.findMany({
      where: {
        AND: [
          // Play count is 0 or null
          {
            OR: [
              { playCount: 0 },
              { playCount: null }
            ]
          },
          // Exclude scenes with "__Watched" tag
          {
            NOT: {
              tags: {
                some: {
                  tag: {
                    name: '__Watched'
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      }
    });

    console.log(`📊 Found ${unwatchedScenes.length} unwatched scenes (excluding "__Watched" tags)`);

    if (unwatchedScenes.length === 0) {
      return res.json({
        success: false,
        message: 'No unwatched scenes available (all scenes have been watched)',
        scene: null
      });
    }

    // Select a random scene from the unwatched scenes
    const randomIndex = Math.floor(Math.random() * unwatchedScenes.length);
    const randomScene = unwatchedScenes[randomIndex];

    console.log(`🎯 Selected random scene: ${randomScene.title} (ID: ${randomScene.id})`);

    // Transform the scene data to match the expected format and include image URLs
    const settings = await prisma.settings.findFirst();
    const stashUrl = settings?.stashUrl || process.env.STASH_URL;
    
    const transformedScene = {
      id: randomScene.id,
      title: randomScene.title,
      details: randomScene.details,
      url: randomScene.url,
      date: randomScene.date,
      rating: randomScene.rating,
      organized: randomScene.organized,
      osHash: randomScene.osHash,
      checksum: randomScene.checksum,
      phash: randomScene.phash,
      oCounter: randomScene.oCounter,
      path: randomScene.path,
      duration: randomScene.duration,
      fileModTime: randomScene.fileModTime,
      studio: randomScene.studioObject ? { 
        id: randomScene.studioObject.id, 
        name: randomScene.studioObject.name,
        url: randomScene.studioObject.url,
        image: randomScene.studioObject.image
      } : randomScene.studio ? { name: randomScene.studio } : null,
      code: randomScene.code,
      director: randomScene.director,
      synopsis: randomScene.synopsis,
      // Play status fields
      playCount: randomScene.playCount,
      lastPlayedAt: randomScene.lastPlayedAt,
      resumeTime: randomScene.resumeTime,
      playDuration: randomScene.playDuration,
      performers: randomScene.performers.map(sp => ({
        id: sp.performer.id,
        name: sp.performer.name,
        disambiguation: sp.performer.disambiguation,
        alias: sp.performer.alias,
        favorite: sp.performer.favorite,
        birthdate: sp.performer.birthdate,
        ethnicity: sp.performer.ethnicity,
        country: sp.performer.country,
        eye_color: sp.performer.eye_color,
        height: sp.performer.height,
        measurements: sp.performer.measurements,
        fake_tits: sp.performer.fake_tits,
        career_length: sp.performer.career_length,
        tattoos: sp.performer.tattoos,
        piercings: sp.performer.piercings,
        image: sp.performer.image,
        instagram: sp.performer.instagram,
        twitter: sp.performer.twitter,
        url: sp.performer.url
      })),
      tags: randomScene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name,
        description: st.tag.description,
        image: st.tag.image
      })),
      // Add scene image URL using our image proxy
      image: `/api/stash/image-proxy/scene/${randomScene.id}/screenshot?t=${Date.now()}`,
      // Also add alternative image formats
      thumb: `/api/stash/image-proxy/scene/${randomScene.id}/screenshot`,
      preview: `/api/stash/image-proxy/scene/${randomScene.id}/preview`
    };

    res.json({
      success: true,
      scene: transformedScene,
      totalUnwatched: unwatchedScenes.length,
      message: `Selected 1 of ${unwatchedScenes.length} unwatched scenes`
    });
  } catch (error) {
    console.error('Error getting random unwatched scene:', error);
    res.status(500).json({ 
      error: 'Failed to get random unwatched scene',
      message: error.message 
    });
  }
});

// GET /api/stash/scenes/:id - Stash scene by ID endpoint
router.get('/scenes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const scene = await prisma.stashScene.findUnique({
      where: { id: id },
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      }
    });
    
    if (!scene) {
      return res.status(404).json({ 
        error: 'Scene not found',
        message: `Scene with ID ${id} not found in database`
      });
    }
    
    // Transform data to match expected format
    const transformedScene = {
      id: scene.id,
      title: scene.title,
      details: scene.details,
      url: scene.url,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      osHash: scene.osHash,
      checksum: scene.checksum,
      phash: scene.phash,
      oCounter: scene.oCounter,
      path: scene.path,
      duration: scene.duration,
      fileModTime: scene.fileModTime,
      studio: scene.studioObject ? { 
        id: scene.studioObject.id, 
        name: scene.studioObject.name,
        url: scene.studioObject.url,
        image: scene.studioObject.image
      } : scene.studio ? { name: scene.studio } : null,
      code: scene.code,
      director: scene.director,
      synopsis: scene.synopsis,
      // Play status fields
      playCount: scene.playCount,
      lastPlayedAt: scene.lastPlayedAt,
      resumeTime: scene.resumeTime,
      playDuration: scene.playDuration,
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        name: sp.performer.name,
        disambiguation: sp.performer.disambiguation,
        alias: sp.performer.alias,
        favorite: sp.performer.favorite,
        birthdate: sp.performer.birthdate,
        ethnicity: sp.performer.ethnicity,
        country: sp.performer.country,
        eye_color: sp.performer.eye_color,
        height: sp.performer.height,
        measurements: sp.performer.measurements,
        fake_tits: sp.performer.fake_tits,
        career_length: sp.performer.career_length,
        tattoos: sp.performer.tattoos,
        piercings: sp.performer.piercings,
        image: sp.performer.image,
        instagram: sp.performer.instagram,
        twitter: sp.performer.twitter,
        url: sp.performer.url
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name,
        description: st.tag.description,
        image: st.tag.image
      }))
    };
    
    res.json({
      success: true,
      data: transformedScene
    });
  } catch (error) {
    console.error('Error fetching Stash scene from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash scene',
      message: error.message 
    });
  }
});

// POST /api/stash/scenes/:id/watched - Mark Stash scene as watched
router.post('/scenes/:id/watched', async (req, res) => {
  try {
    const sceneId = req.params.id;
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    // Update our local database
    const updatedScene = await prisma.stashScene.update({
      where: { id: sceneId },
      data: {
        playCount: {
          increment: 1
        },
        lastPlayedAt: new Date()
      }
    });

    // Handle the case where playCount was null before increment
    // SQLite increment on null results in null, so we need to fix this
    let finalPlayCount = updatedScene.playCount;
    if (finalPlayCount === null) {
      const fixedScene = await prisma.stashScene.update({
        where: { id: sceneId },
        data: { playCount: 1 }
      });
      finalPlayCount = 1;
      updatedScene.playCount = 1;
    }

    // Also increment play count in Stash itself
    let stashResult = null;
    console.log('🔍 Checking Stash service for play count increment...');
    console.log('   - stashService exists:', !!stashSyncService);
    console.log('   - stashService.isConfigured():', stashSyncService ? stashSyncService.isConfigured() : 'N/A');
    
    if (stashSyncService && stashSyncService.isConfigured()) {
      console.log('📡 Incrementing play count in Stash...');
      stashResult = await stashSyncService.incrementScenePlayCount(sceneId);
      if (!stashResult.success) {
        console.warn('Failed to increment play count in Stash:', stashResult.error);
      } else {
        console.log('✅ Play count incremented in Stash successfully');
      }
    } else {
      console.warn('Stash service not configured, skipping remote play count increment');
      console.warn('   - Service exists:', !!stashSyncService);
      console.warn('   - Service configured:', stashSyncService ? stashSyncService.isConfigured() : false);
    }

    res.json({
      success: true,
      message: 'Scene marked as watched',
      scene: updatedScene,
      stashUpdate: stashResult
    });
  } catch (error) {
    console.error('Error marking Stash scene as watched:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ 
        error: 'Scene not found',
        message: 'The requested scene does not exist'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to mark scene as watched',
        message: error.message 
      });
    }
  }
});

// DELETE /api/stash/scenes/:id - Delete Stash scene (from both local database and Stash itself)
router.delete('/scenes/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    const { deleteFile = false } = req.query; // Query parameter to optionally delete the actual file
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    console.log('🗑️ Deleting scene:', sceneId, 'deleteFile:', deleteFile);

    // Delete from local database first
    let localDeleted = false;
    let clipsDeleted = 0;
    try {
      // First, delete all clips associated with this scene
      const clipDeletionResult = await prisma.stashClip.deleteMany({
        where: { sceneId: sceneId }
      });
      clipsDeleted = clipDeletionResult.count;
      if (clipsDeleted > 0) {
        console.log(`✅ Deleted ${clipsDeleted} clips associated with scene`);
      }
      
      // Then delete the scene
      await prisma.stashScene.delete({
        where: { id: sceneId }
      });
      localDeleted = true;
      console.log('✅ Scene deleted from local database');
    } catch (localError) {
      if (localError.code === 'P2025') {
        console.log('ℹ️ Scene not found in local database (may not have been synced)');
      } else {
        console.error('❌ Error deleting from local database:', localError);
        throw localError;
      }
    }

    // Delete from Stash itself
    let stashResult = null;
    if (stashSyncService && stashSyncService.isConfigured()) {
      console.log('🗑️ Deleting scene from Stash...');
      stashResult = await stashSyncService.deleteScene(
        sceneId, 
        deleteFile === 'true', // Convert string to boolean
        true // Always delete generated files (thumbnails, etc.)
      );
      
      if (!stashResult.success) {
        console.warn('Failed to delete scene from Stash:', stashResult.error);
      } else {
        console.log('✅ Scene deleted from Stash successfully');
      }
    } else {
      console.warn('Stash service not configured, skipping remote deletion');
    }

    res.json({
      success: true,
      message: 'Scene deletion completed',
      localDeleted,
      clipsDeleted,
      stashDeleted: stashResult?.success || false,
      stashResult
    });
  } catch (error) {
    console.error('Error deleting Stash scene:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ 
        error: 'Scene not found',
        message: 'The requested scene does not exist in local database'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to delete scene',
        message: error.message 
      });
    }
  }
});

// POST /api/stash/scenes/:id/clips/generate - Generate clips for a scene
router.post('/scenes/:id/clips/generate', async (req, res) => {
  try {
    const sceneId = req.params.id;
    console.log(`🎬 Generating clips for scene: ${sceneId}`);
    
    // Get the scene to check duration
    const scene = await prisma.stashScene.findUnique({
      where: { id: sceneId },
      select: { 
        id: true, 
        title: true, 
        duration: true,
        clips: {
          orderBy: { clipIndex: 'asc' }
        }
      }
    });
    
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    if (!scene.duration || scene.duration <= 0) {
      return res.status(400).json({ error: 'Scene duration not available' });
    }
    
    // Check if clips already exist
    if (scene.clips && scene.clips.length > 0) {
      console.log(`Clips already exist for scene ${sceneId} (${scene.clips.length} clips)`);
      return res.json({ 
        message: 'Clips already exist',
        clipCount: scene.clips.length,
        clips: scene.clips
      });
    }
    
    // Generate clips (1 minute each) with optimized final clip handling
    const clipDuration = 60; // 1 minute in seconds
    const totalDuration = scene.duration;
    
    console.log(`🎬 Generating optimized clips for scene ${sceneId} (${totalDuration}s)`);
    const clipsToCreate = generateOptimizedClips(sceneId, totalDuration, clipDuration);
    
    if (clipsToCreate.length === 0) {
      return res.status(400).json({ 
        error: 'Scene too short for clip generation',
        suggestion: 'Scene must be longer than 60 seconds',
        sceneDuration: totalDuration
      });
    }
    
    // Create clips in database
    const createdClips = await prisma.stashClip.createMany({
      data: clipsToCreate
    });
    
    console.log(`✅ Generated ${createdClips.count} clips for scene ${sceneId}`);
    
    // Return the created clips
    const clips = await prisma.stashClip.findMany({
      where: { sceneId: sceneId },
      orderBy: { clipIndex: 'asc' }
    });
    
    res.json({
      message: 'Clips generated successfully',
      clipCount: clips.length,
      totalDuration: totalDuration,
      clipDuration: clipDuration,
      clips: clips
    });
    
  } catch (error) {
    console.error('Error generating clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stash/scenes/:id/clips - Get clips for a specific scene
router.get('/scenes/:id/clips', async (req, res) => {
  try {
    const sceneId = req.params.id;
    console.log(`📋 Getting clips for scene: ${sceneId}`);
    
    const clips = await prisma.stashClip.findMany({
      where: { sceneId: sceneId },
      orderBy: { clipIndex: 'asc' }
    });
    
    const watchedCount = clips.filter(clip => clip.watched).length;
    const unwatchedCount = clips.length - watchedCount;
    
    res.json({
      clips: clips,
      stats: {
        total: clips.length,
        watched: watchedCount,
        unwatched: unwatchedCount,
        watchedPercentage: clips.length > 0 ? Math.round((watchedCount / clips.length) * 100) : 0
      }
    });
    
  } catch (error) {
    console.error('Error getting scene clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CLIPS MANAGEMENT =====

// GET /api/stash/clips - Get all clips with pagination and filtering
router.get('/clips', async (req, res) => {
  try {
    console.log('📋 Getting all clips with pagination...');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.perPage) || 20;
    const search = req.query.search || '';
    const watchStatus = req.query.watched; // 'true', 'false', or undefined for all
    const sortBy = req.query.sortBy || 'createdAt';
    const sortDirection = req.query.sortDirection || 'desc';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    // Add search filter
    if (search) {
      where.scene = {
        title: {
          contains: search,
          mode: 'insensitive'
        }
      };
    }
    
    // Add watch status filter
    if (watchStatus !== undefined) {
      where.watched = watchStatus === 'true';
    }
    
    // Build sort object
    const validSortFields = ['createdAt', 'sceneTitle', 'duration', 'startTime', 'watchedAt', 'clipIndex'];
    const validatedSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    const orderBy = {};
    if (validatedSortBy === 'sceneTitle') {
      orderBy.scene = { title: sortDirection };
    } else {
      orderBy[validatedSortBy] = sortDirection;
    }
    
    // Get clips with pagination
    const clips = await prisma.stashClip.findMany({
      where,
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            duration: true,
            performers: {
              select: {
                performer: {
                  select: {
                    name: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    });
    
    // Get total count
    const totalClips = await prisma.stashClip.count({ where });
    const totalPages = Math.ceil(totalClips / limit);
    
    console.log(`📋 Found ${clips.length} clips (page ${page}/${totalPages})`);
    
    res.json({
      clips,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalClips,
        itemsPerPage: limit,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error getting clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stash/clips/:id/watched - Mark clip as watched
router.post('/clips/:id/watched', async (req, res) => {
  try {
    const clipId = parseInt(req.params.id);
    console.log(`✅ Marking clip ${clipId} as watched...`);
    
    const updatedClip = await prisma.stashClip.update({
      where: { id: clipId },
      data: { 
        watched: true,
        watchedAt: new Date()
      },
      include: {
        scene: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    
    console.log(`✅ Clip ${clipId} marked as watched`);
    
    res.json({
      message: 'Clip marked as watched',
      clip: updatedClip
    });
    
  } catch (error) {
    console.error('Error marking clip as watched:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stash/clips/:id/play - Play a specific clip by ID
router.post('/clips/:id/play', async (req, res) => {
  try {
    const clipId = parseInt(req.params.id);
    console.log(`▶️ Playing clip: ${clipId}`);

    // Get the clip with scene information
    const clip = await prisma.stashClip.findUnique({
      where: { id: clipId },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            url: true
          }
        }
      }
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    console.log(`▶️ Found clip for scene: ${clip.scene.title}`);

    // Construct streaming URL - prioritize database settings over environment
    const settings = await prisma.settings.findFirst();
    const stashUrl = settings?.stashUrl || process.env.STASH_URL;
    let streamUrl = `${stashUrl}/scene/${clip.sceneId}/stream`;
    
    console.log(`▶️ Stream URL: ${streamUrl}`);

    res.json({
      success: true,
      clip,
      streamUrl,
      message: `Playing clip ${clip.clipIndex + 1} from "${clip.scene.title}"`
    });

  } catch (error) {
    console.error('Error playing clip:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stash/clips/reset - Reset all clips watched status (for testing)
router.post('/clips/reset', async (req, res) => {
  try {
    console.log('🔄 Resetting all clips watched status...');
    
    const result = await prisma.stashClip.updateMany({
      where: { watched: true },
      data: { 
        watched: false,
        watchedAt: null
      }
    });
    
    console.log(`✅ Reset ${result.count} clips to unwatched`);
    
    res.json({
      message: 'All clips reset to unwatched',
      resetCount: result.count
    });
    
  } catch (error) {
    console.error('Error resetting clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stash/clip-play - Select and play a random clip from a random scene
router.post('/clip-play', async (req, res) => {
  try {
    console.log('🎬 Starting Clip Play - selecting random scene and checking/generating clips...');
    
    // First, get all scenes from Stash database
    const allScenes = await prisma.stashScene.findMany({
      select: {
        id: true,
        title: true,
        path: true,
        duration: true
      },
      where: {
        duration: { gt: 60 } // Only scenes longer than 1 minute
      }
    });
    
    if (allScenes.length === 0) {
      return res.status(404).json({ 
        error: 'No scenes available for clip generation',
        suggestion: 'Sync with Stash to populate scene library'
      });
    }

    // ALWAYS start by selecting a random scene first
    const randomSceneIndex = Math.floor(Math.random() * allScenes.length);
    const selectedScene = allScenes[randomSceneIndex];
    
    console.log(`🎲 Selected random scene: ${selectedScene.title}`);
    
    let selectedClip;
    
    // Check if this scene has any clips
    const existingClips = await prisma.stashClip.findMany({
      where: { sceneId: selectedScene.id },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            path: true,
            duration: true
          }
        }
      }
    });
    
    if (existingClips.length > 0) {
      // Scene has clips - check if any are unwatched
      const unwatchedClips = existingClips.filter(clip => !clip.watched);
      
      if (unwatchedClips.length > 0) {
        // Select random unwatched clip from this scene
        const randomIndex = Math.floor(Math.random() * unwatchedClips.length);
        selectedClip = unwatchedClips[randomIndex];
        console.log(`📋 Found ${unwatchedClips.length} unwatched clips, selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedScene.title}`);
      } else {
        // All clips from this scene are watched - reset them and pick random one
        await prisma.stashClip.updateMany({
          where: { sceneId: selectedScene.id },
          data: { 
            watched: false,
            watchedAt: null
          }
        });
        
        // Select random clip from the reset clips
        const randomClipIndex = Math.floor(Math.random() * existingClips.length);
        selectedClip = existingClips[randomClipIndex];
        selectedClip.watched = false;
        console.log(`♻️ Reset ${existingClips.length} clips for scene: ${selectedScene.title}, selected clip ${selectedClip.clipIndex + 1}`);
      }
    } else {
      // Scene has no clips - generate them
      const clipDuration = 60; // 1 minute clips
      
      console.log(`🎬 Generating optimized clips for scene: ${selectedScene.title} (${selectedScene.duration}s)`);
      const clipsToCreate = generateOptimizedClips(selectedScene.id, selectedScene.duration, clipDuration);
      
      if (clipsToCreate.length === 0) {
        return res.status(400).json({ 
          error: 'Selected scene too short for clip generation',
          suggestion: 'Scene must be longer than 60 seconds'
        });
      }
      
      // Bulk create clips
      await prisma.stashClip.createMany({
        data: clipsToCreate
      });
      
      // Get a random generated clip
      const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
      selectedClip = await prisma.stashClip.findFirst({
        where: { 
          sceneId: selectedScene.id,
          clipIndex: randomClipIndex
        },
        include: {
          scene: {
            select: {
              id: true,
              title: true,
              path: true,
              duration: true
            }
          }
        }
      });
      
      console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
    }
    
    // Get connection status for stream URL
    const settings = await prisma.settings.findFirst();
    let stashUrl = settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                   process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3;
    
    // Normalize URL - remove trailing slashes
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    if (!stashUrl) {
      return res.status(400).json({ error: 'Stash URL not configured in settings or environment' });
    }
    
    // Build stream URL (stashUrl is already normalized)
    const streamUrl = `${stashUrl}/scene/${selectedClip.scene.id}/stream`;
    
    // Build Android companion app message
    const androidMessage = {
      type: 'STASH_PLAYBACK',
      action: 'PLAY_CLIP',
      scene: {
        id: selectedClip.scene.id,
        title: selectedClip.scene.title,
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration,
        clipIndex: selectedClip.clipIndex + 1, // Human-readable index
        totalClips: Math.floor(selectedClip.scene.duration / 60),
        stashUrl: stashUrl
      },
      clip: {
        id: selectedClip.id,
        clipIndex: selectedClip.clipIndex,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`🎯 Selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedClip.scene.title}`);
    console.log(`📱 Emitting Android companion app message (Clip Play):`, JSON.stringify(androidMessage, null, 2));
    
    // Emit WebSocket message to Android companion app
    io.emit('androidCompanion', androidMessage);
    
    // Also attempt HTTP forward for legacy support
    try {
      const response = await fetch('http://localhost:8080/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play_clip',
          scene: androidMessage.scene,
          clip: androidMessage.clip
        }),
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        console.log('HTTP clip play command sent successfully to Android app');
      }
    } catch (httpError) {
      console.log('Android HTTP app not available (using WebSocket only)');
    }
    
    // Mark clip as watched
    await prisma.stashClip.update({
      where: { id: selectedClip.id },
      data: { 
        watched: true,
        watchedAt: new Date()
      }
    });
    
    console.log(`✅ Clip ${selectedClip.id} marked as watched`);
    
    // Get current count of unwatched clips across all scenes
    const totalUnwatchedClips = await prisma.stashClip.count({
      where: { watched: false }
    });
    
    res.json({
      message: 'Clip play started successfully',
      clip: selectedClip,
      totalUnwatchedClips: totalUnwatchedClips,
      playbackInfo: {
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      }
    });
    
  } catch (error) {
    console.error('Error in clip play:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /clips/next - Get next clip for continuous playback
router.get('/clips/next', async (req, res) => {
  try {
    console.log('🎲 Getting next clip for continuous playback...');
    
    // Get a random scene with some randomness factors
    const totalScenes = await prisma.stashScene.count();
    
    if (totalScenes === 0) {
      return res.status(404).json({ error: 'No scenes found in database' });
    }
    
    // Generate random offset to get different scene each time
    const randomOffset = Math.floor(Math.random() * totalScenes);
    
    const selectedScene = await prisma.stashScene.findFirst({
      skip: randomOffset,
      include: {
        performers: {
          include: {
            performer: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!selectedScene) {
      return res.status(404).json({ error: 'No scene found' });
    }
    
    console.log(`🎬 Selected scene: ${selectedScene.title} (${selectedScene.performers.map(p => p.performer.name).join(', ')})`);
    
    let selectedClip;
    
    // Check if scene has existing clips
    const existingClips = await prisma.stashClip.findMany({
      where: { sceneId: selectedScene.id },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            path: true,
            duration: true
          }
        }
      }
    });
    
    if (existingClips.length > 0) {
      // Filter for unwatched clips
      const unwatchedClips = existingClips.filter(clip => !clip.watched);
      
      if (unwatchedClips.length > 0) {
        // Select random unwatched clip from this scene
        const randomIndex = Math.floor(Math.random() * unwatchedClips.length);
        selectedClip = unwatchedClips[randomIndex];
        console.log(`🎯 Found ${unwatchedClips.length} unwatched clips, selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedScene.title}`);
      } else {
        // All clips from this scene are watched - reset them and pick random one
        await prisma.stashClip.updateMany({
          where: { sceneId: selectedScene.id },
          data: { 
            watched: false,
            watchedAt: null
          }
        });
        
        // Select random clip from the reset clips
        const randomClipIndex = Math.floor(Math.random() * existingClips.length);
        selectedClip = existingClips[randomClipIndex];
        selectedClip.watched = false;
        console.log(`♻️ Reset ${existingClips.length} clips for scene: ${selectedScene.title}, selected clip ${selectedClip.clipIndex + 1}`);
      }
    } else {
      // Scene has no clips - generate them
      const clipDuration = 60; // 1 minute clips
      
      console.log(`🎬 Generating optimized clips for scene: ${selectedScene.title} (${selectedScene.duration}s)`);
      const clipsToCreate = generateOptimizedClips(selectedScene.id, selectedScene.duration, clipDuration);
      
      if (clipsToCreate.length === 0) {
        return res.status(400).json({ 
          error: 'Selected scene too short for clip generation',
          suggestion: 'Scene must be longer than 60 seconds'
        });
      }
      
      // Bulk create clips
      await prisma.stashClip.createMany({
        data: clipsToCreate
      });
      
      // Get a random generated clip
      const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
      selectedClip = await prisma.stashClip.findFirst({
        where: { 
          sceneId: selectedScene.id,
          clipIndex: randomClipIndex
        },
        include: {
          scene: {
            select: {
              id: true,
              title: true,
              path: true,
              duration: true
            }
          }
        }
      });
      
      console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
    }
    
    // Get connection status for stream URL
    const settings = await prisma.settings.findFirst();
    let stashUrl = settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                   process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3;
    
    // Normalize URL - remove trailing slashes
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    if (!stashUrl) {
      return res.status(400).json({ error: 'Stash URL not configured in settings or environment' });
    }
    
    // Build stream URL (stashUrl is already normalized)  
    const streamUrl = `${stashUrl}/scene/${selectedClip.scene.id}/stream`;
    
    // Mark clip as watched immediately
    await prisma.stashClip.update({
      where: { id: selectedClip.id },
      data: { 
        watched: true,
        watchedAt: new Date()
      }
    });
    
    console.log(`✅ Next clip ${selectedClip.id} marked as watched`);
    
    // Get current count of unwatched clips across all scenes
    const totalUnwatchedClips = await prisma.stashClip.count({
      where: { watched: false }
    });
    
    res.json({
      message: 'Next clip selected successfully',
      clip: selectedClip,
      totalUnwatchedClips: totalUnwatchedClips,
      playbackInfo: {
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      }
    });
    
  } catch (error) {
    console.error('Error getting next clip:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /stats - Get Stash database statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching Stash database statistics...');
    
    // Get counts from each table
    const [scenesCount, performersCount, studiosCount] = await Promise.all([
      prisma.stashScene.count(),
      prisma.stashPerformer.count(),
      prisma.stashStudio.count()
    ]);

    // Get top 10 performers by scene count
    const topPerformers = await prisma.stashPerformer.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: {
            scenes: true
          }
        }
      },
      orderBy: {
        scenes: {
          _count: 'desc'
        }
      },
      take: 10
    });

    // Get top 10 studios by scene count
    const topStudios = await prisma.stashStudio.findMany({
      where: {
        name: {
          not: 'Only Fans'
        }
      },
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: {
            scenes: true
          }
        }
      },
      orderBy: {
        scenes: {
          _count: 'desc'
        }
      },
      take: 10
    });

    const stats = {
      scenes: scenesCount,
      performers: performersCount,
      studios: studiosCount,
      topPerformers: topPerformers.map(p => ({
        id: p.id,
        name: p.name,
        image: p.image,
        sceneCount: p._count.scenes
      })),
      topStudios: topStudios.map(s => ({
        id: s.id,
        name: s.name,
        image: s.image,
        sceneCount: s._count.scenes
      })),
      lastUpdated: new Date().toISOString()
    };

    console.log('📊 Stats retrieved:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching Stash stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash statistics',
      message: error.message 
    });
  }
});

// GET /performers - Stash performers endpoint
router.get('/performers', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { name: { contains: filter, mode: 'insensitive' } },
        { alias: { contains: filter, mode: 'insensitive' } },
        { disambiguation: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get total count
    const total = await prisma.stashPerformer.count({
      where: searchFilter
    });
    
    // Get performers with related data
    const performers = await prisma.stashPerformer.findMany({
      where: searchFilter,
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        scenes: {
          include: {
            scene: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedPerformers = performers.map(performer => ({
      id: performer.id,
      name: performer.name,
      disambiguation: performer.disambiguation,
      alias: performer.alias,
      favorite: performer.favorite,
      ignore_auto_tag: performer.ignore_auto_tag,
      birthdate: performer.birthdate,
      ethnicity: performer.ethnicity,
      country: performer.country,
      eye_color: performer.eye_color,
      height: performer.height,
      measurements: performer.measurements,
      fake_tits: performer.fake_tits,
      career_length: performer.career_length,
      tattoos: performer.tattoos,
      piercings: performer.piercings,
      image: performer.image,
      instagram: performer.instagram,
      twitter: performer.twitter,
      url: performer.url,
      tags: performer.tags.map(pt => ({
        id: pt.tag.id,
        name: pt.tag.name
      })),
      scene_count: performer.scenes.length
    }));
    
    res.json({
      success: true,
      data: transformedPerformers,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash performers from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash performers',
      message: error.message 
    });
  }
});

// GET /studios - Stash studios endpoint
router.get('/studios', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      name: { contains: filter, mode: 'insensitive' }
    } : {};
    
    // Get total count
    const total = await prisma.stashStudio.count({
      where: searchFilter
    });
    
    // Get studios with scene counts using the relationship
    const studios = await prisma.stashStudio.findMany({
      where: searchFilter,
      include: {
        scenes: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedStudios = studios.map(studio => ({
      id: studio.id,
      name: studio.name,
      url: studio.url,
      image: studio.image,
      scene_count: studio.scenes.length
    }));
    
    res.json({
      success: true,
      data: transformedStudios,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash studios from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash studios',
      message: error.message 
    });
  }
});

// GET /tags - Stash tags endpoint
router.get('/tags', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { name: { contains: filter, mode: 'insensitive' } },
        { description: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get total count
    const total = await prisma.stashTag.count({
      where: searchFilter
    });
    
    // Get tags with usage counts
    const tags = await prisma.stashTag.findMany({
      where: searchFilter,
      include: {
        scenes: {
          select: {
            sceneId: true
          }
        },
        performers: {
          select: {
            performerId: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedTags = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      image: tag.image,
      scene_count: tag.scenes.length,
      performer_count: tag.performers.length
    }));
    
    res.json({
      success: true,
      data: transformedTags,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash tags from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash tags',
      message: error.message 
    });
  }
});

// GET /galleries - Stash galleries endpoint
router.get('/galleries', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '', sortBy = 'title', sortDirection = 'asc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { title: { contains: filter, mode: 'insensitive' } },
        { details: { contains: filter, mode: 'insensitive' } },
        { photographer: { contains: filter, mode: 'insensitive' } },
        { studio: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Build sort order
    const orderBy = {};
    orderBy[sortBy] = sortDirection.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.stashGallery.count({
      where: searchFilter
    });
    
    // Get galleries with related data
    const galleries = await prisma.stashGallery.findMany({
      where: searchFilter,
      include: {
        images: {
          select: {
            id: true,
            path: true
          }
        },
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: orderBy,
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedGalleries = galleries.map(gallery => ({
      id: gallery.id,
      title: gallery.title,
      code: gallery.code,
      date: gallery.date,
      details: gallery.details,
      photographer: gallery.photographer,
      url: gallery.url,
      rating: gallery.rating,
      organized: gallery.organized,
      studio: gallery.studio,
      studioId: gallery.studioId,
      path: gallery.path,
      checksum: gallery.checksum,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      imageCount: gallery.images.length,
      images: gallery.images,
      performers: gallery.performers.map(p => p.performer),
      tags: gallery.tags.map(t => t.tag),
      studioObject: gallery.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedGalleries,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash galleries from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash galleries',
      message: error.message 
    });
  }
});

// GET /galleries/:id - Get specific gallery by ID
router.get('/galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const gallery = await prisma.stashGallery.findUnique({
      where: { id: id },
      include: {
        images: {
          select: {
            id: true,
            title: true,
            path: true,
            checksum: true
          }
        },
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    });
    
    if (!gallery) {
      return res.status(404).json({ 
        success: false,
        error: 'Gallery not found' 
      });
    }
    
    // Transform data
    const transformedGallery = {
      id: gallery.id,
      title: gallery.title,
      code: gallery.code,
      date: gallery.date,
      details: gallery.details,
      photographer: gallery.photographer,
      url: gallery.url,
      rating: gallery.rating,
      organized: gallery.organized,
      studio: gallery.studio,
      studioId: gallery.studioId,
      path: gallery.path,
      checksum: gallery.checksum,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      images: gallery.images,
      performers: gallery.performers.map(p => p.performer),
      tags: gallery.tags.map(t => t.tag),
      studioObject: gallery.studioObject
    };
    
    res.json({
      success: true,
      data: transformedGallery
    });
  } catch (error) {
    console.error('Error fetching Stash gallery from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash gallery',
      message: error.message 
    });
  }
});

// GET /images/random - Get a random image from all galleries
router.get('/images/random', async (req, res) => {
  try {
    // Get a random image from all galleries
    const totalImages = await prisma.stashImage.count();
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get a random offset
    const randomOffset = Math.floor(Math.random() * totalImages);
    
    const randomImage = await prisma.stashImage.findMany({
      skip: randomOffset,
      take: 1,
      include: {
        gallery: {
          select: {
            id: true,
            title: true,
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (randomImage.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No random image found' 
      });
    }
    
    const image = randomImage[0];
    
    res.json({
      success: true,
      data: {
        id: image.id,
        title: image.title,
        path: image.path,
        checksum: image.checksum,
        gallery: {
          id: image.gallery.id,
          title: image.gallery.title,
          performers: image.gallery.performers.map(p => p.performer)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching random image from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random image',
      message: error.message 
    });
  }
});

// GET /images/slideshow - Stash random images endpoint for slideshow
router.get('/images/slideshow', async (req, res) => {
  try {
    const { count = 10, includeGalleries = true, includeStandalone = true } = req.query;
    const requestedCount = Math.max(1, Math.min(parseInt(count), 100)); // Limit between 1 and 100
    
    // Build conditions based on what to include
    const conditions = [];
    
    if (includeGalleries === 'true' || includeGalleries === true) {
      // Include images from galleries
      conditions.push({ galleryId: { not: null } });
    }
    
    if (includeStandalone === 'true' || includeStandalone === true) {
      // Include standalone images
      conditions.push({ galleryId: null });
    }
    
    if (conditions.length === 0) {
      return res.status(400).json({ 
        error: 'Must include at least galleries or standalone images' 
      });
    }
    
    // Get total count of matching images
    const totalImages = await prisma.stashImage.count({
      where: {
        OR: conditions
      }
    });
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get random images
    const images = [];
    const usedOffsets = new Set();
    
    // Try to get the requested number of unique random images
    let attempts = 0;
    const maxAttempts = Math.min(requestedCount * 3, 200); // Avoid infinite loops
    
    while (images.length < requestedCount && attempts < maxAttempts) {
      const randomOffset = Math.floor(Math.random() * totalImages);
      
      if (!usedOffsets.has(randomOffset)) {
        usedOffsets.add(randomOffset);
        
        const randomImages = await prisma.stashImage.findMany({
          where: {
            OR: conditions
          },
          skip: randomOffset,
          take: 1,
          include: {
            gallery: {
              select: {
                id: true,
                title: true,
                performers: {
                  include: {
                    performer: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            tags: {
              include: {
                tag: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
        
        if (randomImages.length > 0) {
          images.push(randomImages[0]);
        }
      }
      
      attempts++;
    }
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      path: image.path,
      checksum: image.checksum,
      photographer: image.photographer,
      studio: image.studio,
      rating: image.rating,
      date: image.date,
      details: image.details,
      gallery: image.gallery ? {
        id: image.gallery.id,
        title: image.gallery.title,
        performers: image.gallery.performers.map(p => p.performer)
      } : null,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      meta: {
        requested: requestedCount,
        returned: images.length,
        totalAvailable: totalImages
      }
    });
  } catch (error) {
    console.error('Error fetching random images for slideshow:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random images for slideshow',
      message: error.message 
    });
  }
});

// GET /images - Stash standalone images endpoint
router.get('/images', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '', sortBy = 'title', sortDirection = 'asc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter for standalone images (not part of any gallery)
    const searchFilter = {
      galleryId: null, // Only standalone images
      ...(filter ? {
        OR: [
          { title: { contains: filter, mode: 'insensitive' } },
          { code: { contains: filter, mode: 'insensitive' } },
          { details: { contains: filter, mode: 'insensitive' } },
          { photographer: { contains: filter, mode: 'insensitive' } },
          { studio: { contains: filter, mode: 'insensitive' } }
        ]
      } : {})
    };
    
    // Build sort order
    const orderBy = {};
    orderBy[sortBy] = sortDirection.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.stashImage.count({
      where: searchFilter
    });
    
    // Get standalone images with related data
    const images = await prisma.stashImage.findMany({
      where: searchFilter,
      include: {
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      skip: skip,
      take: take,
      orderBy: orderBy
    });
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      date: image.date,
      details: image.details,
      photographer: image.photographer,
      url: image.url,
      rating: image.rating,
      organized: image.organized,
      studio: image.studio,
      path: image.path,
      checksum: image.checksum,
      fileModTime: image.fileModTime,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash standalone images from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash standalone images',
      message: error.message 
    });
  }
});

// GET /search - Stash search endpoint
router.get('/search', async (req, res) => {
  try {
    const { query, types = 'scene' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const searchTypes = types.split(',').map(t => t.trim());
    const results = {};
    
    // Search scenes
    if (searchTypes.includes('scene')) {
      const scenes = await prisma.stashScene.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { details: { contains: query } },
            { studio: { contains: query } },
            { code: { contains: query } },
            { director: { contains: query } },
            { synopsis: { contains: query } }
          ]
        },
        include: {
          performers: {
            include: {
              performer: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          studioObject: true
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      
      results.scenes = scenes.map(scene => ({
        id: scene.id,
        title: scene.title,
        details: scene.details,
        url: scene.url,
        date: scene.date,
        rating: scene.rating,
        duration: scene.duration,
        studio: scene.studioObject ? { 
          id: scene.studioObject.id, 
          name: scene.studioObject.name,
          url: scene.studioObject.url,
          image: scene.studioObject.image
        } : scene.studio ? { name: scene.studio } : null,
        performers: scene.performers.map(sp => sp.performer),
        tags: scene.tags.map(st => st.tag)
      }));
    }
    
    // Search performers
    if (searchTypes.includes('performer')) {
      const performers = await prisma.stashPerformer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { alias: { contains: query } },
            { disambiguation: { contains: query } }
          ]
        },
        include: {
          scenes: {
            select: {
              sceneId: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.performers = performers.map(performer => ({
        id: performer.id,
        name: performer.name,
        disambiguation: performer.disambiguation,
        alias: performer.alias,
        favorite: performer.favorite,
        birthdate: performer.birthdate,
        image: performer.image,
        scene_count: performer.scenes.length
      }));
    }
    
    // Search studios
    if (searchTypes.includes('studio')) {
      const studios = await prisma.stashStudio.findMany({
        where: {
          name: { contains: query }
        },
        include: {
          scenes: {
            select: {
              id: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.studios = studios.map(studio => ({
        id: studio.id,
        name: studio.name,
        url: studio.url,
        image: studio.image,
        scene_count: studio.scenes.length
      }));
    }
    
    // Search tags
    if (searchTypes.includes('tag')) {
      const tags = await prisma.stashTag.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { description: { contains: query } }
          ]
        },
        include: {
          scenes: {
            select: {
              sceneId: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.tags = tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        image: tag.image,
        scene_count: tag.scenes.length
      }));
    }
    
    res.json({
      success: true,
      query: query,
      results: results
    });
  } catch (error) {
    console.error('Error searching Stash database:', error);
    res.status(500).json({ 
      error: 'Failed to search Stash',
      message: error.message 
    });
  }
});

// Stash sync endpoint
router.post('/sync', async (req, res) => {
  try {
    if (!stashSyncService || !stashSyncServiceOptimized) {
      await initializeStashSyncService();
    }
    
    const activeSyncService = getActiveSyncService();
    if (!activeSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured',
        message: 'Please configure Stash URL in settings'
      });
    }
    
    // Check if background sync is in progress
    if (stashBackgroundSync && stashBackgroundSync.syncInProgress) {
      return res.status(409).json({
        error: 'Sync already in progress',
        message: 'Background Stash sync is currently running. Please wait for it to complete.'
      });
    }
    
    console.log(`Starting manual Stash full sync (${SYNC_SERVICE_TYPE})...`);
    const startTime = Date.now();
    
    // Use optimized sync if available, fallback to legacy
    const results = SYNC_SERVICE_TYPE === 'optimized' && activeSyncService.fullSyncOptimized
      ? await activeSyncService.fullSyncOptimized()
      : await activeSyncService.fullSync();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Manual Stash sync (${SYNC_SERVICE_TYPE}) completed in ${duration}s`);
    
    res.json({
      success: true,
      message: `Stash sync (${SYNC_SERVICE_TYPE}) completed successfully in ${duration}s`,
      syncType: SYNC_SERVICE_TYPE,
      duration: duration,
      results: results,
      performanceImprovement: results?.performanceImprovement || null
    });
  } catch (error) {
    console.error(`Error during manual Stash sync (${SYNC_SERVICE_TYPE}):`, error);
    res.status(500).json({ 
      error: 'Stash sync failed',
      message: error.message,
      syncType: SYNC_SERVICE_TYPE,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Sync configuration endpoint
router.get('/sync/config', async (req, res) => {
  try {
    res.json({
      success: true,
      syncType: SYNC_SERVICE_TYPE,
      availableTypes: ['legacy', 'optimized'],
      services: {
        legacy: !!stashSyncService,
        optimized: !!stashSyncServiceOptimized
      },
      configuration: {
        optimizedPageSize: stashSyncServiceOptimized?.pageSize || 500,
        legacyPageSize: 250,
        memoryCache: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled',
        parallelSync: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled',
        batchTransactions: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled'
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

// Sync benchmark endpoint
router.post('/sync/benchmark', async (req, res) => {
  try {
    if (!stashSyncService || !stashSyncServiceOptimized) {
      await initializeStashSyncService();
    }
    
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

// Sync scenes endpoint
router.post('/sync/scenes', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Sync performers endpoint
router.post('/sync/performers', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Sync studios endpoint
router.post('/sync/studios', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Sync tags endpoint
router.post('/sync/tags', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Sync galleries endpoint
router.post('/sync/galleries', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Sync images endpoint
router.post('/sync/images', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
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

// Get Stash sync status
router.get('/sync/status', async (req, res) => {
  try {
    const backgroundSyncStatus = stashBackgroundSync ? stashBackgroundSync.getSyncStatus() : null;
    
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

// Get background sync status
router.get('/background-sync-status', async (req, res) => {
  try {
    const status = stashBackgroundSync.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get Stash background sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get Stash background sync status',
      details: error.message 
    });
  }
});

// Start background sync
router.post('/background-sync/start', async (req, res) => {
  try {
    await stashBackgroundSync.start();
    res.json({ message: 'Stash background sync service started successfully' });
  } catch (error) {
    console.error('Failed to start Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to start Stash background sync',
      details: error.message 
    });
  }
});

// Stop background sync
router.post('/background-sync/stop', async (req, res) => {
  try {
    await stashBackgroundSync.stop();
    res.json({ message: 'Stash background sync service stopped successfully' });
  } catch (error) {
    console.error('Failed to stop Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to stop Stash background sync',
      details: error.message 
    });
  }
});

// Force background sync now
router.post('/background-sync/force-now', async (req, res) => {
  try {
    const result = await stashBackgroundSync.forceSyncNow();
    res.json({ message: 'Stash background sync completed', result });
  } catch (error) {
    console.error('Failed to force Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to force Stash background sync',
      details: error.message 
    });
  }
});

// Get clips with pagination and filtering
router.get('/clips', async (req, res) => {
  try {
    console.log('📋 Getting all clips with pagination...');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.perPage) || 20;
    const search = req.query.search || '';
    const watchStatus = req.query.watched; // 'true', 'false', or undefined for all
    const sortBy = req.query.sortBy || 'createdAt';
    const sortDirection = req.query.sortDirection || 'desc';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    // Add search filter
    if (search) {
      where.scene = {
        title: {
          contains: search
        }
      };
    }
    
    // Add watch status filter
    if (watchStatus !== undefined) {
      where.watched = watchStatus === 'true';
    }
    
    // Build sort object
    const validSortFields = ['createdAt', 'sceneTitle', 'duration', 'startTime', 'watchedAt', 'clipIndex'];
    const validatedSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    const orderBy = {};
    if (validatedSortBy === 'sceneTitle') {
      orderBy.scene = { title: sortDirection };
    } else {
      orderBy[validatedSortBy] = sortDirection;
    }
    
    // Get clips with pagination
    const clips = await prisma.stashClip.findMany({
      where,
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            duration: true,
            performers: {
              select: {
                performer: {
                  select: {
                    name: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    });
    
    // Get total count
    const totalClips = await prisma.stashClip.count({ where });
    const totalPages = Math.ceil(totalClips / limit);
    
    console.log(`📋 Found ${clips.length} clips (page ${page}/${totalPages})`);
    
    res.json({
      clips,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalClips,
        itemsPerPage: limit,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error getting clips:', error);
    res.status(500).json({ error: error.message });
  }
});

  return router;
}

module.exports = createStashRouter;
