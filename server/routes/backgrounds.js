const express = require('express');
const router = express.Router();
const multer = require('multer');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');

const prisma = require('../prismaClient'); // Use shared singleton instance

// Helper function to determine upload directory based on environment
function getUploadDirectory(type = '') {
  const baseDir = process.env.UPLOAD_DIR || './uploads';
  return type ? path.join(baseDir, type) : baseDir;
}

function sanitizeStoragePath(storagePath) {
  if (typeof storagePath !== 'string') return '';
  const trimmed = storagePath.trim();
  return trimmed;
}

function normalizeSlashes(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function parseUncPath(inputPath) {
  const normalized = normalizeSlashes(inputPath);
  const match = normalized.match(/^\/\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match) return null;

  return {
    server: match[1],
    share: match[2],
    rest: (match[3] || '').replace(/^\/+/, '')
  };
}

function applyUncMappings(inputPath) {
  const mappings = process.env.BACKGROUND_UNC_PATH_MAPPINGS;
  if (!mappings) return null;

  const normalizedInput = normalizeSlashes(inputPath);
  const mappingPairs = mappings
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean);

  for (const pair of mappingPairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;

    const uncPrefix = normalizeSlashes(pair.slice(0, separatorIndex).trim()).replace(/\/+$/, '');
    const targetPrefix = pair.slice(separatorIndex + 1).trim();
    if (!uncPrefix || !targetPrefix) continue;

    const inputLower = normalizedInput.toLowerCase();
    const prefixLower = uncPrefix.toLowerCase();
    if (inputLower === prefixLower || inputLower.startsWith(`${prefixLower}/`)) {
      const remainder = normalizedInput.slice(uncPrefix.length).replace(/^\/+/, '');
      return remainder ? path.join(targetPrefix, remainder) : targetPrefix;
    }
  }

  return null;
}

function resolveConfiguredStoragePath(configuredPath) {
  const rawPath = sanitizeStoragePath(configuredPath);
  if (!rawPath) return '';

  const unc = parseUncPath(rawPath);
  if (!unc) {
    return path.resolve(rawPath);
  }

  // UNC paths are directly usable on Windows hosts.
  if (process.platform === 'win32') {
    return path.resolve(rawPath);
  }

  // First priority: explicit mapping provided via environment variable.
  const mappedPath = applyUncMappings(rawPath);
  if (mappedPath) {
    return path.resolve(mappedPath);
  }

  // Unraid default heuristic: //tower/Media/... -> /mnt/user/Media/...
  const unraidServerName = (process.env.UNRAID_SERVER_NAME || 'tower').toLowerCase();
  if (unc.server.toLowerCase() === unraidServerName) {
    const unraidShareRoot = process.env.UNRAID_SHARE_ROOT || '/mnt/user';
    return path.resolve(path.join(unraidShareRoot, unc.share, unc.rest));
  }

  // Generic Linux fallback for externally mounted SMB shares.
  const uncMountRoot = process.env.UNC_MOUNT_ROOT || '/mnt/remotes';
  return path.resolve(path.join(uncMountRoot, unc.server, unc.share, unc.rest));
}

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.avif'].includes(ext);
}

async function getConfiguredBackgroundStoragePath() {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { backgroundImageStoragePath: true }
  });

  return sanitizeStoragePath(settings?.backgroundImageStoragePath);
}

async function getBackgroundUploadDirectory() {
  const configuredPath = await getConfiguredBackgroundStoragePath();
  if (configuredPath) {
    return resolveConfiguredStoragePath(configuredPath);
  }

  return path.resolve(getUploadDirectory('backgrounds'));
}

async function ensureBackgroundUploadDirectory() {
  const uploadDir = await getBackgroundUploadDirectory();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return uploadDir;
}

async function walkImageFilesRecursive(rootDir, maxFiles = 5000) {
  const files = [];

  async function walk(dir) {
    if (files.length >= maxFiles) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isImageFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

// Configure multer for file uploads
const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureBackgroundUploadDirectory()
      .then(uploadDir => cb(null, uploadDir))
      .catch(error => cb(error));
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
    const uploadDir = await ensureBackgroundUploadDirectory();

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
        const uploadDir = await ensureBackgroundUploadDirectory();

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

// Bulk import existing image files from configured background storage path
router.post('/import-from-storage', async (req, res) => {
  console.log('📸 [BACKGROUNDS] Bulk import from storage endpoint called');

  try {
    const { maxFiles = 2000 } = req.body || {};
    const configuredPath = await getConfiguredBackgroundStoragePath();

    if (!configuredPath) {
      return res.status(400).json({
        success: false,
        error: 'Background image storage path is not configured in Media Settings'
      });
    }

    const storagePath = resolveConfiguredStoragePath(configuredPath);
    if (!fs.existsSync(storagePath)) {
      return res.status(400).json({
        success: false,
        error: `Configured storage path does not exist: ${storagePath}`
      });
    }

    const discoveredFiles = await walkImageFilesRecursive(storagePath, Number(maxFiles) || 2000);

    if (discoveredFiles.length === 0) {
      return res.json({
        success: true,
        message: 'No image files found to import',
        stats: { scanned: 0, imported: 0, skipped: 0, failed: 0 },
        imported: [],
        errors: []
      });
    }

    const existingRecords = await prisma.backgroundImage.findMany({
      where: { path: { in: discoveredFiles } },
      select: { path: true }
    });

    const existingPaths = new Set(existingRecords.map(record => path.resolve(record.path)));
    const imported = [];
    const errors = [];
    let skipped = 0;

    for (const filePath of discoveredFiles) {
      const normalizedPath = path.resolve(filePath);
      if (existingPaths.has(normalizedPath)) {
        skipped += 1;
        continue;
      }

      try {
        const stats = await fsp.stat(normalizedPath);
        const ext = path.extname(normalizedPath).toLowerCase();
        const mimetype =
          ext === '.png' ? 'image/png' :
          ext === '.gif' ? 'image/gif' :
          ext === '.webp' ? 'image/webp' :
          ext === '.bmp' ? 'image/bmp' :
          ext === '.avif' ? 'image/avif' :
          ext === '.tif' || ext === '.tiff' ? 'image/tiff' :
          'image/jpeg';

        const created = await prisma.backgroundImage.create({
          data: {
            filename: path.basename(normalizedPath),
            originalName: path.basename(normalizedPath),
            path: normalizedPath,
            mimetype,
            size: stats.size
          }
        });

        imported.push(created);
      } catch (error) {
        errors.push({ filePath: normalizedPath, error: error.message });
      }
    }

    return res.json({
      success: true,
      message: `Imported ${imported.length} images from storage path`,
      stats: {
        scanned: discoveredFiles.length,
        imported: imported.length,
        skipped,
        failed: errors.length
      },
      imported,
      errors
    });
  } catch (error) {
    console.error('📸 [BACKGROUNDS] Import from storage error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to import backgrounds from storage path',
      message: error.message
    });
  }
});

module.exports = router;
