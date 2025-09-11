const express = require('express');
const router = express.Router();
const { initializeStashSyncService, getActiveStashService, generateOptimizedClips } = require('./shared');

const prisma = require('../prismaClient'); // Use shared singleton instance

// GET /scenes - List all Stash scenes with pagination and filtering
router.get('/', async (req, res) => {
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

// GET /scenes/next - Get random unwatched Stash scene for "Next Stash" functionality
router.get('/next', async (req, res) => {
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

// GET /scenes/:id - Stash scene by ID endpoint
router.get('/:id', async (req, res) => {
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

// POST /scenes/:id/watched - Mark Stash scene as watched
router.post('/:id/watched', async (req, res) => {
  try {
    const sceneId = req.params.id;
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    // Initialize services
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();

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

// DELETE /scenes/:id - Delete Stash scene (from both local database and Stash itself)
router.delete('/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    const { deleteFile = false } = req.query; // Query parameter to optionally delete the actual file
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    console.log('🗑️ Deleting scene:', sceneId, 'deleteFile:', deleteFile);

    // Initialize services
    await initializeStashSyncService();
    const stashSyncService = getActiveStashService();

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

// POST /scenes/:id/clips/generate - Generate clips for a scene
router.post('/:id/clips/generate', async (req, res) => {
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

// GET /scenes/:id/clips - Get clips for a specific scene
router.get('/:id/clips', async (req, res) => {
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

module.exports = router;
