const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance

// Import centralized utilities
const { asyncHandler } = require('../utils/responses');

// Get all background galleries
router.get('/', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] API endpoint called');
  
  const galleries = await prisma.backgroundGallery.findMany({
    include: {
      _count: {
        select: {
          backgrounds: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log(`🖼️ [BACKGROUND-GALLERIES] Found ${galleries.length} galleries`);

  // Add image counts and enhance data
  const galleriesWithCounts = galleries.map(gallery => ({
    ...gallery,
    imageCount: gallery._count.backgrounds,
    _count: undefined // Remove the _count object from response
  }));

  res.json({
    success: true,
    galleries: galleriesWithCounts,
    count: galleries.length
  });
}));

// Create new background gallery
router.post('/', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Create endpoint called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Request body:', req.body);

  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Gallery name is required'
    });
  }

  // Check for duplicate names
  const existingGallery = await prisma.backgroundGallery.findFirst({
    where: {
      name: name
    }
  });

  if (existingGallery) {
    return res.status(400).json({
      success: false,
      error: 'A gallery with this name already exists'
    });
  }

  const gallery = await prisma.backgroundGallery.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null
    }
  });

  console.log('🖼️ [BACKGROUND-GALLERIES] Created gallery:', gallery.id);

  res.json({
    success: true,
    message: 'Background gallery created successfully',
    gallery: gallery
  });
}));

// Get specific gallery with images
router.get('/:id', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Get specific gallery called for ID:', req.params.id);
  
  const galleryId = parseInt(req.params.id);
  
  const gallery = await prisma.backgroundGallery.findUnique({
    where: { id: galleryId },
    include: {
      backgrounds: {
        orderBy: {
          updatedAt: 'desc'
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

  // Add image URLs
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const galleryWithUrls = {
    ...gallery,
    images: gallery.backgrounds.map(img => ({
      ...img,
      url: `${baseUrl}/api/backgrounds/${img.id}/image`,
      thumbnailUrl: img.thumbnailPath ? `${baseUrl}/api/backgrounds/${img.id}/thumbnail` : null
    }))
  };

  console.log(`🖼️ [BACKGROUND-GALLERIES] Found gallery with ${gallery.backgrounds.length} images`);

  res.json({
    success: true,
    gallery: galleryWithUrls
  });
}));

// Update gallery
router.put('/:id', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Update endpoint called for ID:', req.params.id);
  console.log('🖼️ [BACKGROUND-GALLERIES] Request body:', req.body);

  const galleryId = parseInt(req.params.id);
  const { name, description } = req.body;

  // Check if gallery exists
  const existingGallery = await prisma.backgroundGallery.findUnique({
    where: { id: galleryId }
  });

  if (!existingGallery) {
    return res.status(404).json({
      success: false,
      error: 'Gallery not found'
    });
  }

  // Check for duplicate names (excluding current gallery)
  if (name && name !== existingGallery.name) {
    const duplicateGallery = await prisma.backgroundGallery.findFirst({
      where: {
        name: name,
        id: {
          not: galleryId
        }
      }
    });

    if (duplicateGallery) {
      return res.status(400).json({
        success: false,
        error: 'A gallery with this name already exists'
      });
    }
  }

  // Prepare update data
  const updateData = {
    updatedAt: new Date()
  };

  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;

  const updatedGallery = await prisma.backgroundGallery.update({
    where: { id: galleryId },
    data: updateData
  });

  console.log('🖼️ [BACKGROUND-GALLERIES] Updated gallery:', galleryId);

  res.json({
    success: true,
    message: 'Gallery updated successfully',
    gallery: updatedGallery
  });
}));

// Delete gallery
router.delete('/:id', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Delete endpoint called for ID:', req.params.id);
  
  const galleryId = parseInt(req.params.id);
  
  // Check if gallery exists and get image count
  const gallery = await prisma.backgroundGallery.findUnique({
    where: { id: galleryId },
    include: {
      _count: {
        select: {
          backgrounds: true
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

  // Check if gallery has images
  if (gallery._count.backgrounds > 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot delete gallery with ${gallery._count.backgrounds} images. Remove all images first.`,
      imageCount: gallery._count.backgrounds
    });
  }

  // Delete the gallery
  await prisma.backgroundGallery.delete({
    where: { id: galleryId }
  });

  console.log('🖼️ [BACKGROUND-GALLERIES] Successfully deleted gallery:', galleryId);

  res.json({
    success: true,
    message: 'Gallery deleted successfully',
    deletedGallery: {
      id: gallery.id,
      name: gallery.name
    }
  });
}));

// Add image to gallery
router.post('/:id/images/:imageId', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Add image to gallery called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Gallery ID:', req.params.id, 'Image ID:', req.params.imageId);

  const galleryId = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);

  // Check if gallery exists
  const gallery = await prisma.backgroundGallery.findUnique({
    where: { id: galleryId }
  });

  if (!gallery) {
    return res.status(404).json({
      success: false,
      error: 'Gallery not found'
    });
  }

  // Check if image exists
  const image = await prisma.backgroundImage.findUnique({
    where: { id: imageId }
  });

  if (!image) {
    return res.status(404).json({
      success: false,
      error: 'Background image not found'
    });
  }

  // Check if image is already in gallery
  if (image.galleryId === galleryId) {
    return res.status(400).json({
      success: false,
      error: 'Image is already in this gallery'
    });
  }

  // Add image to gallery
  const updatedImage = await prisma.backgroundImage.update({
    where: { id: imageId },
    data: { galleryId: galleryId }
  });

  console.log('🖼️ [BACKGROUND-GALLERIES] Added image to gallery successfully');

  res.json({
    success: true,
    message: 'Image added to gallery successfully',
    image: updatedImage
  });
}));

// Remove image from gallery
router.delete('/:id/images/:imageId', asyncHandler(async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Remove image from gallery called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Gallery ID:', req.params.id, 'Image ID:', req.params.imageId);

  const galleryId = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);

  // Check if image exists and is in this gallery
  const image = await prisma.backgroundImage.findUnique({
    where: { id: imageId }
  });

  if (!image) {
    return res.status(404).json({
      success: false,
      error: 'Background image not found'
    });
  }

  if (image.galleryId !== galleryId) {
    return res.status(400).json({
      success: false,
      error: 'Image is not in this gallery'
    });
  }

  // Remove image from gallery
  const updatedImage = await prisma.backgroundImage.update({
    where: { id: imageId },
    data: { galleryId: null }
  });

  console.log('🖼️ [BACKGROUND-GALLERIES] Removed image from gallery successfully');

  res.json({
    success: true,
    message: 'Image removed from gallery successfully',
    image: updatedImage
  });
}));

module.exports = router;
