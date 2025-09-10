/**
 * Core Background Routes
 * Handles background images and gallery management
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { asyncHandler } = require('../../utils/responses');
const { validateRequiredFields } = require('../../middleware/validation');

// Configure multer for background uploads
const getUploadDirectory = (type) => {
  const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads', type);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadDirectory('backgrounds');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(file.originalname);
    cb(null, `bg-${timestamp}-${randomString}${extension}`);
  }
});

const backgroundUpload = multer({ 
  storage: backgroundStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Create background routes
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createBackgroundRoutes(prisma) {
  const router = express.Router();

  // Get all backgrounds
  router.get('/', asyncHandler(async (req, res) => {
    console.log('📸 [BACKGROUNDS] API endpoint called');
    console.log('📸 [BACKGROUNDS] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('📸 [BACKGROUNDS] DATABASE_URL:', process.env.DATABASE_URL);
    console.log('📸 [BACKGROUNDS] NODE_ENV:', process.env.NODE_ENV);
    
    console.log('📸 [BACKGROUNDS] Attempting to connect to database...');
    
    // Test database connection first
    await prisma.$connect();
    console.log('📸 [BACKGROUNDS] Database connection successful');
    
    // Check if BackgroundImage table exists (database-agnostic)
    console.log('📸 [BACKGROUNDS] Checking if BackgroundImage table exists...');
    const isPostgres = process.env.DATABASE_URL?.includes('postgresql://');
    let tableExists;
      
      if (isPostgres) {
        tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'BackgroundImage'
          );
        `;
        console.log('📸 [BACKGROUNDS] BackgroundImage table exists (PostgreSQL):', tableExists[0]?.exists || false);
      } else {
        tableExists = await prisma.$queryRaw`
          SELECT name FROM sqlite_master WHERE type='table' AND name='BackgroundImage';
        `;
        console.log('📸 [BACKGROUNDS] BackgroundImage table exists (SQLite):', tableExists.length > 0);
      }
      
      console.log('📸 [BACKGROUNDS] Attempting to query BackgroundImage table...');
      const backgrounds = await prisma.backgroundImage.findMany({
        include: {
          gallery: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('📸 [BACKGROUNDS] Query successful, found', backgrounds.length, 'backgrounds');
      console.log('📸 [BACKGROUNDS] Sample background:', backgrounds[0] ? JSON.stringify(backgrounds[0], null, 2) : 'None');
      
      res.json(backgrounds);
  }));

  // Upload backgrounds
  router.post('/upload', backgroundUpload.array('backgrounds'), async (req, res) => {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const uploaded = [];
      const errors = [];

      for (const file of files) {
        try {
          // Get image dimensions
          const sharp = require('sharp');
          const metadata = await sharp(file.path).metadata();

          const background = await prisma.backgroundImage.create({
            data: {
              filename: file.filename,
              originalName: file.originalname,
              path: file.path,
              mimetype: file.mimetype,
              size: file.size,
              width: metadata.width,
              height: metadata.height
            }
          });

          uploaded.push(background);
        } catch (error) {
          console.error('Error processing file:', file.originalname, error);
          errors.push(`Failed to process ${file.originalname}: ${error.message}`);
          
          // Clean up failed file
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            console.error('Error cleaning up file:', unlinkError);
          }
        }
      }

      res.json({ uploaded, errors });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload backgrounds' });
    }
  });

  // Get background image file
  router.get('/:id/image', async (req, res) => {
    try {
      const { id } = req.params;
      const background = await prisma.backgroundImage.findUnique({
        where: { id: parseInt(id) }
      });

      if (!background) {
        return res.status(404).json({ error: 'Background not found' });
      }

      if (!fs.existsSync(background.path)) {
        return res.status(404).json({ error: 'Background file not found on disk' });
      }

      res.setHeader('Content-Type', background.mimetype);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
      res.sendFile(path.resolve(background.path));
    } catch (error) {
      console.error('Error serving background image:', error);
      res.status(500).json({ error: 'Failed to serve background image' });
    }
  });

  // Delete background
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const background = await prisma.backgroundImage.findUnique({
        where: { id: parseInt(id) }
      });

      if (!background) {
        return res.status(404).json({ error: 'Background not found' });
      }

      // Delete from database (the gallery relationship will be handled by onDelete: SetNull)
      await prisma.backgroundImage.delete({
        where: { id: parseInt(id) }
      });

      // Delete file from disk
      try {
        if (fs.existsSync(background.path)) {
          fs.unlinkSync(background.path);
        }
      } catch (fileError) {
        console.error('Error deleting background file:', fileError);
        // Continue - file might already be deleted
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting background:', error);
      res.status(500).json({ error: 'Failed to delete background' });
    }
  });

  // Download background image from URL
  router.post('/download', async (req, res) => {
    console.log('📥 [BACKGROUND DOWNLOAD] Single image download requested');
    
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log('📥 [BACKGROUND DOWNLOAD] URL:', url);

      // First, detect if this is a gallery (e.g., imgur album)
      if (url.includes('imgur.com/a/') || url.includes('imgur.com/gallery/')) {
        console.log('📥 [BACKGROUND DOWNLOAD] Gallery detected, extracting images...');
        
        try {
          let galleryId;
          let images = [];
          let galleryTitle = '';
          let galleryDescription = '';
          
          if (url.includes('imgur.com/a/')) {
            // Direct album URL - extract ID and use API
            const galleryMatch = url.match(/imgur\.com\/a\/([a-zA-Z0-9]+)/);
            galleryId = galleryMatch ? galleryMatch[1] : null;
            
            if (!galleryId) {
              throw new Error('Invalid album URL format');
            }
            
            console.log('📥 [BACKGROUND DOWNLOAD] Using album API for ID:', galleryId);
            
            const imgurResponse = await fetch(`https://api.imgur.com/3/album/${galleryId}`, {
              headers: {
                'Authorization': 'Client-ID 546c25a59c58ad7'
              }
            });
            
            if (!imgurResponse.ok) {
              throw new Error(`Imgur API error: ${imgurResponse.status}`);
            }
            
            const imgurData = await imgurResponse.json();
            images = imgurData.data.images || [];
            galleryTitle = imgurData.data.title || 'Untitled Album';
            galleryDescription = imgurData.data.description || '';
            
          } else if (url.includes('imgur.com/gallery/')) {
            // Gallery URL - extract ID from URL directly
            console.log('📥 [BACKGROUND DOWNLOAD] Extracting gallery ID from URL...');
            
            // Extract gallery ID from URL pattern like /gallery/star-wars-wallpapers-W4lOh
            const urlPath = url.split('/gallery/')[1];
            if (!urlPath) {
              throw new Error('Invalid imgur gallery URL format');
            }
            
            // For URLs like "star-wars-wallpapers-W4lOh", the ID is "W4lOh"
            const parts = urlPath.split('-');
            galleryId = parts[parts.length - 1];
            
            console.log('📥 [BACKGROUND DOWNLOAD] Extracted gallery ID:', galleryId);
            
            // Try as album first (most common for galleries)
            const imgurResponse = await fetch(`https://api.imgur.com/3/album/${galleryId}`, {
              headers: {
                'Authorization': 'Client-ID 546c25a59c58ad7'
              }
            });
            
            if (!imgurResponse.ok) {
              throw new Error(`Imgur API error: ${imgurResponse.status}`);
            }
            
            const imgurData = await imgurResponse.json();
            images = imgurData.data.images || [];
            galleryTitle = imgurData.data.title || 'Untitled Gallery';
            galleryDescription = imgurData.data.description || '';
          }
          
          console.log('📥 [BACKGROUND DOWNLOAD] Found', images.length, 'images in gallery');
          
          return res.json({
            isGallery: true,
            galleryUrl: url,
            galleryTitle: galleryTitle,
            galleryDescription: galleryDescription,
            images: images.map((img, index) => ({
              id: img.id,
              url: img.link,
              title: img.title || `Image ${index + 1}`,
              description: img.description || '',
              width: img.width,
              height: img.height,
              size: img.size,
              type: img.type
            }))
          });
          
        } catch (error) {
          console.error('📥 [BACKGROUND DOWNLOAD] Gallery fetch error:', error);
          return res.status(500).json({ error: 'Failed to fetch gallery data' });
        }
      }
      
      // Single image download
      console.log('📥 [BACKGROUND DOWNLOAD] Downloading single image...');
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error('URL does not point to an image');
      }
      
      const buffer = await response.arrayBuffer();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = contentType.split('/')[1] || 'jpg';
      const filename = `bg-${timestamp}-${randomString}.${extension}`;
      
      const uploadDir = getUploadDirectory('backgrounds');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, Buffer.from(buffer));
      
      // Save to database
      const background = await prisma.backgroundImage.create({
        data: {
          filename,
          originalName: path.basename(url),
          path: filepath,
          mimetype: contentType,
          size: buffer.byteLength,
          url: url
        }
      });
      
      console.log('📥 [BACKGROUND DOWNLOAD] Successfully downloaded and saved:', filename);
      
      res.json({
        success: true,
        background: {
          id: background.id,
          filename: background.filename,
          originalName: background.originalName,
          url: background.url,
          size: background.size,
          mimetype: background.mimetype
        }
      });
      
    } catch (error) {
      console.error('📥 [BACKGROUND DOWNLOAD] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to download image' });
    }
  });

  // Bulk download from gallery
  router.post('/download-gallery-bulk', async (req, res) => {
    console.log('📥 [BULK DOWNLOAD] Gallery bulk download requested');
    
    try {
      const { url, galleryId, selectedImages } = req.body;
      
      if (!url || !selectedImages || !Array.isArray(selectedImages)) {
        return res.status(400).json({ error: 'URL and selectedImages array are required' });
      }
      
      console.log('📥 [BULK DOWNLOAD] Gallery URL:', url);
      console.log('📥 [BULK DOWNLOAD] Selected images:', selectedImages.length);
      
      // Extract gallery ID from URL - handle various imgur URL formats
      let imgurGalleryId;
      if (url.includes('imgur.com/a/')) {
        const galleryMatch = url.match(/imgur\.com\/a\/([a-zA-Z0-9\-_]+)/);
        imgurGalleryId = galleryMatch ? galleryMatch[1] : null;
      } else if (url.includes('imgur.com/gallery/')) {
        // Gallery URL - extract ID from URL directly
        console.log('📥 [BULK DOWNLOAD] Extracting gallery ID from URL...');
        
        const urlPath = url.split('/gallery/')[1];
        if (!urlPath) {
          console.log('📥 [BULK DOWNLOAD] Failed to extract gallery path from URL:', url);
          return res.status(400).json({ error: 'Invalid imgur gallery URL format' });
        }
        
        // For URLs like "star-wars-wallpapers-W4lOh", the ID is "W4lOh"
        const parts = urlPath.split('-');
        imgurGalleryId = parts[parts.length - 1];
      }
      
      if (!imgurGalleryId) {
        console.log('📥 [BULK DOWNLOAD] Failed to extract gallery ID from URL:', url);
        return res.status(400).json({ error: 'Invalid gallery URL format' });
      }
      
      console.log('📥 [BULK DOWNLOAD] Extracted gallery ID:', imgurGalleryId);
      
      // Fetch gallery data
      const imgurResponse = await fetch(`https://api.imgur.com/3/album/${imgurGalleryId}`, {
        headers: {
          'Authorization': 'Client-ID 546c25a59c58ad7'
        }
      });
      
      if (!imgurResponse.ok) {
        throw new Error('Failed to fetch gallery data');
      }
      
      const imgurData = await imgurResponse.json();
      const images = imgurData.data.images || [];
      
      let successCount = 0;
      let failedCount = 0;
      const results = [];
      
      // Create gallery if galleryId is provided
      let gallery = null;
      if (galleryId) {
        gallery = await prisma.backgroundGallery.findUnique({
          where: { id: parseInt(galleryId, 10) }
        });
      }
      
      // Download selected images
      for (const imageIndex of selectedImages) {
        if (imageIndex >= 0 && imageIndex < images.length) {
          const image = images[imageIndex];
          
          try {
            console.log('📥 [BULK DOWNLOAD] Downloading image:', image.link);
            
            // Add delay between requests to avoid rate limiting
            if (imageIndex > 0) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
            }
            
            // Make request with proper browser-like headers
            const response = await fetch(image.link, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': url,
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'same-site'
              }
            });
            
            if (!response.ok) {
              if (response.status === 429) {
                console.log('📥 [BULK DOWNLOAD] Rate limited, waiting 10 seconds and retrying...');
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                
                // Retry once with longer delay
                const retryResponse = await fetch(image.link, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Referer': url,
                    'Sec-Fetch-Dest': 'image',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Sec-Fetch-Site': 'same-site'
                  }
                });
                
                if (!retryResponse.ok) {
                  throw new Error(`HTTP ${retryResponse.status} (after retry)`);
                }
                
                // Use retry response for processing
                const buffer = await retryResponse.arrayBuffer();
                const timestamp = Date.now();
                const randomString = Math.random().toString(36).substring(2, 15);
                const extension = image.type?.split('/')[1] || 'jpg';
                const filename = `bg-${timestamp}-${randomString}.${extension}`;
                
                const uploadDir = getUploadDirectory('backgrounds');
                if (!fs.existsSync(uploadDir)) {
                  fs.mkdirSync(uploadDir, { recursive: true });
                }
                
                const filepath = path.join(uploadDir, filename);
                fs.writeFileSync(filepath, Buffer.from(buffer));
                
                // Save to database
                const background = await prisma.backgroundImage.create({
                  data: {
                    filename,
                    originalName: image.title || `Image ${imageIndex + 1}`,
                    path: filepath,
                    mimetype: image.type,
                    size: buffer.byteLength,
                    url: image.link,
                    width: image.width,
                    height: image.height,
                    galleryId: gallery?.id || null
                  }
                });
                
                results.push({
                  success: true,
                  imageIndex,
                  backgroundId: background.id,
                  filename: background.filename
                });
                
                successCount++;
                console.log('📥 [BULK DOWNLOAD] Successfully downloaded after retry:', filename);
              } else {
                throw new Error(`HTTP ${response.status}`);
              }
            } else {
              // Normal successful response
              const buffer = await response.arrayBuffer();
              const timestamp = Date.now();
              const randomString = Math.random().toString(36).substring(2, 15);
              const extension = image.type?.split('/')[1] || 'jpg';
              const filename = `bg-${timestamp}-${randomString}.${extension}`;
              
              const uploadDir = getUploadDirectory('backgrounds');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              
              const filepath = path.join(uploadDir, filename);
              fs.writeFileSync(filepath, Buffer.from(buffer));
              
              // Save to database
              const background = await prisma.backgroundImage.create({
                data: {
                  filename,
                  originalName: image.title || `Image ${imageIndex + 1}`,
                  path: filepath,
                  mimetype: image.type,
                  size: buffer.byteLength,
                  url: image.link,
                  width: image.width,
                  height: image.height,
                  galleryId: gallery?.id || null
                }
              });
              
              results.push({
                success: true,
                imageIndex,
                backgroundId: background.id,
                filename: background.filename
              });
              
              successCount++;
              console.log('📥 [BULK DOWNLOAD] Successfully downloaded:', filename);
            }
            
          } catch (error) {
            console.error('📥 [BULK DOWNLOAD] Failed to download image:', error);
            results.push({
              success: false,
              imageIndex,
              error: error.message
            });
            failedCount++;
          }
        }
      }
      
      console.log('📥 [BULK DOWNLOAD] Completed - Success:', successCount, 'Failed:', failedCount);
      
      res.json({
        success: true,
        successCount,
        failedCount,
        totalRequested: selectedImages.length,
        results
      });
      
    } catch (error) {
      console.error('📥 [BULK DOWNLOAD] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk download images' });
    }
  });

  console.log('Background routes module loaded');
  
  return router;
}

/**
 * Create background galleries routes
 * @param {PrismaClient} prisma - Database client instance  
 * @returns {express.Router} Configured router
 */
function createBackgroundGalleriesRoutes(prisma) {
  const router = express.Router();

  // Get all galleries  
  router.get('/', async (req, res) => {
    console.log('🖼️  [GALLERIES] API endpoint called');
    console.log('🖼️  [GALLERIES] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🖼️  [GALLERIES] DATABASE_URL:', process.env.DATABASE_URL);
    console.log('🖼️  [GALLERIES] NODE_ENV:', process.env.NODE_ENV);
    
    try {
      console.log('🖼️  [GALLERIES] Attempting to connect to database...');
      
      // Test database connection first
      await prisma.$connect();
      console.log('🖼️  [GALLERIES] Database connection successful');
      
      // Check if BackgroundGallery table exists (database-agnostic)
      console.log('🖼️  [GALLERIES] Checking if BackgroundGallery table exists...');
      const isPostgres = process.env.DATABASE_URL?.includes('postgresql://');
      let tableExists;
      
      if (isPostgres) {
        tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'BackgroundGallery'
          );
        `;
        console.log('🖼️  [GALLERIES] BackgroundGallery table exists (PostgreSQL):', tableExists[0]?.exists || false);
      } else {
        tableExists = await prisma.$queryRaw`
          SELECT name FROM sqlite_master WHERE type='table' AND name='BackgroundGallery';
        `;
        console.log('🖼️  [GALLERIES] BackgroundGallery table exists (SQLite):', tableExists.length > 0);
      }
      
      console.log('🖼️  [GALLERIES] Attempting to query BackgroundGallery table...');
      const galleries = await prisma.backgroundGallery.findMany({
        include: {
          _count: {
            select: { backgrounds: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log('🖼️  [GALLERIES] Query successful, found', galleries.length, 'galleries');
      console.log('🖼️  [GALLERIES] Sample gallery:', galleries[0] ? JSON.stringify(galleries[0], null, 2) : 'None');

      const galleriesWithCount = galleries.map(gallery => ({
        ...gallery,
        backgroundCount: gallery._count.backgrounds
      }));

      console.log('🖼️  [GALLERIES] Returning', galleriesWithCount.length, 'galleries with counts');
      res.json(galleriesWithCount);
    } catch (error) {
      console.error('❌ [GALLERIES] Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        meta: error.meta
      });
      res.status(500).json({ 
        error: 'Failed to fetch galleries',
        details: error.message,
        code: error.code 
      });
    }
  });

  // Create gallery
  router.post('/', async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Gallery name is required' });
      }

      const gallery = await prisma.backgroundGallery.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null
        }
      });

      res.json(gallery);
    } catch (error) {
      console.error('Error creating gallery:', error);
      res.status(500).json({ error: 'Failed to create gallery' });
    }
  });

  // Get gallery with backgrounds
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const gallery = await prisma.backgroundGallery.findUnique({
        where: { id: parseInt(id) },
        include: {
          backgrounds: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!gallery) {
        return res.status(404).json({ error: 'Gallery not found' });
      }

      res.json(gallery);
    } catch (error) {
      console.error('Error fetching gallery:', error);
      res.status(500).json({ error: 'Failed to fetch gallery' });
    }
  });

  // Update gallery
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Gallery name is required' });
      }

      const gallery = await prisma.backgroundGallery.update({
        where: { id: parseInt(id) },
        data: {
          name: name.trim(),
          description: description ? description.trim() : null
        }
      });

      res.json(gallery);
    } catch (error) {
      console.error('Error updating gallery:', error);
      res.status(500).json({ error: 'Failed to update gallery' });
    }
  });

  // Get backgrounds for a specific gallery
  router.get('/:id/backgrounds', async (req, res) => {
    try {
      const { id } = req.params;
      const gallery = await prisma.backgroundGallery.findUnique({
        where: { id: parseInt(id) },
        include: {
          backgrounds: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });

      if (!gallery) {
        return res.status(404).json({ error: 'Gallery not found' });
      }

      res.json(gallery.backgrounds);
    } catch (error) {
      console.error('Error fetching gallery backgrounds:', error);
      res.status(500).json({ error: 'Failed to fetch gallery backgrounds' });
    }
  });

  // Add backgrounds to gallery
  router.post('/:id/add-backgrounds', async (req, res) => {
    try {
      const { id } = req.params;
      const { backgroundIds } = req.body;

      if (!Array.isArray(backgroundIds) || backgroundIds.length === 0) {
        return res.status(400).json({ error: 'Background IDs array is required' });
      }

      const gallery = await prisma.backgroundGallery.findUnique({
        where: { id: parseInt(id) }
      });

      if (!gallery) {
        return res.status(404).json({ error: 'Gallery not found' });
      }

      // Update background images to belong to this gallery
      const updatedCount = await prisma.backgroundImage.updateMany({
        where: {
          id: { in: backgroundIds.map(id => parseInt(id)) },
          galleryId: null // Only update backgrounds not already in a gallery
        },
        data: {
          galleryId: parseInt(id)
        }
      });

      res.json({ success: true, addedCount: updatedCount.count });
    } catch (error) {
      console.error('Error adding backgrounds to gallery:', error);
      res.status(500).json({ error: 'Failed to add backgrounds to gallery' });
    }
  });

  // Remove backgrounds from gallery
  router.post('/:id/remove-backgrounds', async (req, res) => {
    try {
      const { id } = req.params;
      const { backgroundIds } = req.body;

      if (!Array.isArray(backgroundIds) || backgroundIds.length === 0) {
        return res.status(400).json({ error: 'Background IDs array is required' });
      }

      // Remove backgrounds from gallery by setting galleryId to null
      const updatedCount = await prisma.backgroundImage.updateMany({
        where: {
          id: { in: backgroundIds.map(id => parseInt(id)) },
          galleryId: parseInt(id)
        },
        data: {
          galleryId: null
        }
      });

      res.json({ success: true, removedCount: updatedCount.count });
    } catch (error) {
      console.error('Error removing backgrounds from gallery:', error);
      res.status(500).json({ error: 'Failed to remove backgrounds from gallery' });
    }
  });

  // Delete gallery
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // First remove all backgrounds from the gallery
      await prisma.backgroundImage.updateMany({
        where: { galleryId: parseInt(id) },
        data: { galleryId: null }
      });

      // Then delete the gallery
      await prisma.backgroundGallery.delete({
        where: { id: parseInt(id) }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting gallery:', error);
      res.status(500).json({ error: 'Failed to delete gallery' });
    }
  });

  console.log('🖼️ Background routes initialized');

  return router;
}

module.exports = createBackgroundRoutes;
