const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const prisma = new PrismaClient();

// GET /api/artist-types - List all artist types
router.get('/', asyncHandler(async (req, res) => {
  const artistTypes = await prisma.artistType.findMany({
    include: {
      parent: true,
      children: true,
      _count: {
        select: { artists: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  sendSuccess(res, { artistTypes });
}));

// GET /api/artist-types/:id - Get single artist type with artists
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const artistType = await prisma.artistType.findUnique({
    where: { id: parseInt(id) },
    include: {
      parent: true,
      children: true,
      artists: {
        include: {
          artist: true
        }
      }
    }
  });

  if (!artistType) {
    return sendBadRequest(res, 'Artist type not found');
  }

  sendSuccess(res, { artistType });
}));

// POST /api/artist-types - Create new artist type
router.post('/', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['name']);

  const { name, description, color, parentId } = req.body;

  // Check if name already exists
  const existing = await prisma.artistType.findUnique({
    where: { name: name.trim() }
  });

  if (existing) {
    return sendBadRequest(res, 'Artist type with this name already exists');
  }

  // If parentId provided, verify it exists
  if (parentId) {
    const parent = await prisma.artistType.findUnique({
      where: { id: parseInt(parentId) }
    });
    if (!parent) {
      return sendBadRequest(res, 'Parent artist type not found');
    }
  }

  const artistType = await prisma.artistType.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color?.trim() || null,
      parentId: parentId ? parseInt(parentId) : null
    },
    include: {
      parent: true,
      children: true
    }
  });

  sendSuccess(res, { artistType }, 201);
}));

// PUT /api/artist-types/:id - Update artist type
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateRequiredFields(req.body, ['name']);

  const { name, description, color, parentId } = req.body;

  // Check if another artist type has this name
  const existing = await prisma.artistType.findFirst({
    where: {
      name: name.trim(),
      NOT: { id: parseInt(id) }
    }
  });

  if (existing) {
    return sendBadRequest(res, 'Artist type with this name already exists');
  }

  // If parentId provided, verify it exists and prevent circular reference
  if (parentId) {
    const parentIdInt = parseInt(parentId);
    
    // Can't be its own parent
    if (parentIdInt === parseInt(id)) {
      return sendBadRequest(res, 'Artist type cannot be its own parent');
    }
    
    const parent = await prisma.artistType.findUnique({
      where: { id: parentIdInt }
    });
    
    if (!parent) {
      return sendBadRequest(res, 'Parent artist type not found');
    }
    
    // Check if setting this parent would create a circular reference
    // (if the parent is already a descendant of this type)
    const checkCircular = async (checkId, targetId) => {
      const type = await prisma.artistType.findUnique({
        where: { id: checkId },
        include: { parent: true }
      });
      if (!type || !type.parent) return false;
      if (type.parent.id === targetId) return true;
      return await checkCircular(type.parent.id, targetId);
    };
    
    if (await checkCircular(parentIdInt, parseInt(id))) {
      return sendBadRequest(res, 'This would create a circular reference');
    }
  }

  const artistType = await prisma.artistType.update({
    where: { id: parseInt(id) },
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      color: color?.trim() || null,
      parentId: parentId ? parseInt(parentId) : null
    },
    include: {
      parent: true,
      children: true
    }
  });

  sendSuccess(res, { artistType });
}));

// DELETE /api/artist-types/:id - Delete artist type
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if artist type exists
  const artistType = await prisma.artistType.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { artists: true }
      }
    }
  });

  if (!artistType) {
    return sendBadRequest(res, 'Artist type not found');
  }

  // Delete artist type (cascade will handle assignments)
  await prisma.artistType.delete({
    where: { id: parseInt(id) }
  });

  sendSuccess(res, { 
    message: 'Artist type deleted successfully',
    artistsAffected: artistType._count.artists
  });
}));

// POST /api/artist-types/:id/artists/:artistKey - Assign artist type to artist
router.post('/:id/artists/:artistKey', asyncHandler(async (req, res) => {
  const { id, artistKey } = req.params;

  // Verify artist type exists
  const artistType = await prisma.artistType.findUnique({
    where: { id: parseInt(id) }
  });

  if (!artistType) {
    return sendBadRequest(res, 'Artist type not found');
  }

  // Verify artist exists
  const artist = await prisma.plexArtist.findUnique({
    where: { ratingKey: artistKey }
  });

  if (!artist) {
    return sendBadRequest(res, 'Artist not found');
  }

  // Check if already assigned
  const existing = await prisma.artistTypeAssignment.findUnique({
    where: {
      artistKey_artistTypeId: {
        artistKey,
        artistTypeId: parseInt(id)
      }
    },
    include: {
      artistType: true
    }
  });

  if (existing) {
    // Already assigned - return success (idempotent behavior)
    return sendSuccess(res, { assignment: existing });
  }

  // Create assignment
  const assignment = await prisma.artistTypeAssignment.create({
    data: {
      artistKey,
      artistTypeId: parseInt(id)
    },
    include: {
      artistType: true
    }
  });

  sendSuccess(res, { assignment }, 201);
}));

// DELETE /api/artist-types/:id/artists/:artistKey - Remove artist type from artist
router.delete('/:id/artists/:artistKey', asyncHandler(async (req, res) => {
  const { id, artistKey } = req.params;

  // Check if assignment exists
  const assignment = await prisma.artistTypeAssignment.findUnique({
    where: {
      artistKey_artistTypeId: {
        artistKey,
        artistTypeId: parseInt(id)
      }
    }
  });

  if (!assignment) {
    return sendBadRequest(res, 'Artist type assignment not found');
  }

  // Delete assignment
  await prisma.artistTypeAssignment.delete({
    where: {
      artistKey_artistTypeId: {
        artistKey,
        artistTypeId: parseInt(id)
      }
    }
  });

  sendSuccess(res, { message: 'Artist type removed from artist successfully' });
}));

// GET /api/artist-types/artist/:artistKey - Get all artist types for an artist
router.get('/artist/:artistKey', asyncHandler(async (req, res) => {
  const { artistKey } = req.params;

  const assignments = await prisma.artistTypeAssignment.findMany({
    where: { artistKey },
    include: {
      artistType: true
    },
    orderBy: {
      artistType: {
        name: 'asc'
      }
    }
  });

  const artistTypes = assignments.map(a => a.artistType);

  sendSuccess(res, { artistTypes });
}));

module.exports = router;
