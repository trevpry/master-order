const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const prisma = new PrismaClient();

// Get all works with composer and parts
router.get('/', asyncHandler(async (req, res) => {
  const works = await prisma.work.findMany({
    include: {
      composer: true,
      parts: {
        include: {
          artistTypes: {
            include: {
              artistType: true
            }
          },
          tracks: {
            include: {
              track: {
                include: {
                  album: {
                    include: {
                      artist: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          order: 'asc'
        }
      }
    },
    orderBy: {
      title: 'asc'
    }
  });

  // Add totalPlayCount to each work (sum of all track viewCounts)
  const worksWithPlayCount = works.map(work => {
    const totalPlayCount = work.parts.reduce((workSum, part) => {
      const partPlayCount = part.tracks.reduce((partSum, trackRel) => 
        partSum + (trackRel.track.viewCount || 0), 0);
      return workSum + partPlayCount;
    }, 0);
    
    // Add play count to each part as well
    const partsWithPlayCount = work.parts.map(part => {
      const partPlayCount = part.tracks.reduce((sum, trackRel) => 
        sum + (trackRel.track.viewCount || 0), 0);
      return { ...part, totalPlayCount: partPlayCount };
    });
    
    return { ...work, totalPlayCount, parts: partsWithPlayCount };
  });

  sendSuccess(res, worksWithPlayCount);
}));

// Get single work by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const work = await prisma.work.findUnique({
    where: { id: parseInt(id) },
    include: {
      composer: true,
      parts: {
        include: {
          artistTypes: {
            include: {
              artistType: true
            }
          },
          tracks: {
            include: {
              track: {
                include: {
                  album: {
                    include: {
                      artist: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          order: 'asc'
        }
      }
    }
  });

  if (!work) {
    return sendBadRequest(res, 'Work not found');
  }

  // Add totalPlayCount to work and parts
  const totalPlayCount = work.parts.reduce((workSum, part) => {
    const partPlayCount = part.tracks.reduce((partSum, trackRel) => 
      partSum + (trackRel.track.viewCount || 0), 0);
    return workSum + partPlayCount;
  }, 0);
  
  const partsWithPlayCount = work.parts.map(part => {
    const partPlayCount = part.tracks.reduce((sum, trackRel) => 
      sum + (trackRel.track.viewCount || 0), 0);
    return { ...part, totalPlayCount: partPlayCount };
  });
  
  const workWithPlayCount = { ...work, totalPlayCount, parts: partsWithPlayCount };

  sendSuccess(res, workWithPlayCount);
}));

// Create new work
router.post('/', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title', 'composerKey']);

  const { title, composerKey, parts = [] } = req.body;

  // Verify composer exists
  const composer = await prisma.plexArtist.findUnique({
    where: { ratingKey: composerKey }
  });

  if (!composer) {
    return sendBadRequest(res, 'Composer not found');
  }

  // Create work with parts
  const work = await prisma.work.create({
    data: {
      title,
      composerKey,
      parts: {
        create: parts.map((part, index) => ({
          title: part.title,
          order: part.order !== undefined ? part.order : index + 1,
          tracks: {
            create: (part.trackKeys || []).map(trackKey => ({
              trackKey
            }))
          }
        }))
      }
    },
    include: {
      composer: true,
      parts: {
        include: {
          tracks: {
            include: {
              track: true
            }
          }
        },
        orderBy: {
          order: 'asc'
        }
      }
    }
  });

  sendSuccess(res, work);
}));

// Update work
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, composerKey, parts } = req.body;

  // Check if work exists
  const existingWork = await prisma.work.findUnique({
    where: { id: parseInt(id) }
  });

  if (!existingWork) {
    return sendBadRequest(res, 'Work not found');
  }

  // Verify composer if provided
  if (composerKey) {
    const composer = await prisma.plexArtist.findUnique({
      where: { ratingKey: composerKey }
    });

    if (!composer) {
      return sendBadRequest(res, 'Composer not found');
    }
  }

  // Update work
  const updateData = {};
  if (title) updateData.title = title;
  if (composerKey) updateData.composerKey = composerKey;

  // Handle parts if provided
  if (parts !== undefined) {
    // Delete all existing parts (cascade will delete tracks)
    await prisma.workPart.deleteMany({
      where: { workId: parseInt(id) }
    });

    // Create new parts
    if (parts.length > 0) {
      updateData.parts = {
        create: parts
          .filter(part => part.title && part.title.trim())
          .map((part, index) => ({
            title: part.title,
            order: part.order !== undefined ? part.order : index + 1,
            tracks: {
              create: (part.trackKeys || []).map(trackKey => ({
                trackKey
              }))
            }
          }))
      };
    }
  }

  const work = await prisma.work.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      composer: true,
      parts: {
        include: {
          tracks: {
            include: {
              track: true
            }
          }
        },
        orderBy: {
          order: 'asc'
        }
      }
    }
  });

  sendSuccess(res, work);
}));

// Delete work
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const work = await prisma.work.findUnique({
    where: { id: parseInt(id) }
  });

  if (!work) {
    return sendBadRequest(res, 'Work not found');
  }

  await prisma.work.delete({
    where: { id: parseInt(id) }
  });

  sendSuccess(res, { message: 'Work deleted successfully' });
}));

// Add part to work
router.post('/:id/parts', asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateRequiredFields(req.body, ['title']);

  const { title, order, trackKeys = [] } = req.body;

  const work = await prisma.work.findUnique({
    where: { id: parseInt(id) },
    include: {
      parts: true
    }
  });

  if (!work) {
    return sendBadRequest(res, 'Work not found');
  }

  // Determine order if not provided
  const partOrder = order !== undefined ? order : (work.parts.length + 1);

  const part = await prisma.workPart.create({
    data: {
      workId: parseInt(id),
      title,
      order: partOrder,
      tracks: {
        create: trackKeys.map(trackKey => ({
          trackKey
        }))
      }
    },
    include: {
      tracks: {
        include: {
          track: true
        }
      }
    }
  });

  sendSuccess(res, part);
}));

// Update part
router.put('/:workId/parts/:partId', asyncHandler(async (req, res) => {
  const { workId, partId } = req.params;
  const { title, order, trackKeys } = req.body;

  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found');
  }

  // Update part fields
  const updateData = {};
  if (title) updateData.title = title;
  if (order !== undefined) updateData.order = order;

  // If trackKeys provided, replace all tracks
  if (trackKeys !== undefined) {
    // Delete existing tracks
    await prisma.workPartTrack.deleteMany({
      where: { workPartId: parseInt(partId) }
    });

    // Add new tracks
    updateData.tracks = {
      create: trackKeys.map(trackKey => ({
        trackKey
      }))
    };
  }

  const updatedPart = await prisma.workPart.update({
    where: { id: parseInt(partId) },
    data: updateData,
    include: {
      tracks: {
        include: {
          track: true
        }
      }
    }
  });

  sendSuccess(res, updatedPart);
}));

// Delete part
router.delete('/:workId/parts/:partId', asyncHandler(async (req, res) => {
  const { workId, partId } = req.params;

  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found');
  }

  await prisma.workPart.delete({
    where: { id: parseInt(partId) }
  });

  sendSuccess(res, { message: 'Part deleted successfully' });
}));

// Add track to work part
router.post('/:workId/parts/:partId/tracks', asyncHandler(async (req, res) => {
  const { workId, partId } = req.params;
  validateRequiredFields(req.body, ['trackKey']);

  const { trackKey } = req.body;

  // Verify part exists and belongs to work
  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found');
  }

  // Verify track exists
  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: trackKey }
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  // Check if track is already linked
  const existing = await prisma.workPartTrack.findUnique({
    where: {
      workPartId_trackKey: {
        workPartId: parseInt(partId),
        trackKey
      }
    }
  });

  if (existing) {
    return sendBadRequest(res, 'Track is already linked to this part');
  }

  // Create association
  const workPartTrack = await prisma.workPartTrack.create({
    data: {
      workPartId: parseInt(partId),
      trackKey
    },
    include: {
      track: true,
      workPart: {
        include: {
          work: {
            include: {
              composer: true
            }
          }
        }
      }
    }
  });

  sendSuccess(res, workPartTrack);
}));

// Remove track from work part
router.delete('/:workId/parts/:partId/tracks/:trackKey', asyncHandler(async (req, res) => {
  const { workId, partId, trackKey } = req.params;

  // Verify part exists and belongs to work
  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found');
  }

  // Find and delete the association
  const association = await prisma.workPartTrack.findUnique({
    where: {
      workPartId_trackKey: {
        workPartId: parseInt(partId),
        trackKey
      }
    }
  });

  if (!association) {
    return sendBadRequest(res, 'Track is not linked to this part');
  }

  await prisma.workPartTrack.delete({
    where: {
      id: association.id
    }
  });

  sendSuccess(res, { message: 'Track removed from work part successfully' });
}));

// Assign artist type to work part
router.post('/:workId/parts/:partId/artist-types/:artistTypeId', asyncHandler(async (req, res) => {
  const { workId, partId, artistTypeId } = req.params;

  // Verify part exists and belongs to work
  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found or does not belong to this work');
  }

  // Verify artist type exists
  const artistType = await prisma.artistType.findUnique({
    where: { id: parseInt(artistTypeId) }
  });

  if (!artistType) {
    return sendBadRequest(res, 'Artist type not found');
  }

  // Check if already assigned
  const existing = await prisma.workPartArtistType.findUnique({
    where: {
      workPartId_artistTypeId: {
        workPartId: parseInt(partId),
        artistTypeId: parseInt(artistTypeId)
      }
    }
  });

  if (existing) {
    return sendBadRequest(res, 'Artist type already assigned to this part');
  }

  // Create assignment
  const assignment = await prisma.workPartArtistType.create({
    data: {
      workPartId: parseInt(partId),
      artistTypeId: parseInt(artistTypeId)
    },
    include: {
      artistType: true
    }
  });

  sendSuccess(res, assignment, 201);
}));

// Remove artist type from work part
router.delete('/:workId/parts/:partId/artist-types/:artistTypeId', asyncHandler(async (req, res) => {
  const { workId, partId, artistTypeId } = req.params;

  // Verify part exists and belongs to work
  const part = await prisma.workPart.findUnique({
    where: { id: parseInt(partId) }
  });

  if (!part || part.workId !== parseInt(workId)) {
    return sendBadRequest(res, 'Part not found or does not belong to this work');
  }

  // Find and delete the assignment
  const assignment = await prisma.workPartArtistType.findUnique({
    where: {
      workPartId_artistTypeId: {
        workPartId: parseInt(partId),
        artistTypeId: parseInt(artistTypeId)
      }
    }
  });

  if (!assignment) {
    return sendBadRequest(res, 'Artist type not assigned to this part');
  }

  await prisma.workPartArtistType.delete({
    where: {
      id: assignment.id
    }
  });

  sendSuccess(res, { message: 'Artist type removed from work part successfully' });
}));

module.exports = router;
