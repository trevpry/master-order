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
const GeviScraperService = require('../services/geviScraperService');
const ActionCodeService = require('../services/actionCodeService');
const PerformerSwapService = require('../services/performerSwapService');
const PerformerMergeService = require('../services/performerMergeService');
const ScraperRegistry = require('../services/scrapers/ScraperRegistry');

// Create global scraper registry singleton (shared across all routes)
let globalScraperRegistry = null;
function getScraperRegistry() {
  if (!globalScraperRegistry) {
    globalScraperRegistry = new ScraperRegistry();
  }
  return globalScraperRegistry;
}

// Create a function that returns a router with io instance
function createStashRouter(io) {
  const router = express.Router();
  
  // Import validation and response utilities
  const { validateRequiredFieldsDirect } = require('../middleware/validation');
  const { sendBadRequest, sendNotFound, sendSuccess, sendServerError, asyncHandler, logError } = require('../utils/responses');
  
  // Local sync service instances (initialized when needed)
  let stashSyncService = null;
  let stashSyncServiceOptimized = null;
  const stashBackgroundSync = new StashBackgroundSyncService();
  const geviScraper = new GeviScraperService();
  const actionCodeService = new ActionCodeService();
  const performerSwapService = new PerformerSwapService();
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
  
  // If scene is shorter than clip duration, create one clip with the entire scene
  if (totalFullClips === 0) {
    clipsToCreate.push({
      sceneId: sceneId,
      clipIndex: 0,
      startTime: 0,
      endTime: sceneDuration,
      duration: sceneDuration,
      watched: false
    });
    return clipsToCreate;
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

// ===== CONNECTION STATUS =====

// GET /api/stash/status - Check Stash connection status and configuration
router.get('/status', asyncHandler(async (req, res) => {
  console.log('🔍 Checking Stash connection status...');
  
  // Get the Stash configuration from settings
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  
  // Check if Stash is configured
  const stashUrl = settings?.stashUrl || process.env.STASH_URL;
  const apiKey = settings?.stashApiKey;
    
    if (!stashUrl) {
      console.log('⚠️ Stash URL not configured');
      return res.json({
        configured: false,
        connected: false,
        stashUrl: null,
        apiKey: null
      });
    }
    
    // Test connection if configured
    try {
      if (!stashSyncService) {
        console.log('⚠️ StashSyncService not initialized, initializing now...');
        await initializeStashSyncService();
      }
      
      if (stashSyncService) {
        console.log('🧪 Testing Stash connection...');
        const version = await stashSyncService.testConnection();
        console.log('✅ Stash connection successful:', version);
        
        return res.json({
          configured: true,
          connected: true,
          stashUrl: stashUrl,
          apiKey: apiKey ? '***configured***' : null,
          version: version
        });
      } else {
        throw new Error('Stash sync service not available');
      }
    } catch (connectionError) {
      console.log('❌ Stash connection failed:', connectionError.message);
      return res.json({
        configured: true,
        connected: false,
        stashUrl: stashUrl,
        apiKey: apiKey ? '***configured***' : null,
        error: connectionError.message
      });
    }
}));

// ===== IMAGE PROXY ROUTES =====

// GET /api/stash/image-proxy/* - Proxy images from Stash server  
router.get('/image-proxy/*', asyncHandler(async (req, res) => {
    const imagePath = req.params[0]; // Get everything after /api/stash/image-proxy/
    console.log(`[Image Proxy] Raw imagePath: "${imagePath}"`);
    console.log(`[Image Proxy] Full URL: ${req.originalUrl}`);
    
    // Get settings using cached database utility
    const { getSettings } = require('../databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.stashUrl) {
      return res.status(500).send('Stash settings not configured');
    }
    
    let imageUrl;
    
    // Handle scene screenshot requests
    if (imagePath.startsWith('scene/') && imagePath.includes('/screenshot')) {
      const sceneIdMatch = imagePath.match(/scene\/([^\/]+)\/screenshot/);
      if (sceneIdMatch) {
        const sceneId = sceneIdMatch[1];
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/scene/${sceneId}/screenshot`;
        console.log(`[Image Proxy] Scene screenshot detected - Scene ID: ${sceneId}, URL: ${imageUrl}`);
      }
    }
    // If the path is already a full HTTP URL, use it directly
    else if (imagePath.startsWith('http')) {
      imageUrl = imagePath;
      console.log(`[Image Proxy] Full HTTP URL detected: ${imageUrl}`);
    } else {
      // For file paths, we need to find the image by path and get its ID from Stash
      console.log(`[Image Proxy] Looking for image by path: "${imagePath}"`);
      
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
        console.log(`[Image Proxy] Found image ID ${image.id} for path, URL: ${imageUrl}`);
      } else {
        // Fallback: try to use the path directly (may not work for all cases)
        console.warn(`Could not find image ID for path: ${imagePath}, trying direct path`);
        
        // Remove leading slash if present and normalize base URL
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/${cleanPath}`;
        console.log(`[Image Proxy] Direct path fallback URL: ${imageUrl}`);
      }
    }
    
    if (!imageUrl) {
      console.error(`[Image Proxy] No image URL generated for path: ${imagePath}`);
      return res.status(404).send('Image not found');
    }
    
    console.log(`Proxying Stash image: ${imageUrl}`);
    
    // Forward the request to Stash
    const axios = require('axios');
    
    const proxyResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0',
        ...(settings.stashApiKey && { 'ApiKey': settings.stashApiKey })
      }
    });
    
    // Set content type based on response
    const contentType = proxyResponse.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    
    // Add cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the image data to the response
    proxyResponse.data.pipe(res);
}));

// ===== CONNECTION TESTING =====

// GET /api/stash/test - Test Stash connection and configuration
router.get('/test', asyncHandler(async (req, res) => {
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
}));

// ===== SCENES MANAGEMENT =====

// GET /api/stash/scenes - List all Stash scenes with pagination and filtering
router.get('/scenes', asyncHandler(async (req, res) => {
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
      maxRating,
      watched,
      noPerformers
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build where clause for filtering
    const where = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { details: { contains: search } },
        { synopsis: { contains: search } },
        { path: { contains: search } }
      ];
    }
    
    if (performer) {
      where.performers = {
        some: {
          performer: {
            name: { contains: performer }
          }
        }
      };
    }

    // Filter by scenes with no performers
    if (noPerformers === 'true') {
      where.AND = where.AND || [];
      where.AND.push({
        performers: { none: {} }
      });
    }
    
    if (studio) {
      // Use AND to combine with other filters
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          {
            studioObject: {
              name: { contains: studio }
            }
          },
          {
            studio: { contains: studio }
          }
        ]
      });
    }
    
    if (tag) {
      where.tags = {
        some: {
          tag: {
            name: { contains: tag }
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
    
    // Handle watched filter
    if (watched === 'true') {
      where.playCount = { gt: 0 };
    } else if (watched === 'false') {
      // Use AND to combine with other filters
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { playCount: 0 },
          { playCount: null }
        ]
      });
    }
    
    // Build order by clause
    const sortOrderLower = sortOrder.toLowerCase();
    const orderBy = {};
    if (sortBy === 'title') {
      orderBy.title = sortOrderLower;
    } else if (sortBy === 'rating') {
      orderBy.rating = sortOrderLower;
    } else if (sortBy === 'duration') {
      orderBy.duration = sortOrderLower;
    } else if (sortBy === 'playCount') {
      orderBy.playCount = sortOrderLower;
    } else {
      orderBy.date = sortOrderLower;
    }
    
    // Get total count for pagination
    const total = await prisma.stashScene.count({ where });
    
    // Get scenes with relations
    const scenes = await prisma.stashScene.findMany({
      where,
      include: {
        performers: {
          include: {
            performer: true,
            tags: {
              include: {
                tag: true
              }
            }
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
      // Image URLs using Stash screenshot API
      paths: {
        screenshot: `scene/${scene.id}/screenshot`,
        image: `scene/${scene.id}/screenshot`
      },
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        performerId: sp.performerId,
        name: sp.performer.name,
        // Include scene-specific metadata from pivot table
        notes: sp.notes,
        tags: sp.tags.map(t => ({
          tag: {
            id: t.tag.id,
            name: t.tag.name,
            description: t.tag.description
          }
        }))
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
}));

// GET /api/stash/scenes/next - Get random unwatched Stash scene for "Next Stash" functionality
router.get('/scenes/next', asyncHandler(async (req, res) => {
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
}));

// GET /api/stash/scenes/:id - Stash scene by ID endpoint
router.get('/scenes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
    
    const scene = await prisma.stashScene.findUnique({
      where: { id: id },
      include: {
        performers: {
          include: {
            performer: true,
            tags: {
              include: {
                tag: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        clips: {
          include: {
            tags: {
              include: {
                tag: true
              }
            }
          }
        },
        studioObject: true,
        groups: {
          include: {
            group: {
              include: {
                studio: true
              }
            }
          },
          orderBy: {
            sceneIndex: 'asc'
          }
        }
      }
    });
    
    if (!scene) {
      return res.status(404).json({ 
        error: 'Scene not found',
        message: `Scene with ID ${id} not found in database`
      });
    }
    
    console.log(`🔍 [Scene GET] Scene ${id} raw data:`, {
      id: scene.id,
      title: scene.title,
      url: scene.url,
      geviUrl: scene.geviUrl,
      episodeUrls: scene.episodeUrls,
      episodeUrlsType: typeof scene.episodeUrls,
      episodeUrlsLength: scene.episodeUrls ? scene.episodeUrls.length : 'null',
      // File info
      path: scene.path,
      fileSize: scene.fileSize ? Number(scene.fileSize) : null,
      width: scene.width,
      height: scene.height,
      duration: scene.duration,
      bitrate: scene.bitrate
    });
    
    // Transform data to match expected format
    const transformedScene = {
      id: scene.id,
      stashId: scene.stashId,
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
      geviUrl: scene.geviUrl,
      episodeUrls: scene.episodeUrls,
      // File information for merge UI
      fileSize: scene.fileSize ? Number(scene.fileSize) : null,
      width: scene.width,
      height: scene.height,
      bitrate: scene.bitrate,
      frameRate: scene.frameRate,
      videoCodec: scene.videoCodec,
      studio: scene.studioObject ? { 
        id: scene.studioObject.id, 
        name: scene.studioObject.name,
        url: scene.studioObject.url,
        image: scene.studioObject.image,
        geviUrl: scene.studioObject.geviUrl
      } : scene.studio ? { name: scene.studio } : null,
      code: scene.code,
      director: scene.director,
      synopsis: scene.synopsis,
      // Image URLs using Stash screenshot API
      paths: {
        screenshot: `scene/${scene.id}/screenshot`,
        image: `scene/${scene.id}/screenshot`
      },
      // Play status fields
      playCount: scene.playCount,
      lastPlayedAt: scene.lastPlayedAt,
      resumeTime: scene.resumeTime,
      playDuration: scene.playDuration,
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        performerId: sp.performerId,
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
        url: sp.performer.url,
        // Include scene-specific metadata from pivot table
        notes: sp.notes,
        tags: sp.tags.map(t => ({
          tag: {
            id: t.tag.id,
            name: t.tag.name,
            description: t.tag.description
          }
        }))
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name,
        description: st.tag.description,
        image: st.tag.image
      })),
      clipTags: (() => {
        // Collect all unique tags from clips
        const tagMap = new Map();
        scene.clips?.forEach(clip => {
          clip.tags?.forEach(ct => {
            if (!tagMap.has(ct.tag.id)) {
              tagMap.set(ct.tag.id, {
                id: ct.tag.id,
                name: ct.tag.name,
                description: ct.tag.description,
                image: ct.tag.image
              });
            }
          });
        });
        return Array.from(tagMap.values());
      })(),
      groups: scene.groups.map(groupWrapper => ({
        sceneIndex: groupWrapper.sceneIndex,
        group: {
          id: groupWrapper.group.id,
          name: groupWrapper.group.name,
          date: groupWrapper.group.date,
          rating: groupWrapper.group.rating,
          duration: groupWrapper.group.duration,
          director: groupWrapper.group.director,
          studio: groupWrapper.group.studio ? {
            id: groupWrapper.group.studio.id,
            name: groupWrapper.group.studio.name
          } : null,
          front_image: groupWrapper.group.front_image,
          back_image: groupWrapper.group.back_image
        }
      }))
    };
    
    res.json({
      success: true,
      data: transformedScene
    });
}));

// POST /api/stash/scenes/:id/parse-filename - Parse filename to extract metadata
router.post('/scenes/:id/parse-filename', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { customFilename, parseStudio = true, parseTitle = true, parsePerformers = true } = req.body;
  
  console.log(`🔍 [Parse Filename] Parse options: Studio=${parseStudio}, Title=${parseTitle}, Performers=${parsePerformers}`);
  
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      studioObject: true
    }
  });
  
  if (!scene || !scene.path) {
    return sendBadRequest(res, 'Scene not found or has no file path');
  }
  
  // Use custom filename if provided, otherwise extract from path
  let nameWithoutExt;
  if (customFilename) {
    // Use provided custom filename (already without extension)
    nameWithoutExt = customFilename;
  } else {
    // Extract filename from path
    const filename = scene.path.split(/[\\/]/).pop();
    nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  }
  
  // Normalize filename: handle double underscores as performer separators, then replace single underscores with spaces
  // Important: Preserve dashes in performer names (e.g., "Q-Tip")
  nameWithoutExt = nameWithoutExt
    .replace(/__/g, ' & ')                       // Replace double underscores with ampersand separator (performer delimiter)
    .replace(/_-_/g, ' - ')                      // Replace _-_ pattern with dash separator (structure delimiter)
    .replace(/_/g, ' ')                          // Replace remaining single underscores with spaces
    .replace(/\s+and\s+/gi, ' & ')               // Normalize "and" to "&"
    .replace(/\s*,\s*/g, ', ')                   // Normalize commas with consistent spacing
    .replace(/\s*&\s*/g, ' & ')                  // Normalize ampersands with consistent spacing
    .replace(/\s+/g, ' ')                        // Collapse multiple spaces
    .trim();                                     // Remove leading/trailing whitespace
  
  // Get all performers and studios for matching
  const allPerformers = await prisma.stashPerformer.findMany();
  const allStudios = await prisma.stashStudio.findMany();
  
  // Helper function to match performers in a string
  const findPerformersInText = (text) => {
    const matched = [];
    const textLower = text.toLowerCase();
    const textNormalized = textLower.replace(/\s+/g, '');
    
    for (const performer of allPerformers) {
      const nameLower = performer.name.toLowerCase();
      const normalizedName = nameLower.replace(/\s+/g, '');
      
      // Check primary name
      let isMatch = false;
      let isExactMatch = false;
      let score = 0;
      
      // First check for exact match (with spaces preserved)
      if (textLower === nameLower) {
        isMatch = true;
        isExactMatch = true;
        score = 1.0;
      }
      // Then check for exact match (normalized without spaces)
      else if (textNormalized === normalizedName) {
        isMatch = true;
        isExactMatch = true;
        score = 1.0;
      }
      // Finally check if the performer name is a complete word/token in the text
      // Use word boundary matching to avoid "Xisco" matching in "Javi Xisco"
      else if (textNormalized.includes(normalizedName)) {
        // Check if it's a word boundary match in the original text with spaces
        const nameWords = nameLower.split(/\s+/);
        const textWords = textLower.split(/\s+/);
        
        // Check if all words of the performer name appear consecutively in the text
        let foundConsecutive = false;
        for (let i = 0; i <= textWords.length - nameWords.length; i++) {
          const slice = textWords.slice(i, i + nameWords.length);
          if (slice.join(' ') === nameWords.join(' ')) {
            foundConsecutive = true;
            break;
          }
        }
        
        if (foundConsecutive) {
          isMatch = true;
          isExactMatch = false;
          score = normalizedName.length / textNormalized.length * 0.9;
        }
      }
      
      if (isMatch) {
        matched.push({
          performer,
          matchedVia: 'name',
          matchedText: performer.name,
          score,
          isExactMatch
        });
        continue;
      }
      
      // Check aliases with the same logic
      if (performer.alias) {
        const aliases = performer.alias.split(',').map(a => a.trim());
        for (const alias of aliases) {
          const aliasLower = alias.toLowerCase();
          const normalizedAlias = aliasLower.replace(/\s+/g, '');
          
          let aliasMatch = false;
          let aliasExactMatch = false;
          let aliasScore = 0;
          
          if (textLower === aliasLower) {
            aliasMatch = true;
            aliasExactMatch = true;
            aliasScore = 1.0;
          } else if (textNormalized === normalizedAlias) {
            aliasMatch = true;
            aliasExactMatch = true;
            aliasScore = 1.0;
          } else if (textNormalized.includes(normalizedAlias)) {
            const aliasWords = aliasLower.split(/\s+/);
            const textWords = textLower.split(/\s+/);
            
            let foundConsecutive = false;
            for (let i = 0; i <= textWords.length - aliasWords.length; i++) {
              const slice = textWords.slice(i, i + aliasWords.length);
              if (slice.join(' ') === aliasWords.join(' ')) {
                foundConsecutive = true;
                break;
              }
            }
            
            if (foundConsecutive) {
              aliasMatch = true;
              aliasExactMatch = false;
              aliasScore = normalizedAlias.length / textNormalized.length * 0.9;
            }
          }
          
          if (aliasMatch) {
            matched.push({
              performer,
              matchedVia: 'alias',
              matchedText: alias,
              score: aliasScore,
              isExactMatch: aliasExactMatch
            });
            break;
          }
        }
      }
    }
    
    // Sort by exact match first, then by score (best match first)
    return matched.sort((a, b) => {
      // Prioritize exact matches
      if (a.isExactMatch && !b.isExactMatch) return -1;
      if (!a.isExactMatch && b.isExactMatch) return 1;
      // Then sort by score
      return b.score - a.score;
    });
  };
  
  // Helper function to match studio in text
  const findStudioInText = (text) => {
    const textLower = text.toLowerCase().replace(/\s+/g, '');
    
    for (const studio of allStudios) {
      const normalizedName = studio.name.toLowerCase().replace(/\s+/g, '');
      if (textLower.includes(normalizedName)) {
        return studio;
      }
    }
    
    return null;
  };
  
  // Helper function to add performer with alternatives
  const addPerformerMatch = (searchText) => {
    const found = findPerformersInText(searchText);
    if (found.length > 0) {
      const bestMatch = found[0]; // Highest score
      const alternatives = found.slice(1).map(fp => ({
        id: fp.performer.id,
        name: fp.performer.name,
        disambiguation: fp.performer.disambiguation || null,
        matchedVia: fp.matchedVia,
        matchedAlias: fp.matchedVia === 'alias' ? fp.matchedText : null
      }));
      
      // Check if this performer is already in the list
      if (!matchedPerformers.find(mp => mp.id === bestMatch.performer.id)) {
        matchedPerformers.push({
          id: bestMatch.performer.id,
          name: bestMatch.performer.name,
          disambiguation: bestMatch.performer.disambiguation || null,
          matchedVia: bestMatch.matchedVia,
          matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
          alternatives: alternatives
        });
        performers.push(bestMatch.performer.name);
      }
      return true;
    }
    return false;
  };
  
  // Helper function to add ALL performers found in text by splitting by separators first
  const addAllPerformerMatches = (searchText) => {
    // Split by & or , to identify individual performer names
    const performerNames = searchText.split(/\s*[,&]\s*/).map(p => p.trim()).filter(Boolean);
    
    let addedCount = 0;
    
    // For each name, find best match + alternatives specific to that name
    performerNames.forEach(pName => {
      const found = findPerformersInText(pName);
      
      if (found.length > 0) {
        // Group by performer ID to handle duplicate matches for same performer
        const performerGroups = {};
        found.forEach(fp => {
          if (!performerGroups[fp.performer.id]) {
            performerGroups[fp.performer.id] = [];
          }
          performerGroups[fp.performer.id].push(fp);
        });
        
        // Convert to array and sort by best score
        const uniquePerformers = Object.values(performerGroups).map(group => group[0]);
        uniquePerformers.sort((a, b) => b.score - a.score);
        
        // Best match for THIS name
        const bestMatch = uniquePerformers[0];
        
        // Alternatives are other performers that also match THIS name
        const alternatives = uniquePerformers.slice(1).map(fp => ({
          id: fp.performer.id,
          name: fp.performer.name,
          disambiguation: fp.performer.disambiguation || null,
          matchedVia: fp.matchedVia,
          matchedAlias: fp.matchedVia === 'alias' ? fp.matchedText : null
        }));
        
        // Check if this performer is already in the list
        if (!matchedPerformers.find(mp => mp.id === bestMatch.performer.id)) {
          matchedPerformers.push({
            id: bestMatch.performer.id,
            name: bestMatch.performer.name,
            disambiguation: bestMatch.performer.disambiguation || null,
            matchedVia: bestMatch.matchedVia,
            matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
            alternatives: alternatives,
            originalName: pName  // Store the original name from filename
          });
          performers.push(bestMatch.performer.name);
          addedCount++;
        }
      } else {
        // No match found - add as unmatched
        unmatchedPerformers.push(pName);
        performers.push(pName);
      }
    });
    
    return addedCount;
  };
  
  // Strategy: Try to match performers first, then studio, then derive title
  let studio = null;
  let performers = [];
  let title = null;
  let matchedStudio = null;
  const matchedPerformers = [];
  const unmatchedPerformers = [];
  
  // Split filename by dash separators to detect structure
  // Only split on " - " (space-dash-space) to preserve dashes in names like "Q-Tip"
  const parts = nameWithoutExt.split(' - ');
  
  // Pattern 1: Studio - Performer(s) - Title (3 parts)
  if (parts.length === 3) {
    const [part1, part2, part3] = parts.map(p => p.trim());
    
    // If we haven't found studio yet and parsing studio is enabled, first part might be studio
    if (!studio && parseStudio) {
      const studioMatch = findStudioInText(part1);
      if (studioMatch) {
        matchedStudio = studioMatch;
        studio = studioMatch.name;
      } else {
        studio = part1;
      }
    }
    
    // Second part is performers - parse all of them if parsing performers is enabled
    if (performers.length === 0 && parsePerformers) {
      addAllPerformerMatches(part2);
    }
    
    // Third part is title if parsing title is enabled
    if (parseTitle) {
      title = part3;
    }
  }
  // Pattern 2: Studio - Performer(s) OR Performer(s) - Title (2 parts)
  else if (parts.length === 2) {
    const [part1, part2] = parts.map(p => p.trim());
    
    // Check if first part is studio and parsing studio is enabled
    const studioMatch = parseStudio ? findStudioInText(part1) : null;
    if (studioMatch && !studio && parseStudio) {
      matchedStudio = studioMatch;
      studio = studioMatch.name;
      
      // Second part could be performers or title
      if (performers.length === 0 && parsePerformers) {
        // Parse as performers, generate title from them
        addAllPerformerMatches(part2);
        if (parseTitle) {
          title = performers.join(' & ');
        }
      } else if (parseTitle) {
        // Not parsing performers, so second part is the title
        title = part2;
      }
    } else {
      // First part might be performers, second is title
      if (performers.length === 0 && parsePerformers) {
        addAllPerformerMatches(part1);
      }
      if (parseTitle) {
        title = part2;
      }
    }
  }
  // Single part - try to parse it as performers or studio
  else {
    // If we already found performers/studio globally, use those
    if (performers.length > 0 || studio) {
      // Generate title from performers if no title yet and parsing title is enabled
      if (!title && performers.length > 0 && parseTitle) {
        title = performers.join(' & ');
      } else if (!title && parseTitle) {
        title = nameWithoutExt;
      }
    } else {
      // No dash separators - could be:
      // 1. Multiple performers separated by & or ,
      // 2. Single studio name
      // 3. Just a title
      
      // Try to parse as multiple performers (this will split by & or ,) if parsing performers is enabled
      const foundCount = parsePerformers ? addAllPerformerMatches(nameWithoutExt) : 0;
      
      if (foundCount > 0 && parseTitle) {
        // Found performers - generate title from them
        title = performers.join(' & ');
      } else if (foundCount === 0) {
        // No performers found - try as studio if parsing studio is enabled
        const studioMatch = parseStudio ? findStudioInText(nameWithoutExt) : null;
        if (studioMatch && parseStudio) {
          matchedStudio = studioMatch;
          studio = studioMatch.name;
          if (parseTitle) {
            title = studio;
          }
        } else if (parseTitle) {
          // Final fallback - use whole name as title
          title = nameWithoutExt;
        }
      }
    }
  }
  
  // Set unmatched studio if we have a studio but no match
  const unmatchedStudio = studio && !matchedStudio ? studio : null;
  
  // Don't automatically update scene - just return parsing results
  // User will accept/edit in modal before updating
  
  sendSuccess(res, {
    parsed: {
      studio: parseStudio ? studio : null,
      performers: parsePerformers ? performers : [],
      title: parseTitle ? title : null
    },
    matched: {
      studio: parseStudio && matchedStudio ? { id: matchedStudio.id, name: matchedStudio.name } : null,
      performers: parsePerformers ? matchedPerformers : []
    },
    unmatched: {
      studio: parseStudio ? unmatchedStudio : null,
      performers: parsePerformers ? unmatchedPerformers : []
    }
  });
}));

// POST /api/stash/performers/create - Create a new performer in both Stash and local DB
router.post('/performers/create', asyncHandler(async (req, res) => {
  console.log('👤 [Create Performer] Request received');
  console.log('   - Body:', JSON.stringify(req.body, null, 2));
  
  const { name, aliases, gender, birthdate, ethnicity, country, eyeColor, hairColor, height, measurements, fakeTits, penisLength, circumcised, tattoos, piercings, careerLength, details, url } = req.body;

  // Validate required fields - this will throw an error if validation fails
  validateRequiredFieldsDirect(req.body, ['name']);

  console.log('👤 [Create Performer] Creating performer:', name);
  if (url) {
    console.log('   - With URL:', url);
  }

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Ensure sync service is available
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  try {
    // First, create performer in Stash via GraphQL
    const createMutation = `
      mutation PerformerCreate($input: PerformerCreateInput!) {
        performerCreate(input: $input) {
          id
          name
          alias_list
          gender
          birthdate
          ethnicity
          country
          eye_color
          hair_color
          height_cm
          measurements
          fake_tits
          penis_length
          circumcised
          tattoos
          piercings
          career_length
          details
          url
          stash_ids {
            endpoint
            stash_id
          }
        }
      }
    `;

    const variables = {
      input: {
        name: name,
        alias_list: aliases || [],
        gender: gender || null,
        birthdate: birthdate || null,
        ethnicity: ethnicity || null,
        country: country || null,
        eye_color: eyeColor || null,
        hair_color: hairColor || null,
        height_cm: height || null,
        measurements: measurements || null,
        fake_tits: fakeTits || null,
        penis_length: penisLength || null,
        url: url || null,
        circumcised: circumcised || null,
        tattoos: tattoos || null,
        piercings: piercings || null,
        career_length: careerLength || null,
        details: details || null
      }
    };

    console.log('   - Creating in Stash with variables:', JSON.stringify(variables, null, 2));

    const data = await syncService.makeGraphQLRequest(createMutation, variables);

    console.log('   - GraphQL response data:', JSON.stringify(data, null, 2));

    if (!data || !data.performerCreate) {
      console.error('   - Failed to create performer in Stash. Response:', data);
      return sendServerError(res, 'Failed to create performer in Stash - no data returned');
    }

    const stashPerformer = data.performerCreate;
    console.log('   - Created in Stash:', stashPerformer.id, stashPerformer.name);

    // Now create in local database
    const localPerformer = await prisma.stashPerformer.create({
      data: {
        id: stashPerformer.id, // Use Stash ID as primary key
        name: stashPerformer.name,
        alias: stashPerformer.alias_list && stashPerformer.alias_list.length > 0 ? stashPerformer.alias_list.join(', ') : null,
        gender: stashPerformer.gender || null,
        birthdate: stashPerformer.birthdate || null,
        ethnicity: stashPerformer.ethnicity || null,
        country: stashPerformer.country || null,
        eye_color: stashPerformer.eye_color || null,
        hair_color: stashPerformer.hair_color || null,
        height: stashPerformer.height_cm ? String(stashPerformer.height_cm) : null,
        measurements: stashPerformer.measurements || null,
        fake_tits: stashPerformer.fake_tits || null,
        penis_length: stashPerformer.penis_length ? String(stashPerformer.penis_length) : null,
        circumcised: stashPerformer.circumcised || null,
        tattoos: stashPerformer.tattoos || null,
        piercings: stashPerformer.piercings || null,
        career_length: stashPerformer.career_length || null,
        details: stashPerformer.details || null,
        url: stashPerformer.url || null,
        image: null, // Will be set on next sync if available
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncedAt: new Date()
      }
    });

    console.log('   - Created in local DB:', localPerformer.id, localPerformer.name);

    sendSuccess(res, {
      performer: localPerformer,
      message: `Performer "${name}" created successfully`
    });

  } catch (error) {
    console.error('❌ [Create Performer] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    return sendServerError(res, error.message || 'Failed to create performer');
  }
}));

// POST /api/stash/tags/create - Create a new tag in both Stash and local DB
router.post('/tags/create', asyncHandler(async (req, res) => {
  console.log('🏷️ [Create Tag] Request received');
  console.log('   - Body:', JSON.stringify(req.body, null, 2));
  
  const { name, aliases } = req.body;

  // Validate required fields
  validateRequiredFieldsDirect(req.body, ['name']);

  console.log('🏷️ [Create Tag] Creating tag:', name);

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Ensure sync service is available
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  try {
    // First, create tag in Stash via GraphQL
    const createMutation = `
      mutation TagCreate($input: TagCreateInput!) {
        tagCreate(input: $input) {
          id
          name
          aliases
        }
      }
    `;

    const variables = {
      input: {
        name: name,
        aliases: aliases || []
      }
    };

    console.log('   - Creating in Stash with variables:', JSON.stringify(variables, null, 2));

    const data = await syncService.makeGraphQLRequest(createMutation, variables);

    console.log('   - GraphQL response data:', JSON.stringify(data, null, 2));

    if (!data || !data.tagCreate) {
      console.error('   - Failed to create tag in Stash. Response:', data);
      return sendServerError(res, 'Failed to create tag in Stash - no data returned');
    }

    const stashTag = data.tagCreate;
    console.log('   - Created in Stash:', stashTag.id, stashTag.name);

    // Now create in local database with aliases as separate records
    const createData = {
      id: stashTag.id,
      name: stashTag.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date()
    };

    // Add aliases if they exist
    if (stashTag.aliases && stashTag.aliases.length > 0) {
      createData.aliases = {
        create: stashTag.aliases.map(alias => ({
          alias: alias
        }))
      };
    }

    const localTag = await prisma.stashTag.create({
      data: createData,
      include: {
        aliases: true
      }
    });

    console.log('   - Created in local DB:', localTag.id, localTag.name);

    sendSuccess(res, {
      tag: localTag,
      message: `Tag "${name}" created successfully`
    });

  } catch (error) {
    console.error('❌ [Create Tag] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    return sendServerError(res, error.message || 'Failed to create tag');
  }
}));

// PUT /api/stash/performers/:id - Update performer in both Stash and local DB
router.put('/performers/:id', asyncHandler(async (req, res) => {
  console.log('✏️ [Update Performer] Request received');
  console.log('   - Performer ID:', req.params.id);
  console.log('   - Body:', JSON.stringify(req.body, null, 2));

  const { id } = req.params;
  const { name, alias, disambiguation, newUrls } = req.body;

  // Validate required fields
  validateRequiredFieldsDirect(req.body, ['name']);

  console.log('✏️ [Update Performer] Updating performer:', id, name);

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Ensure sync service is available
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  try {
    // First, fetch current performer data from Stash to get existing URLs
    const fetchQuery = `
      query FindPerformer($id: ID!) {
        findPerformer(id: $id) {
          id
          urls
        }
      }
    `;

    const currentData = await syncService.makeGraphQLRequest(fetchQuery, { id });
    const existingUrls = currentData?.findPerformer?.urls || [];
    
    console.log('   - Existing URLs:', existingUrls.length);
    
    // Prepare new URLs to append (filter out duplicates)
    const urlsToAdd = (newUrls || [])
      .filter(url => url && url.trim() !== '')
      .filter(url => !existingUrls.includes(url));
    
    console.log('   - URLs to add:', urlsToAdd.length);
    
    // Combine existing and new URLs
    const allUrls = [...existingUrls, ...urlsToAdd];
    
    // Now update performer in Stash via GraphQL
    const updateMutation = `
      mutation PerformerUpdate($input: PerformerUpdateInput!) {
        performerUpdate(input: $input) {
          id
          name
          disambiguation
          alias_list
          url
          twitter
          instagram
          urls
        }
      }
    `;

    // Prepare variables - convert alias to array if provided
    const aliasList = alias && alias.trim() !== '' 
      ? alias.split(',').map(a => a.trim()).filter(a => a !== '')
      : [];

    const variables = {
      input: {
        id: id,
        name: name.trim(),
        alias_list: aliasList,
        disambiguation: disambiguation && disambiguation.trim() !== '' ? disambiguation.trim() : null,
        urls: allUrls // Send complete URLs array (existing + new)
      }
    };

    console.log('   - Updating in Stash with variables:', JSON.stringify(variables, null, 2));

    const data = await syncService.makeGraphQLRequest(updateMutation, variables);

    console.log('   - GraphQL response data:', JSON.stringify(data, null, 2));

    if (!data || !data.performerUpdate) {
      console.error('   - Failed to update performer in Stash. Response:', data);
      return sendServerError(res, 'Failed to update performer in Stash - no data returned');
    }

    const stashPerformer = data.performerUpdate;
    console.log('   - Updated in Stash:', stashPerformer.id, stashPerformer.name);

    // Now update in local database
    const updatedPerformer = await prisma.stashPerformer.update({
      where: { id: id },
      data: {
        name: stashPerformer.name,
        alias: stashPerformer.alias_list && stashPerformer.alias_list.length > 0 
          ? stashPerformer.alias_list.join(', ') 
          : null,
        disambiguation: stashPerformer.disambiguation || null,
        url: stashPerformer.url || null,
        twitter: stashPerformer.twitter || null,
        instagram: stashPerformer.instagram || null,
        updatedAt: new Date(),
        lastSyncedAt: new Date()
      }
    });

    console.log('   - Updated in local DB:', updatedPerformer.id, updatedPerformer.name);

    sendSuccess(res, {
      performer: updatedPerformer,
      message: `Performer "${name}" updated successfully`
    });

  } catch (error) {
    console.error('❌ [Update Performer] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    
    // Handle case where performer doesn't exist in local DB
    if (error.code === 'P2025') {
      return sendNotFound(res, 'Performer not found in local database');
    }
    
    return sendServerError(res, error.message || 'Failed to update performer');
  }
}));

// DELETE /api/stash/performers/:id - Delete performer from both Stash and local DB
router.delete('/performers/:id', asyncHandler(async (req, res) => {
  console.log('🗑️ [Delete Performer] Request received');
  console.log('   - Performer ID:', req.params.id);

  const { id } = req.params;

  console.log('🗑️ [Delete Performer] Deleting performer:', id);

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Get sync service (but don't require it - we'll delete from DB even if Stash fails)
  const syncService = getActiveSyncService();
  
  let stashDeleted = false;
  let stashError = null;

  // Try to delete from Stash first (but don't fail if this doesn't work)
  if (syncService) {
    try {
      await syncService.ensureConfigLoaded();
      
      const deleteMutation = `
        mutation PerformerDestroy($input: PerformerDestroyInput!) {
          performerDestroy(input: $input)
        }
      `;

      const variables = {
        input: {
          id: id
        }
      };

      console.log('   - Deleting from Stash with variables:', JSON.stringify(variables, null, 2));

      const data = await syncService.makeGraphQLRequest(deleteMutation, variables);

      console.log('   - GraphQL response data:', JSON.stringify(data, null, 2));

      if (data && data.performerDestroy) {
        stashDeleted = true;
        console.log('   - Successfully deleted from Stash');
      } else {
        stashError = 'Stash did not confirm deletion';
        console.warn('   - Stash deletion uncertain:', data);
      }

    } catch (error) {
      stashError = error.message;
      console.error('   - Failed to delete from Stash:', error.message);
      console.error('   - Will proceed with local DB deletion anyway');
    }
  } else {
    stashError = 'Sync service not initialized';
    console.warn('   - Sync service not available, will only delete from local DB');
  }

  // Always try to delete from local database, regardless of Stash result
  try {
    const deletedPerformer = await prisma.stashPerformer.delete({
      where: { id: id }
    });

    console.log('   - Deleted from local DB:', deletedPerformer.id, deletedPerformer.name);

    // Prepare response message
    let message = '';
    if (stashDeleted) {
      message = `Performer "${deletedPerformer.name}" deleted successfully from both Stash and local database`;
    } else if (stashError) {
      message = `Performer "${deletedPerformer.name}" deleted from local database. Stash deletion ${stashError ? 'failed: ' + stashError : 'could not be verified'}`;
    } else {
      message = `Performer "${deletedPerformer.name}" deleted from local database`;
    }

    sendSuccess(res, {
      performer: deletedPerformer,
      message: message,
      stashDeleted: stashDeleted,
      stashError: stashError
    });

  } catch (error) {
    console.error('❌ [Delete Performer] Error deleting from local DB:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    
    // Handle case where performer doesn't exist in local DB
    if (error.code === 'P2025') {
      return sendNotFound(res, 'Performer not found in local database');
    }
    
    return sendServerError(res, error.message || 'Failed to delete performer from local database');
  }
}));

// POST /api/stash/performers/:id/sync - Sync single performer from Stash
router.post('/performers/:id/sync', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log('🔄 [Sync Performer] Syncing performer from Stash:', id);
  
  // Initialize sync service if needed
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }
  
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }
  
  try {
    // Fetch performer data from Stash
    const performerQuery = `
      query FindPerformer($id: ID!) {
        findPerformer(id: $id) {
          id
          name
          disambiguation
          alias_list
          gender
          birthdate
          death_date
          country
          ethnicity
          hair_color
          eye_color
          height_cm
          weight
          penis_length
          circumcised
          fake_tits
          career_length
          tattoos
          piercings
          url
          twitter
          instagram
          urls
          image_path
          tags {
            id
            name
          }
          scene_count
        }
      }
    `;
    
    console.log('   - Fetching from Stash API...');
    const data = await syncService.makeGraphQLRequest(performerQuery, { id });
    
    if (!data || !data.findPerformer) {
      console.log('   - Performer not found in Stash');
      return sendNotFound(res, 'Performer not found in Stash');
    }
    
    const stashPerformer = data.findPerformer;
    console.log('   - Fetched performer:', stashPerformer.name);
    
    // Update performer in local database
    const updatedPerformer = await prisma.stashPerformer.update({
      where: { id: id },
      data: {
        name: stashPerformer.name,
        disambiguation: stashPerformer.disambiguation || null,
        alias: stashPerformer.alias_list?.join(', ') || null,
        gender: stashPerformer.gender || null,
        birthdate: stashPerformer.birthdate || null,
        death_date: stashPerformer.death_date || null,
        country: stashPerformer.country || null,
        ethnicity: stashPerformer.ethnicity || null,
        hair_color: stashPerformer.hair_color || null,
        eye_color: stashPerformer.eye_color || null,
        height: stashPerformer.height_cm ? `${stashPerformer.height_cm} cm` : null,
        weight: stashPerformer.weight ? `${stashPerformer.weight} kg` : null,
        penis_length: stashPerformer.penis_length ? `${stashPerformer.penis_length} cm` : null,
        circumcised: stashPerformer.circumcised || null,
        fake_tits: stashPerformer.fake_tits || null,
        career_length: stashPerformer.career_length || null,
        tattoos: stashPerformer.tattoos || null,
        piercings: stashPerformer.piercings || null,
        url: stashPerformer.url || null,
        twitter: stashPerformer.twitter || null,
        instagram: stashPerformer.instagram || null,
        image: stashPerformer.image_path || null
      }
    });
    
    console.log('   - Updated local database');
    
    // Sync tags (delete existing relationships and recreate)
    if (stashPerformer.tags && stashPerformer.tags.length > 0) {
      console.log(`   - Syncing ${stashPerformer.tags.length} tags...`);
      
      // Delete existing tag relationships
      await prisma.stashPerformerTag.deleteMany({
        where: { performerId: id }
      });
      
      // Create new tag relationships
      for (const tag of stashPerformer.tags) {
        // Ensure tag exists in database
        await prisma.stashTag.upsert({
          where: { id: tag.id },
          create: {
            id: tag.id,
            name: tag.name
          },
          update: {
            name: tag.name
          }
        });
        
        // Create relationship
        await prisma.stashPerformerTag.create({
          data: {
            performerId: id,
            tagId: tag.id
          }
        });
      }
      
      console.log('   - Tags synced');
    }
    
    // Fetch updated performer with relationships
    const finalPerformer = await prisma.stashPerformer.findUnique({
      where: { id: id },
      include: {
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
    
    console.log('✅ [Sync Performer] Successfully synced:', finalPerformer.name);
    
    sendSuccess(res, {
      performer: finalPerformer,
      message: `Successfully synced "${finalPerformer.name}" from Stash`
    });
    
  } catch (error) {
    console.error('❌ [Sync Performer] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    
    if (error.code === 'P2025') {
      return sendNotFound(res, 'Performer not found in local database');
    }
    
    return sendServerError(res, error.message || 'Failed to sync performer from Stash');
  }
}));

// POST /api/stash/performers/merge - Merge multiple performers into one
router.post('/performers/merge', asyncHandler(async (req, res) => {
  const { mainPerformerId, mergePerformerIds } = req.body;
  
  console.log('🔄 [Merge Performers] Request received');
  console.log(`   - Main performer: ${mainPerformerId}`);
  console.log(`   - Merge performers: ${mergePerformerIds?.join(', ')}`);
  
  // Validate inputs
  validateRequiredFieldsDirect({ mainPerformerId, mergePerformerIds }, ['mainPerformerId', 'mergePerformerIds']);
  
  if (!Array.isArray(mergePerformerIds) || mergePerformerIds.length === 0) {
    return sendBadRequest(res, 'mergePerformerIds must be a non-empty array');
  }
  
  if (mergePerformerIds.includes(mainPerformerId)) {
    return sendBadRequest(res, 'Cannot merge a performer into itself');
  }
  
  // Initialize sync service if needed
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }
  
  const syncService = getActiveSyncService();
  
  // Create merge service instance with sync service
  const mergeService = new PerformerMergeService(prisma, syncService);
  
  // Perform the merge
  const result = await mergeService.mergePerformers(mainPerformerId, mergePerformerIds);
  
  if (result.success) {
    console.log('✅ [Merge Performers] Merge completed successfully');
    console.log(`   - Merged ${result.mergedCount} performer(s) into ${result.mainPerformer.name}`);
    console.log(`   - Transferred ${result.transferredScenes} scene(s)`);
    
    sendSuccess(res, {
      mainPerformer: result.mainPerformer,
      mergedCount: result.mergedCount,
      transferredScenes: result.transferredScenes,
      message: `Successfully merged ${result.mergedCount} performer(s) into "${result.mainPerformer.name}"`
    });
  } else {
    console.error('❌ [Merge Performers] Merge failed:', result.error);
    return sendServerError(res, result.error || 'Failed to merge performers');
  }
}));

// POST /api/stash/groups/create - Create a new group/movie in both Stash and local DB
router.post('/groups/create', asyncHandler(async (req, res) => {
  console.log('🎬 [Create Group] Request received');
  console.log('   - Body:', JSON.stringify(req.body, null, 2));
  
  const { 
    name, 
    aliases, 
    duration, 
    date, 
    rating, 
    director, 
    synopsis, 
    studioId,
    front_image,
    back_image,
    url,
    geviUrl,
    sceneId,
    sceneIndex
  } = req.body;

  // Validate required fields
  validateRequiredFieldsDirect(req.body, ['name']);

  console.log('🎬 [Create Group] Creating group:', name);

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Ensure sync service is available
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  try {
    // First, create group in Stash via GraphQL
    const createMutation = `
      mutation GroupCreate($input: GroupCreateInput!) {
        groupCreate(input: $input) {
          id
          name
          aliases
          duration
          date
          rating100
          director
          synopsis
          studio {
            id
            name
          }
          urls
          front_image_path
          back_image_path
        }
      }
    `;

    const variables = {
      input: {
        name: name,
        aliases: aliases || null,
        duration: duration ? parseInt(duration) : null,
        date: date || null,
        rating100: rating ? parseInt(rating) : null,
        director: director || null,
        synopsis: synopsis || null,
        studio_id: studioId || null,
        urls: url ? [url] : []
      }
    };

    console.log('   - Creating in Stash with variables:', JSON.stringify(variables, null, 2));

    const data = await syncService.makeGraphQLRequest(createMutation, variables);

    console.log('   - GraphQL response data:', JSON.stringify(data, null, 2));

    if (!data || !data.groupCreate) {
      console.error('   - Failed to create group in Stash. Response:', data);
      return sendServerError(res, 'Failed to create group in Stash - no data returned');
    }

    const stashGroup = data.groupCreate;
    console.log('   - Created in Stash:', stashGroup.id, stashGroup.name);

    // Now create in local database
    const localGroup = await prisma.stashGroup.create({
      data: {
        id: stashGroup.id, // Use Stash ID as primary key
        name: stashGroup.name,
        aliases: stashGroup.aliases || null,
        duration: stashGroup.duration || null,
        date: stashGroup.date || null,
        rating: stashGroup.rating100 || null,
        director: stashGroup.director || null,
        synopsis: stashGroup.synopsis || null,
        studioId: stashGroup.studio?.id || studioId || null,
        url: url || (stashGroup.urls && stashGroup.urls.length > 0 ? stashGroup.urls[0] : null),
        geviUrl: geviUrl || null, // Store GEVI URL
        frontImage: front_image || stashGroup.front_image_path || null,
        backImage: back_image || stashGroup.back_image_path || null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('   - Created in local DB:', localGroup.id, localGroup.name);

    // Return group with studio info if available
    const groupWithStudio = await prisma.stashGroup.findUnique({
      where: { id: localGroup.id },
      include: {
        studio: true
      }
    });

    sendSuccess(res, {
      group: groupWithStudio,
      message: `Group "${name}" created successfully`
    });

  } catch (error) {
    console.error('❌ [Create Group] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    return sendServerError(res, error.message || 'Failed to create group');
  }
}));

// POST /api/stash/groups/:id/add-scene - Add a scene to an existing group/movie
router.post('/groups/:id/add-scene', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sceneId, sceneIndex = 0 } = req.body;

  console.log(`\n=== ADD SCENE TO GROUP ===`);
  console.log(`Group ID: ${id}`);
  console.log(`Scene ID: ${sceneId}`);
  console.log(`Scene Index: ${sceneIndex}`);

  validateRequiredFieldsDirect(req.body, ['sceneId']);

  try {
    // First, verify the group exists
    const group = await prisma.stashGroup.findUnique({
      where: { id: id }
    });

    if (!group) {
      return sendBadRequest(res, `Group with ID ${id} not found`);
    }

    // Verify the scene exists
    const scene = await prisma.stashScene.findUnique({
      where: { id: sceneId }
    });

    if (!scene) {
      return sendBadRequest(res, `Scene with ID ${sceneId} not found`);
    }

    // Check if the relationship already exists
    const existingRelation = await prisma.stashGroupScene.findFirst({
      where: {
        groupId: id,
        sceneId: sceneId
      }
    });

    if (existingRelation) {
      return sendBadRequest(res, 'Scene is already linked to this group');
    }

    // Create the relationship in the database
    const groupScene = await prisma.stashGroupScene.create({
      data: {
        groupId: id,
        sceneId: sceneId,
        sceneIndex: parseInt(sceneIndex)
      }
    });

    console.log('✅ Scene linked to group in database');

    // Also update in Stash via GraphQL if we have the IDs
    if (group.id && scene.id) {
      const mutation = `
        mutation UpdateGroup($input: GroupUpdateInput!) {
          groupUpdate(input: $input) {
            id
          }
        }
      `;

      // First get the existing scene IDs
      const existingScenes = await prisma.stashGroupScene.findMany({
        where: { groupId: id },
        include: { scene: true }
      });

      const sceneIds = existingScenes
        .map(gs => gs.scene.id)
        .filter(sid => sid); // Filter out nulls

      const variables = {
        input: {
          id: group.id,
          scene_ids: sceneIds
        }
      };

      try {
        await makeStashGraphQLRequest(mutation, variables);
        console.log('✅ Scene linked to group in Stash');
      } catch (stashError) {
        console.error('⚠️  Warning: Failed to update Stash, but database was updated:', stashError.message);
        // Continue anyway since database update succeeded
      }
    }

    sendSuccess(res, {
      groupScene,
      message: 'Scene linked to group successfully'
    });

  } catch (error) {
    console.error('❌ [Add Scene to Group] Error:', error);
    console.error('   - Error message:', error.message);
    console.error('   - Error stack:', error.stack);
    return sendServerError(res, error.message || 'Failed to add scene to group');
  }
}));

// POST /api/stash/groups/:id/apply-matched-scenes - Apply action codes from matched scenes after user acceptance
router.post('/groups/:id/apply-matched-scenes', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { matchedScenes } = req.body;

  console.log('🎬 [Apply Matched Scenes] Processing action codes for group:', id);
  console.log(`   - Received ${matchedScenes?.length || 0} matched scenes`);

  validateRequiredFieldsDirect(req.body, ['matchedScenes']);

  if (!Array.isArray(matchedScenes) || matchedScenes.length === 0) {
    return sendBadRequest(res, 'matchedScenes must be a non-empty array');
  }

  const results = {
    totalScenes: matchedScenes.length,
    processedScenes: 0,
    totalPerformers: 0,
    appliedActionCodes: 0,
    errors: []
  };

  for (const match of matchedScenes) {
    if (!match.sceneId || !match.performers || !Array.isArray(match.performers)) {
      console.log(`   ⚠️  Skipping invalid match (sceneId: ${match.sceneId}, performers: ${match.performers?.length})`);
      continue;
    }

    console.log(`\n   🎭 Processing scene ${match.sceneId} with ${match.performers.length} performers`);

    // Get scene with performers
    const dbScene = await prisma.stashScene.findUnique({
      where: { id: match.sceneId },
      include: {
        performers: {
          include: {
            performer: true
          }
        }
      }
    });

    if (!dbScene) {
      console.log(`   ⚠️  Scene ${match.sceneId} not found in database`);
      results.errors.push({ sceneId: match.sceneId, error: 'Scene not found' });
      continue;
    }

    // Build array of performers with IDs and action codes
    const performersWithCodes = [];

    for (const geviPerformer of match.performers) {
      const performerName = typeof geviPerformer === 'string' ? geviPerformer : geviPerformer.name;
      const actionCode = typeof geviPerformer === 'object' ? geviPerformer.actionCode : null;

      if (!actionCode) {
        console.log(`      ⚠️  No action code for performer: ${performerName}`);
        continue;
      }

      console.log(`      - Performer: ${performerName}, Action Code: ${actionCode}`);

      // Find matching performer in database scene
      const dbPerformer = dbScene.performers.find(sp => 
        sp.performer.name.toLowerCase() === performerName.toLowerCase() ||
        sp.performer.name.toLowerCase().includes(performerName.toLowerCase()) ||
        performerName.toLowerCase().includes(sp.performer.name.toLowerCase())
      );

      if (dbPerformer) {
        performersWithCodes.push({
          id: dbPerformer.performerId,
          name: dbPerformer.performer.name,
          actionCode: actionCode
        });
        results.totalPerformers++;
      } else {
        console.log(`      ⚠️  Could not find matching DB performer for: ${performerName}`);
        results.errors.push({ sceneId: match.sceneId, performer: performerName, error: 'Performer not found' });
      }
    }

    // Apply action code tags using the service
    if (performersWithCodes.length > 0) {
      try {
        const tagResult = await actionCodeService.applyActionCodeTagsForPerformers(
          match.sceneId,
          performersWithCodes,
          prisma
        );

        console.log(`      ✅ Applied ${tagResult.totalApplied} tags from ${performersWithCodes.length} action codes`);
        results.appliedActionCodes += tagResult.totalApplied;
        results.processedScenes++;

        if (tagResult.missingTags && tagResult.missingTags.length > 0) {
          console.warn(`      ⚠️  Warning: ${tagResult.missingTags.length} tags not found in database`);
          results.errors.push({ sceneId: match.sceneId, missingTags: tagResult.missingTags });
        }

        // Log details for each performer
        for (const result of tagResult.performerResults) {
          if (result.appliedTags.length > 0) {
            console.log(`      ✅ ${result.performerName}: ${result.appliedTags.join(', ')}`);
          }
          if (result.missingTags.length > 0) {
            console.log(`      ⚠️  ${result.performerName}: Missing tags - ${result.missingTags.join(', ')}`);
          }
        }
      } catch (error) {
        console.error(`      ❌ Failed to apply action code tags:`, error.message);
        results.errors.push({ sceneId: match.sceneId, error: error.message });
      }
    }
  }

  console.log(`\n✅ [Apply Matched Scenes] Complete:`);
  console.log(`   - Processed: ${results.processedScenes}/${results.totalScenes} scenes`);
  console.log(`   - Total performers: ${results.totalPerformers}`);
  console.log(`   - Applied action codes: ${results.appliedActionCodes}`);
  console.log(`   - Errors: ${results.errors.length}`);

  sendSuccess(res, {
    message: 'Action codes applied successfully',
    results
  });
}));

// POST /api/stash/groups/:id/search-gevi - Search GEVI for movies by group title
router.post('/groups/:id/search-gevi', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🔍 [GEVI Movie Search] Searching for group:', id);

  // Get the group from database
  const group = await prisma.stashGroup.findUnique({
    where: { id },
    include: {
      studio: true
    }
  });

  if (!group) {
    return sendBadRequest(res, 'Group not found');
  }

  if (!group.name || !group.name.trim()) {
    return sendBadRequest(res, 'Group has no title to search');
  }

  console.log('   - Group title:', group.name);

  try {
    // Search GEVI for movies matching the group title
    let movies = await geviScraper.searchMovie(group.name);

    // If no results and group has aliases, try searching with each alias
    if ((!movies || movies.length === 0) && group.aliases) {
      console.log('   - No results with primary title, trying aliases...');
      const aliases = group.aliases.split(',').map(a => a.trim()).filter(a => a.length > 0);
      
      for (const alias of aliases) {
        console.log(`   - Trying alias: "${alias}"`);
        movies = await geviScraper.searchMovie(alias);
        
        if (movies && movies.length > 0) {
          console.log(`   - ✓ Found ${movies.length} movies using alias "${alias}"`);
          break;
        }
      }
    }

    if (!movies || movies.length === 0) {
      console.log('   - No movies found');
      return sendSuccess(res, {
        group: {
          id: group.id,
          name: group.name
        },
        movies: []
      });
    }

    console.log(`   - Found ${movies.length} movies`);
    
    sendSuccess(res, {
      group: {
        id: group.id,
        name: group.name
      },
      movies: movies
    });

  } catch (error) {
    console.error('❌ Error searching GEVI:', error);
    return sendServerError(res, error.message || 'Failed to search GEVI');
  }
}));

// PUT /api/stash/groups/:id - Update group with scraped GEVI metadata
router.put('/groups/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, date, duration, director, synopsis, studio, front_image, back_image, geviUrl } = req.body;

  console.log('📝 [Group Update] Updating group:', id);

  // Initialize sync service if not already done
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Ensure sync service is available
  const syncService = getActiveSyncService();
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  // Get the group from database
  const group = await prisma.stashGroup.findUnique({
    where: { id }
  });

  if (!group) {
    return sendBadRequest(res, 'Group not found');
  }

  try {
    // Prepare update data for Stash GraphQL
    const updateInput = {
      id: id,
    };

    if (name) updateInput.name = name;
    if (date) updateInput.date = date;
    if (duration) updateInput.duration = parseInt(duration, 10);
    if (director) updateInput.director = director;
    if (synopsis) updateInput.synopsis = synopsis;
    if (front_image) updateInput.front_image = front_image;
    if (back_image) updateInput.back_image = back_image;

    // Handle studio
    if (studio) {
      const studioName = typeof studio === 'string' ? studio : studio.name;
      if (studioName && studioName.trim()) {
        // Find or create studio in Stash
        const existingStudio = await prisma.stashStudio.findFirst({
          where: { name: studioName }
        });

        if (existingStudio) {
          updateInput.studio_id = existingStudio.id;
        } else {
          // Create new studio in Stash
        const createStudioMutation = `
          mutation StudioCreate($input: StudioCreateInput!) {
            studioCreate(input: $input) {
              id
              name
            }
          }
        `;

        try {
          const studioData = await syncService.makeGraphQLRequest(createStudioMutation, {
            input: { name: studioName }
          });

          if (studioData && studioData.studioCreate) {
            const newStudio = studioData.studioCreate;
            updateInput.studio_id = newStudio.id;
            
            // Save to local database
            await prisma.stashStudio.upsert({
              where: { id: newStudio.id },
              update: { name: newStudio.name },
              create: { id: newStudio.id, name: newStudio.name }
            });
          }
        } catch (studioError) {
          // Studio might already exist - search for it in local database
          console.warn(`   - ⚠️  Studio creation failed (likely already exists): ${studioError.message}`);
          
          const existingStudio = await prisma.stashStudio.findFirst({
            where: { name: studioName }
          });
          
          if (existingStudio) {
            console.log(`   - ✅ Found existing studio in local database: ${existingStudio.name} (ID: ${existingStudio.id})`);
            updateInput.studio_id = existingStudio.id;
          } else {
            console.warn(`   - ⚠️  Studio not found in local database either, continuing without studio`);
            // Continue without studio
          }
        }
        }
      }
    }

    // Update group in Stash via GraphQL
    const updateMutation = `
      mutation MovieUpdate($input: MovieUpdateInput!) {
        movieUpdate(input: $input) {
          id
          name
          date
          duration
          director
          synopsis
          front_image_path
          back_image_path
          studio {
            id
            name
          }
        }
      }
    `;

    const stashData = await syncService.makeGraphQLRequest(updateMutation, {
      input: updateInput
    });

    if (!stashData || !stashData.movieUpdate) {
      console.error('❌ Failed to update group in Stash. Response:', stashData);
      return sendServerError(res, 'Failed to update group in Stash');
    }

    const updatedMovie = stashData.movieUpdate;

    // Update local database
    const dbUpdateData = {};
    if (name) dbUpdateData.name = name;
    if (date) dbUpdateData.date = date;
    if (duration) dbUpdateData.duration = parseInt(duration, 10);
    if (director) dbUpdateData.director = director;
    if (synopsis) dbUpdateData.synopsis = synopsis;
    if (front_image) dbUpdateData.frontImage = front_image;
    if (back_image) dbUpdateData.backImage = back_image;
    if (geviUrl) dbUpdateData.geviUrl = geviUrl;
    if (updatedMovie.studio) dbUpdateData.studioId = updatedMovie.studio.id;

    const updatedGroup = await prisma.stashGroup.update({
      where: { id },
      data: dbUpdateData,
      include: {
        studio: true
      }
    });

    console.log('✅ Group updated successfully:', updatedGroup.name);

    sendSuccess(res, {
      group: updatedGroup,
      stashMovie: updatedMovie
    });

  } catch (error) {
    console.error('❌ Error updating group:', error);
    return sendServerError(res, error.message || 'Failed to update group');
  }
}));

// DELETE /api/stash/groups/:id - Delete group from both Stash and local database
router.delete('/groups/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🗑️  [Delete Group] Starting deletion for group:', id);

  // Initialize sync service if needed
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  // Get sync service
  const syncService = getActiveSyncService();
  
  if (!syncService) {
    console.error('   - Sync service not initialized');
    return sendServerError(res, 'Stash sync service not initialized');
  }

  // Ensure Stash URL is configured
  try {
    await syncService.ensureConfigLoaded();
  } catch (error) {
    console.error('   - Stash not configured:', error.message);
    return sendServerError(res, 'Stash server not configured. Please configure in Settings.');
  }

  // Get the group from database to verify it exists
  const group = await prisma.stashGroup.findUnique({
    where: { id },
    include: {
      scenes: true
    }
  });

  if (!group) {
    return sendBadRequest(res, 'Group not found');
  }

  console.log(`   - Found group: ${group.name}`);
  console.log(`   - Group has ${group.scenes.length} scene(s) linked`);

  try {
    // Delete from Stash first via GraphQL
    const deleteMutation = `
      mutation GroupDestroy($input: GroupDestroyInput!) {
        groupDestroy(input: $input)
      }
    `;

    const variables = {
      input: {
        id: id
      }
    };

    console.log(`   - Deleting group from Stash...`);
    console.log(`   - GraphQL Variables:`, JSON.stringify(variables, null, 2));
    
    let stashResult;
    try {
      stashResult = await syncService.makeGraphQLRequest(deleteMutation, variables);
      console.log(`   - GraphQL Response:`, JSON.stringify(stashResult, null, 2));
    } catch (graphqlError) {
      console.error(`   - ❌ GraphQL Error:`, graphqlError);
      // If group doesn't exist in Stash, continue with local deletion
      if (graphqlError.message && graphqlError.message.includes('not found')) {
        console.warn(`   - ⚠️  Group not found in Stash (may have been deleted manually), continuing with local deletion...`);
        stashResult = { groupDestroy: true }; // Proceed with local deletion
      } else {
        throw graphqlError; // Re-throw other errors
      }
    }
    
    if (!stashResult || stashResult.groupDestroy === false) {
      console.error(`   - ⚠️  Failed to delete from Stash:`, stashResult);
      return sendServerError(res, 'Failed to delete group from Stash');
    }

    console.log(`   - ✅ Deleted group from Stash (or already deleted)`);

    // Delete from local database
    // First delete related records (cascade should handle this, but being explicit)
    await prisma.stashGroupScene.deleteMany({
      where: { groupId: id }
    });

    console.log(`   - Deleted ${group.scenes.length} scene link(s) from local database`);

    // Delete the group itself
    await prisma.stashGroup.delete({
      where: { id }
    });

    console.log(`   - ✅ Deleted group from local database`);

    sendSuccess(res, {
      message: `Group "${group.name}" deleted successfully from both Stash and local database`
    });

  } catch (error) {
    console.error('❌ Error deleting group:', error);
    console.error('   - Error stack:', error.stack);
    return sendServerError(res, error.message || 'Failed to delete group');
  }
}));

// POST /api/stash/scenes/:id/scrape-gevi - Scrape scene metadata from GEVI
router.post('/scenes/:id/scrape-gevi', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;

  console.log('🔍 [GEVI Scrape] Starting scrape for scene:', id);
  console.log('   - URL:', url);

  // Validate URL provided
  if (!url || !url.trim()) {
    return sendBadRequest(res, 'URL is required');
  }

  // Scrape the GEVI page
  const scrapeResult = await geviScraper.scrapeScene(url);

  if (!scrapeResult.success) {
    return sendServerError(res, scrapeResult.error || 'Failed to scrape GEVI');
  }

  const { metadata } = scrapeResult;

  console.log('   - Scraped metadata:', JSON.stringify(metadata, null, 2));

  // Match performers, studio, and movies/groups against database
  let matchedPerformers = { matched: [], unmatched: [] };
  let matchedStudio = null;
  let matchedGroups = { matched: [], unmatched: [] };

  if (metadata.performers && metadata.performers.length > 0) {
    matchedPerformers = await geviScraper.matchPerformers(metadata.performers, prisma);
  }

  if (metadata.studio) {
    matchedStudio = await geviScraper.matchStudio(metadata.studio, prisma);
  }

  if (metadata.movies && metadata.movies.length > 0) {
    matchedGroups = await geviScraper.matchGroups(metadata.movies, prisma);
  }

  console.log('   - Matched performers:', matchedPerformers.matched.length);
  console.log('   - Unmatched performers:', matchedPerformers.unmatched);
  console.log('   - Matched studio:', matchedStudio ? matchedStudio.name : 'none');
  console.log('   - Matched groups:', matchedGroups.matched.length);
  console.log('   - Unmatched groups:', matchedGroups.unmatched);

  // Proxy the image URL if present
  if (metadata.image) {
    const originalImage = metadata.image;
    metadata.image = `/api/stash/gevi-image-proxy?url=${encodeURIComponent(originalImage)}`;
    console.log('   - Proxied image URL:', metadata.image);
  }

  // Return scraped data with matches
  sendSuccess(res, {
    scraped: metadata,
    matched: {
      studio: matchedStudio,
      performers: matchedPerformers.matched,
      groups: matchedGroups.matched
    },
    unmatched: {
      studio: matchedStudio ? null : metadata.studio,
      performers: matchedPerformers.unmatched,
      groups: matchedGroups.unmatched
    },
    source: 'GEVI',
    sourceUrl: url
  });
}));

// POST /api/stash/gevi/movie - Fetch full movie details from GEVI URL
router.post('/gevi/movie', asyncHandler(async (req, res) => {
  const { url, groupId } = req.body;

  console.log('🎬 [GEVI Movie] Fetching movie details from:', url);

  // Validate URL provided
  if (!url || !url.trim()) {
    return sendBadRequest(res, 'URL is required');
  }

  // Fetch movie details
  const movie = await geviScraper.movieFromUrl(url);

  if (!movie) {
    return sendServerError(res, 'Failed to fetch movie details from GEVI');
  }

  console.log('   - Movie details fetched:', movie.name);

  // If groupId is provided, try to match scenes
  let matchedScenes = [];
  console.log(`   - groupId provided: ${groupId}`);
  console.log(`   - movie.scenes length: ${movie.scenes?.length}`);
  
  if (groupId && movie.scenes && movie.scenes.length > 0) {
    console.log(`   - Attempting to match scenes for group ${groupId}`);
    
    // Fetch scenes associated with this group
    const groupScenes = await prisma.stashGroupScene.findMany({
      where: { groupId },
      include: {
        scene: {
          include: {
            performers: {
              include: {
                performer: true
              }
            }
          }
        }
      }
    });

    console.log(`   - Found ${groupScenes.length} scenes in database for this group`);

    if (groupScenes.length > 0) {
      const dbScenes = groupScenes.map(gs => gs.scene);
      matchedScenes = await geviScraper.matchMovieScenes(movie.scenes, dbScenes);
      console.log(`   - Matched ${matchedScenes.length} scenes`);
      console.log(`   - Matched scenes details:`, JSON.stringify(matchedScenes, null, 2));
      
      // Update matched scenes with GEVI details if they don't have any
      for (const match of matchedScenes) {
        console.log(`\n   🔄 Processing matched scene ${match.sceneId}`);
        console.log(`      - Match scene number: ${match.sceneNumber}`);
        const dbScene = dbScenes.find(s => s.id === match.sceneId);
        if (dbScene) {
          console.log(`      - Found DB scene: ${dbScene.title || dbScene.id}`);
          console.log(`      - Current details: "${dbScene.details?.substring(0, 50)}..."`);
          console.log(`      - Current geviUrl: "${dbScene.geviUrl}"`);
          console.log(`      - Match details: "${match.details?.substring(0, 50)}..."`);
          console.log(`      - Match episodeUrl: "${match.episodeUrl}"`);
          
          const localUpdates = {};
          const stashUpdates = {};
          let needsUpdate = false;
          
          // Update details if empty
          if (!dbScene.details || dbScene.details.trim() === '') {
            localUpdates.details = match.details || '';
            stashUpdates.details = match.details || '';
            needsUpdate = true;
            console.log(`      ✓ Will update details`);
          } else {
            console.log(`      ✗ Skipping details (already has: "${dbScene.details.substring(0, 30)}...")`);
          }
          
          // Update GEVI URL if empty
          if ((!dbScene.geviUrl || dbScene.geviUrl.trim() === '') && match.episodeUrl) {
            localUpdates.geviUrl = match.episodeUrl;
            // Add GEVI URL to scene URLs in Stash
            stashUpdates.urls = dbScene.url ? [dbScene.url, match.episodeUrl] : [match.episodeUrl];
            needsUpdate = true;
            console.log(`      ✓ Will update GEVI URL: ${match.episodeUrl}`);
          } else {
            console.log(`      ✗ Skipping GEVI URL (already has: "${dbScene.geviUrl}")`);
          }
          
          console.log(`      - needsUpdate: ${needsUpdate}`);
          
          // Perform update if needed
          if (needsUpdate) {
            try {
              // Update local database
              await prisma.stashScene.update({
                where: { id: match.sceneId },
                data: localUpdates
              });
              console.log(`   - ✅ Updated local database for scene ${match.sceneId}`);
              
              // Update Stash via GraphQL
              const mutation = `
                mutation SceneUpdate($input: SceneUpdateInput!) {
                  sceneUpdate(input: $input) {
                    id
                    details
                    urls
                  }
                }
              `;
              
              const variables = {
                input: {
                  id: match.sceneId,
                  ...stashUpdates
                }
              };
              
              console.log(`   - Sending GraphQL mutation for scene ${match.sceneId}:`, JSON.stringify(variables, null, 2));
              
              const result = await syncService.makeGraphQLRequest(mutation, variables);
              
              if (!result || !result.data || !result.data.sceneUpdate) {
                console.error(`   - ❌ Invalid response from Stash:`, result);
                throw new Error('Invalid response from Stash');
              }
              
              console.log(`   - ✅ Updated Stash for scene ${match.sceneId}:`, result.data.sceneUpdate);
              
            } catch (error) {
              console.error(`   - ❌ Failed to update scene ${match.sceneId}:`, error.message);
              if (error.response) {
                console.error(`   - GraphQL errors:`, error.response.errors);
              }
            }
          }
          
          // Update scene index (scene number) in the group-scene pivot table
          // Always update even if one exists, as it may be wrong
          console.log(`      - Checking scene index update: sceneNumber=${match.sceneNumber}, groupId=${groupId}`);
          if (match.sceneNumber !== undefined && match.sceneNumber !== null && groupId) {
            try {
              console.log(`      - Attempting to update scene index to ${match.sceneNumber} for scene ${match.sceneId} in group ${groupId}`);
              await prisma.stashGroupScene.update({
                where: {
                  groupId_sceneId: {
                    groupId: groupId,
                    sceneId: match.sceneId
                  }
                },
                data: {
                  sceneIndex: match.sceneNumber
                }
              });
              console.log(`      ✅ Updated scene index to ${match.sceneNumber} for scene ${match.sceneId}`);
            } catch (error) {
              console.error(`      ⚠️  Failed to update scene index:`, error.message);
              console.error(`      - Error details:`, error);
            }
          } else {
            console.log(`      ⚠️  Skipping scene index update - sceneNumber: ${match.sceneNumber}, groupId: ${groupId}`);
          }
          
          // NOTE: Action code application has been moved to the acceptance workflow
          // Action codes are now applied via POST /api/stash/groups/:id/apply-matched-scenes
          // This ensures users can review scrape results before applying changes
          
          /* COMMENTED OUT: Auto-apply action codes during scrape
          // Update performer action codes if performers data is available
          if (match.performers && Array.isArray(match.performers) && match.performers.length > 0) {
            console.log(`\n   🎭 Updating action codes for ${match.performers.length} performers`);
            
            // Build array of performers with IDs and action codes
            const performersWithCodes = [];
            
            for (const geviPerformer of match.performers) {
              // Handle both object and string formats
              const performerName = typeof geviPerformer === 'string' ? geviPerformer : geviPerformer.name;
              const actionCode = typeof geviPerformer === 'object' ? geviPerformer.actionCode : null;
              
              if (!actionCode) {
                console.log(`      ⚠️  No action code for performer: ${performerName}`);
                continue;
              }
              
              console.log(`      - Performer: ${performerName}, Action Code: ${actionCode}`);
              
              // Find matching performer in database scene
              const dbPerformer = dbScene.performers.find(sp => 
                sp.performer.name.toLowerCase() === performerName.toLowerCase() ||
                sp.performer.name.toLowerCase().includes(performerName.toLowerCase()) ||
                performerName.toLowerCase().includes(sp.performer.name.toLowerCase())
              );
              
              if (dbPerformer) {
                performersWithCodes.push({
                  id: dbPerformer.performerId,
                  name: dbPerformer.performer.name,
                  actionCode: actionCode
                });
              } else {
                console.log(`      ⚠️  Could not find matching DB performer for: ${performerName}`);
              }
            }
            
            // Apply action code tags using the service
            if (performersWithCodes.length > 0) {
              try {
                const tagResult = await actionCodeService.applyActionCodeTagsForPerformers(
                  match.sceneId,
                  performersWithCodes,
                  prisma
                );
                
                console.log(`      ✅ Applied ${tagResult.totalApplied} tags from ${performersWithCodes.length} action codes`);
                
                if (tagResult.missingTags && tagResult.missingTags.length > 0) {
                  console.warn(`      ⚠️  Warning: ${tagResult.missingTags.length} tags not found in database`);
                }
                
                // Log details for each performer
                for (const result of tagResult.performerResults) {
                  if (result.appliedTags.length > 0) {
                    console.log(`      ✅ ${result.performerName}: ${result.appliedTags.join(', ')}`);
                  }
                  if (result.missingTags.length > 0) {
                    console.log(`      ⚠️  ${result.performerName}: Missing tags - ${result.missingTags.join(', ')}`);
                  }
                }
              } catch (error) {
                console.error(`      ❌ Failed to apply action code tags:`, error.message);
              }
            }
          }
          */
        }
      }
    } else {
      console.log(`   - No scenes found in database for group ${groupId}`);
    }
  } else {
    console.log(`   - Scene matching skipped (groupId: ${groupId}, movie.scenes: ${movie.scenes?.length})`);
  }

  // Extract and match compilations from MATCHED scenes only
  let matchedCompilations = { matched: [], unmatched: [] };
  if (matchedScenes && matchedScenes.length > 0 && movie.scenes && movie.scenes.length > 0) {
    const allCompilations = [];
    
    // Collect all compilations from matched scenes (including duplicates by URL for different scenes)
    for (const matchedScene of matchedScenes) {
      // Find the corresponding movie scene by scene number
      const movieScene = movie.scenes.find(s => s.sceneNumber === matchedScene.sceneNumber);
      
      if (movieScene && movieScene.compilations && movieScene.compilations.length > 0) {
        console.log(`   - Scene ${matchedScene.sceneNumber} has ${movieScene.compilations.length} compilations`);
        for (const comp of movieScene.compilations) {
          // Add ALL compilations with scene tracking (don't dedupe yet)
          allCompilations.push({
            ...comp,
            sceneNumber: matchedScene.sceneNumber,
            sceneId: matchedScene.sceneId
          });
        }
      }
    }
    
    console.log(`   - Found ${allCompilations.length} total compilations from ${matchedScenes.length} matched scenes`);
    
    // Match compilations against database movies
    if (allCompilations.length > 0) {
      matchedCompilations = await geviScraper.matchCompilations(allCompilations, prisma);
      console.log(`   - Matched ${matchedCompilations.matched.length} compilations`);
      console.log(`   - Unmatched ${matchedCompilations.unmatched.length} compilations`);
    }
  }

  // Return movie data
  const responseData = {
    movie,
    matchedScenes,
    compilations: matchedCompilations,
    source: 'GEVI',
    sourceUrl: url
  };
  
  console.log(`   - Sending response with matchedScenes length: ${matchedScenes.length}`);
  console.log(`   - Sending response with compilations: ${matchedCompilations.matched.length} matched, ${matchedCompilations.unmatched.length} unmatched`);
  
  sendSuccess(res, responseData);
}));

// POST /api/stash/compilations/create - Create a new compilation movie from GEVI and link to scene
router.post('/compilations/create', asyncHandler(async (req, res) => {
  const { geviUrl, sceneId, name } = req.body;

  console.log('🎬 [Create Compilation] Creating new compilation from GEVI');
  console.log(`   - GEVI URL: ${geviUrl}`);
  console.log(`   - Scene ID: ${sceneId}`);
  console.log(`   - Name (from scene): ${name}`);

  // Validate inputs
  if (!geviUrl || !name) {
    console.log('   - ❌ Validation failed: Missing geviUrl or name');
    return sendBadRequest(res, 'GEVI URL and name are required');
  }

  try {
    console.log('   - ✅ Validation passed, entering try block');
    
    // Initialize sync service if needed
    await initializeStashSyncService();
    console.log('   - 🔄 Sync service initialized');
    
    // Get active sync service
    const activeSyncService = getActiveSyncService();
    console.log('   - Got sync service:', activeSyncService ? 'Available' : 'NULL');
    
    if (!activeSyncService) {
      console.log('   - ❌ Sync service not available');
      return sendServerError(res, 'Stash sync service is not available. Please check your Stash connection settings.');
    }

    // Extract alias from the original name (text in parentheses)
    // Example: "Hard Luck (ChocolateCream)" -> alias = "ChocolateCream"
    let aliasFromOriginalName = null;
    const aliasMatch = name.match(/\(([^)]+)\)$/);
    if (aliasMatch) {
      aliasFromOriginalName = aliasMatch[1].trim();
      console.log(`   - Extracted alias from original name: ${aliasFromOriginalName}`);
    }

    // Scrape the compilation movie from GEVI
    console.log('   - 🌐 Starting GEVI scrape...');
    const movie = await geviScraper.movieFromUrl(geviUrl);
    console.log('   - 🌐 GEVI scrape completed');
    
    if (!movie) {
      console.log('   - ❌ No movie data returned from GEVI');
      return sendServerError(res, 'Failed to scrape movie from GEVI');
    }

    console.log(`   - Scraped movie name: ${movie.name}`);

    // Get or create studio first (if studio exists)
    let studioId = null;
    if (movie.studio) {
      try {
        studioId = await getOrCreateStudio(movie.studio, activeSyncService);
        console.log(`   - Studio ID: ${studioId}`);
      } catch (studioError) {
        console.error(`   - ⚠️  Failed to get/create studio:`, studioError);
        // Continue without studio
      }
    }

    // Create group in Stash via GraphQL
    const createMutation = `
      mutation GroupCreate($input: GroupCreateInput!) {
        groupCreate(input: $input) {
          id
          name
          aliases
          date
          duration
          director
          synopsis
          urls
        }
      }
    `;

    // Build aliases string
    // If we have an alias from the original name, use the full original name as alias
    // This preserves the full title like "Hard Luck (ChocolateCream)"
    let aliasesString = null;
    if (aliasFromOriginalName) {
      aliasesString = name; // Store the full original name with parentheses as alias
      console.log(`   - Setting aliases: ${aliasesString}`);
    }

    const createVariables = {
      input: {
        name: movie.name || name,
        aliases: aliasesString,
        date: movie.date || null,
        duration: movie.duration || null,
        director: movie.director || null,
        synopsis: movie.synopsis || null,
        studio_id: studioId,
        urls: [geviUrl]
      }
    };

    console.log(`   - Creating group in Stash with variables:`, JSON.stringify(createVariables, null, 2));
    
    const createResult = await activeSyncService.makeGraphQLRequest(createMutation, createVariables);
    
    // makeGraphQLRequest returns the data directly (already unwrapped)
    if (!createResult || !createResult.groupCreate) {
      console.error(`   - ❌ Invalid response from Stash:`, JSON.stringify(createResult, null, 2));
      throw new Error('Failed to create group in Stash - invalid response');
    }

    const stashGroup = createResult.groupCreate;
    console.log(`   - ✅ Created group in Stash with ID: ${stashGroup.id}`);
    if (stashGroup.aliases) {
      console.log(`   - ✅ Aliases saved to Stash: ${stashGroup.aliases}`);
    }

    // Get Stash URL for constructing group URL
    const stashUrl = await getStashUrl();
    console.log(`   - Stash URL: ${stashUrl}`);

    // Create group in local database
    console.log(`   - Creating group in local database...`);
    const localGroup = await prisma.stashGroup.create({
      data: {
        id: stashGroup.id,
        name: stashGroup.name || name,
        aliases: stashGroup.aliases || aliasesString || null,
        date: stashGroup.date || null,
        duration: stashGroup.duration || null,
        director: stashGroup.director || null,
        synopsis: stashGroup.synopsis || null,
        studioId: studioId,
        geviUrl: geviUrl,
        url: `${stashUrl}/movies/${stashGroup.id}`
      }
    });

    console.log(`   - ✅ Created group in local database with ID: ${localGroup.id}`);
    if (localGroup.aliases) {
      console.log(`   - ✅ Saved aliases: ${localGroup.aliases}`);
    }

    // Link scene to the new compilation if sceneId provided
    if (sceneId) {
      console.log(`   - Scene ID provided: ${sceneId}, linking scene to group...`);
      
      // Verify scene exists first
      const sceneExists = await prisma.stashScene.findUnique({
        where: { id: sceneId }
      });
      
      if (!sceneExists) {
        console.warn(`   - ⚠️  Scene ${sceneId} not found in database, skipping scene linking`);
      } else {
        // Get existing groups for this scene first
        const existingSceneGroups = await prisma.stashGroupScene.findMany({
          where: { sceneId: sceneId },
          select: { groupId: true, sceneIndex: true }
        });

        console.log(`   - Scene has ${existingSceneGroups.length} existing group(s)`);

        // Build groups array with existing groups + new group
        const allGroups = [
          ...existingSceneGroups.map(sg => ({
            group_id: sg.groupId,
            scene_index: sg.sceneIndex
          })),
          {
            group_id: stashGroup.id,
            scene_index: sceneIndex || null  // Use provided scene index or null
          }
        ];

        // Update scene to add this group (scene-centric approach)
        const updateSceneMutation = `
          mutation SceneUpdate($input: SceneUpdateInput!) {
            sceneUpdate(input: $input) {
              id
              groups {
                group {
                  id
                  name
                }
              }
            }
          }
        `;

        const updateSceneVariables = {
          input: {
            id: sceneId,
            groups: allGroups
          }
        };

        console.log(`   - Updating scene ${sceneId} with ${allGroups.length} group(s) in Stash`);

        const updateSceneResult = await activeSyncService.makeGraphQLRequest(updateSceneMutation, updateSceneVariables);

        // makeGraphQLRequest returns the data directly (already unwrapped)
        if (!updateSceneResult || !updateSceneResult.sceneUpdate) {
          console.error(`   - ⚠️  Failed to add scene to group in Stash:`, updateSceneResult);
        } else {
          console.log(`   - ✅ Scene now belongs to ${updateSceneResult.sceneUpdate.groups.length} group(s) in Stash`);
        }

        // Link in local database (check if link already exists)
        const existingLink = await prisma.stashGroupScene.findUnique({
          where: {
            groupId_sceneId: {
              groupId: stashGroup.id,
              sceneId: sceneId
            }
          }
        });

        if (!existingLink) {
          await prisma.stashGroupScene.create({
            data: {
              groupId: stashGroup.id,
              sceneId: sceneId
            }
          });
          console.log(`   - ✅ Linked scene to group in local database`);
        } else {
          console.log(`   - ℹ️  Scene already linked to group in local database`);
        }
      }
    }

    // Return the created group
    sendSuccess(res, {
      group: {
        id: localGroup.id,
        name: localGroup.name,
        stashId: localGroup.id,
        date: localGroup.date,
        duration: localGroup.duration,
        director: localGroup.director,
        synopsis: localGroup.synopsis,
        geviUrl: localGroup.geviUrl,
        url: localGroup.url
      }
    });

  } catch (error) {
    console.error('❌ [Create Compilation] Error caught:');
    console.error('   - Message:', error.message);
    console.error('   - Stack:', error.stack);
    console.error('   - Full error:', error);
    return sendServerError(res, `Failed to create compilation: ${error.message}`);
  }
}));

// Link scene to existing compilation/group
router.post('/compilations/link-scene', asyncHandler(async (req, res) => {
  const { groupId, sceneId } = req.body;

  console.log('🔗 [Link Scene to Compilation] Linking scene to existing group');
  console.log(`   - Group ID: ${groupId}`);
  console.log(`   - Scene ID: ${sceneId}`);

  // Validate inputs
  if (!groupId || !sceneId) {
    console.log('   - ❌ Validation failed: Missing groupId or sceneId');
    return sendBadRequest(res, 'Group ID and Scene ID are required');
  }

  try {
    console.log('   - ✅ Validation passed, entering try block');
    
    // Initialize sync service if needed
    await initializeStashSyncService();
    console.log('   - 🔄 Sync service initialized');
    
    // Get active sync service
    const activeSyncService = getActiveSyncService();
    console.log('   - Got sync service:', activeSyncService ? 'Available' : 'NULL');
    
    if (!activeSyncService) {
      console.log('   - ❌ Sync service not available');
      return sendServerError(res, 'Stash sync service is not available. Please check your Stash connection settings.');
    }

    // Verify group exists in database
    const group = await prisma.stashGroup.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      console.log(`   - ❌ Group ${groupId} not found in database`);
      return sendBadRequest(res, `Group ${groupId} not found`);
    }

    console.log(`   - ✅ Found group: ${group.name}`);

    // Verify scene exists in database
    const scene = await prisma.stashScene.findUnique({
      where: { id: sceneId }
    });

    if (!scene) {
      console.log(`   - ❌ Scene ${sceneId} not found in database`);
      return sendBadRequest(res, `Scene ${sceneId} not found`);
    }

    console.log(`   - ✅ Found scene: ${scene.title}`);

    // Check if link already exists
    const existingLink = await prisma.stashGroupScene.findFirst({
      where: {
        groupId: groupId,
        sceneId: sceneId
      }
    });

    if (existingLink) {
      console.log(`   - ⚠️  Scene ${sceneId} is already linked to group ${groupId}`);
      return sendSuccess(res, {
        message: 'Scene is already linked to this group',
        alreadyLinked: true
      });
    }

    // Link scene to group in Stash via GraphQL
    // We need to update the SCENE, not the group, because scenes belong to groups
    const updateSceneMutation = `
      mutation SceneUpdate($input: SceneUpdateInput!) {
        sceneUpdate(input: $input) {
          id
          groups {
            group {
              id
              name
            }
            scene_index
          }
        }
      }
    `;

    // Get all existing groups for this scene
    const existingSceneGroups = await prisma.stashGroupScene.findMany({
      where: { sceneId: sceneId },
      select: { groupId: true, sceneIndex: true }
    });

    // Add the new group to the list
    const allGroups = [
      ...existingSceneGroups.map(sg => ({
        group_id: sg.groupId,
        scene_index: sg.sceneIndex
      })),
      {
        group_id: groupId,
        scene_index: null  // No specific index for now
      }
    ];

    console.log(`   - Existing groups for scene: ${existingSceneGroups.length}`);
    console.log(`   - Total groups after adding: ${allGroups.length}`);

    const updateSceneVariables = {
      input: {
        id: sceneId,
        groups: allGroups
      }
    };

    console.log(`   - Linking scene ${sceneId} to group ${groupId} in Stash`);

    const updateSceneResult = await activeSyncService.makeGraphQLRequest(updateSceneMutation, updateSceneVariables);

    // makeGraphQLRequest returns the data directly (already unwrapped)
    if (!updateSceneResult || !updateSceneResult.sceneUpdate) {
      console.error(`   - ⚠️  Failed to link scene to group in Stash:`, updateSceneResult);
      return sendServerError(res, 'Failed to link scene to group in Stash');
    }

    console.log(`   - ✅ Linked scene to group in Stash`);
    console.log(`   - Scene now belongs to ${updateSceneResult.sceneUpdate.groups.length} group(s)`);

    // Create link in local database
    await prisma.stashGroupScene.create({
      data: {
        groupId: groupId,
        sceneId: sceneId
      }
    });

    console.log(`   - ✅ Linked scene to group in local database`);

    // Return success
    sendSuccess(res, {
      message: `Successfully linked scene ${scene.title} to group ${group.name}`,
      group: {
        id: group.id,
        name: group.name
      },
      scene: {
        id: scene.id,
        title: scene.title
      }
    });

  } catch (error) {
    console.error('❌ [Link Scene to Compilation] Error caught:');
    console.error('   - Message:', error.message);
    console.error('   - Stack:', error.stack);
    console.error('   - Full error:', error);
    return sendServerError(res, `Failed to link scene to compilation: ${error.message}`);
  }
}));

// Helper function to get or create studio
async function getOrCreateStudio(studioName, syncService) {
  if (typeof studioName !== 'string') {
    studioName = studioName.name || studioName;
  }

  // Search for existing studio
  const existing = await prisma.stashStudio.findFirst({
    where: {
      name: studioName
    }
  });

  if (existing) {
    return existing.id;
  }

  // Create in Stash
  const createMutation = `
    mutation StudioCreate($input: StudioCreateInput!) {
      studioCreate(input: $input) {
        id
        name
      }
    }
  `;

  const createVariables = {
    input: {
      name: studioName
    }
  };

  try {
    const result = await syncService.makeGraphQLRequest(createMutation, createVariables);

    // makeGraphQLRequest returns the data directly (already unwrapped)
    if (!result || !result.studioCreate) {
      throw new Error('Failed to create studio in Stash');
    }

    // Create in local database
    const studio = await prisma.stashStudio.create({
      data: {
        id: result.studioCreate.id,
        name: studioName,
        url: `${await getStashUrl()}/studios/${result.studioCreate.id}`
      }
    });

    return studio.id;
  } catch (error) {
    // If studio already exists in Stash, search for it by name
    if (error.message && error.message.includes('already exists')) {
      console.log(`   - Studio "${studioName}" already exists in Stash, searching for it...`);
      
      // Search for the studio in local database again (might have been created by another process)
      const existing = await prisma.stashStudio.findFirst({
        where: {
          name: studioName
        }
      });
      
      if (existing) {
        return existing.id;
      }
      
      // If not in local DB, we need to fetch it from Stash
      // For now, just return null and continue without studio
      console.warn(`   - Studio "${studioName}" exists in Stash but not in local database`);
      return null;
    }
    
    // Re-throw other errors
    throw error;
  }
}

// Helper function to get Stash URL
async function getStashUrl() {
  const settings = await prisma.settings.findMany();
  const stashUrl = settings.find(s => s.key === 'stashUrl')?.value;
  return stashUrl || 'http://localhost:9999';
}

// POST /api/stash/scenes/:id/search-gevi - Search GEVI using scene performers
router.post('/scenes/:id/search-gevi', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🔍 [GEVI Search] Starting search for scene:', id);

  // Get the scene with performers
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }

  if (!scene.performers || scene.performers.length < 2) {
    return sendBadRequest(res, 'Scene must have at least 2 performers to search GEVI');
  }

  const allPerformers = scene.performers.map(sp => sp.performer);
  
  // Choose performer without punctuation for better GEVI search results
  const hasPunctuation = (name) => /['".,;:!?\-()[\]{}]/.test(name);
  const firstPerformer = allPerformers.find(p => !hasPunctuation(p.name)) || allPerformers[0];

  console.log(`   - Scene has ${allPerformers.length} performers:`, allPerformers.map(p => p.name).join(', '));
  console.log('   - Primary search performer:', firstPerformer.name);

  // Search GEVI for the first performer
  const firstPerformerResults = await geviScraper.searchPerformer(firstPerformer.name);

  if (!firstPerformerResults || firstPerformerResults.length === 0) {
    return sendServerError(res, `No results found for performer: ${firstPerformer.name}`);
  }

  console.log(`   - Found ${firstPerformerResults.length} matches for first performer`);

  // Try each matching performer until we find one with episodes
  let performerPage = null;
  let scenesByUrl = new Map(); // Map of scene URL to {title, url, matchedPerformers[]}
  
  // Get a test performer (first one that isn't the primary search performer)
  const testPerformer = allPerformers.find(p => p.id !== firstPerformer.id);
  
  for (let matchIndex = 0; matchIndex < firstPerformerResults.length; matchIndex++) {
    const candidatePerformer = firstPerformerResults[matchIndex];
    console.log(`   - Trying match ${matchIndex + 1}/${firstPerformerResults.length}: ${candidatePerformer.name} (${candidatePerformer.url})`);
    
    // Test this performer by searching for another performer
    // Use a quick test with the test performer to see if this page has episodes
    console.log(`   - Testing with performer: ${testPerformer.name}`);
    
    const testScenes = await geviScraper.searchScenesWithPerformers(candidatePerformer.url, testPerformer);
    
    if (testScenes.length > 0) {
      console.log(`   - ✅ Found ${testScenes.length} episodes on this performer page`);
      performerPage = candidatePerformer;
      
      // Add test results to our collection
      for (const scene of testScenes) {
        scenesByUrl.set(scene.url, {
          ...scene,
          matchedPerformers: [testPerformer.name]
        });
      }
      
      break; // Found a working performer page, stop searching
    } else {
      console.log(`   - ⚠️  No episodes found on this performer page, trying next match...`);
    }
  }

  if (!performerPage) {
    return sendServerError(res, `No performer pages with episodes found for: ${firstPerformer.name}`);
  }

  console.log(`   - Using performer: ${performerPage.name} (${performerPage.url})`);
  
  // Filter out the performers we've already searched
  const remainingPerformers = allPerformers.filter(p => 
    p.id !== firstPerformer.id && p.id !== testPerformer.id
  );
  
  console.log(`   - Searching for ${remainingPerformers.length} remaining performers in episodes...`);
  console.log(`   - (Already searched: ${firstPerformer.name}, ${testPerformer.name})`);

  // Search for remaining performers
  for (let i = 0; i < remainingPerformers.length; i++) {
    const performer = remainingPerformers[i];
    console.log(`   - [${i + 1}/${remainingPerformers.length}] Searching for: ${performer.name}`);

    // Search for scenes with this performer on the performer's page
    // Pass the performer object (not just the name string)
    const performerScenes = await geviScraper.searchScenesWithPerformers(performerPage.url, performer);

    console.log(`   - Found ${performerScenes.length} scenes with ${performer.name}`);

    // Add to our collection, tracking which performers matched
    for (const scene of performerScenes) {
      if (scenesByUrl.has(scene.url)) {
        // Scene already found, add this performer to the match list
        const existing = scenesByUrl.get(scene.url);
        existing.matchedPerformers.push(performer.name);
      } else {
        // New scene, start tracking
        scenesByUrl.set(scene.url, {
          ...scene,
          matchedPerformers: [performer.name]
        });
      }
    }
  }

  // Convert map to array and sort by number of matched performers (descending)
  let scenes = Array.from(scenesByUrl.values()).sort((a, b) => {
    return b.matchedPerformers.length - a.matchedPerformers.length;
  });

  console.log(`   - Total unique scenes found: ${scenes.length}`);
  console.log(`   - Match distribution:`);
  
  // Log distribution of matches
  const matchCounts = {};
  scenes.forEach(scene => {
    const count = scene.matchedPerformers.length;
    matchCounts[count] = (matchCounts[count] || 0) + 1;
  });
  
  Object.keys(matchCounts).sort((a, b) => b - a).forEach(count => {
    console.log(`   - ${matchCounts[count]} scene(s) with ${count} matching performer(s)`);
  });

  // Proxy image URLs for any scenes that have images
  const scenesWithProxiedImages = scenes.map(scene => {
    if (scene.image) {
      return {
        ...scene,
        image: `/api/stash/gevi-image-proxy?url=${encodeURIComponent(scene.image)}`
      };
    }
    return scene;
  });

  sendSuccess(res, {
    firstPerformer: {
      ...performerPage,
      name: firstPerformer.name
    },
    searchedPerformers: allPerformers.slice(1).map(p => p.name),
    scenes: scenesWithProxiedImages,
    totalScenes: scenes.length,
    performersSearched: allPerformers.length - 1
  });
}));

// POST /api/stash/scenes/:id/search-gevi-by-title - Search GEVI using studio URL and scene title
router.post('/scenes/:id/search-gevi-by-title', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🔍 [GEVI Title Search] Starting search for scene:', id);

  // Get the scene with studio
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      studioObject: true
    }
  });

  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }

  if (!scene.title) {
    return sendBadRequest(res, 'Scene must have a title to search GEVI');
  }

  if (!scene.studioObject) {
    return sendBadRequest(res, 'Scene must have a studio to search GEVI by title');
  }

  if (!scene.studioObject.geviUrl) {
    return sendBadRequest(res, 'Studio must have a GEVI URL set to search by title');
  }

  console.log('   - Studio:', scene.studioObject.name);
  console.log('   - Studio GEVI URL:', scene.studioObject.geviUrl);
  console.log('   - Scene Title:', scene.title);

  // Search for scenes on the studio's GEVI page by title
  const sceneResults = await geviScraper.searchScenesByTitleOnStudio(scene.studioObject.geviUrl, scene.title);

  if (!sceneResults || sceneResults.length === 0) {
    return sendServerError(res, `No results found for title "${scene.title}" on studio page`);
  }

  console.log(`   - Found ${sceneResults.length} matching scenes on studio page`);

  // Proxy the image URLs through our server to handle CORS
  const scenesWithProxiedImages = sceneResults.map(scene => {
    if (scene.image) {
      return {
        ...scene,
        image: `/api/stash/gevi-image-proxy?url=${encodeURIComponent(scene.image)}`
      };
    }
    return scene;
  });

  sendSuccess(res, {
    studio: {
      name: scene.studioObject.name,
      geviUrl: scene.studioObject.geviUrl
    },
    searchTitle: scene.title,
    scenes: scenesWithProxiedImages
  });
}));

// POST /api/stash/scenes/:id/search-gevi-movies - Open GEVI performer page for movie search
router.post('/scenes/:id/search-gevi-movies', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🎬 [GEVI Movie Search] Starting movie search for scene:', id);

  // Get the scene with performers
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }

  if (!scene.performers || scene.performers.length < 2) {
    return sendBadRequest(res, 'Scene must have at least 2 performers to search GEVI movies');
  }

  const allPerformers = scene.performers.map(sp => sp.performer);
  
  // Choose performer without punctuation for better GEVI search results
  const hasPunctuation = (name) => /['".,;:!?\-()[\]{}]/.test(name);
  const firstPerformer = allPerformers.find(p => !hasPunctuation(p.name)) || allPerformers[0];

  console.log(`   - Scene has ${allPerformers.length} performers:`, allPerformers.map(p => p.name).join(', '));
  console.log('   - Primary search performer:', firstPerformer.name);

  // Search GEVI for the first performer
  const firstPerformerResults = await geviScraper.searchPerformer(firstPerformer.name);

  if (!firstPerformerResults || firstPerformerResults.length === 0) {
    return sendServerError(res, `No results found for performer: ${firstPerformer.name}`);
  }

  console.log(`✅ Found ${firstPerformerResults.length} performers matching "${firstPerformer.name}"`);
  console.log(`   - Found ${firstPerformerResults.length} matches for first performer`);

  // We'll aggregate results from all performer matches
  const allMoviesMap = new Map(); // Map of movie URL to {title, url, matchedPerformers[], foundVia}

  // Try searching with each performer match
  for (let matchIdx = 0; matchIdx < firstPerformerResults.length; matchIdx++) {
    const performerPage = firstPerformerResults[matchIdx];
    console.log(`\n   - [Match ${matchIdx + 1}/${firstPerformerResults.length}] Using performer: ${performerPage.name} (${performerPage.url})`);

    let browser = null;
    try {
      // Launch Puppeteer browser
      const puppeteer = require('puppeteer');
      
      browser = await puppeteer.launch({
        headless: true,  // Run in headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      console.log(`   - Loading GEVI homepage...`);
      await page.goto('https://gayeroticvideoindex.com', { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`   - Looking for Enter button...`);
      
      // Wait for and click the Enter button
      try {
        // Try multiple possible selectors for the Enter button
        const enterButtonClicked = await page.evaluate(() => {
          // Look for various possible selectors
          const selectors = [
            'button:contains("Enter")',
            'a:contains("Enter")',
            'input[type="submit"][value*="Enter"]',
            'button[type="submit"]',
            '.enter-button',
            '#enter-button',
            '[onclick*="enter"]'
          ];

          // Try text-based search first (most reliable)
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
          const enterButton = buttons.find(el => 
            el.textContent.trim().toLowerCase() === 'enter' ||
            el.value?.toLowerCase() === 'enter'
          );

          if (enterButton) {
            enterButton.click();
            return true;
          }

          // Fallback to selector search
          for (const selector of selectors) {
            try {
              const element = document.querySelector(selector);
              if (element) {
                element.click();
                return true;
              }
            } catch (e) {}
          }

          return false;
        });

        if (enterButtonClicked) {
          console.log(`   - ✅ Clicked Enter button`);
          // Wait for any navigation/modal close
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          console.log(`   - ℹ️  No Enter button found, proceeding...`);
        }
      } catch (error) {
        console.log(`   - ℹ️  Enter button not required or already dismissed:`, error.message);
      }

      console.log(`   - Navigating to performer page...`);
      await page.goto(performerPage.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`   - Page loaded, looking for Movies tab...`);
      
      // Wait for the page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click on the Movies tab/button
      // The Movies tab is a button with sectionid="movies"
      // Click on the Movies tab/button
      // The Movies tab is a button with sectionid="movies"
      const moviesTabClicked = await page.evaluate(() => {
        // Look for various possible selectors
        const selectors = [
          'button[sectionid="movies"]',           // Primary: button with sectionid
          'button[data-sectionid="movies"]',      // Alternate data attribute
          '[sectionid="movies"]',                 // Any element with sectionid
          'a[href="#movies"]',                    // Fallback: link
          'a[href="#moviesDT"]',                  // Fallback: DataTable link
          'button:contains("Movies")'             // Fallback: text search
        ];

        for (const selector of selectors) {
          try {
            // Try direct selector
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              console.log('Clicked Movies tab using selector:', selector);
              return true;
            }
          } catch (e) {}
        }

        // Final fallback: find by text content
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const moviesButton = buttons.find(el => 
          el.textContent.trim().toLowerCase() === 'movies' ||
          el.getAttribute('sectionid') === 'movies'
        );

        if (moviesButton) {
          moviesButton.click();
          console.log('Clicked Movies tab via text/attribute search');
          return true;
        }

        return false;
      });

      if (moviesTabClicked) {
        console.log(`   - ✅ Clicked Movies tab`);
      } else {
        console.log(`   - ⚠️  Could not find Movies tab, page may already be showing movies`);
      }

      // Wait for the movies table and search box to appear
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Filter out the first performer since we're already on their page
      const otherPerformers = allPerformers.filter(p => p.id !== firstPerformer.id);
      
      console.log(`   - Searching for ${otherPerformers.length} other performers in movies table...`);
      console.log(`   - (Skipping ${firstPerformer.name} since we're already on their page)`);

      // Search for each other performer
      const moviesByPerformer = new Map(); // Map of movie URL to {title, url, matchedPerformers[]}

      for (let i = 0; i < otherPerformers.length; i++) {
        const performer = otherPerformers[i];
        console.log(`   - [${i + 1}/${otherPerformers.length}] Searching for: ${performer.name}`);

        // Clear the search box
        await page.evaluate(() => {
          const searchBox = document.querySelector('#moviesDT_filter input[type="search"]');
          if (searchBox) {
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Wait for the search input to be available
        await page.waitForSelector('#moviesDT_filter input[type="search"]', { timeout: 10000 });

        // Type the performer's name into the search box
        await page.type('#moviesDT_filter input[type="search"]', performer.name);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for search results to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract movie results for this performer
        const performerMovies = await page.evaluate((performerName) => {
          const results = [];
          const rows = document.querySelectorAll('#moviesDT tbody tr');
          
          rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            
            // Skip empty data rows
            const firstCell = cells[0];
            if (firstCell && firstCell.classList.contains('dataTables_empty')) {
              return;
            }
            
            // Look for the movie link
            let foundLink = null;
            let foundTitle = null;
            
            for (let i = 0; i < cells.length; i++) {
              const link = cells[i].querySelector('a[href*="video/"]');
              if (link) {
                const href = link.getAttribute('href');
                if (href && !href.includes('company/') && !href.includes('performer/')) {
                  foundLink = link;
                  foundTitle = link.textContent.trim();
                  break;
                }
              }
            }
            
            if (foundLink && foundTitle) {
              let url = foundLink.getAttribute('href');
              
              // Make URL absolute if it's relative
              if (url && !url.startsWith('http')) {
                url = 'https://gayeroticvideoindex.com/' + (url.startsWith('/') ? url.substring(1) : url);
              }
              
              if (url) {
                results.push({ title: foundTitle, url });
              }
            }
          });
          
          return results;
        }, performer.name);

        console.log(`     - Found ${performerMovies.length} movie(s) for ${performer.name}`);

        // Add to our map, tracking which performers are in each movie
        performerMovies.forEach(movie => {
          if (!moviesByPerformer.has(movie.url)) {
            moviesByPerformer.set(movie.url, {
              title: movie.title,
              url: movie.url,
              matchedPerformers: [],
              foundVia: performerPage.name // Track which performer match found this
            });
          }
          moviesByPerformer.get(movie.url).matchedPerformers.push(performer.name);
        });
      }

      // Merge results into the main allMoviesMap
      moviesByPerformer.forEach((movieData, url) => {
        if (!allMoviesMap.has(url)) {
          allMoviesMap.set(url, movieData);
        } else {
          // Movie already found via different performer match - merge matched performers
          const existing = allMoviesMap.get(url);
          movieData.matchedPerformers.forEach(p => {
            if (!existing.matchedPerformers.includes(p)) {
              existing.matchedPerformers.push(p);
            }
          });
        }
      });

      console.log(`   - Found ${moviesByPerformer.size} unique movie(s) via ${performerPage.name}`);
      console.log(`✅ Search completed for ${performerPage.name}`);    } catch (error) {
      console.error(`   - ❌ Error searching with ${performerPage.name}:`, error.message);
    } finally {
      // Close the browser
      if (browser) {
        await browser.close();
      }
    }
  } // End of for loop through performer matches

  // Convert map to array and sort by number of matched performers (descending)
  const movies = Array.from(allMoviesMap.values()).sort((a, b) => {
    return b.matchedPerformers.length - a.matchedPerformers.length;
  });

  console.log(`\n📊 FINAL RESULTS: Found ${movies.length} unique movie(s) across all performer matches`);
  
  // Check if movies exist in database by matching on geviUrl or name
  for (const movie of movies) {
    // Try to find existing movie by GEVI URL (most accurate)
    let existingMovie = await prisma.stashGroup.findFirst({
      where: { geviUrl: movie.url }
    });

    // If not found by URL, try fuzzy match on name
    if (!existingMovie) {
      // Remove common suffixes/prefixes for better matching
      const cleanTitle = movie.title
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      
      const allMovies = await prisma.stashGroup.findMany({
        select: { id: true, name: true, geviUrl: true }
      });

      existingMovie = allMovies.find(m => {
        const cleanDbTitle = m.name
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        return cleanDbTitle === cleanTitle;
      });
    }

    if (existingMovie) {
      movie.existingMovieId = existingMovie.id;
      movie.existingMovieName = existingMovie.name;
      console.log(`     ✓ "${movie.title}" matches existing movie: ${existingMovie.name} (ID: ${existingMovie.id})`);
    }
  }

  movies.forEach((movie, idx) => {
    const matchStatus = movie.existingMovieId ? '✓ IN DB' : '✗ NEW';
    console.log(`     ${idx + 1}. [${matchStatus}] "${movie.title}" - ${movie.matchedPerformers.length} performer(s): ${movie.matchedPerformers.join(', ')}`);
  });
  console.log(`✅ Search completed across all performer matches`);

  sendSuccess(res, {
    firstPerformer: {
      name: firstPerformerResults[0].name,
      url: firstPerformerResults[0].url
    },
    secondPerformer: allPerformers.length > 1 ? allPerformers[1].name : null,
    allPerformers: allPerformers.map(p => p.name),
    movies: movies
  });
}));

// POST /api/stash/scenes/:id/search-gevi-movies-by-title - Search studio's GEVI page for movies by title
router.post('/scenes/:id/search-gevi-movies-by-title', asyncHandler(async (req, res) => {
  const { id } = req.params;

  console.log('🎬 [GEVI Movie Search by Title] Starting movie search for scene:', id);

  // Get the scene with studio info
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      studioObject: true
    }
  });

  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }

  if (!scene.studioObject || !scene.studioObject.geviUrl) {
    return sendBadRequest(res, 'Studio must have a GEVI URL set to search by title');
  }

  if (!scene.title) {
    return sendBadRequest(res, 'Scene must have a title to search');
  }

  const studioGeviUrl = scene.studioObject.geviUrl;
  const sceneTitle = scene.title;

  console.log(`   - Studio: ${scene.studioObject.name}`);
  console.log(`   - Studio GEVI URL: ${studioGeviUrl}`);
  console.log(`   - Scene title: ${sceneTitle}`);

  // Strip common scene number patterns from title for movie search
  // Movies typically don't include "Scene X" in their titles
  let searchTitle = sceneTitle
    .replace(/\s*[-–—:]\s*Scene\s+\d+\s*$/i, '')  // Remove "- Scene 2" at end
    .replace(/\s*[-–—:]\s*Part\s+\d+\s*$/i, '')   // Remove "- Part 2" at end
    .replace(/\s*[-–—:]\s*Episode\s+\d+\s*$/i, '') // Remove "- Episode 2" at end
    .replace(/\s*\(\s*Scene\s+\d+\s*\)\s*$/i, '')  // Remove "(Scene 2)" at end
    .replace(/\s*#\d+\s*$/i, '')                    // Remove "#2" at end
    .trim();

  console.log(`   - Search title (scene number stripped): "${searchTitle}"`);

  // Launch Puppeteer browser
  const puppeteer = require('puppeteer');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  console.log(`   - Loading GEVI homepage...`);
  await page.goto('https://gayeroticvideoindex.com', { 
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log(`   - Looking for Enter button...`);
  
  // Wait for and click the Enter button if present
  try {
    const enterButtonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
      const enterButton = buttons.find(el => 
        el.textContent.trim().toLowerCase() === 'enter' ||
        el.value?.toLowerCase() === 'enter'
      );

      if (enterButton) {
        enterButton.click();
        return true;
      }
      return false;
    });

    if (enterButtonClicked) {
      console.log(`   - ✅ Clicked Enter button`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log(`   - ℹ️  No Enter button found, proceeding...`);
    }
  } catch (error) {
    console.log(`   - ℹ️  Enter button handling:`, error.message);
  }

  console.log(`   - Navigating to studio page...`);
  await page.goto(studioGeviUrl, { 
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log(`   - Page loaded, looking for Movies tab...`);
  
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Click on the Movies tab
  const moviesTabClicked = await page.evaluate(() => {
    const selectors = [
      'button[sectionid="movies"]',
      '[sectionid="movies"]',
      'a[href="#movies"]',
      'a[href="#moviesDT"]'
    ];

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          element.click();
          return true;
        }
      } catch (e) {}
    }

    const buttons = Array.from(document.querySelectorAll('button, a'));
    const moviesButton = buttons.find(el => 
      el.textContent.trim().toLowerCase() === 'movies' ||
      el.getAttribute('sectionid') === 'movies'
    );

    if (moviesButton) {
      moviesButton.click();
      return true;
    }

    return false;
  });

  if (moviesTabClicked) {
    console.log(`   - ✅ Clicked Movies tab`);
  } else {
    console.log(`   - ⚠️  Could not find Movies tab`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`   - Searching for title: "${sceneTitle}"`);

  // Clear the search box
  console.log(`   - Clearing search box...`);
  await page.evaluate(() => {
    const searchBox = document.querySelector('#moviesDT_filter input[type="search"]');
    if (searchBox) {
      searchBox.value = '';
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Wait for and type into the search input
  console.log(`   - Waiting for search input...`);
  await page.waitForSelector('#moviesDT_filter input[type="search"]', { timeout: 10000 });
  
  console.log(`   - Typing title into search box: "${sceneTitle}"`);
  await page.type('#moviesDT_filter input[type="search"]', sceneTitle, { delay: 50 });
  
  console.log(`   - Pressing Enter to search...`);
  await page.keyboard.press('Enter');

  console.log(`   - Waiting for search results...`);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Extract movie results
  const movies = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll('#moviesDT tbody tr');
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      
      if (cells[0] && cells[0].classList.contains('dataTables_empty')) {
        return;
      }
      
      if (cells.length >= 2) {
        const titleCell = cells[1];
        const link = titleCell.querySelector('a');
        
        if (link && link.href) {
          const title = link.textContent.trim();
          const url = link.href;
          
          results.push({
            title: title,
            url: url
          });
        }
      }
    });
    
    return results;
  });

  await browser.close();

  console.log(`   - Found ${movies.length} movie(s) matching title`);

  // Check against local database
  const localMovies = await prisma.stashGroup.findMany({
    select: {
      id: true,
      name: true,
      geviUrl: true
    }
  });

  for (const movie of movies) {
    const existingMovie = localMovies.find(m => {
      if (m.geviUrl === movie.url) return true;
      
      const cleanDbTitle = m.name
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const cleanTitle = movie.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleanDbTitle === cleanTitle;
    });

    if (existingMovie) {
      movie.existingMovieId = existingMovie.id;
      movie.existingMovieName = existingMovie.name;
      console.log(`     ✓ "${movie.title}" matches existing movie: ${existingMovie.name} (ID: ${existingMovie.id})`);
    }
  }

  movies.forEach((movie, idx) => {
    const matchStatus = movie.existingMovieId ? '✓ IN DB' : '✗ NEW';
    console.log(`     ${idx + 1}. [${matchStatus}] "${movie.title}"`);
  });

  console.log(`✅ Search completed for studio: ${scene.studioObject.name}`);

  sendSuccess(res, {
    studio: {
      name: scene.studioObject.name,
      url: studioGeviUrl
    },
    searchTitle: sceneTitle,
    movies: movies,
    searchMethod: 'title'
  });
}));

// DELETE /api/stash/scenes/:sceneId/performers/:performerId - Remove performer from scene
router.delete('/scenes/:sceneId/performers/:performerId', asyncHandler(async (req, res) => {
  const { sceneId, performerId } = req.params;

  console.log(`🗑️ [REMOVE PERFORMER] Removing performer ${performerId} from scene ${sceneId}`);

  // Initialize Stash sync service if not already initialized
  if (!stashSyncService && !stashSyncServiceOptimized) {
    await initializeStashSyncService();
  }

  const syncService = stashSyncServiceOptimized || stashSyncService;

  // Get current scene data to determine the updated performer list
  const scene = await prisma.stashScene.findUnique({
    where: { id: sceneId },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }

  // Check if performer is actually in the scene
  const performerInScene = scene.performers.find(p => p.performerId === performerId);
  if (!performerInScene) {
    return sendBadRequest(res, 'Performer not found in scene');
  }

  // Update in Stash first (if configured)
  if (syncService) {
    try {
      await syncService.ensureConfigLoaded();
      console.log('   🔄 Updating in Stash via GraphQL...');
      
      // Get the updated list of performer IDs (excluding the one we're removing)
      const updatedPerformerIds = scene.performers
        .filter(p => p.performerId !== performerId)
        .map(p => p.performerId);

      const mutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            performers {
              id
              name
            }
          }
        }
      `;
      
      const variables = {
        input: {
          id: sceneId,
          performer_ids: updatedPerformerIds
        }
      };

      console.log('   - Updated performer IDs:', updatedPerformerIds);

      const result = await syncService.makeGraphQLRequest(mutation, variables);
      
      if (!result || !result.sceneUpdate) {
        console.error('   ❌ Invalid response from Stash:', JSON.stringify(result, null, 2));
        throw new Error('Invalid response from Stash');
      }

      console.log('   ✅ Stash updated successfully');
      console.log('   - Scene now has', result.sceneUpdate.performers.length, 'performer(s)');
    } catch (error) {
      console.error('❌ Failed to remove performer from scene in Stash:', error.message);
      // Don't return error - continue with local DB update
      console.warn('⚠️  Continuing with local database update...');
    }
  } else {
    console.warn('⚠️ Stash service not available, skipping Stash update');
  }

  // Remove from local database
  console.log('   💾 Removing from local database...');
  await prisma.stashScenePerformer.delete({
    where: {
      sceneId_performerId: {
        sceneId,
        performerId
      }
    }
  });

  console.log('   ✅ Performer removed from scene successfully');

  // Return updated scene data
  const updatedScene = await prisma.stashScene.findUnique({
    where: { id: sceneId },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  sendSuccess(res, updatedScene);
}));

// POST /api/stash/scenes/:id/performers - Add a performer to a scene
router.post('/scenes/:id/performers', asyncHandler(async (req, res) => {
  const { id: sceneId } = req.params;
  const { performerId } = req.body;

  console.log(`➕ [ADD PERFORMER] Adding performer ${performerId} to scene ${sceneId}`);

  validateRequiredFieldsDirect(req.body, ['performerId']);

  // Check if scene exists
  const scene = await prisma.stashScene.findUnique({
    where: { id: sceneId },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  if (!scene) {
    return sendNotFound(res, 'Scene not found');
  }

  // Check if performer exists
  const performer = await prisma.stashPerformer.findUnique({
    where: { id: performerId }
  });

  if (!performer) {
    return sendNotFound(res, 'Performer not found');
  }

  // Check if performer is already in the scene
  const existingLink = scene.performers.find(sp => sp.performerId === performerId);
  if (existingLink) {
    return sendBadRequest(res, 'Performer is already in this scene');
  }

  // Add performer to scene in local database
  await prisma.stashScenePerformer.create({
    data: {
      sceneId: sceneId,
      performerId: performerId
    }
  });

  console.log(`   ✅ Added performer ${performer.name} to scene locally`);

  // Update in Stash via GraphQL
  // Note: In our schema, the 'id' field IS the Stash ID (no separate stashId field)
  if (scene.id && performer.id) {
    try {
      let stashService = getActiveSyncService();
      
      // If service not initialized, try to initialize it
      if (!stashService) {
        console.log('   📡 Stash service not initialized, initializing now...');
        await initializeStashSyncService();
        stashService = getActiveSyncService();
      }
      
      if (!stashService) {
        console.warn('   ⚠️ Stash service not available - skipping Stash update');
        console.warn('   ℹ️  Performer added to local database only');
        const updatedScene = await prisma.stashScene.findUnique({
          where: { id: sceneId },
          include: {
            performers: {
              include: {
                performer: true,
                tags: {
                  include: {
                    tag: true
                  }
                }
              }
            }
          }
        });
        return sendSuccess(res, updatedScene);
      }
      
      console.log(`   📝 Preparing Stash update:`);
      console.log(`      - Scene ID: ${scene.id}`);
      console.log(`      - Performer ID: ${performer.id}`);
      console.log(`      - Performer Name: ${performer.name}`);
      
      // Get current performer IDs from scene (using performer.id, not performer.stashId)
      const currentPerformerIds = scene.performers.map(sp => sp.performer.id).filter(Boolean);
      console.log(`      - Current performers in scene: ${currentPerformerIds.length}`);
      console.log(`      - Current performer IDs: [${currentPerformerIds.join(', ')}]`);
      
      // Add new performer ID
      const updatedPerformerIds = [...currentPerformerIds, performer.id];
      console.log(`      - Updated performer IDs: [${updatedPerformerIds.join(', ')}]`);
      
      const updateMutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            performers { id name }
          }
        }
      `;

      console.log(`   🚀 Sending GraphQL mutation to Stash...`);
      const data = await stashService.makeGraphQLRequest(updateMutation, {
        input: {
          id: scene.id,
          performer_ids: updatedPerformerIds
        }
      });
      
      const result = data ? { sceneUpdate: data.sceneUpdate } : null;

      if (result && result.sceneUpdate) {
        console.log(`   ✅ Successfully updated scene in Stash`);
        console.log(`      - Scene ID: ${result.sceneUpdate.id}`);
        console.log(`      - Performers now in scene: ${result.sceneUpdate.performers?.length || 0}`);
        if (result.sceneUpdate.performers) {
          result.sceneUpdate.performers.forEach(p => {
            console.log(`        - ${p.name} (${p.id})`);
          });
        }
      } else {
        console.error(`   ⚠️ Unexpected response from Stash:`, result);
      }
    } catch (stashError) {
      console.error('   ❌ Failed to update Stash:', stashError.message);
      console.error('   Stack:', stashError.stack);
      // Continue anyway - local database is updated
    }
  } else {
    console.warn(`   ⚠️ Cannot update in Stash - missing IDs:`);
    console.warn(`      - Scene ID: ${scene.id || 'MISSING'}`);
    console.warn(`      - Performer ID: ${performer.id || 'MISSING'}`);
    console.warn(`      - Performer Name: ${performer.name}`);
  }

  // Return updated scene
  const updatedScene = await prisma.stashScene.findUnique({
    where: { id: sceneId },
    include: {
      performers: {
        include: {
          performer: true,
          tags: {
            include: {
              tag: true
            }
          }
        }
      }
    }
  });

  sendSuccess(res, updatedScene);
}));

// POST /api/stash/scenes/:sceneId/performers/:performerId/swap - Swap performer with another
router.post('/scenes/:sceneId/performers/:performerId/swap', asyncHandler(async (req, res) => {
  const { sceneId, performerId: oldPerformerId } = req.params;
  const { newPerformerId } = req.body;

  console.log(`🔄 [SWAP PERFORMER] Swapping performer in scene ${sceneId}`);
  console.log(`   - Old: ${oldPerformerId} → New: ${newPerformerId}`);

  validateRequiredFieldsDirect(req.body, ['newPerformerId']);

  // Perform the swap
  const result = await performerSwapService.swapPerformerInScene(
    sceneId,
    oldPerformerId,
    newPerformerId,
    prisma
  );

  // Return updated scene data with performers
  const updatedScene = await prisma.stashScene.findUnique({
    where: { id: sceneId },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });

  sendSuccess(res, {
    scene: updatedScene,
    swap: result
  });
}));

// ============================================================================
// GENERIC SCRAPER ROUTES
// ============================================================================

// GET /api/stash/scenes/:id/available-scrapers - Get available scrapers for a scene's URLs
router.get('/scenes/:id/available-scrapers', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  console.log(`🔍 [Available Scrapers] Checking available scrapers for scene: ${id}`);
  
  // Fetch scene with URLs
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    select: { 
      id: true, 
      url: true, 
      episodeUrls: true 
    }
  });
  
  if (!scene) {
    return sendNotFound(res, 'Scene not found');
  }
  
  // Collect all URLs
  const urls = [];
  if (scene.url) urls.push(scene.url);
  if (scene.episodeUrls) {
    try {
      const parsedUrls = typeof scene.episodeUrls === 'string' 
        ? JSON.parse(scene.episodeUrls) 
        : scene.episodeUrls;
      if (Array.isArray(parsedUrls)) {
        // Handle both formats: plain strings and objects with url property
        parsedUrls.forEach(urlItem => {
          if (typeof urlItem === 'string') {
            urls.push(urlItem);
          } else if (urlItem && urlItem.url) {
            urls.push(urlItem.url);
          }
        });
      }
    } catch (e) {
      console.warn('   - Failed to parse episodeUrls:', e.message);
    }
  }
  
  console.log(`   - Found ${urls.length} URL(s) to check:`, urls);
  
  // Use global scraper registry
  const registry = getScraperRegistry();
  
  console.log(`   - Registry has ${registry.scrapers.length} scrapers loaded`);
  
  // Debug: Check each URL against each scraper
  urls.forEach(url => {
    console.log(`   - Checking URL: ${url}`);
    registry.scrapers.forEach(scraper => {
      const canHandle = scraper.canHandle(url);
      console.log(`     - ${scraper.siteName}: ${canHandle ? '✅ MATCH' : '❌ no match'}`);
      if (scraper.sceneUrlPatterns) {
        console.log(`       Patterns: ${scraper.sceneUrlPatterns.join(', ')}`);
      }
    });
  });
  
  // Get available scrapers
  const availableScrapers = registry.getAvailableScrapers(urls);
  
  console.log(`   - Found ${availableScrapers.length} available scraper(s):`, 
    availableScrapers.map(s => s.name).join(', '));
  
  sendSuccess(res, {
    sceneId: id,
    urls,
    scrapers: availableScrapers.map(s => ({
      name: s.name,
      siteName: s.scraper.siteName,
      url: s.url
    }))
  });
}));

// POST /api/stash/scrapers/reload - Reload all YAML scraper configurations
router.post('/scrapers/reload', asyncHandler(async (req, res) => {
  console.log('🔄 [Scraper Reload] Reloading YAML scrapers...');
  
  try {
    const registry = getScraperRegistry();
    const result = registry.reloadYamlScrapers();
    
    console.log('✅ [Scraper Reload] Successfully reloaded scrapers');
    console.log(`   - Total scrapers: ${result.totalScrapers}`);
    console.log(`   - YAML scrapers: ${result.yamlScrapers}`);
    console.log(`   - Code scrapers: ${result.codeScrapers}`);
    
    sendSuccess(res, {
      message: 'YAML scrapers reloaded successfully',
      ...result
    });
  } catch (error) {
    console.error('❌ [Scraper Reload] Failed to reload scrapers:', error);
    return sendServerError(res, `Failed to reload scrapers: ${error.message}`);
  }
}));

// POST /api/stash/scenes/:id/scrape-generic - Scrape using any registered scraper
router.post('/scenes/:id/scrape-generic', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { url, scraperName, sceneNumber } = req.body;
  
  console.log(`🔍 [Generic Scrape] Starting scrape for scene: ${id}`);
  console.log(`   - URL: ${url}`);
  console.log(`   - Scraper: ${scraperName || 'auto-detect'}`);
  if (sceneNumber) {
    console.log(`   - Direct scene number: ${sceneNumber}`);
  }  
  // Validate URL provided
  if (!url || !url.trim()) {
    return sendBadRequest(res, 'URL is required');
  }
  
  // Fetch scene data with performers for matching
  const scene = await prisma.stashScene.findUnique({
    where: { id },
    include: {
      performers: {
        include: {
          performer: true
        }
      }
    }
  });
  
  if (!scene) {
    return sendBadRequest(res, 'Scene not found');
  }
  
  const scenePerformers = scene.performers.map(sp => sp.performer);
  console.log(`   - Scene has ${scenePerformers.length} performer(s):`, scenePerformers.map(p => p.name));
  
  // Use global scraper registry
  const registry = getScraperRegistry();
  
  // Get the appropriate scraper
  let scraper;
  if (scraperName) {
    // Find scraper by name
    scraper = registry.getAllScrapers().find(s => s.siteName === scraperName);
    if (!scraper) {
      return sendBadRequest(res, `Unknown scraper: ${scraperName}`);
    }
    if (!scraper.canHandle(url)) {
      return sendBadRequest(res, `Scraper "${scraperName}" cannot handle URL: ${url}`);
    }
  } else {
    // Auto-detect scraper from URL
    scraper = registry.getScraperForUrl(url);
    if (!scraper) {
      return sendBadRequest(res, 'No scraper available for this URL');
    }
  }
  
  console.log(`   - Using scraper: ${scraper.siteName}`);
  
  // Scrape the URL (pass performers for matching if scraper supports it)
  let scrapeResult;
  try {
    // Check if scraper accepts performers parameter (like AEBN)
    if (scraper.siteName === 'AEBN') {
      // If scene number provided, pass null for performers (skip matching)
      if (sceneNumber) {
        console.log(`   - Using direct scene number ${sceneNumber}, skipping performer matching`);
        scrapeResult = await scraper.scrape(url, null, sceneNumber);
      } else {
        scrapeResult = await scraper.scrape(url, scenePerformers);
      }
    } else {
      scrapeResult = await scraper.scrape(url);
    }
  } catch (error) {
    console.error(`❌ [Generic Scrape] Scrape failed:`, error);
    return sendServerError(res, `Failed to scrape: ${error.message}`);
  }
  
  // Check if scrape was successful
  if (!scrapeResult || !scrapeResult.success) {
    const errorMsg = scrapeResult?.error || 'Unknown scrape error';
    console.error(`❌ [Generic Scrape] Scrape unsuccessful:`, errorMsg);
    return sendServerError(res, errorMsg);
  }
  
  const metadata = scrapeResult.scraped;
  
  if (!metadata) {
    console.error(`❌ [Generic Scrape] No metadata returned from scraper`);
    return sendServerError(res, 'No metadata returned from scraper');
  }
  
  console.log(`   - Scraped metadata:`, JSON.stringify(metadata, null, 2));
  
  // Match performers, studio, tags, and movies/groups against database
  let matchedPerformers = { matched: [], unmatched: [] };
  let matchedStudio = null;
  let matchedTags = { matched: [], unmatched: [] };
  let matchedGroups = { matched: [], unmatched: [] };
  
  if (metadata.performers && metadata.performers.length > 0) {
    matchedPerformers = await geviScraper.matchPerformers(metadata.performers, prisma);
  }
  
  if (metadata.studio) {
    matchedStudio = await geviScraper.matchStudio(metadata.studio, prisma);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    matchedTags = await geviScraper.matchTags(metadata.tags, prisma);
  }
  
  if (metadata.movies && metadata.movies.length > 0) {
    matchedGroups = await geviScraper.matchGroups(metadata.movies, prisma);
  }
  
  console.log(`   - Matched performers: ${matchedPerformers.matched.length}`);
  console.log(`   - Unmatched performers:`, matchedPerformers.unmatched);
  console.log(`   - Matched studio: ${matchedStudio ? matchedStudio.name : 'none'}`);
  console.log(`   - Matched tags: ${matchedTags.matched.length}`);
  console.log(`   - Unmatched tags:`, matchedTags.unmatched);
  console.log(`   - Matched groups: ${matchedGroups.matched.length}`);
  console.log(`   - Unmatched groups:`, matchedGroups.unmatched);
  
  // Note: Image URL is used directly from scraper (no proxying)
  // Each scraper can proxy in their YAML config if needed
  if (metadata.image) {
    console.log(`   - Image URL: ${metadata.image}`);
  }
  
  // Return scraped data with matches (same format as GEVI scraper)
  sendSuccess(res, {
    scraped: metadata,
    matched: {
      studio: matchedStudio,
      performers: matchedPerformers.matched,
      tags: matchedTags.matched,
      groups: matchedGroups.matched
    },
    unmatched: {
      studio: matchedStudio ? null : metadata.studio,
      performers: matchedPerformers.unmatched,
      tags: matchedTags.unmatched,
      groups: matchedGroups.unmatched
    },
    source: scraper.siteName,
    sourceUrl: url
  });
}));

// GET /api/stash/performers/search - Search for performers
router.get('/performers/search', asyncHandler(async (req, res) => {
  const { q, limit = 20 } = req.query;

  console.log(`🔍 [SEARCH PERFORMERS] Query: "${q}"`);

  if (!q || q.trim().length < 2) {
    return sendSuccess(res, []);
  }

  const performers = await performerSwapService.searchPerformers(q, parseInt(limit));

  console.log(`   - Found ${performers.length} matches`);

  sendSuccess(res, performers);
}));

// POST /api/stash/performers - Create new performer
router.post('/performers', asyncHandler(async (req, res) => {
  const { name, stashId, image } = req.body;

  console.log(`\n➕ [CREATE PERFORMER] Request received for: "${name}"`);

  validateRequiredFieldsDirect(req.body, ['name']);

  // Get active sync service to create in Stash
  const syncService = getActiveSyncService();
  
  if (!syncService) {
    console.warn('   - ⚠️  Sync service not initialized, creating local-only performer');
  }

  const performer = await performerSwapService.createPerformer({
    name,
    stashId,
    image
  }, syncService);

  sendSuccess(res, performer);
}));

// PUT /api/stash/scenes/:id - Update scene details
router.put('/scenes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, studio, studioId, performerIds, tagIds, groupIds, sceneNumbers, details, date, url, coverImage, actionCodes, geviUrl, episodeUrls } = req.body;
  
  console.log('🎬 [PUT /scenes/:id] Scene update request received');
  console.log('   - Scene ID:', id);
  console.log('   - Performer IDs:', performerIds);
  console.log('   - Tag IDs:', tagIds);
  console.log('   - Group IDs:', groupIds);
  console.log('   - Scene Numbers:', sceneNumbers);
  console.log('   - Request body keys:', Object.keys(req.body));
  
  // Initialize Stash sync service if not already initialized
  if (!stashSyncService) {
    await initializeStashSyncService();
  }
  
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (studio !== undefined) updateData.studio = studio;
  if (studioId !== undefined) updateData.studioId = studioId;
  if (details !== undefined) updateData.details = details;
  if (date !== undefined) updateData.date = date;
  if (url !== undefined) updateData.url = url;
  if (geviUrl !== undefined) updateData.geviUrl = geviUrl;
  
  // Handle episode URLs - APPEND instead of replace
  if (episodeUrls !== undefined && Array.isArray(episodeUrls)) {
    // Fetch existing scene to get current episodeUrls
    const existingScene = await prisma.stashScene.findUnique({
      where: { id },
      select: { episodeUrls: true }
    });
    
    let existingUrls = [];
    if (existingScene && existingScene.episodeUrls) {
      try {
        existingUrls = typeof existingScene.episodeUrls === 'string'
          ? JSON.parse(existingScene.episodeUrls)
          : existingScene.episodeUrls;
        
        if (!Array.isArray(existingUrls)) {
          existingUrls = [];
        }
      } catch (e) {
        console.warn('   - Failed to parse existing episodeUrls, starting fresh:', e.message);
        existingUrls = [];
      }
    }
    
    // Merge new URLs with existing ones (remove duplicates)
    const allUrls = [...existingUrls];
    
    for (const newUrl of episodeUrls) {
      // Check if URL already exists (support both string URLs and objects with url property)
      const newUrlString = typeof newUrl === 'string' ? newUrl : newUrl.url;
      const exists = allUrls.some(existing => {
        const existingUrlString = typeof existing === 'string' ? existing : existing.url;
        return existingUrlString === newUrlString;
      });
      
      if (!exists) {
        allUrls.push(newUrl);
      }
    }
    
    // Store merged episode URLs as JSON string in database
    updateData.episodeUrls = JSON.stringify(allUrls);
    console.log(`   - Appending ${episodeUrls.length} new episode URL(s) to ${existingUrls.length} existing (total: ${allUrls.length})`);
  }
  
  // Update local database
  const updatedScene = await prisma.stashScene.update({
    where: { id },
    data: updateData
  });
  
  // Handle performer relationships if provided
  if (performerIds !== undefined && Array.isArray(performerIds)) {
    // Add new performer relationships (upsert to avoid duplicates)
    for (const performerId of performerIds) {
      await prisma.stashScenePerformer.upsert({
        where: {
          sceneId_performerId: {
            sceneId: id,
            performerId: performerId
          }
        },
        create: {
          sceneId: id,
          performerId: performerId
        },
        update: {} // No update needed, just ensure it exists
      });
    }
    
    // Apply action code tags if provided
    if (actionCodes && Array.isArray(actionCodes)) {
      console.log('🏷️  Processing action codes for scene performers...');
      const performersWithCodes = performerIds
        .map((performerId, idx) => ({
          id: performerId,
          actionCode: actionCodes[idx]
        }))
        .filter(p => p.actionCode); // Only process those with codes
      
      if (performersWithCodes.length > 0) {
        try {
          const tagResult = await actionCodeService.applyActionCodeTagsForPerformers(
            id, 
            performersWithCodes, 
            prisma
          );
          console.log(`🏷️  Applied ${tagResult.totalApplied} tags from ${performersWithCodes.length} action codes`);
          if (tagResult.missingTags.length > 0) {
            console.warn(`⚠️  Warning: ${tagResult.missingTags.length} tags not found in database:`, tagResult.missingTags);
          }
        } catch (error) {
          console.error('❌ Error applying action code tags:', error);
          // Don't fail the request if tagging fails
        }
      }
    }
  }

  // Handle tag relationships if provided
  if (tagIds !== undefined && Array.isArray(tagIds)) {
    console.log('🏷️  Processing tag associations for scene...');
    
    // Add new tag relationships (upsert to avoid duplicates)
    for (const tagId of tagIds) {
      await prisma.stashSceneTag.upsert({
        where: {
          sceneId_tagId: {
            sceneId: id,
            tagId: tagId
          }
        },
        create: {
          sceneId: id,
          tagId: tagId
        },
        update: {} // No update needed, just ensure it exists
      });
    }
    console.log(`   - Added ${tagIds.length} tag(s) to scene`);
  }

  // Handle group relationships if provided
  if (groupIds !== undefined && Array.isArray(groupIds)) {
    console.log('🎬 Processing group associations for scene...');
    console.log('   - Group IDs:', groupIds);
    console.log('   - Scene Numbers:', sceneNumbers);
    
    // Get current groups to determine scene index
    const existingGroups = await prisma.stashGroupScene.findMany({
      where: { sceneId: id }
    });

    // Add new group relationships
    for (let i = 0; i < groupIds.length; i++) {
      const groupId = groupIds[i];
      
      // Check if association already exists
      const existing = existingGroups.find(g => g.groupId === groupId);
      
      if (!existing) {
        // Use provided scene number if available (from AEBN scraper)
        let sceneIndex;
        if (sceneNumbers && Array.isArray(sceneNumbers) && sceneNumbers[i] !== null && sceneNumbers[i] !== undefined) {
          sceneIndex = parseInt(sceneNumbers[i]);
          console.log(`   - Using provided scene number ${sceneIndex} for group ${groupId}`);
        } else {
          // Get the current max sceneIndex for this group to append at the end
          const maxIndexGroup = await prisma.stashGroupScene.findMany({
            where: { groupId: groupId },
            orderBy: { sceneIndex: 'desc' },
            take: 1
          });

          sceneIndex = maxIndexGroup.length > 0 ? (maxIndexGroup[0].sceneIndex || 0) + 1 : 1;
          console.log(`   - Auto-calculated scene index ${sceneIndex} for group ${groupId}`);
        }

        await prisma.stashGroupScene.create({
          data: {
            sceneId: id,
            groupId: groupId,
            sceneIndex: sceneIndex
          }
        });

        console.log(`   - Added scene to group ${groupId} at index ${sceneIndex}`);
      }
    }
  }
  
  // Update scene in Stash itself if configured
  console.log('🔍 [STASH UPDATE] Checking Stash sync configuration...');
  console.log('   - stashSyncService exists:', !!stashSyncService);
  console.log('   - Request body received:', {
    title: title !== undefined ? 'provided' : 'not provided',
    studioId: studioId !== undefined ? studioId : 'not provided',
    performerIds: performerIds !== undefined ? `${performerIds.length} performers` : 'not provided',
    tagIds: tagIds !== undefined ? `${tagIds.length} tags` : 'not provided',
    groupIds: groupIds !== undefined ? `${groupIds.length} groups` : 'not provided',
    details: details !== undefined ? 'provided' : 'not provided',
    date: date !== undefined ? date : 'not provided',
    url: url !== undefined ? 'provided' : 'not provided',
    coverImage: coverImage !== undefined ? 'provided' : 'not provided'
  });
  
  if (!stashSyncService) {
    console.warn('⚠️ [STASH UPDATE] stashSyncService is not available');
  } else {
    const isConfigured = await stashSyncService.isConfigured();
    console.log('   - stashSyncService.isConfigured():', isConfigured);
    
    if (isConfigured) {
      console.log('📡 [STASH UPDATE] Preparing to update scene in Stash...');
      console.log('   - Scene ID:', id);
      console.log('   - Title:', title);
      console.log('   - Studio ID:', studioId);
      console.log('   - Performer IDs:', performerIds);
      console.log('   - Performer IDs type:', typeof performerIds, Array.isArray(performerIds));
      console.log('   - Details:', details ? `${details.substring(0, 50)}...` : 'none');
      console.log('   - Date:', date);
      console.log('   - URL:', url);
      console.log('   - Cover Image:', coverImage ? 'provided' : 'none');
      
      const stashUpdates = {};
      if (title !== undefined) stashUpdates.title = title;
      if (studioId !== undefined) stashUpdates.studioId = studioId;
      if (performerIds !== undefined && Array.isArray(performerIds)) {
        console.log('✅ [STASH UPDATE] Performer IDs validation starting...');
        console.log('   - Input performer IDs:', performerIds);
        // Validate that all performers exist in local database (synced from Stash)
        const validPerformerIds = [];
        for (const performerId of performerIds) {
          const performer = await prisma.stashPerformer.findUnique({
            where: { id: performerId }
          });
          
          if (performer) {
            validPerformerIds.push(performerId);
          } else {
            console.warn(`⚠️  Performer ${performerId} not found in database, skipping`);
          }
        }
        
        if (validPerformerIds.length !== performerIds.length) {
          console.warn(`⚠️  ${performerIds.length - validPerformerIds.length} performer(s) not found, using ${validPerformerIds.length} valid performers`);
        }
        
        console.log('✅ [STASH UPDATE] Performer validation complete');
        console.log('   - Valid performer IDs:', validPerformerIds);
        console.log('   - Count:', validPerformerIds.length);
        
        stashUpdates.performerIds = validPerformerIds;
      }
      if (groupIds !== undefined && Array.isArray(groupIds)) {
        // Validate that all groups exist in local database
        const validGroupIds = [];
        for (const groupId of groupIds) {
          const group = await prisma.stashGroup.findUnique({
            where: { id: groupId }
          });
          
          if (group) {
            validGroupIds.push(groupId);
          } else {
            console.warn(`⚠️  Group ${groupId} not found in database, skipping`);
          }
        }
        
      if (validGroupIds.length !== groupIds.length) {
        console.warn(`⚠️  ${groupIds.length - validGroupIds.length} group(s) not found, using ${validGroupIds.length} valid groups`);
      }
      
      stashUpdates.groupIds = validGroupIds;
      
      // If scene numbers are provided, pass them along for Stash update
      if (sceneNumbers && Array.isArray(sceneNumbers)) {
        stashUpdates.sceneNumbers = sceneNumbers;
        console.log('   - Including scene numbers for Stash update:', sceneNumbers);
      }
    }
    if (tagIds !== undefined && Array.isArray(tagIds)) {
      // Validate that all tags exist in local database
      const validTagIds = [];
      for (const tagId of tagIds) {
        const tag = await prisma.stashTag.findUnique({
          where: { id: tagId }
        });
        
        if (tag) {
          validTagIds.push(tagId);
        } else {
          console.warn(`⚠️  Tag ${tagId} not found in database, skipping`);
        }
      }
      
      if (validTagIds.length !== tagIds.length) {
        console.warn(`⚠️  ${tagIds.length - validTagIds.length} tag(s) not found, using ${validTagIds.length} valid tags`);
      }
      
      stashUpdates.tagIds = validTagIds;
    }
    if (details !== undefined) stashUpdates.details = details;
    if (date !== undefined) stashUpdates.date = date;
    if (url !== undefined) stashUpdates.url = url;
    if (coverImage !== undefined) stashUpdates.coverImage = coverImage;      // Handle episode URLs - append to existing URLs in Stash
      if (episodeUrls !== undefined && Array.isArray(episodeUrls) && episodeUrls.length > 0) {
        console.log(`   - Preparing to append ${episodeUrls.length} episode URL(s) to Stash`);
        stashUpdates.episodeUrls = episodeUrls;
      }
      
      console.log('   - Updates object keys:', Object.keys(stashUpdates));
      console.log('   - Full stashUpdates object:', JSON.stringify(stashUpdates, null, 2));
      
      try {
        const stashResult = await stashSyncService.updateScene(id, stashUpdates);
        console.log('   - Stash result:', JSON.stringify(stashResult, null, 2));
        
        if (!stashResult.success) {
          console.error('❌ [STASH UPDATE] Failed to update scene in Stash:', stashResult.error);
        } else {
          console.log('✅ [STASH UPDATE] Scene updated in Stash successfully!');
        }
      } catch (error) {
        console.error('❌ [STASH UPDATE] Exception during Stash update:', error);
      }
    } else {
      console.warn('⚠️ [STASH UPDATE] Stash service not configured, skipping update');
    }
  }
  
  sendSuccess(res, updatedScene);
}));

// POST /api/stash/scenes/:id/watched - Mark Stash scene as watched
router.post('/scenes/:id/watched', asyncHandler(async (req, res) => {
  const sceneId = req.params.id;

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
    const isStashConfigured = stashSyncService ? await stashSyncService.isConfigured() : false;
    console.log('   - stashService.isConfigured():', isStashConfigured);
    
    if (stashSyncService && isStashConfigured) {
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
      console.warn('   - Service configured:', isStashConfigured);
    }

  res.json({
    success: true,
    message: 'Scene marked as watched',
    scene: updatedScene,
    stashUpdate: stashResult
  });
}));

// Sync a single scene from Stash
router.post('/scenes/:id/sync', asyncHandler(async (req, res) => {
  const sceneId = req.params.id;
  console.log(`🔄 [Sync Scene] Syncing scene ${sceneId} from Stash`);

  try {
    // Get Stash settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.stashUrl) {
      return sendBadRequest(res, 'Stash URL not configured');
    }

    // Fetch scene from Stash
    const query = `
      query FindScene($id: ID!) {
        findScene(id: $id) {
          id
          title
          details
          url
          date
          rating100
          o_counter
          organized
          studio {
            id
            name
          }
          tags {
            id
            name
          }
          performers {
            id
            name
          }
          stash_ids {
            endpoint
            stash_id
          }
          files {
            path
            size
            duration
            video_codec
            audio_codec
            width
            height
            frame_rate
            bit_rate
          }
        }
      }
    `;

    const stashResponse = await fetch(`${settings.stashUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: sceneId }
      })
    });

    const stashData = await stashResponse.json();
    const scene = stashData?.data?.findScene;

    if (!scene) {
      return sendBadRequest(res, 'Scene not found in Stash');
    }

    console.log(`   - Found scene in Stash: ${scene.title}`);

    // Process scene data - adapted from StashSyncService.syncScenes()
    const primaryFile = scene.files && scene.files.length > 0 ? scene.files[0] : null;
    
    // DEBUG: Log file metadata
    if (primaryFile) {
      console.log(`   📹 File metadata:`, {
        size: primaryFile.size,
        width: primaryFile.width,
        height: primaryFile.height,
        video_codec: primaryFile.video_codec,
        audio_codec: primaryFile.audio_codec,
        frame_rate: primaryFile.frame_rate,
        bit_rate: primaryFile.bit_rate
      });
    } else {
      console.log(`   ⚠️ No file data available`);
    }
    
    // Validate foreign key references
    let validatedStudioId = null;
    if (scene.studio?.id) {
      const studioExists = await prisma.stashStudio.findUnique({
        where: { id: scene.studio.id }
      });
      if (studioExists) {
        validatedStudioId = scene.studio.id;
      } else {
        console.log(`   ⚠️ Studio ${scene.studio.id} not found, setting studioId to null`);
      }
    }

    const sceneData = {
      id: scene.id,
      title: scene.title || '',
      details: scene.details || null,
      url: scene.url || null,
      date: scene.date || null,
      rating: scene.rating100 ? Math.round(scene.rating100 / 20) : null,
      organized: scene.organized || false,
      osHash: null,
      checksum: null,
      phash: null,
      oCounter: scene.o_counter || null,
      path: primaryFile?.path || null,
      fileModTime: null,
      // File metadata
      fileSize: primaryFile?.size || null,
      duration: primaryFile?.duration || null,
      width: primaryFile?.width || null,
      height: primaryFile?.height || null,
      videoCodec: primaryFile?.video_codec || null,
      audioCodec: primaryFile?.audio_codec || null,
      frameRate: primaryFile?.frame_rate || null,
      bitrate: primaryFile?.bit_rate || null,
      // Studio and other metadata
      studio: scene.studio?.name || null,
      studioId: validatedStudioId,
      code: null,
      director: null,
      synopsis: null,
      lastPlayedAt: null,
      resumeTime: null,
      playDuration: null,
      playCount: null,
      lastSyncedAt: new Date()
    };

    // Upsert scene
    const syncedScene = await prisma.stashScene.upsert({
      where: { id: scene.id },
      update: sceneData,
      create: sceneData
    });

    console.log(`   - Synced scene data to database`);

    // Sync performers - PRESERVE LOCAL TAGS/NOTES
    if (scene.performers && scene.performers.length > 0) {
      // Get existing performer relationships with their tags (action codes)
      const existingRelationships = await prisma.stashScenePerformer.findMany({
        where: { sceneId: scene.id },
        include: {
          tags: true
        }
      });

      // Create a map of existing relationships that have tags or notes
      const relationshipsWithData = new Map();
      existingRelationships.forEach(rel => {
        if (rel.tags.length > 0 || rel.notes) {
          relationshipsWithData.set(rel.performerId, rel);
        }
      });

      // Build set of performer IDs from Stash
      const stashPerformerIds = new Set();
      const validPerformers = [];
      
      for (const performer of scene.performers) {
        const performerExists = await prisma.stashPerformer.findUnique({
          where: { id: performer.id }
        });
        if (performerExists) {
          validPerformers.push(performer);
          stashPerformerIds.add(performer.id);
        } else {
          console.log(`   ⚠️ Skipping performer ${performer.id} - not found in database`);
        }
      }

      // Remove only relationships that:
      // 1. Are NOT in the current Stash data, AND
      // 2. Don't have any local tags or notes
      const performersToRemove = existingRelationships
        .filter(rel => !stashPerformerIds.has(rel.performerId) && !relationshipsWithData.has(rel.performerId))
        .map(rel => rel.performerId);

      if (performersToRemove.length > 0) {
        await prisma.stashScenePerformer.deleteMany({
          where: { 
            sceneId: scene.id,
            performerId: { in: performersToRemove }
          }
        });
        console.log(`   🗑️ Removed ${performersToRemove.length} performer(s) no longer in Stash (without local data)`);
      }

      // Upsert performers to preserve existing tags/notes
      if (validPerformers.length > 0) {
        for (const performer of validPerformers) {
          await prisma.stashScenePerformer.upsert({
            where: {
              sceneId_performerId: {
                sceneId: scene.id,
                performerId: performer.id
              }
            },
            update: {
              // Don't overwrite notes or tags - keep existing local data
            },
            create: {
              sceneId: scene.id,
              performerId: performer.id
            }
          });
        }
        
        const preserved = validPerformers.filter(p => relationshipsWithData.has(p.id)).length;
        console.log(`   - Synced ${validPerformers.length} performers`);
        if (preserved > 0) {
          console.log(`   💾 Preserved ${preserved} performer(s) with action codes/notes`);
        }
      }
    }

    // Sync tags
    if (scene.tags && scene.tags.length > 0) {
      await prisma.stashSceneTag.deleteMany({
        where: { sceneId: scene.id }
      });

      const validTags = [];
      for (const tag of scene.tags) {
        const tagExists = await prisma.stashTag.findUnique({
          where: { id: tag.id }
        });
        if (tagExists) {
          validTags.push(tag);
        } else {
          console.log(`   ⚠️ Skipping tag ${tag.id} - not found in database`);
        }
      }

      if (validTags.length > 0) {
        await prisma.stashSceneTag.createMany({
          data: validTags.map(tag => ({
            sceneId: scene.id,
            tagId: tag.id
          }))
        });
        console.log(`   - Synced ${validTags.length} tags`);
      }
    }

    console.log(`✅ [Sync Scene] Scene ${sceneId} synced successfully`);
    sendSuccess(res, { sceneId, title: scene.title });

  } catch (error) {
    console.error('❌ [Sync Scene] Error:', error);
    sendServerError(res, `Failed to sync scene: ${error.message}`);
  }
}));

router.delete('/scenes/:id', asyncHandler(async (req, res) => {
  try {
    const sceneId = req.params.id;
    // Query parameters to control deletion behavior (default to deleting both file and generated content)
    const { deleteFile = 'true', deleteGenerated = 'true' } = req.query;
    
    const deleteFileBoolean = deleteFile === 'true';
    const deleteGeneratedBoolean = deleteGenerated === 'true';
    
    console.log('🗑️ Deleting scene:', sceneId, 'deleteFile:', deleteFileBoolean, 'deleteGenerated:', deleteGeneratedBoolean);

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

  // Delete from Stash itself via direct GraphQL request
  let stashResult = null;
  try {
    // Get Stash settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const stashUrl = settings?.stashUrl;
    const stashApiKey = settings?.stashApiKey;
    
    if (!stashUrl) {
      console.warn('⚠️ Stash URL not configured - scene deleted from local database only');
      stashResult = {
        success: false,
        error: 'Stash URL not configured',
        message: 'Scene deleted from local database. To delete from Stash, configure Stash URL in settings.'
      };
    } else {
      console.log('🗑️ Deleting scene from Stash via GraphQL...');
      
      // Make direct GraphQL mutation to Stash
      const mutation = `
        mutation SceneDestroy($id: ID!, $delete_file: Boolean, $delete_generated: Boolean) {
          sceneDestroy(input: {
            id: $id
            delete_file: $delete_file
            delete_generated: $delete_generated
          })
        }
      `;
      
      const variables = {
        id: sceneId,
        delete_file: deleteFileBoolean,
        delete_generated: deleteGeneratedBoolean
      };
      
      const baseUrl = stashUrl.endsWith('/') ? stashUrl.slice(0, -1) : stashUrl;
      const graphqlUrl = `${baseUrl}/graphql`;
      
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      if (stashApiKey) {
        headers['ApiKey'] = stashApiKey;
      }
      
      const fetch = require('node-fetch');
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: mutation,
          variables
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Stash GraphQL request failed:', response.status, errorText);
        stashResult = {
          success: false,
          error: `Stash API request failed: ${response.status}`,
          message: 'Scene deleted from local database, but failed to delete from Stash.'
        };
      } else {
        const jsonData = await response.json();
        
        if (jsonData.errors) {
          console.error('❌ Stash GraphQL errors:', jsonData.errors);
          stashResult = {
            success: false,
            error: `GraphQL errors: ${JSON.stringify(jsonData.errors)}`,
            message: 'Scene deleted from local database, but Stash returned errors.'
          };
        } else if (jsonData.data && jsonData.data.sceneDestroy !== undefined) {
          console.log('✅ Scene deleted from Stash successfully');
          stashResult = {
            success: true,
            deleted: jsonData.data.sceneDestroy
          };
        } else {
          console.warn('⚠️ Unexpected response from Stash:', jsonData);
          stashResult = {
            success: false,
            error: 'Unexpected response from Stash API',
            message: 'Scene deleted from local database, but Stash response was unexpected.'
          };
        }
      }
    }
  } catch (stashError) {
    console.error('❌ Error deleting from Stash:', stashError);
    stashResult = {
      success: false,
      error: stashError.message
    };
  }

  res.json({
    success: true,
    message: stashResult?.success 
      ? 'Scene deleted from both local database and Stash'
      : 'Scene deleted from local database only',
    localDeleted,
    clipsDeleted,
    stashDeleted: stashResult?.success || false,
    stashResult,
    warning: !stashResult?.success ? stashResult?.message || 'Scene not deleted from Stash - may need manual cleanup' : null
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
}));

// PUT /api/stash/scenes/:id/studio - Update a scene's studio
router.put('/scenes/:id/studio', asyncHandler(async (req, res) => {
  const sceneId = req.params.id;
  const { studioId } = req.body;

  if (!studioId) {
    return sendBadRequest(res, 'studioId is required');
  }

  console.log(`🎬 Updating studio for scene ${sceneId} to studio ${studioId}`);
  console.log(`   Scene ID type: ${typeof sceneId}, Studio ID type: ${typeof studioId}`);

  // Get Stash settings for direct GraphQL access
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const stashUrl = settings?.stashUrl;
  const stashApiKey = settings?.stashApiKey;
  
  let stashResult = { success: false, warning: null };
  
  if (!stashUrl) {
    console.warn('⚠️ Stash URL not configured, updating local database only');
    stashResult.warning = 'Stash not configured - updated local database only';
  } else {
    console.log('   🔄 Updating in Stash via GraphQL...');
    
    try {
      // Make direct GraphQL mutation to Stash
      const mutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            studio {
              id
              name
              image_path
            }
          }
        }
      `;
      
      const variables = {
        input: {
          id: sceneId,
          studio_id: studioId
        }
      };
      
      console.log('   GraphQL mutation:', mutation);
      console.log('   Variables:', variables);
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (stashApiKey) {
        headers['ApiKey'] = stashApiKey;
      }
      
      const response = await fetch(`${stashUrl}/graphql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: mutation, variables })
      });
      
      if (!response.ok) {
        throw new Error(`Stash API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }
      
      console.log('   ✅ Stash updated successfully:', result.data.sceneUpdate);
      stashResult = { success: true };
    } catch (error) {
      console.error('❌ Failed to update studio in Stash:', error.message);
      stashResult = {
        success: false,
        warning: `Studio updated locally but failed to update in Stash: ${error.message}`
      };
    }
  }

  // Update in local database
  console.log('   💾 Updating in local database...');
  const updatedScene = await prisma.stashScene.update({
    where: { id: sceneId },
    data: { studioId: studioId },
    include: {
      studioObject: true
    }
  });

  console.log('✅ Scene studio updated successfully');
  console.log('   Updated scene studio:', updatedScene.studioObject?.name);

  sendSuccess(res, {
    scene: updatedScene,
    stashUpdated: stashResult.success,
    warning: stashResult.warning,
    message: 'Studio updated successfully'
  });
}));

// POST /api/stash/scenes/:id/clips/generate - Generate clips for a scene
router.post('/scenes/:id/clips/generate', asyncHandler(async (req, res) => {
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
}));

// GET /api/stash/scenes/:id/clips - Get clips for a specific scene
router.get('/scenes/:id/clips', asyncHandler(async (req, res) => {
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
}));

// ===== CLIPS MANAGEMENT =====

// GET /api/stash/clips - Get all clips with pagination and filtering
router.get('/clips', asyncHandler(async (req, res) => {
  console.log('📋 Getting all clips with pagination...');
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || parseInt(req.query.perPage) || 20;
  const search = req.query.search || '';
  const watchStatus = req.query.watched; // 'true', 'false', or undefined for all
  const tags = req.query.tags; // comma-separated tag IDs
  const sortBy = req.query.sortBy || 'createdAt';
  const sortDirection = (req.query.sortDirection || 'desc').toLowerCase(); // Ensure lowercase for Prisma
  
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
  
  // Add tag filter
  if (tags) {
    const tagIds = tags.split(',').map(id => id.trim()).filter(id => id && !isNaN(parseInt(id)));
    if (tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: {
            in: tagIds
          }
        }
      };
    }
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
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              favorite: true
            }
          }
        }
      },
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
    success: true,
    data: clips,
    pagination: {
      page: page,
      perPage: limit,
      total: totalClips,
      totalPages: totalPages
    }
  });
}));

// GET /clips/next - Get next clip for continuous playback
// NOTE: This route MUST come before /clips/:id to avoid matching "next" as an ID parameter
router.get('/clips/next', asyncHandler(async (req, res) => {
  console.log('🎲 Getting next clip for continuous playback...');
  
  // Get a random scene with some randomness factors
  const totalScenes = await prisma.stashScene.count();
  
  if (totalScenes === 0) {
    return sendBadRequest(res, 'No scenes found in database');
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
    return sendBadRequest(res, 'No scene found');
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
          duration: true,
          studio: true,
          performers: {
            include: {
              performer: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                  disambiguation: true,
                  favorite: true,
                  url: true
                }
              }
            }
          },
          tags: {
            include: {
              tag: {
                include: {
                  parentTags: {
                    include: {
                      parentTag: {
                        select: {
                          id: true,
                          name: true
                        }
                      }
                    }
                  },
                  childTags: {
                    include: {
                      childTag: {
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
          },
          studioObject: {
            select: {
              id: true,
              name: true,
              url: true,
              image: true
            }
          }
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
    
    // This should never happen now since we create clips for scenes of any length
    if (clipsToCreate.length === 0) {
      return sendBadRequest(res, 'Unexpected error: No clips generated for scene', {
        suggestion: 'Please try again or contact support'
      });
    }
    
    // Bulk create clips
    await prisma.stashClip.createMany({
      data: clipsToCreate
    });
    
    console.log('✨ Created clips for scene:', {
      sceneId: selectedScene.id,
      clipCount: clipsToCreate.length,
      clipIndexes: clipsToCreate.map(c => c.clipIndex)
    });
    
    // Get a random generated clip
    const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
    console.log('🎲 Selecting random clip with index:', randomClipIndex);
    
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
            duration: true,
            studio: true,
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    disambiguation: true,
                    favorite: true,
                    url: true
                  }
                }
              }
            },
            tags: {
              include: {
                tag: {
                  include: {
                    parentTags: {
                      include: {
                        parentTag: {
                          select: {
                            id: true,
                            name: true
                          }
                        }
                      }
                    },
                    childTags: {
                      include: {
                        childTag: {
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
            },
            studioObject: {
              select: {
                id: true,
                name: true,
                url: true,
                image: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              include: {
                parentTags: {
                  include: {
                    parentTag: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                },
                childTags: {
                  include: {
                    childTag: {
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
        }
      }
    });
    
    console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
  }
  
  // Verify we have a valid clip
  if (!selectedClip || !selectedClip.id) {
    console.error('❌ Failed to select a clip:', {
      selectedClipExists: !!selectedClip,
      selectedClipId: selectedClip?.id,
      sceneId: selectedScene?.id
    });
    return sendBadRequest(res, 'Failed to select clip', {
      reason: 'Clip selection returned null or invalid data',
      suggestion: 'Please try again'
    });
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
    return sendBadRequest(res, 'Stash URL not configured in settings or environment');
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
  
  console.log(`✅ Next clip marked as watched:`, {
    clipId: selectedClip.id,
    sceneId: selectedClip.scene.id,
    clipIndex: selectedClip.clipIndex,
    startTime: selectedClip.startTime,
    endTime: selectedClip.endTime
  });
  
  // Debug: Log tag hierarchy data
  if (selectedClip.scene?.tags && selectedClip.scene.tags.length > 0) {
    console.log('🏷️ Scene tags with hierarchy:');
    selectedClip.scene.tags.forEach(tagRelation => {
      const tag = tagRelation.tag;
      console.log(`  - ${tag.name}: parents=${tag.parentTags?.length || 0}, children=${tag.childTags?.length || 0}`);
    });
  }
  
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
}));

// POST /clips/reset - Reset all clips to unwatched
// NOTE: This route MUST come before /clips/:id to avoid matching "reset" as an ID parameter
router.post('/clips/reset', asyncHandler(async (req, res) => {
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
}));

// GET /clips/:id - Single clip details
// NOTE: This route MUST come after specific /clips/* routes to avoid shadowing them
router.get('/clips/:id', asyncHandler(async (req, res) => {
  const clipId = parseInt(req.params.id);
  
  // Validate that clipId is a valid number
  if (isNaN(clipId) || clipId <= 0) {
    return sendBadRequest(res, 'Invalid clip ID', {
      provided: req.params.id,
      message: 'Clip ID must be a valid positive integer'
    });
  }

  const clip = await prisma.stashClip.findUnique({
    where: { id: clipId },
    include: {
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              favorite: true
            }
          }
        }
      },
      scene: {
        select: {
          id: true,
          title: true,
          date: true,
          duration: true,
          rating: true,
          studioObject: {
            select: {
              id: true,
              name: true
            }
          },
          performers: {
            select: {
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

  if (!clip) {
    return sendBadRequest(res, `Clip with ID ${clipId} not found`);
  }

  // Transform data to match expected format
  const transformedClip = {
    id: clip.id,
    name: clip.name || `Clip ${clip.clipIndex}`,
    duration: clip.duration,
    startTime: clip.startTime,
    endTime: clip.endTime,
    clipIndex: clip.clipIndex,
    sceneId: clip.sceneId,
    sceneTitle: clip.scene?.title,
    watched: clip.watched,
    watchedAt: clip.watchedAt,
    createdAt: clip.createdAt,
    tags: clip.tags.map(ct => ct.tag),
    scene: clip.scene ? {
      id: clip.scene.id,
      title: clip.scene.title,
      date: clip.scene.date,
      rating: clip.scene.rating,
      duration: clip.scene.duration,
      studioName: clip.scene.studioObject?.name
    } : null
  };

  sendSuccess(res, transformedClip);
}));

// POST /api/stash/clips/:id/watched - Mark clip as watched
router.post('/clips/:id/watched', asyncHandler(async (req, res) => {
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
}));

// POST /api/stash/clips/:id/play - Play a specific clip by ID
router.post('/clips/:id/play', asyncHandler(async (req, res) => {
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
    return sendBadRequest(res, 'Clip not found');
  }

  console.log(`▶️ Found clip for scene: ${clip.scene.title}`);

  // Construct streaming URL - prioritize database settings over environment
  const settings = await prisma.settings.findFirst();
  const stashUrl = settings?.stashUrl || process.env.STASH_URL;
  let streamUrl = `${stashUrl}/scene/${clip.sceneId}/stream`;
  
  console.log(`▶️ Stream URL: ${streamUrl}`);

  sendSuccess(res, {
    clip,
    streamUrl,
    message: `Playing clip ${clip.clipIndex + 1} from "${clip.scene.title}"`
  });
}));

// POST /api/stash/clip-play - Select and play a random clip from a random scene
router.post('/clip-play', asyncHandler(async (req, res) => {
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
    return sendBadRequest(res, 'No scenes available for clip generation', {
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
      },
      tags: {
        include: {
          tag: {
            include: {
              parentTags: {
                include: {
                  parentTag: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              },
              childTags: {
                include: {
                  childTag: {
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
      return sendBadRequest(res, 'Selected scene too short for clip generation', {
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
        },
        tags: {
          include: {
            tag: {
              include: {
                parentTags: {
                  include: {
                    parentTag: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                },
                childTags: {
                  include: {
                    childTag: {
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
        }
      }
    });
    
    console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
  }
  
  // Verify we have a valid clip
  if (!selectedClip || !selectedClip.id) {
    console.error('❌ Failed to select a clip:', {
      selectedClipExists: !!selectedClip,
      selectedClipId: selectedClip?.id,
      sceneId: selectedScene?.id
    });
    return sendBadRequest(res, 'Failed to select clip', {
      reason: 'Clip selection returned null or invalid data',
      suggestion: 'Please try again'
    });
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
    return sendBadRequest(res, 'Stash URL not configured in settings or environment');
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
}));

// GET /stats - Get Stash database statistics
router.get('/stats', asyncHandler(async (req, res) => {
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
}));

// GET /performers - Stash performers endpoint
router.get('/performers', asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20, filter = '', search = '', startsWith = 'false' } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(perPage);
  const take = parseInt(perPage);
  
  // Use 'search' or 'filter' parameter (search takes precedence for compatibility)
  const searchQuery = search || filter;
  const useStartsWith = startsWith === 'true';
  
  // Build search filter for name and alias
  // Note: Using 'contains' or 'startsWith' without 'mode' for SQLite compatibility
  // This makes search case-sensitive in SQLite, case-insensitive in PostgreSQL
  const searchFilter = searchQuery ? {
    OR: [
      { name: useStartsWith ? { startsWith: searchQuery } : { contains: searchQuery } },
      { alias: useStartsWith ? { startsWith: searchQuery } : { contains: searchQuery } },
      { disambiguation: useStartsWith ? { startsWith: searchQuery } : { contains: searchQuery } }
    ]
  } : {};
  
  console.log(`🔍 [PERFORMERS] Searching with query: "${searchQuery}" (startsWith: ${useStartsWith})`);
  
  // Get total count
  const total = await prisma.stashPerformer.count({
    where: searchFilter
  });
  
  console.log(`📊 [PERFORMERS] Found ${total} total matches`);
  
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
  
  console.log(`✅ [PERFORMERS] Returning ${performers.length} performers for page ${page}`);
  
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
}));

/**
 * GET /api/stash/performers/body-attributes
 * Get all body attribute tags (children of "Body Attributes" parent tag)
 * NOTE: This MUST come before /performers/:id to avoid route collision
 */
router.get('/performers/body-attributes', asyncHandler(async (req, res) => {
  const ScenePerformerService = require('../services/scenePerformerService');
  const scenePerformerService = new ScenePerformerService();
  
  const bodyTags = await scenePerformerService.getBodyAttributeTagsHierarchy();
  sendSuccess(res, bodyTags);
}));

// GET /performers/:id - Single performer details
router.get('/performers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Fetch performer with tags and ALL scenes with their tags
  const performer = await prisma.stashPerformer.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      ethnicityTag: true, // Include the ethnicity tag relation
      scenes: {
        include: {
          scene: {
            select: { id: true, title: true, date: true, studio: true, rating: true }
          },
          tags: {
            include: {
              tag: true
            }
          }
        },
        orderBy: {
          scene: {
            date: 'desc'
          }
        }
        // No take limit - get ALL scenes to collect all scene-specific tags
      }
    }
  });

  if (!performer) {
    return sendNotFound(res, 'Performer not found');
  }

  const data = {
    id: performer.id,
    name: performer.name,
    disambiguation: performer.disambiguation,
    alias: performer.alias,
    favorite: performer.favorite,
    ignore_auto_tag: performer.ignore_auto_tag,
    birthdate: performer.birthdate,
    death_date: performer.death_date,
    gender: performer.gender,
    details: performer.details,
    rating: performer.rating,
    ethnicity: performer.ethnicity,
    ethnicityTag: performer.ethnicityTag ? { id: performer.ethnicityTag.id, name: performer.ethnicityTag.name } : null,
    country: performer.country,
    eye_color: performer.eye_color,
    hair_color: performer.hair_color,
    height: performer.height,
    weight: performer.weight,
    measurements: performer.measurements,
    fake_tits: performer.fake_tits,
    penis_length: performer.penis_length,
    circumcised: performer.circumcised,
    career_length: performer.career_length,
    tattoos: performer.tattoos,
    piercings: performer.piercings,
    image: performer.image,
    instagram: performer.instagram,
    twitter: performer.twitter,
    url: performer.url,
    tags: performer.tags.map(pt => ({ id: pt.tag.id, name: pt.tag.name })),
    // Return only recent scenes for display (limit 20)
    scenes: performer.scenes.slice(0, 20).map(ps => ({
      ...ps.scene,
      performerTags: ps.tags.map(t => ({ id: t.tag.id, name: t.tag.name }))
    })),
    // Include ALL scene-performer tags for comprehensive tag merging
    allScenePerformerTags: performer.scenes.flatMap(ps => 
      ps.tags.map(t => ({ 
        tagId: t.tag.id, 
        tagName: t.tag.name,
        sceneId: ps.sceneId,
        sceneTitle: ps.scene.title
      }))
    )
  };

  return sendSuccess(res, data);
}));

// GET /studios - Stash studios endpoint
router.get('/studios', asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20, filter = '' } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(perPage);
  const take = parseInt(perPage);
  
  // Build search filter (SQLite doesn't support mode: 'insensitive', but contains is case-insensitive by default)
  const searchFilter = filter ? {
    name: { contains: filter }
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
}));

// GET /studios/:id - Single studio details
router.get('/studios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const studio = await prisma.stashStudio.findUnique({
    where: { id },
    include: {
      scenes: {
        include: {
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          date: 'desc'
        }
      }
    }
  });

  if (!studio) {
    return sendBadRequest(res, `Studio with ID ${id} not found`);
  }

  // Transform data to match expected format
  const transformedStudio = {
    id: studio.id,
    name: studio.name,
    url: studio.url,
    image: studio.image,
    geviUrl: studio.geviUrl,
    scenes: studio.scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      date: scene.date,
      rating: scene.rating,
      duration: scene.duration,
      tags: scene.tags.map(st => st.tag)
    })),
    scene_count: studio.scenes.length
  };

  sendSuccess(res, transformedStudio);
}));

// PUT /studios/:id - Update studio details
router.put('/studios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { geviUrl, notes } = req.body;

  // Check if studio exists
  const studio = await prisma.stashStudio.findUnique({
    where: { id }
  });

  if (!studio) {
    return sendBadRequest(res, `Studio with ID ${id} not found`);
  }

  // Update studio
  const updateData = {};
  if (geviUrl !== undefined) updateData.geviUrl = geviUrl;
  if (notes !== undefined) updateData.notes = notes;

  const updatedStudio = await prisma.stashStudio.update({
    where: { id },
    data: updateData
  });

  sendSuccess(res, updatedStudio);
}));

// GET /tags/:id - Single tag details
// NOTE: This MUST come before /tags to avoid route collision
router.get('/tags/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Fetch tag with scenes, performers, parent, and children
  const tag = await prisma.stashTag.findUnique({
    where: { id },
    include: {
      scenes: {
        include: {
          scene: {
            select: { 
              id: true, 
              title: true, 
              date: true, 
              studio: true, 
              rating: true
            }
          }
        },
        take: 20
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
        },
        take: 20
      },
      parentTags: {
        include: {
          parentTag: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      childTags: {
        include: {
          childTag: {
            select: {
              id: true,
              name: true,
              description: true,
              image: true
            }
          }
        }
      }
    }
  });

  if (!tag) {
    return sendNotFound(res, 'Tag not found');
  }

  const data = {
    id: tag.id,
    name: tag.name,
    description: tag.description,
    aliases: tag.aliases ? tag.aliases.split(',').map(a => a.trim()) : [],
    image: tag.image,
    favorite: tag.favorite,
    scene_count: tag.scenes.length,
    performer_count: tag.performers.length,
    parent: tag.parentTags.length > 0 ? tag.parentTags[0].parentTag : null,
    children: tag.childTags.map(ct => ct.childTag),
    scenes: tag.scenes.map(ts => ts.scene),
    performers: tag.performers.map(tp => tp.performer),
    created_at: tag.created_at,
    updated_at: tag.updated_at
  };

  return sendSuccess(res, data);
}));

// GET /tags - Stash tags endpoint
router.get('/tags', asyncHandler(async (req, res) => {
  const { page = 1, perPage = 20, filter = '', rootOnly = 'true' } = req.query;
  
  const skip = (parseInt(page) - 1) * parseInt(perPage);
  const take = parseInt(perPage);
  
  // Build search filter (SQLite doesn't support mode: 'insensitive', but contains is case-insensitive by default in SQLite)
  const searchFilter = filter ? {
    OR: [
      { name: { contains: filter } },
      { description: { contains: filter } }
    ]
  } : {};
  
  // Add root-only filter if requested
  const whereClause = { ...searchFilter };
  if (rootOnly === 'true') {
    // Only get tags that have no parents
    whereClause.parentTags = {
      none: {}
    };
  }
  
  // Get total count
  const total = await prisma.stashTag.count({
    where: whereClause
  });
  
  // Get tags with usage counts and hierarchy
  const tags = await prisma.stashTag.findMany({
    where: whereClause,
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
      },
      parentTags: {
        include: {
          parentTag: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      childTags: {
        include: {
          childTag: {
            select: {
              id: true,
              name: true,
              description: true,
              image: true,
              favorite: true,
              scenes: {
                select: {
                  sceneId: true
                }
              },
              performers: {
                select: {
                  performerId: true
                }
              },
              childTags: {
                include: {
                  childTag: {
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
      },
      aliases: {
        select: {
          alias: true
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
    favorite: tag.favorite,
    ignoreAutoTag: tag.ignoreAutoTag,
    scene_count: tag.scenes.length,
    performer_count: tag.performers.length,
    parent_count: tag.parentTags.length,
    child_count: tag.childTags.length,
    parents: tag.parentTags.map(pt => pt.parentTag),
    children: tag.childTags.map(ct => ({
      id: ct.childTag.id,
      name: ct.childTag.name,
      description: ct.childTag.description,
      image: ct.childTag.image,
      favorite: ct.childTag.favorite,
      scene_count: ct.childTag.scenes.length,
      performer_count: ct.childTag.performers.length,
      child_count: ct.childTag.childTags.length,
      children: ct.childTag.childTags.map(gct => gct.childTag)
    })),
    aliases: tag.aliases.map(a => a.alias)
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
}));

// GET /galleries - Stash galleries endpoint
router.get('/galleries', asyncHandler(async (req, res) => {
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
}));

// GET /galleries/:id - Get specific gallery by ID
router.get('/galleries/:id', asyncHandler(async (req, res) => {
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
}));

// GET /images/random - Get a random image from all galleries
router.get('/images/random', asyncHandler(async (req, res) => {
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
}));

// GET /images/slideshow - Stash random images endpoint for slideshow
router.get('/images/slideshow', asyncHandler(async (req, res) => {
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
}));

// GET /images - Stash standalone images endpoint
router.get('/images', asyncHandler(async (req, res) => {
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
}));

// GET /search - Stash search endpoint
router.get('/search', asyncHandler(async (req, res) => {
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
}));

// Stash sync endpoint
router.post('/sync', asyncHandler(async (req, res) => {
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
}));

// Sync configuration endpoint
router.get('/sync/config', asyncHandler(async (req, res) => {
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
}));

// Sync benchmark endpoint
router.post('/sync/benchmark', asyncHandler(async (req, res) => {
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
}));

// Sync scenes endpoint
router.post('/sync/scenes', asyncHandler(async (req, res) => {
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
}));

// Sync performers endpoint
router.post('/sync/performers', asyncHandler(async (req, res) => {
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
}));

// Sync studios endpoint
router.post('/sync/studios', asyncHandler(async (req, res) => {
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
}));

// Sync tags endpoint
router.post('/sync/tags', asyncHandler(async (req, res) => {
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
}));

// Sync galleries endpoint
router.post('/sync/galleries', asyncHandler(async (req, res) => {
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
}));

// Sync groups/movies endpoint
router.post('/sync/groups', asyncHandler(async (req, res) => {
  if (!stashSyncService) {
    await initializeStashSyncService();
  }
  
  if (!stashSyncService) {
    return sendBadRequest(res, 'Stash sync service not configured');
  }
  
  const { page = 1, perPage = 100 } = req.body;
  console.log(`Starting Stash groups sync (page ${page})...`);
  
  const results = await stashSyncService.syncGroups(parseInt(page), parseInt(perPage));
  
  sendSuccess(res, {
    synced: results.groups.length,
    hasMore: results.hasMore,
    totalCount: results.totalCount
  }, `Synced ${results.groups.length} groups from page ${page}`);
}));

// Sync images endpoint
router.post('/sync/images', asyncHandler(async (req, res) => {
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
}));

// Get Stash sync status
router.get('/sync/status', asyncHandler(async (req, res) => {
  const backgroundSyncStatus = stashBackgroundSync ? stashBackgroundSync.getSyncStatus() : null;
  
  res.json({
    backgroundSync: backgroundSyncStatus,
    serviceInitialized: !!stashSyncService,
    configuration: {
      stashUrlConfigured: !!(await prisma.settings.findFirst())?.stashUrl,
      stashApiKeyConfigured: !!(await prisma.settings.findFirst())?.stashApiKey
    }
  });
}));

// Get background sync status
router.get('/background-sync-status', asyncHandler(async (req, res) => {
  const status = stashBackgroundSync.getSyncStatus();
  res.json(status);
}));

// Start background sync
router.post('/background-sync/start', asyncHandler(async (req, res) => {
  await stashBackgroundSync.start();
  res.json({ message: 'Stash background sync service started successfully' });
}));

// Stop background sync
router.post('/background-sync/stop', asyncHandler(async (req, res) => {
  await stashBackgroundSync.stop();
  res.json({ message: 'Stash background sync service stopped successfully' });
}));

// Force background sync now
router.post('/background-sync/force-now', asyncHandler(async (req, res) => {
  const result = await stashBackgroundSync.forceSyncNow();
  res.json({ message: 'Stash background sync completed', result });
}));

// Comprehensive cleanup: Remove orphaned entities
router.post('/cleanup/orphaned-entities', asyncHandler(async (req, res) => {
  try {
    // Ensure sync service is initialized
    if (!stashSyncService && !stashSyncServiceOptimized) {
      console.log('⚠️ Stash sync services not initialized, initializing now...');
      await initializeStashSyncService();
    }

    const activeSyncService = getActiveSyncService();
    if (!activeSyncService) {
      return sendServerError(res, 'Stash sync service not available');
    }

    console.log(`🧹 Starting comprehensive cleanup via ${SYNC_SERVICE_TYPE} sync service...`);
    
    let cleanupResults;
    if (SYNC_SERVICE_TYPE === 'optimized') {
      cleanupResults = await activeSyncService.cleanupOrphanedEntitiesOptimized(true);
    } else {
      cleanupResults = await activeSyncService.cleanupOrphanedEntities(true);
    }

    const totalCleaned = Object.values(cleanupResults).reduce((sum, count) => sum + count, 0);
    
    sendSuccess(res, {
      message: `Comprehensive cleanup completed using ${SYNC_SERVICE_TYPE} service`,
      totalEntitiesRemoved: totalCleaned,
      details: cleanupResults,
      serviceType: SYNC_SERVICE_TYPE
    });

  } catch (error) {
    logError('Error during comprehensive cleanup:', error);
    sendServerError(res, `Comprehensive cleanup failed: ${error.message}`);
  }
}));

// Test cleanup (dry run) - Check what would be cleaned up without doing it
router.post('/cleanup/test', asyncHandler(async (req, res) => {
  try {
    // Ensure sync service is initialized
    if (!stashSyncService && !stashSyncServiceOptimized) {
      console.log('⚠️ Stash sync services not initialized, initializing now...');
      await initializeStashSyncService();
    }

    const activeSyncService = getActiveSyncService();
    if (!activeSyncService) {
      return sendServerError(res, 'Stash sync service not available');
    }

    console.log(`🔍 Testing cleanup to see what would be removed (dry run)...`);
    
    // Run cleanup with enableCleanup=false to see what would be cleaned
    let cleanupResults;
    if (SYNC_SERVICE_TYPE === 'optimized') {
      cleanupResults = await activeSyncService.cleanupOrphanedEntitiesOptimized(false);
    } else {
      cleanupResults = await activeSyncService.cleanupOrphanedEntities(false);
    }

    sendSuccess(res, {
      message: `Cleanup test completed using ${SYNC_SERVICE_TYPE} service (no entities were actually removed)`,
      wouldBeRemoved: cleanupResults,
      serviceType: SYNC_SERVICE_TYPE,
      dryRun: true
    });

  } catch (error) {
    logError('Error during cleanup test:', error);
    sendServerError(res, `Cleanup test failed: ${error.message}`);
  }
}));

// Get tags that are used on clips
router.get('/clips/tags', asyncHandler(async (req, res) => {
  console.log('🏷️ Getting tags used on clips...');
  
  // Get all unique tags that are associated with clips
  const clipTags = await prisma.stashClipTag.findMany({
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          favorite: true
        }
      }
    },
    distinct: ['tagId']
  });

  // Transform to just the tag data with clip count
  const tags = await Promise.all(
    clipTags.map(async (clipTag) => {
      // Count how many clips use this tag
      const clipCount = await prisma.stashClipTag.count({
        where: { tagId: clipTag.tagId }
      });
      
      return {
        ...clipTag.tag,
        clip_count: clipCount
      };
    })
  );

  // Sort by clip count descending
  tags.sort((a, b) => b.clip_count - a.clip_count);

  console.log(`🏷️ Found ${tags.length} tags used on clips`);
  
  res.json({
    success: true,
    data: tags
  });
}));

// Get clips with pagination and filtering


// GET /clips/:id/tags - Get tags for a specific clip
router.get('/clips/:id/tags', asyncHandler(async (req, res) => {
  const clipId = parseInt(req.params.id);
  
  console.log('🏷️ GET /clips/:id/tags - Looking for clip:', {
    rawId: req.params.id,
    parsedId: clipId,
    isNaN: isNaN(clipId)
  });
  
  if (isNaN(clipId)) {
    return sendBadRequest(res, 'Invalid clip ID');
  }
  
  const clip = await prisma.stashClip.findUnique({
    where: { id: clipId },
    include: {
      tags: {
        include: {
          tag: {
            include: {
              parentTags: {
                include: {
                  parentTag: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              },
              childTags: {
                include: {
                  childTag: {
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
      }
    }
  });
  
  console.log('🔍 Clip lookup result:', {
    clipId: clipId,
    found: !!clip,
    clipDbId: clip?.id
  });
  
  if (!clip) {
    return sendNotFound(res, 'Clip not found');
  }
  
  res.json({
    clipId: clip.id,
    tags: clip.tags
  });
}));

// POST /clips/:id/tags - Add tags to a clip
router.post('/clips/:id/tags', asyncHandler(async (req, res) => {
  const clipId = parseInt(req.params.id);
  const { tagIds } = req.body;
  
  if (isNaN(clipId)) {
    return sendBadRequest(res, 'Invalid clip ID');
  }
  
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return sendBadRequest(res, 'tagIds must be a non-empty array');
  }
  
  // Verify clip exists, if not try to create it from scene data
  let clip = await prisma.stashClip.findUnique({
    where: { id: clipId }
  });
  
  if (!clip) {
    console.log(`⚠️ Clip ${clipId} not found, attempting to create from scene data...`);
    
    // Try to find the clip's scene and clip data to create it
    // This might happen when clips are generated on-the-fly
    // For now, we'll return a 404 but log that we should create it
    // In a future update, we could auto-create the clip here
    return sendNotFound(res, 'Clip not found. Please ensure the clip has been generated and synced.');
  }
  
  // Verify all tags exist
  const tags = await prisma.stashTag.findMany({
    where: { id: { in: tagIds } }
  });
  
  if (tags.length !== tagIds.length) {
    return sendBadRequest(res, 'One or more tag IDs are invalid');
  }
  
  // Create clip-tag associations (skip duplicates)
  const createdTags = [];
  for (const tagId of tagIds) {
    const existing = await prisma.stashClipTag.findUnique({
      where: {
        clipId_tagId: {
          clipId: clipId,
          tagId: tagId
        }
      }
    });
    
    if (!existing) {
      const created = await prisma.stashClipTag.create({
        data: {
          clipId: clipId,
          tagId: tagId
        },
        include: {
          tag: true
        }
      });
      createdTags.push(created);
    }
  }
  
  console.log(`✅ Added ${createdTags.length} tags to clip ${clipId}`);
  
  res.json({
    message: `Added ${createdTags.length} tag(s) to clip`,
    clipId: clipId,
    addedTags: createdTags
  });
}));

// DELETE /clips/:id/tags/:tagId - Remove a tag from a clip
router.delete('/clips/:id/tags/:tagId', asyncHandler(async (req, res) => {
  const clipId = parseInt(req.params.id);
  const { tagId } = req.params;
  
  if (isNaN(clipId)) {
    return sendBadRequest(res, 'Invalid clip ID');
  }
  
  if (!tagId) {
    return sendBadRequest(res, 'Tag ID is required');
  }
  
  // Check if association exists
  const clipTag = await prisma.stashClipTag.findUnique({
    where: {
      clipId_tagId: {
        clipId: clipId,
        tagId: tagId
      }
    }
  });
  
  if (!clipTag) {
    return sendNotFound(res, 'Tag not associated with this clip');
  }
  
  // Delete the association
  await prisma.stashClipTag.delete({
    where: {
      clipId_tagId: {
        clipId: clipId,
        tagId: tagId
      }
    }
  });
  
  console.log(`✅ Removed tag ${tagId} from clip ${clipId}`);
  
  res.json({
    message: 'Tag removed from clip successfully',
    clipId: clipId,
    tagId: tagId
  });
}));

// GET /api/stash/gevi-image-proxy - Proxy GEVI images to avoid CORS issues
router.get('/gevi-image-proxy', asyncHandler(async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return sendBadRequest(res, 'Image URL is required');
  }

  // Validate it's a GEVI URL
  if (!url.startsWith('https://gayeroticvideoindex.com/')) {
    return sendBadRequest(res, 'Only GEVI images are allowed');
  }

  try {
    const axios = require('axios');
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://gayeroticvideoindex.com/'
      }
    });

    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });

    // Pipe the image data
    response.data.pipe(res);
  } catch (error) {
    console.error('❌ Error proxying GEVI image:', error.message);
    return sendServerError(res, 'Failed to proxy image');
  }
}));

// POST /api/stash/scenes/merge - Merge multiple scenes into one
router.post('/scenes/merge', asyncHandler(async (req, res) => {
  const { primarySceneId, mergeSceneIds, mergedData } = req.body;

  if (!primarySceneId || !mergeSceneIds || mergeSceneIds.length === 0) {
    return sendBadRequest(res, 'Primary scene ID and merge scene IDs are required');
  }

  if (!mergedData.keepFileFromSceneId) {
    return sendBadRequest(res, 'keepFileFromSceneId is required to determine which file to keep');
  }

  console.log(`🔀 Merging ${mergeSceneIds.length} scenes into scene ${primarySceneId}`);
  console.log(`📁 Keeping file from scene ${mergedData.keepFileFromSceneId}`);

  try {
    const allSceneIds = [primarySceneId, ...mergeSceneIds];

    // Fetch all scenes to merge with pivot data
    const scenes = await prisma.stashScene.findMany({
      where: { id: { in: allSceneIds } },
      include: {
        studioObject: true,
        performers: {
          include: {
            performer: true,
            tags: {
              include: {
                tag: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        groups: {
          include: {
            group: true
          }
        }
      }
    });

    if (scenes.length !== allSceneIds.length) {
      return sendBadRequest(res, 'One or more scenes not found');
    }

    const primaryScene = scenes.find(s => s.id === primarySceneId);
    const mergeScenes = scenes.filter(s => s.id !== primarySceneId);
    const keepFileScene = scenes.find(s => s.id === mergedData.keepFileFromSceneId);

    if (!keepFileScene) {
      return sendBadRequest(res, 'Scene with file to keep not found');
    }

    // Collect all unique performers from all scenes with their pivot data
    const performerDataMap = new Map(); // Map<performerId, { notes, tagIds }>
    
    scenes.forEach(scene => {
      scene.performers.forEach(sp => {
        const performerId = sp.performerId;
        
        if (!performerDataMap.has(performerId)) {
          // First time seeing this performer, initialize with their data
          const tagIds = new Set(sp.tags.map(t => t.tagId));
          performerDataMap.set(performerId, {
            notes: sp.notes || null,
            tagIds: tagIds
          });
        } else {
          // Performer already exists, merge the data
          const existing = performerDataMap.get(performerId);
          
          // Keep existing notes if present, otherwise use new notes
          if (!existing.notes && sp.notes) {
            existing.notes = sp.notes;
          }
          
          // Merge tag IDs (union of all tags across scenes)
          sp.tags.forEach(t => existing.tagIds.add(t.tagId));
        }
      });
    });

    const allPerformerIds = Array.from(performerDataMap.keys());
    
    console.log(`👥 Merging ${allPerformerIds.length} unique performers with their action codes/tags`);

    // Collect all unique tags from all scenes
    const allTagIds = new Set();
    scenes.forEach(scene => {
      scene.tags.forEach(t => allTagIds.add(t.tagId));
    });

    // Collect all unique groups (movies/compilations) from all scenes with scene numbers
    const groupDataMap = new Map(); // Map<groupId, sceneIndex>
    
    scenes.forEach(scene => {
      scene.groups.forEach(sg => {
        const groupId = sg.groupId;
        
        if (!groupDataMap.has(groupId)) {
          // First time seeing this group, store with scene index
          groupDataMap.set(groupId, {
            sceneIndex: sg.sceneIndex
          });
        } else {
          // Group already exists, keep existing scene index if present, otherwise use new one
          const existing = groupDataMap.get(groupId);
          if (existing.sceneIndex === null && sg.sceneIndex !== null) {
            existing.sceneIndex = sg.sceneIndex;
          }
        }
      });
    });

    const allGroupIds = Array.from(groupDataMap.keys());
    
    if (allGroupIds.length > 0) {
      console.log(`🎬 Merging ${allGroupIds.length} movie/compilation links`);
    }

    // Collect all unique URLs from all scenes
    const allUrls = new Set();
    scenes.forEach(scene => {
      if (scene.url) allUrls.add(scene.url);
      if (scene.geviUrl) allUrls.add(scene.geviUrl);
    });

    // Collect all episode URLs from all scenes
    const allEpisodeUrls = [];
    const episodeUrlSet = new Set(); // Track unique URLs to avoid duplicates
    
    scenes.forEach(scene => {
      if (scene.episodeUrls) {
        try {
          // episodeUrls is stored as JSON string
          const urls = typeof scene.episodeUrls === 'string' 
            ? JSON.parse(scene.episodeUrls) 
            : scene.episodeUrls;
          if (Array.isArray(urls)) {
            urls.forEach(urlItem => {
              // Handle both formats: plain strings and objects with url property
              let urlString = null;
              let urlLabel = 'Episode URL';
              
              if (typeof urlItem === 'string') {
                // Format: ["url1", "url2", ...]
                urlString = urlItem;
              } else if (urlItem && urlItem.url) {
                // Format: [{url: "...", label: "..."}, ...]
                urlString = urlItem.url;
                urlLabel = urlItem.label || 'Episode URL';
              }
              
              // Avoid duplicates
              if (urlString && !episodeUrlSet.has(urlString)) {
                episodeUrlSet.add(urlString);
                allEpisodeUrls.push({
                  url: urlString,
                  label: urlLabel
                });
              }
            });
          }
        } catch (e) {
          console.error(`Failed to parse episodeUrls for scene ${scene.id}:`, e);
        }
      }
    });

    // Add all collected URLs to episodeUrls if they're not already there
    // This ensures we don't lose any URLs from url or geviUrl fields
    const selectedUrl = mergedData.url || primaryScene.url;
    const selectedGeviUrl = mergedData.geviUrl || primaryScene.geviUrl;
    
    Array.from(allUrls).forEach(url => {
      // Don't add if it's the selected primary url or geviUrl (they go in their dedicated fields)
      // But do add to episodeUrls if not already there
      if (!episodeUrlSet.has(url)) {
        episodeUrlSet.add(url);
        allEpisodeUrls.push({
          url: url,
          label: url === selectedGeviUrl ? 'GEVI' : 'Scene URL'
        });
      }
    });

    // Convert episodeUrls array to JSON string for storage
    const combinedEpisodeUrls = JSON.stringify(allEpisodeUrls);

    console.log(`📎 Combining URLs: ${allUrls.size} unique URLs from url/geviUrl fields, ${allEpisodeUrls.length} total episode URLs after combining`);

    // Prepare file information from the scene we're keeping the file from
    const fileData = {
      path: keepFileScene.path,
      fileSize: keepFileScene.fileSize ? Number(keepFileScene.fileSize) : null,
      duration: keepFileScene.duration,
      width: keepFileScene.width,
      height: keepFileScene.height,
      bitrate: keepFileScene.bitrate,
      frameRate: keepFileScene.frameRate,
      videoCodec: keepFileScene.videoCodec,
      fileModTime: keepFileScene.fileModTime,
      osHash: keepFileScene.osHash,
      checksum: keepFileScene.checksum,
      phash: keepFileScene.phash
    };

    // Update primary scene with merged data and file information
    const updatedScene = await prisma.stashScene.update({
      where: { id: primarySceneId },
      data: {
        title: mergedData.title || primaryScene.title,
        date: mergedData.date || primaryScene.date,
        details: mergedData.details || primaryScene.details,
        url: mergedData.url || primaryScene.url,
        stashId: mergedData.stashId || primaryScene.stashId,
        geviUrl: mergedData.geviUrl || primaryScene.geviUrl,
        episodeUrls: combinedEpisodeUrls, // Combined episode URLs from all scenes
        studioId: mergedData.studio?.id || primaryScene.studioId,
        // Update file information
        ...fileData
      },
      include: {
        studioObject: true,
        performers: {
          include: {
            performer: true,
            tags: {
              include: {
                tag: true
              }
            }
          }
        },
        tags: true
      }
    });

    // Clear existing performer relationships and their pivot data
    await prisma.stashScenePerformer.deleteMany({
      where: { sceneId: primarySceneId }
    });

    // Recreate performer relationships with merged pivot data
    for (const performerId of allPerformerIds) {
      const performerData = performerDataMap.get(performerId);
      
      // Create the scene-performer relationship
      await prisma.stashScenePerformer.create({
        data: {
          sceneId: primarySceneId,
          performerId: performerId,
          notes: performerData.notes
        }
      });

      // Create the performer tag relationships (action codes)
      if (performerData.tagIds.size > 0) {
        await prisma.stashScenePerformerTag.createMany({
          data: Array.from(performerData.tagIds).map(tagId => ({
            sceneId: primarySceneId,
            performerId: performerId,
            tagId: tagId
          }))
        });
        
        console.log(`   ✓ Merged ${performerData.tagIds.size} action codes for performer ${performerId}`);
      }
    }

    // Update scene tags (separate from performer tags)
    await prisma.stashSceneTag.deleteMany({
      where: { sceneId: primarySceneId }
    });
    
    await prisma.stashSceneTag.createMany({
      data: Array.from(allTagIds).map(tagId => ({
        sceneId: primarySceneId,
        tagId: tagId
      }))
    });

    // Update scene groups (movies/compilations) with scene numbers
    await prisma.stashGroupScene.deleteMany({
      where: { sceneId: primarySceneId }
    });
    
    if (allGroupIds.length > 0) {
      for (const groupId of allGroupIds) {
        const groupData = groupDataMap.get(groupId);
        
        await prisma.stashGroupScene.create({
          data: {
            sceneId: primarySceneId,
            groupId: groupId,
            sceneIndex: groupData.sceneIndex
          }
        });
        
        console.log(`   ✓ Linked to movie/compilation ${groupId}${groupData.sceneIndex ? ` (scene #${groupData.sceneIndex})` : ''}`);
      }
    }

    // Update in Stash via GraphQL
    try {
      const stashService = getActiveSyncService();
      
      if (!stashService) {
        console.warn('⚠️ Stash service not available - skipping Stash update');
        throw new Error('Stash service not available');
      }
      
      // Fetch fresh scene data with all relationships for Stash update
      const freshScene = await prisma.stashScene.findUnique({
        where: { id: primarySceneId },
        include: {
          studioObject: true,
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
          groups: {
            include: {
              group: true
            }
          }
        }
      });
      
      const updateMutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            title
            date
            details
            url
            studio { id name }
            performers { id name }
            tags { id name }
            movies { movie { id name } scene_index }
          }
        }
      `;

      // Prepare movies input with scene numbers
      const moviesInput = freshScene.groups.map(sg => ({
        group_id: sg.group.id,
        scene_index: sg.sceneIndex
      })).filter(m => m.group_id); // Only include if group has ID

      const stashInput = {
        id: primaryScene.id,
        title: freshScene.title,
        date: freshScene.date,
        details: freshScene.details,
        url: freshScene.url,
        studio_id: freshScene.studioObject?.id || null,
        performer_ids: freshScene.performers.map(sp => sp.performer.id).filter(Boolean),
        tag_ids: freshScene.tags.map(st => st.tag.id).filter(Boolean),
        movies: moviesInput
      };

      console.log(`📤 Updating scene ${primaryScene.id} in Stash with:`, {
        title: stashInput.title,
        performers: stashInput.performer_ids?.length || 0,
        tags: stashInput.tag_ids?.length || 0,
        movies: stashInput.movies?.length || 0
      });

      const updateResult = await stashService.makeGraphQLRequest(updateMutation, {
        input: stashInput
      });

      if (updateResult.errors) {
        console.error(`❌ GraphQL errors updating scene:`, updateResult.errors);
        throw new Error(`Failed to update scene in Stash: ${updateResult.errors.map(e => e.message).join(', ')}`);
      }

      console.log(`✅ Updated primary scene in Stash: ${primaryScene.id}`);
      if (moviesInput.length > 0) {
        console.log(`   ✓ Updated ${moviesInput.length} movie/compilation link(s) in Stash`);
      }

      // Delete merged scenes from Stash (including their files if not the kept file)
      console.log(`🗑️ Deleting ${mergeScenes.length} merged scene(s) from Stash...`);
      
      for (const scene of mergeScenes) {
        console.log(`   Processing scene ${scene.id} (title: ${scene.title})`);
        
        if (!scene.id) {
          console.log(`   ⚠️ Skipping scene - no ID found`);
          continue;
        }
        
        // Delete the file from disk if this is NOT the scene with the file we're keeping
        const deleteFile = scene.id !== mergedData.keepFileFromSceneId;
        
        console.log(`   🗑️ Deleting scene ${scene.id} from Stash (deleteFile: ${deleteFile})`);
        
        const deleteMutation = `
          mutation SceneDestroy($id: ID!, $deleteFile: Boolean!) {
            sceneDestroy(input: { id: $id, delete_file: $deleteFile })
          }
        `;
        
        try {
          await stashService.makeGraphQLRequest(deleteMutation, { 
            id: scene.id,
            deleteFile: deleteFile
          });
          
          console.log(`   ✅ Successfully deleted scene ${scene.id} from Stash`);
        } catch (deleteError) {
          console.error(`   ❌ Failed to delete scene ${scene.id} from Stash:`, deleteError.message);
        }
      }
      
      console.log(`✅ Finished deleting merged scenes from Stash`);

      // If the primary scene has a different file than the one we're keeping, 
      // we need to handle this specially since we're not deleting the primary scene
      if (primaryScene.id !== mergedData.keepFileFromSceneId) {
        console.log(`⚠️ Primary scene file will be replaced with kept file from scene ${mergedData.keepFileFromSceneId}`);
        console.log(`   Old file: ${primaryScene.path}`);
        console.log(`   New file: ${keepFileScene.path}`);
        // Note: The primary scene now has the kept file's path/info, so it points to the correct file
        // The old primary scene file will remain on disk but won't be referenced in Stash
      }

    } catch (stashError) {
      console.error('❌ CRITICAL: Failed to update Stash:', stashError.message);
      console.error('   Stack:', stashError.stack);
      // Still continue with local merge, but make the error very visible
      console.error('⚠️  WARNING: Scenes merged locally but NOT in Stash!');
      console.error('⚠️  You may need to manually merge the scenes in Stash.');
    }

    // Delete merged scenes from local database
    await prisma.stashScene.deleteMany({
      where: { id: { in: mergeSceneIds } }
    });

    console.log(`✅ Merged ${mergeSceneIds.length} scenes into scene ${primarySceneId}`);
    sendSuccess(res, {
      scene: updatedScene,
      mergedCount: mergeSceneIds.length,
      keptFile: keepFileScene.path
    });

  } catch (error) {
    console.error('Failed to merge scenes:', error);
    return sendServerError(res, `Failed to merge scenes: ${error.message}`);
  }
}));

  // Mount scene-performer metadata routes (mounted at router root, routes handle their own paths)
  const scenePerformerRoutes = require('./stash/scenePerformers');
  router.use(scenePerformerRoutes);

  return router;
}

module.exports = createStashRouter;
