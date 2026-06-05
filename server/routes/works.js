const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const prisma = new PrismaClient();

const WORK_INCLUDE = {
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
};

// Get all works with composer and parts
router.get('/', asyncHandler(async (req, res) => {
  const works = await prisma.work.findMany({
    include: WORK_INCLUDE,
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

// Merge multiple works into a single parent work
router.post('/merge', asyncHandler(async (req, res) => {
  const { sourceWorkIds, targetWorkId, targetTitle } = req.body;

  if (!Array.isArray(sourceWorkIds) || sourceWorkIds.length < 2) {
    return sendBadRequest(res, 'At least two work IDs are required to merge');
  }

  const normalizedSourceWorkIds = [...new Set(
    sourceWorkIds
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

  if (normalizedSourceWorkIds.length < 2) {
    return sendBadRequest(res, 'At least two valid work IDs are required to merge');
  }

  const parsedTargetWorkId = targetWorkId ? parseInt(targetWorkId, 10) : null;
  if (targetWorkId !== undefined && targetWorkId !== null && (!Number.isInteger(parsedTargetWorkId) || parsedTargetWorkId <= 0)) {
    return sendBadRequest(res, 'Invalid target work ID');
  }

  const worksToMerge = await prisma.work.findMany({
    where: {
      id: {
        in: normalizedSourceWorkIds
      }
    },
    include: {
      parts: {
        include: {
          tracks: true,
          artistTypes: true
        },
        orderBy: {
          order: 'asc'
        }
      }
    }
  });

  if (worksToMerge.length !== normalizedSourceWorkIds.length) {
    return sendBadRequest(res, 'One or more works were not found');
  }

  const composerKey = worksToMerge[0].composerKey;
  const mixedComposers = worksToMerge.some((work) => work.composerKey !== composerKey);
  if (mixedComposers) {
    return sendBadRequest(res, 'All works must have the same composer to merge');
  }

  if (parsedTargetWorkId && !normalizedSourceWorkIds.includes(parsedTargetWorkId)) {
    return sendBadRequest(res, 'Target work must be one of the selected works');
  }

  if (!parsedTargetWorkId && !targetTitle?.trim()) {
    return sendBadRequest(res, 'Target title is required when creating a new parent work');
  }

  const mergeResult = await prisma.$transaction(async (tx) => {
    let destinationWorkId = parsedTargetWorkId;

    if (!destinationWorkId) {
      const newParent = await tx.work.create({
        data: {
          title: targetTitle.trim(),
          composerKey
        }
      });
      destinationWorkId = newParent.id;
    }

    const destinationWork = worksToMerge.find((work) => work.id === destinationWorkId);
    const sourceWorks = worksToMerge.filter((work) => work.id !== destinationWorkId);

    const existingDestinationParts = await tx.workPart.findMany({
      where: { workId: destinationWorkId },
      orderBy: { order: 'asc' }
    });

    let nextPartOrder = existingDestinationParts.length > 0
      ? Math.max(...existingDestinationParts.map((part) => part.order)) + 1
      : 1;

    const movedTrackKeys = new Set();

    for (const sourceWork of sourceWorks) {
      for (const sourcePart of sourceWork.parts) {
        const createdPart = await tx.workPart.create({
          data: {
            workId: destinationWorkId,
            title: `${sourceWork.title}: ${sourcePart.title}`,
            order: nextPartOrder
          }
        });

        nextPartOrder += 1;

        if (sourcePart.tracks.length > 0) {
          const uniqueTrackKeys = [...new Set(sourcePart.tracks.map((trackRel) => trackRel.trackKey))];

          await tx.workPartTrack.createMany({
            data: uniqueTrackKeys.map((trackKey) => ({
              workPartId: createdPart.id,
              trackKey
            }))
          });

          sourcePart.tracks.forEach((trackRel) => movedTrackKeys.add(trackRel.trackKey));
        }

        if (sourcePart.artistTypes.length > 0) {
          const uniqueArtistTypeIds = [...new Set(sourcePart.artistTypes.map((artistTypeRel) => artistTypeRel.artistTypeId))];

          await tx.workPartArtistType.createMany({
            data: uniqueArtistTypeIds.map((artistTypeId) => ({
              workPartId: createdPart.id,
              artistTypeId
            }))
          });
        }
      }

      await tx.work.delete({
        where: { id: sourceWork.id }
      });
    }

    if (movedTrackKeys.size > 0) {
      await tx.plexTrack.updateMany({
        where: {
          ratingKey: {
            in: [...movedTrackKeys]
          }
        },
        data: {
          workId: destinationWorkId
        }
      });
    }

    const mergedWork = await tx.work.findUnique({
      where: { id: destinationWorkId },
      include: WORK_INCLUDE
    });

    return {
      destinationWorkId,
      destinationWorkTitle: mergedWork?.title || destinationWork?.title || targetTitle,
      removedWorkIds: sourceWorks.map((work) => work.id),
      mergedWork
    };
  });

  sendSuccess(res, mergeResult);
}));

// Get single work by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const work = await prisma.work.findUnique({
    where: { id: parseInt(id) },
    include: WORK_INCLUDE
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

  await prisma.plexTrack.update({
    where: { ratingKey: trackKey },
    data: { workId: parseInt(workId) }
  });

  sendSuccess(res, workPartTrack);
}));

// Bulk link tracks to a work by creating one part for the selected tracks
router.post('/:workId/bulk-link-tracks', asyncHandler(async (req, res) => {
  const { workId } = req.params;
  const { trackKeys, partTitle } = req.body;

  if (!Array.isArray(trackKeys) || trackKeys.length === 0) {
    return sendBadRequest(res, 'trackKeys array is required');
  }

  const parsedWorkId = parseInt(workId, 10);
  if (!Number.isInteger(parsedWorkId) || parsedWorkId <= 0) {
    return sendBadRequest(res, 'Invalid work ID');
  }

  const uniqueTrackKeys = [...new Set(
    trackKeys
      .map((trackKey) => String(trackKey || '').trim())
      .filter(Boolean)
  )];

  if (uniqueTrackKeys.length === 0) {
    return sendBadRequest(res, 'At least one valid track key is required');
  }

  const work = await prisma.work.findUnique({
    where: { id: parsedWorkId },
    include: {
      parts: {
        select: { order: true }
      }
    }
  });

  if (!work) {
    return sendBadRequest(res, 'Work not found');
  }

  const tracks = await prisma.plexTrack.findMany({
    where: {
      ratingKey: {
        in: uniqueTrackKeys
      }
    },
    select: {
      ratingKey: true
    }
  });

  if (tracks.length !== uniqueTrackKeys.length) {
    return sendBadRequest(res, 'One or more tracks were not found');
  }

  const nextPartOrder = work.parts.length > 0
    ? Math.max(...work.parts.map((part) => part.order || 0)) + 1
    : 1;

  const normalizedPartTitle = String(partTitle || '').trim() || `Part ${nextPartOrder}`;

  const createdPart = await prisma.$transaction(async (tx) => {
    const newPart = await tx.workPart.create({
      data: {
        workId: parsedWorkId,
        title: normalizedPartTitle,
        order: nextPartOrder
      }
    });

    await tx.workPartTrack.createMany({
      data: uniqueTrackKeys.map((trackKey) => ({
        workPartId: newPart.id,
        trackKey
      }))
    });

    await tx.plexTrack.updateMany({
      where: {
        ratingKey: {
          in: uniqueTrackKeys
        }
      },
      data: {
        workId: parsedWorkId
      }
    });

    return tx.workPart.findUnique({
      where: { id: newPart.id },
      include: {
        work: true,
        tracks: {
          include: {
            track: true
          }
        }
      }
    });
  });

  sendSuccess(res, {
    part: createdPart,
    linkedTrackCount: uniqueTrackKeys.length,
    message: `Linked ${uniqueTrackKeys.length} tracks to work via one new part`
  });
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

  const remainingAssociation = await prisma.workPartTrack.findFirst({
    where: { trackKey },
    include: {
      workPart: {
        select: {
          workId: true
        }
      }
    },
    orderBy: {
      id: 'asc'
    }
  });

  await prisma.plexTrack.update({
    where: { ratingKey: trackKey },
    data: {
      workId: remainingAssociation?.workPart?.workId || null
    }
  });

  sendSuccess(res, { message: 'Track removed from work part successfully' });
}));

// Disconnect a track from all works
router.delete('/tracks/:trackKey/disconnect', asyncHandler(async (req, res) => {
  const { trackKey } = req.params;

  const track = await prisma.plexTrack.findUnique({
    where: { ratingKey: trackKey }
  });

  if (!track) {
    return sendBadRequest(res, 'Track not found');
  }

  const removedLinks = await prisma.workPartTrack.findMany({
    where: { trackKey },
    include: {
      workPart: true
    }
  });

  if (removedLinks.length > 0) {
    await prisma.workPartTrack.deleteMany({
      where: { trackKey }
    });
  }

  await prisma.plexTrack.update({
    where: { ratingKey: trackKey },
    data: {
      workId: null
    }
  });

  sendSuccess(res, {
    message: 'Track disconnected from work',
    removedLinks: removedLinks.length
  });
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
