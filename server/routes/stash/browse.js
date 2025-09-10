const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance
const { validateRequiredFields } = require('../../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../../utils/responses');

// GET /search - Universal search endpoint
router.get('/search', asyncHandler(async (req, res) => {
  const { query, types } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  // Parse search types, default to all
  const searchTypes = types ? types.split(',') : ['scene', 'performer', 'studio', 'tag'];
  
  const results = {};
  
  // Search scenes
  if (searchTypes.includes('scene')) {
    const scenes = await prisma.stashScene.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { details: { contains: query } },
          { performers: { some: { performer: { name: { contains: query } } } } },
          { tags: { some: { tag: { name: { contains: query } } } } },
          { studioObject: { name: { contains: query } } }
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
      },
      take: 20,
      orderBy: { title: 'asc' }
    });
    
    results.scenes = scenes.map(scene => ({
      id: scene.id,
      stash_id: scene.stash_id,
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
router.get('/studios', asyncHandler(async (req, res) => {
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
}));

// GET /tags - Stash tags endpoint
router.get('/tags', asyncHandler(async (req, res) => {
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

module.exports = router;
