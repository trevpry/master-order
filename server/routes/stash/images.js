const express = require('express');
const router = express.Router();
const axios = require('axios');
const { initializeStashSyncService, getActiveStashService } = require('./shared');

const prisma = require('../prismaClient'); // Use shared singleton instance

// GET /image-proxy/* - Proxy images from Stash server  
router.get('/image-proxy/*', async (req, res) => {
  try {
    const imagePath = req.params[0]; // Get everything after /api/stash/image-proxy/
    
    // Get settings using cached database utility
    const { getSettings } = require('../../databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.stashUrl) {
      return res.status(500).send('Stash settings not configured');
    }
    
    // Stash serves images through specific GraphQL endpoints or image endpoints
    // We need to extract the image ID from the database and use Stash's image serving API
    
    let imageUrl;
    
    // If the path is already a full HTTP URL, use it directly
    if (imagePath.startsWith('http')) {
      imageUrl = imagePath;
    } else {
      // For file paths, we need to find the image by path and get its ID from Stash
      // Then use Stash's image endpoint: /image/{imageId}/image
      
      // First, try to find the image ID from our database
      const image = await prisma.stashImage.findFirst({
        where: {
          OR: [
            { path: imagePath },
            { path: decodeURIComponent(imagePath) }
          ]
        }
      });
      
      if (image && image.id) {
        // Use Stash's image endpoint with the image ID
        // Normalize the URL to avoid double slashes
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/image/${image.id}/image`;
      } else {
        // Fallback: try to use the path directly (may not work for all cases)
        console.warn(`Could not find image ID for path: ${imagePath}, trying direct path`);
        
        // Remove leading slash if present and normalize base URL
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/${cleanPath}`;
      }
    }
    
    console.log(`Proxying Stash image: ${imageUrl}`);
    
    // Forward the request to Stash
    const proxyResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });
    
    // Set content type based on response
    const contentType = proxyResponse.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    
    // Add cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the image data to the response
    proxyResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error proxying Stash image:', error.message);
    res.status(500).send('Failed to proxy image from Stash');
  }
});

// GET /image/:id - Stash image proxy endpoint
router.get('/image/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`[Stash Image Proxy] Attempting to proxy image with ID: ${id}`);
    
    // Initialize services
    await initializeStashSyncService();
    const service = getActiveStashService();
    
    if (!service) {
      console.error('[Stash Image Proxy] No Stash service available');
      return res.status(503).json({ error: 'Stash service not available' });
    }
    
    // Check if it's a database ID or a Stash ID
    let stashImageId = id;
    
    // Try to find by database ID first
    if (!isNaN(id)) {
      const dbImage = await prisma.stashImage.findUnique({
        where: { id: parseInt(id) },
        select: { stashId: true }
      });
      
      if (dbImage && dbImage.stashId) {
        stashImageId = dbImage.stashId;
        console.log(`[Stash Image Proxy] Found Stash ID ${stashImageId} for database ID ${id}`);
      }
    }
    
    console.log(`[Stash Image Proxy] Using Stash ID: ${stashImageId}`);
    
    // Get Stash settings for the URL
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.stashUrl) {
      console.error('[Stash Image Proxy] No Stash URL configured');
      return res.status(500).json({ error: 'Stash URL not configured' });
    }
    
    const stashUrl = settings.stashUrl.replace(/\/$/, ''); // Remove trailing slash
    const imageUrl = `${stashUrl}/image/${stashImageId}`;
    
    console.log(`[Stash Image Proxy] Proxying from: ${imageUrl}`);
    
    // Make request to Stash
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      },
      timeout: 30000
    });
    
    // Set appropriate headers
    if (response.headers['content-type']) {
      res.set('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the response
    response.data.pipe(res);
    
    response.data.on('error', (error) => {
      console.error('[Stash Image Proxy] Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error' });
      }
    });
    
  } catch (error) {
    console.error('[Stash Image Proxy] Error:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'Cannot connect to Stash server' });
    } else if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Image not found' });
    } else if (error.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Stash server not found' });
    }
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to proxy image',
        message: error.message 
      });
    }
  }
});

// GET /images/random - Get a random image from all galleries
router.get('/random', async (req, res) => {
  try {
    // Get a random image from all galleries
    const totalImages = await prisma.stashImage.count();
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get a random offset
    const randomOffset = Math.floor(Math.random() * totalImages);
    
    const randomImage = await prisma.stashImage.findMany({
      skip: randomOffset,
      take: 1,
      include: {
        gallery: {
          select: {
            id: true,
            title: true,
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (randomImage.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No random image found' 
      });
    }
    
    const image = randomImage[0];
    
    res.json({
      success: true,
      data: {
        id: image.id,
        title: image.title,
        path: image.path,
        checksum: image.checksum,
        gallery: {
          id: image.gallery.id,
          title: image.gallery.title,
          performers: image.gallery.performers.map(p => p.performer)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching random image from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random image',
      message: error.message 
    });
  }
});

// GET /images/slideshow - Random images endpoint for slideshow
router.get('/slideshow', async (req, res) => {
  try {
    const { count = 10, includeGalleries = true, includeStandalone = true } = req.query;
    const requestedCount = Math.max(1, Math.min(parseInt(count), 100)); // Limit between 1 and 100
    
    // Build conditions based on what to include
    const conditions = [];
    
    if (includeGalleries === 'true' || includeGalleries === true) {
      // Include images from galleries
      conditions.push({ galleryId: { not: null } });
    }
    
    if (includeStandalone === 'true' || includeStandalone === true) {
      // Include standalone images
      conditions.push({ galleryId: null });
    }
    
    if (conditions.length === 0) {
      return res.status(400).json({ 
        error: 'Must include at least galleries or standalone images' 
      });
    }
    
    // Get total count of matching images
    const totalImages = await prisma.stashImage.count({
      where: {
        OR: conditions
      }
    });
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get random images
    const images = [];
    const usedOffsets = new Set();
    
    // Try to get the requested number of unique random images
    let attempts = 0;
    const maxAttempts = Math.min(requestedCount * 3, 200); // Avoid infinite loops
    
    while (images.length < requestedCount && attempts < maxAttempts) {
      const randomOffset = Math.floor(Math.random() * totalImages);
      
      if (!usedOffsets.has(randomOffset)) {
        usedOffsets.add(randomOffset);
        
        const randomImages = await prisma.stashImage.findMany({
          where: {
            OR: conditions
          },
          skip: randomOffset,
          take: 1,
          include: {
            gallery: {
              select: {
                id: true,
                title: true,
                performers: {
                  include: {
                    performer: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true
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
                name: true
              }
            }
          }
        });
        
        if (randomImages.length > 0) {
          images.push(randomImages[0]);
        }
      }
      
      attempts++;
    }
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      path: image.path,
      checksum: image.checksum,
      photographer: image.photographer,
      studio: image.studio,
      rating: image.rating,
      date: image.date,
      details: image.details,
      gallery: image.gallery ? {
        id: image.gallery.id,
        title: image.gallery.title,
        performers: image.gallery.performers.map(p => p.performer)
      } : null,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      meta: {
        requested: requestedCount,
        returned: images.length,
        totalAvailable: totalImages
      }
    });
  } catch (error) {
    console.error('Error fetching random images for slideshow:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random images for slideshow',
      message: error.message 
    });
  }
});

// GET /images - Standalone images endpoint
router.get('/', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '', sortBy = 'title', sortDirection = 'asc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter for standalone images (not part of any gallery)
    const searchFilter = {
      galleryId: null, // Only standalone images
      ...(filter ? {
        OR: [
          { title: { contains: filter, mode: 'insensitive' } },
          { code: { contains: filter, mode: 'insensitive' } },
          { details: { contains: filter, mode: 'insensitive' } },
          { photographer: { contains: filter, mode: 'insensitive' } },
          { studio: { contains: filter, mode: 'insensitive' } }
        ]
      } : {})
    };
    
    // Build sort order
    const orderBy = {};
    orderBy[sortBy] = sortDirection.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.stashImage.count({
      where: searchFilter
    });
    
    // Get standalone images with related data
    const images = await prisma.stashImage.findMany({
      where: searchFilter,
      include: {
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
      skip: skip,
      take: take,
      orderBy: orderBy
    });
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      date: image.date,
      details: image.details,
      photographer: image.photographer,
      url: image.url,
      rating: image.rating,
      organized: image.organized,
      studio: image.studio,
      path: image.path,
      checksum: image.checksum,
      fileModTime: image.fileModTime,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash standalone images from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash standalone images',
      message: error.message 
    });
  }
});

module.exports = router;
