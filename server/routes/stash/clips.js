const express = require('express');
const router = express.Router();
const { generateOptimizedClips } = require('./shared');

const prisma = require('../prismaClient'); // Use shared singleton instance

// GET /clips - Get all clips with pagination and filtering
router.get('/', async (req, res) => {
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

// GET /clips/next - Get next clip for continuous playback
router.get('/next', async (req, res) => {
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

// POST /clips/:id/watched - Mark clip as watched
router.post('/:id/watched', async (req, res) => {
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

// POST /clips/:id/play - Play a specific clip by ID
router.post('/:id/play', async (req, res) => {
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

// POST /clips/reset - Reset all clips watched status (for testing)
router.post('/reset', async (req, res) => {
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

module.exports = router;
