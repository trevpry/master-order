const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance

// GET /stats - Get Stash database statistics
router.get('/', async (req, res) => {
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

module.exports = router;
