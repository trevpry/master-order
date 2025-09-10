/**
 * Artwork Routes
 * Part of Eddie Life Management - Artwork Management Module
 * 
 * Handles artwork caching, serving, and proxy functionality
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

// Import centralized utilities
const { asyncHandler } = require('../utils/responses');

// Use shared Prisma client and services
const prisma = require('../prismaClient');
const ArtworkCacheService = require('../artworkCacheService');
const artworkCache = new ArtworkCacheService();

// GET /api/artwork-cache/health - Check artwork cache health
router.get('/cache/health', asyncHandler(async (req, res) => {
  const items = await prisma.customOrderItem.findMany({
    where: {
      localArtworkPath: { not: null }
    },
    select: {
      id: true,
      title: true,
      localArtworkPath: true
    }
  });

  let validFiles = 0;
  let missingFiles = 0;
  const orphanedEntries = [];

  for (const item of items) {
    const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
      ? item.localArtworkPath.split(/[\\\/]/).pop() 
      : item.localArtworkPath;
    
    const filePath = artworkCache.getCachedFilePath(filename);
    
    try {
      await fs.access(filePath);
      validFiles++;
    } catch (error) {
      missingFiles++;
      orphanedEntries.push({
        id: item.id,
        title: item.title,
        missingFile: filename
      });
    }
  }

  res.json({
    success: true,
    summary: {
      totalTrackedFiles: items.length,
      validFiles,
      missingFiles,
      orphanedEntries
    }
  });
}));

// POST /api/artwork-cache/repair - Repair artwork cache
router.post('/cache/repair', asyncHandler(async (req, res) => {
  console.log('🔧 Manual artwork cache repair requested...');
  
  const items = await prisma.customOrderItem.findMany({
    where: {
      localArtworkPath: { not: null }
    },
    include: {
      storyContainedInBook: true
    }
  });

  let cleanedEntries = 0;
  let recachedItems = 0;

  for (const item of items) {
    const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
      ? item.localArtworkPath.split(/[\\\/]/).pop() 
      : item.localArtworkPath;
    
    const filePath = artworkCache.getCachedFilePath(filename);
    
    try {
      await fs.access(filePath);
      // File exists, no action needed
    } catch (error) {
      console.log(`🗑️ Cleaning orphaned entry for: ${item.title}`);
      
      // Clear the localArtworkPath since file doesn't exist
      await prisma.customOrderItem.update({
        where: { id: item.id },
        data: { localArtworkPath: null }
      });
      
      cleanedEntries++;
      
      // Try to re-cache artwork
      try {
        if (item.storyContainedInBook && item.storyContainedInBook.openLibraryWorkKey) {
          console.log(`🔄 Attempting to re-cache artwork for: ${item.title}`);
          
          const openLibraryService = require('../openLibraryService');
          const cachedPath = await openLibraryService.cacheBookCover(
            item.storyContainedInBook.openLibraryWorkKey,
            item.title
          );
          
          if (cachedPath) {
            await prisma.customOrderItem.update({
              where: { id: item.id },
              data: { localArtworkPath: cachedPath }
            });
            
            recachedItems++;
            console.log(`✅ Successfully re-cached artwork for: ${item.title}`);
          }
        }
      } catch (recacheError) {
        console.error(`❌ Failed to re-cache artwork for ${item.title}:`, recacheError.message);
      }
    }
  }

  console.log(`✅ Artwork cache repair completed: ${cleanedEntries} cleaned, ${recachedItems} re-cached`);

  res.json({
    success: true,
    summary: {
      cleanedEntries,
      recachedItems,
      message: `Repair completed: ${cleanedEntries} entries cleaned, ${recachedItems} items re-cached`
    }
  });
}));

// GET /api/artwork/:filename - Serve cached artwork files
router.get('/:filename', asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const filePath = artworkCache.getCachedFilePath(filename);
  
  // Check if file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    return res.status(404).send('Cached artwork not found');
  }
  
  // Get file stats and MIME type
  const extension = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  
  const mimeType = mimeMap[extension] || 'application/octet-stream';
  
  // Set headers
  res.set({
    'Content-Type': mimeType,
    'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
  });
  
  // Send file
  res.sendFile(filePath);
}));

// GET /api/artwork/* - Proxy artwork from Plex server
router.get('/*', asyncHandler(async (req, res) => {
  const artworkPath = req.params[0]; // Get everything after /api/artwork/
  
  // Get settings using cached database utility
  const { getSettings } = require('../databaseUtils');
  const settings = await getSettings();
  
  if (!settings || !settings.plexUrl || !settings.plexToken) {
    return res.status(500).send('Plex settings not configured');
  }
  
  const artworkUrl = `${settings.plexUrl}/${artworkPath}?X-Plex-Token=${settings.plexToken}`;
  
  const response = await axios.get(artworkUrl, {
    responseType: 'stream'
  });
  
  // Set appropriate headers
  res.set({
    'Content-Type': response.headers['content-type'],
    'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
  });
  
  // Pipe the image data
  response.data.pipe(res);
}));

module.exports = router;
