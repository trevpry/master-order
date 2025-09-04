const { PrismaClient } = require('@prisma/client');
const express = require('express');
const app = express();

// Initialize Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./master_order.db'
    }
  }
});

app.use(express.json());

const getAndroidApiBaseUrl = () => {
  const externalIp = process.env.EXTERNAL_IP;
  const PORT = process.env.PORT || 3001;
  return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
};

// Test Android endpoint with extensive error handling
app.get('/api/android/gallery/:galleryName/random-image', async (req, res) => {
  console.log('📱 Android app requesting random image from gallery...');
  
  try {
    console.log('Step 1: Extracting parameters');
    const { galleryName } = req.params;
    console.log('Gallery name:', galleryName);
    
    if (!galleryName) {
      console.log('Step 1 FAILED: Missing gallery name');
      return res.status(400).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Missing gallery name',
          message: 'Gallery name is required in the URL path',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log('Step 2: Querying database for gallery');
    // Find the gallery by name (exact match only)
    const gallery = await prisma.BackgroundGallery.findFirst({
      where: {
        name: galleryName
      },
      include: {
        backgrounds: true
      }
    });
    
    console.log('Gallery query result:', gallery ? 'Found' : 'Not found');
    if (gallery) {
      console.log('Gallery details:', {
        id: gallery.id,
        name: gallery.name,
        backgroundCount: gallery.backgrounds?.length || 0
      });
    }
    
    if (!gallery) {
      console.log('Step 2 FAILED: Gallery not found');
      return res.status(404).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Gallery not found',
          message: `Gallery "${galleryName}" does not exist`,
          galleryName: galleryName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!gallery.backgrounds || gallery.backgrounds.length === 0) {
      console.log('Step 2 FAILED: No images in gallery');
      return res.status(404).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'No images in gallery',
          message: `Gallery "${galleryName}" contains no images`,
          galleryName: galleryName,
          galleryId: gallery.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log('Step 3: Selecting random image');
    // Select random image from gallery
    const randomIndex = Math.floor(Math.random() * gallery.backgrounds.length);
    const randomImage = gallery.backgrounds[randomIndex];
    console.log('Random image selected:', {
      id: randomImage.id,
      filename: randomImage.filename,
      hasUrl: !!randomImage.url,
      hasPath: !!randomImage.path
    });
    
    console.log('Step 4: Generating image URL');
    // Generate image URL based on available data
    let imageUrl = null;
    const baseUrl = getAndroidApiBaseUrl();
    console.log('Base URL:', baseUrl);
    
    if (randomImage.url) {
      // Direct URL available
      imageUrl = randomImage.url;
      console.log('Using direct URL:', imageUrl);
    } else if (randomImage.path) {
      // Use path to construct URL (assuming it's relative to uploads/backgrounds)
      const path = require('path');
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename || path.basename(randomImage.path)}`;
      console.log('Using path-based URL:', imageUrl);
    } else if (randomImage.filename) {
      // Use filename to construct URL
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename}`;
      console.log('Using filename-based URL:', imageUrl);
    }
    
    console.log('Step 5: Building response');
    const androidResponse = {
      type: 'RANDOM_IMAGE_SUCCESS',
      data: {
        success: true,
        galleryName: gallery.name,
        galleryId: gallery.id,
        galleryDescription: gallery.description,
        image: {
          id: randomImage.id,
          filename: randomImage.filename,
          originalName: randomImage.originalName,
          url: imageUrl,
          width: randomImage.width,
          height: randomImage.height,
          size: randomImage.size,
          mimetype: randomImage.mimetype
        },
        totalImages: gallery.backgrounds.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('Step 6: Sending response');
    console.log('📱 Random gallery image response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android random gallery image endpoint:', error);
    console.error('Stack trace:', error.stack);
    
    const androidErrorResponse = {
      type: 'RANDOM_IMAGE_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🧪 Test server running on port ${PORT}`);
  console.log(`Test the endpoint: http://localhost:${PORT}/api/android/gallery/Star%20Warss/random-image`);
});

process.on('SIGINT', () => {
  console.log('\n🔌 Test server shutting down...');
  prisma.$disconnect();
  process.exit(0);
});
