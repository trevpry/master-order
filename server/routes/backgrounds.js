const express = require('express');
const router = express.Router();
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const prisma = require('../prismaClient'); // Use shared singleton instance

// Helper function to determine upload directory based on environment
function getUploadDirectory(type = '') {
  const baseDir = process.env.UPLOAD_DIR || './uploads';
  return type ? path.join(baseDir, type) : baseDir;
}

// Configure multer for file uploads
const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadDirectory('backgrounds');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'bg-' + uniqueSuffix + ext);
  }
});

const backgroundUpload = multer({
  storage: backgroundStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all backgrounds
router.get('/', async (req, res) => {
  console.log('📸 [BACKGROUNDS] API endpoint called');
  
  try {
    const backgrounds = await prisma.backgroundImage.findMany({
      orderBy: {
        updatedAt: 'desc'
      }
    });

    console.log(`📸 [BACKGROUNDS] Found ${backgrounds.length} backgrounds`);

    // Add URLs for accessing the images
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const backgroundsWithUrls = backgrounds.map(bg => ({
      ...bg,
      url: `${baseUrl}/api/backgrounds/${bg.id}/image`,
      thumbnailUrl: bg.thumbnailPath ? `${baseUrl}/api/backgrounds/${bg.id}/thumbnail` : null
    }));

    res.json({
      success: true,
      backgrounds: backgroundsWithUrls,
      count: backgrounds.length
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Error fetching backgrounds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backgrounds',
      message: error.message
    });
  }
});

// Upload new backgrounds
router.post('/upload', backgroundUpload.array('backgrounds'), async (req, res) => {
  console.log('📸 [BACKGROUNDS] Upload endpoint called');
  console.log('📸 [BACKGROUNDS] Files uploaded:', req.files?.length || 0);
  console.log('📸 [BACKGROUNDS] Body:', req.body);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { tags } = req.body;
    const uploadedBackgrounds = [];

    for (const file of req.files) {
      console.log('📸 [BACKGROUNDS] Processing file:', file.filename);
      
      try {
        // Create database record
        const background = await prisma.backgroundImage.create({
          data: {
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            mimetype: file.mimetype,
            size: file.size
          }
        });

        console.log('📸 [BACKGROUNDS] Created database record:', background.id);
        uploadedBackgrounds.push(background);
      } catch (dbError) {
        console.error('📸 [BACKGROUNDS] Database error for file:', file.filename, dbError);
        // Clean up file if database insert failed
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('📸 [BACKGROUNDS] Failed to clean up file:', unlinkError);
        }
      }
    }

    console.log('📸 [BACKGROUNDS] Successfully uploaded:', uploadedBackgrounds.length, 'files');

    res.json({
      success: true,
      message: `Successfully uploaded ${uploadedBackgrounds.length} backgrounds`,
      backgrounds: uploadedBackgrounds,
      count: uploadedBackgrounds.length
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload backgrounds',
      message: error.message
    });
  }
});

// Get background image
router.get('/:id/image', async (req, res) => {
  try {
    const backgroundId = parseInt(req.params.id);
    
    const background = await prisma.backgroundImage.findUnique({
      where: { id: backgroundId }
    });

    if (!background) {
      return res.status(404).json({
        success: false,
        error: 'Background not found'
      });
    }

    // Check if file exists
    if (!fs.existsSync(background.path)) {
      console.error('📸 [BACKGROUNDS] File not found:', background.path);
      return res.status(404).json({
        success: false,
        error: 'Background file not found on disk'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', background.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file
    const stream = fs.createReadStream(background.path);
    stream.pipe(res);
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Error serving image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve background image',
      message: error.message
    });
  }
});

// Delete background
router.delete('/:id', async (req, res) => {
  console.log('📸 [BACKGROUNDS] Delete endpoint called for ID:', req.params.id);
  
  try {
    const backgroundId = parseInt(req.params.id);
    
    const background = await prisma.backgroundImage.findUnique({
      where: { id: backgroundId }
    });

    if (!background) {
      return res.status(404).json({
        success: false,
        error: 'Background not found'
      });
    }

    // Delete file from filesystem
    try {
      if (fs.existsSync(background.path)) {
        fs.unlinkSync(background.path);
        console.log('📸 [BACKGROUNDS] Deleted file:', background.path);
      }
    } catch (fileError) {
      console.warn('📸 [BACKGROUNDS] Failed to delete file:', fileError);
    }

    // Delete from database
    await prisma.backgroundImage.delete({
      where: { id: backgroundId }
    });

    console.log('📸 [BACKGROUNDS] Successfully deleted background:', backgroundId);

    res.json({
      success: true,
      message: 'Background deleted successfully',
      deletedBackground: background
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete background',
      message: error.message
    });
  }
});

// Download background from URL
router.post('/download', async (req, res) => {
  console.log('📸 [BACKGROUNDS] Download endpoint called');
  console.log('📸 [BACKGROUNDS] Request body:', req.body);

  try {
    const { url, tags, filename } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    console.log('📸 [BACKGROUNDS] Downloading from URL:', url);

    // Validate URL format
    let downloadUrl;
    try {
      downloadUrl = new URL(url);
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });

    if (!response.ok) {
      console.error('📸 [BACKGROUNDS] Failed to fetch image:', response.status, response.statusText);
      return res.status(400).json({
        success: false,
        error: `Failed to download image: ${response.status} ${response.statusText}`
      });
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        error: 'URL does not point to an image'
      });
    }

    // Generate filename
    const ext = path.extname(downloadUrl.pathname) || '.jpg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const generatedFilename = filename ? 
      `${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}_${uniqueSuffix}${ext}` : 
      `bg-downloaded-${uniqueSuffix}${ext}`;

    // Ensure upload directory exists
    const uploadDir = getUploadDirectory('backgrounds');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, generatedFilename);

    // Save the image
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);

    console.log('📸 [BACKGROUNDS] Image saved to:', filePath);
    console.log('📸 [BACKGROUNDS] File size:', buffer.length, 'bytes');

    // Create database record
    const background = await prisma.backgroundImage.create({
      data: {
        filename: generatedFilename,
        originalName: filename || downloadUrl.pathname.split('/').pop() || 'downloaded-image',
        path: filePath,
        mimetype: contentType,
        size: buffer.length
      }
    });

    console.log('📸 [BACKGROUNDS] Created database record:', background.id);

    res.json({
      success: true,
      message: 'Background downloaded successfully',
      background: background
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download background',
      message: error.message
    });
  }
});

// Bulk download backgrounds from gallery
router.post('/download-gallery-bulk', async (req, res) => {
  console.log('📸 [BACKGROUNDS] Bulk gallery download endpoint called');
  console.log('📸 [BACKGROUNDS] Request body:', req.body);

  try {
    const { galleryUrl, maxImages = 10, tags } = req.body;

    if (!galleryUrl) {
      return res.status(400).json({
        success: false,
        error: 'Gallery URL is required'
      });
    }

    console.log('📸 [BACKGROUNDS] Bulk downloading from gallery:', galleryUrl);

    // Fetch the gallery page
    const response = await fetch(galleryUrl, {
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: `Failed to fetch gallery: ${response.status} ${response.statusText}`
      });
    }

    const html = await response.text();

    // Extract image URLs from HTML (simple regex-based approach)
    const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const linkRegex = /<a[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["'][^>]*>/gi;
    
    const imageUrls = new Set();
    let match;

    // Extract from img tags
    while ((match = imageRegex.exec(html)) !== null) {
      const src = match[1];
      if (src.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        try {
          const fullUrl = new URL(src, galleryUrl).href;
          imageUrls.add(fullUrl);
        } catch (e) {
          // Skip invalid URLs
        }
      }
    }

    // Extract from links to images
    while ((match = linkRegex.exec(html)) !== null) {
      try {
        const fullUrl = new URL(match[1], galleryUrl).href;
        imageUrls.add(fullUrl);
      } catch (e) {
        // Skip invalid URLs
      }
    }

    const imageUrlArray = Array.from(imageUrls).slice(0, maxImages);
    console.log('📸 [BACKGROUNDS] Found', imageUrlArray.length, 'image URLs');

    if (imageUrlArray.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No images found in gallery'
      });
    }

    // Download images
    const downloadedBackgrounds = [];
    const errors = [];

    for (let i = 0; i < imageUrlArray.length; i++) {
      const imageUrl = imageUrlArray[i];
      console.log(`📸 [BACKGROUNDS] Downloading image ${i + 1}/${imageUrlArray.length}:`, imageUrl);

      try {
        const imageResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Eddie-Life-Management/1.0'
          }
        });

        if (!imageResponse.ok) {
          errors.push({ url: imageUrl, error: `HTTP ${imageResponse.status}` });
          continue;
        }

        const contentType = imageResponse.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
          errors.push({ url: imageUrl, error: 'Not an image' });
          continue;
        }

        // Generate filename
        const urlPath = new URL(imageUrl).pathname;
        const ext = path.extname(urlPath) || '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const generatedFilename = `bg-gallery-${i + 1}-${uniqueSuffix}${ext}`;

        // Ensure upload directory exists
        const uploadDir = getUploadDirectory('backgrounds');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, generatedFilename);

        // Save the image
        const buffer = await imageResponse.buffer();
        fs.writeFileSync(filePath, buffer);

        // Create database record
        const background = await prisma.backgroundImage.create({
          data: {
            filename: generatedFilename,
            originalName: `gallery-image-${i + 1}`,
            path: filePath,
            mimetype: contentType,
            size: buffer.length
          }
        });

        downloadedBackgrounds.push(background);
        console.log(`📸 [BACKGROUNDS] Successfully downloaded image ${i + 1}`);

      } catch (error) {
        console.error(`📸 [BACKGROUNDS] Error downloading image ${i + 1}:`, error);
        errors.push({ url: imageUrl, error: error.message });
      }
    }

    console.log('📸 [BACKGROUNDS] Bulk download complete:', downloadedBackgrounds.length, 'successful,', errors.length, 'errors');

    res.json({
      success: true,
      message: `Downloaded ${downloadedBackgrounds.length} images from gallery`,
      backgrounds: downloadedBackgrounds,
      errors: errors,
      stats: {
        total: imageUrlArray.length,
        successful: downloadedBackgrounds.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Bulk download error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk download from gallery',
      message: error.message
    });
  }
});

module.exports = router;
