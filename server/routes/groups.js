const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { sendSuccess, sendBadRequest, sendNotFound, sendServerError, asyncHandler } = require('../utils/responses');

const prisma = new PrismaClient();

/**
 * STASH GROUPS (MOVIES) ROUTES
 * 
 * Handles Stash Groups which represent movies/compilations containing multiple scenes.
 * Groups can have metadata like name, synopsis, date, director, studio, and contain
 * multiple scenes in a specific order.
 */

// GET /api/stash/groups - List all groups with pagination and filtering
router.get('/', asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 50, 
    sortBy = 'name',
    sortOrder = 'asc',
    search = '',
    studioId = null
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Build where clause for filtering
  const where = {};
  
  if (search) {
    // Strip text within parentheses from search query for matching
    // This ignores extra info like year, studio, etc. that's often in parentheses
    const searchWithoutParens = search.replace(/\([^)]*\)/g, '').trim();
    
    // Note: SQLite doesn't support mode: 'insensitive', but contains is case-insensitive by default in SQLite
    // PostgreSQL needs mode: 'insensitive' for case-insensitive search
    const searchFilter = { contains: searchWithoutParens };
    
    // Only search in name field (not synopsis or director)
    where.name = searchFilter;
  }

  if (studioId) {
    where.studioId = studioId;
  }

  // Get total count for pagination
  const total = await prisma.stashGroup.count({ where });

  // Fetch groups with relations
  const groups = await prisma.stashGroup.findMany({
    where,
    skip,
    take,
    orderBy: { [sortBy]: sortOrder.toLowerCase() },
    include: {
      studio: true,
      scenes: {
        include: {
          scene: {
            select: {
              id: true,
              title: true,
              duration: true,
              date: true
            }
          }
        },
        orderBy: {
          sceneIndex: 'asc'
        }
      },
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  sendSuccess(res, {
    groups,
    pagination: {
      page: parseInt(page),
      limit: take,
      total,
      totalPages: Math.ceil(total / take)
    }
  });
}));

// GET /api/stash/groups/:id - Get single group details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const group = await prisma.stashGroup.findUnique({
    where: { id },
    include: {
      studio: true,
      scenes: {
        include: {
          scene: {
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
              }
            }
          }
        },
        orderBy: {
          sceneIndex: 'asc'
        }
      },
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  if (!group) {
    return sendNotFound(res, 'Group not found');
  }

  // Transform scene data to include image paths
  const transformedGroup = {
    ...group,
    scenes: group.scenes.map(sceneWrapper => ({
      ...sceneWrapper,
      scene: {
        ...sceneWrapper.scene,
        paths: {
          screenshot: `scene/${sceneWrapper.scene.id}/screenshot`,
          image: `scene/${sceneWrapper.scene.id}/screenshot`
        }
      }
    }))
  };

  sendSuccess(res, transformedGroup);
}));

// PUT /api/stash/groups/:id - Update group details
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, aliases, duration, date, rating, director, synopsis, url, studioId } = req.body;

  // Build update data object
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (aliases !== undefined) updateData.aliases = aliases;
  if (duration !== undefined) updateData.duration = duration;
  if (date !== undefined) updateData.date = date;
  if (rating !== undefined) updateData.rating = rating;
  if (director !== undefined) updateData.director = director;
  if (synopsis !== undefined) updateData.synopsis = synopsis;
  if (url !== undefined) updateData.url = url;
  if (studioId !== undefined) updateData.studioId = studioId;

  const updatedGroup = await prisma.stashGroup.update({
    where: { id },
    data: updateData,
    include: {
      studio: true,
      scenes: {
        include: {
          scene: true
        }
      },
      tags: {
        include: {
          tag: true
        }
      }
    }
  });

  sendSuccess(res, updatedGroup);
}));

// DELETE /api/stash/groups/:id - Delete a group
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.stashGroup.delete({
    where: { id }
  });

  sendSuccess(res, { message: 'Group deleted successfully' });
}));

// GET /api/stash/groups/:id/scenes - Get scenes in a group
router.get('/:id/scenes', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const groupScenes = await prisma.stashGroupScene.findMany({
    where: { groupId: id },
    include: {
      scene: {
        include: {
          studioObject: true,
          performers: {
            include: {
              performer: true
            }
          }
        }
      }
    },
    orderBy: {
      sceneIndex: 'asc'
    }
  });

  sendSuccess(res, groupScenes.map(gs => gs.scene));
}));

// POST /api/stash/groups/:id/scenes - Add scene to group
router.post('/:id/scenes', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sceneId, sceneIndex } = req.body;

  if (!sceneId) {
    return sendBadRequest(res, 'Scene ID is required');
  }

  // Check if the relationship already exists
  const existing = await prisma.stashGroupScene.findUnique({
    where: {
      groupId_sceneId: {
        groupId: id,
        sceneId: sceneId
      }
    }
  });

  if (existing) {
    return sendBadRequest(res, 'Scene already in group');
  }

  const groupScene = await prisma.stashGroupScene.create({
    data: {
      groupId: id,
      sceneId: sceneId,
      sceneIndex: sceneIndex || null
    },
    include: {
      scene: true
    }
  });

  sendSuccess(res, groupScene);
}));

// DELETE /api/stash/groups/:id/scenes/:sceneId - Remove scene from group
router.delete('/:id/scenes/:sceneId', asyncHandler(async (req, res) => {
  const { id, sceneId } = req.params;

  await prisma.stashGroupScene.delete({
    where: {
      groupId_sceneId: {
        groupId: id,
        sceneId: sceneId
      }
    }
  });

  sendSuccess(res, { message: 'Scene removed from group' });
}));

module.exports = router;
