const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance

// Get all background galleries
router.get('/', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] API endpoint called');
  
  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Error fetching galleries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch background galleries',
      message: error.message
    });
  }
});

// Create new background gallery
router.post('/', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Create endpoint called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Request body:', req.body);

  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Create error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create background gallery',
      message: error.message
    });
  }
});

// Get specific gallery with images
router.get('/:id', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Get specific gallery called for ID:', req.params.id);
  
  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Get specific gallery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery',
      message: error.message
    });
  }
});

// Update gallery
router.put('/:id', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Update endpoint called for ID:', req.params.id);
  console.log('🖼️ [BACKGROUND-GALLERIES] Request body:', req.body);

  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gallery',
      message: error.message
    });
  }
});

// Delete gallery
router.delete('/:id', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Delete endpoint called for ID:', req.params.id);
  
  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete gallery',
      message: error.message
    });
  }
});

// Add image to gallery
router.post('/:id/images/:imageId', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Add image to gallery called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Gallery ID:', req.params.id, 'Image ID:', req.params.imageId);

  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Add image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add image to gallery',
      message: error.message
    });
  }
});

// Remove image from gallery
router.delete('/:id/images/:imageId', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Remove image from gallery called');
  console.log('🖼️ [BACKGROUND-GALLERIES] Gallery ID:', req.params.id, 'Image ID:', req.params.imageId);

  try {
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
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Remove image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove image from gallery',
      message: error.message
    });
  }
});

// Get backgrounds for a specific gallery
router.get('/:id/backgrounds', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Get gallery backgrounds called for ID:', req.params.id);
  
  try {
    const galleryId = parseInt(req.params.id);
    
    const gallery = await prisma.backgroundGallery.findUnique({
      where: { id: galleryId },
      include: {
        backgrounds: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        error: 'Gallery not found'
      });
    }

    console.log(`🖼️ [BACKGROUND-GALLERIES] Found ${gallery.backgrounds.length} backgrounds`);

    res.json(gallery.backgrounds);
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Get gallery backgrounds error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gallery backgrounds',
      message: error.message
    });
  }
});

// Add backgrounds to gallery
router.post('/:id/add-backgrounds', async (req, res) => {
  console.log('🖼️ [BACKGROUND-GALLERIES] Add backgrounds called for ID:', req.params.id);
  console.log('🖼️ [BACKGROUND-GALLERIES] Request body:', req.body);
  
  try {
    const galleryId = parseInt(req.params.id);
    const { backgroundIds } = req.body;

    if (!Array.isArray(backgroundIds) || backgroundIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Background IDs array is required'
      });
    }

    const gallery = await prisma.backgroundGallery.findUnique({
      where: { id: galleryId }
    });

    if (!gallery) {
      return res.status(404).json({
        success: false,
        error: 'Gallery not found'
      });
    }

    // Update background images to belong to this gallery
    const updatedCount = await prisma.backgroundImage.updateMany({
      where: {
        id: { in: backgroundIds.map(id => parseInt(id)) },
        galleryId: null // Only update backgrounds not already in a gallery
      },
      data: {
        galleryId: galleryId
      }
    });

    console.log(`🖼️ [BACKGROUND-GALLERIES] Added ${updatedCount.count} backgrounds to gallery`);

    res.json({
      success: true,
      addedCount: updatedCount.count,
      message: `Added ${updatedCount.count} backgrounds to gallery`
    });
  } catch (error) {
    console.error('🖼️ [BACKGROUND-GALLERIES] Add backgrounds error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add backgrounds to gallery',
      message: error.message
    });
  }
});

module.exports = router;
