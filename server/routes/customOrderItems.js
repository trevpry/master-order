const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance
const { validateMediaTypeAndTitle, validateCustomOrderItem } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler, logError } = require('../utils/responses');
const { extractComicVineMetadata } = require('./customOrders/utilities/metadataExtractor');

// Utility functions
const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

const markCustomOrderItemAsWatched = async (itemId) => {
  return await prisma.customOrderItem.update({
    where: { id: itemId },
    data: { 
      isWatched: true,
      watchedAt: new Date()
    }
  });
};

// POST /api/custom-orders/:id/items - Add item to custom order
router.post('/:id/items', validateMediaTypeAndTitle, asyncHandler(async (req, res) => {
  console.log('🔍 Route handler started');
  
  const { id } = req.params;
  console.log('🔍 ID extracted:', id);
  
  const {
    mediaType,
    plexKey,
    title,
    seasonNumber,
    episodeNumber,
    seriesTitle,
    comicSeries,
    comicYear,
    comicIssue,
    comicVolume,
    comicPublisher,
    customTitle,
    comicVineId,
    comicVineDetailsJson,
    bookTitle,
    bookAuthor,
    bookYear,
    bookIsbn,
    bookPublisher,
    bookOpenLibraryId,
    bookCoverUrl,
    bookPageCount,
    storyTitle,
    storyAuthor,
    storyYear,
    storyUrl,
    storyContainedInBookId,
    storyCoverUrl,
    webTitle,
    webUrl,
    webDescription
  } = req.body;

  console.log('🔍 Destructuring completed');

  console.log('🔍 Full request body:', JSON.stringify(req.body, null, 2));
  console.log('🔍 MediaType:', mediaType);
  console.log('🔍 Title:', title);
  console.log('🔍 ComicSeries:', comicSeries);
  console.log('🔍 ComicIssue:', comicIssue);

  // Check for duplicates based on media type
  let existingItem;
  if (mediaType === 'episode') {
    // For episodes, check by series, season, and episode
    const whereCondition = {
      customOrderId: parseInt(id),
      mediaType: 'episode',
      seriesTitle: seriesTitle,
      seasonNumber: parseInt(seasonNumber),
      episodeNumber: parseInt(episodeNumber)
    };
    
    existingItem = await prisma.customOrderItem.findFirst({
      where: whereCondition
    });
  } else {
    // For other media with plexKey, check by plexKey
    existingItem = await prisma.customOrderItem.findFirst({
      where: {
        customOrderId: parseInt(id),
        plexKey: plexKey
      }
    });
  }
  
  if (existingItem) {
    return res.status(409).json({ 
      error: 'This item is already in the custom order',
      existingItem: {
        title: existingItem.title,
        mediaType: existingItem.mediaType
      }
    });
  }
    
    // Get the highest sort order for this custom order
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId: parseInt(id) },
      orderBy: { sortOrder: 'desc' }
    });
    
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;

    // Generate a unique plexKey for items without existing Plex keys
    let finalPlexKey;
    if (mediaType === 'comic') {
      finalPlexKey = `comic-${comicSeries}-${comicYear}-${comicIssue}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'book') {
      finalPlexKey = `book-${bookTitle}-${bookAuthor}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'shortstory') {
      const authorPart = storyAuthor ? `-${storyAuthor}` : '';
      finalPlexKey = `shortstory-${storyTitle}${authorPart}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'webvideo') {
      const urlHash = simpleHash(webUrl || ''); // Hash of the URL, ensure webUrl is not null
      const cleanWebTitle = (webTitle || title || 'untitled').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      finalPlexKey = `webvideo-${cleanWebTitle}-${urlHash}`;
      // Truncate if too long, ensuring it fits within typical database limits for such keys
      if (finalPlexKey.length > 250) { 
        finalPlexKey = finalPlexKey.substring(0, 250);
      }
    } else if (mediaType === 'episode' && !plexKey) {
      // Generate key for episodes not yet in Plex
      finalPlexKey = `tvdb-episode-${seriesTitle}-s${seasonNumber}e${episodeNumber}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'movie' && !plexKey) {
      // Generate key for movies not yet in Plex  
      const yearPart = bookYear ? `-${bookYear}` : ''; // Using bookYear as it's the year field available
      finalPlexKey = `tvdb-movie-${title}${yearPart}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else {
      finalPlexKey = plexKey;
    }

    // Handle OpenLibrary integration for books
    let finalBookData = {
      bookTitle,
      bookAuthor,
      bookYear: bookYear ? parseInt(bookYear) : null,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount: bookPageCount ? parseInt(bookPageCount) : null
    };

    // Parse ComicVine details if provided
    let comicVineDetails = null;
    let extractedMetadata = {};
    if (comicVineDetailsJson) {
      try {
        comicVineDetails = JSON.parse(comicVineDetailsJson);
        
        // Extract metadata from ComicVine details for comics
        if (mediaType === 'comic') {
          extractedMetadata = extractComicVineMetadata(comicVineDetailsJson);
          console.log('📚 Extracted ComicVine metadata:', extractedMetadata);
        }
      } catch (parseError) {
        console.warn('Failed to parse ComicVine details JSON:', parseError);
      }
    }

    // Create the custom order item
    const customOrderItem = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType: mediaType,
        title: customTitle || title,
        plexKey: finalPlexKey,
        sortOrder: nextSortOrder,
        // TV Show specific fields
        seriesTitle: seriesTitle,
        seasonNumber: seasonNumber ? parseInt(seasonNumber) : null,
        episodeNumber: episodeNumber ? parseInt(episodeNumber) : null,
        // Comic specific fields
        comicSeries: comicSeries,
        comicYear: comicYear ? parseInt(comicYear) : null,
        comicIssue: comicIssue,
        comicVolume: comicVolume,
        comicPublisher: comicPublisher,
        comicVineId: comicVineId,
        comicVineDetailsJson: comicVineDetails ? JSON.stringify(comicVineDetails) : null,
        // Add extracted ComicVine metadata fields
        ...extractedMetadata,
        // Book specific fields  
        ...finalBookData,
        // Short story specific fields
        storyTitle: storyTitle,
        storyAuthor: storyAuthor,
        storyYear: storyYear ? parseInt(storyYear) : null,
        storyUrl: storyUrl,
        storyContainedInBookId: storyContainedInBookId ? parseInt(storyContainedInBookId) : null,
        storyCoverUrl: storyCoverUrl,
        // Web video specific fields
        webTitle: webTitle,
        webUrl: webUrl,
        webDescription: webDescription
      },
      include: {
        customOrder: true
      }
    });

  console.log(`✅ Added ${mediaType} "${customOrderItem.title}" to custom order "${customOrderItem.customOrder.name}"`);
  res.status(201).json(customOrderItem);
}));

// DELETE /api/custom-orders/:id/items/:itemId - Remove item from custom order
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    
    await prisma.customOrderItem.delete({
      where: {
        id: parseInt(itemId),
        customOrderId: parseInt(id)
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing item from custom order:', error);
    res.status(500).json({ error: 'Failed to remove item from custom order' });
  }
});

// PUT /api/custom-orders/:id/items/:itemId - Update custom order item
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const updateData = req.body;
    
    // Handle nested JSON data parsing
    if (updateData.comicVineDetailsJson && typeof updateData.comicVineDetailsJson === 'string') {
      try {
        const parsedDetails = JSON.parse(updateData.comicVineDetailsJson);
        updateData.comicVineDetailsJson = JSON.stringify(parsedDetails);
        
        // Extract metadata from ComicVine details for comics
        const extractedMetadata = extractComicVineMetadata(updateData.comicVineDetailsJson);
        console.log('📚 Extracted ComicVine metadata during update:', extractedMetadata);
        
        // Merge extracted metadata into update data
        Object.assign(updateData, extractedMetadata);
      } catch (parseError) {
        console.warn('Failed to parse ComicVine details JSON in update:', parseError);
        updateData.comicVineDetailsJson = null;
      }
    }
    
    // Convert string numbers to integers for specific fields
    const intFields = ['seasonNumber', 'episodeNumber', 'comicYear', 'bookYear', 'storyYear', 'bookPageCount', 'storyContainedInBookId'];
    intFields.forEach(field => {
      if (updateData[field] && typeof updateData[field] === 'string') {
        updateData[field] = parseInt(updateData[field]);
      }
    });

    // Check if this update sets reading completion to 100% and auto-mark as watched
    if (updateData.bookPercentRead === 100 || 
        (updateData.bookCurrentPage && updateData.bookPageCount && updateData.bookCurrentPage >= updateData.bookPageCount)) {
      
      // Get the current item to check media type
      const currentItem = await prisma.customOrderItem.findUnique({
        where: { id: parseInt(itemId) }
      });
      
      if (currentItem && (currentItem.mediaType === 'book' || currentItem.mediaType === 'comic' || currentItem.mediaType === 'shortstory')) {
        updateData.isWatched = true;
        console.log(`Setting ${currentItem.mediaType} "${currentItem.title}" as watched (100% completion)`);
      }
    }
    
    const updatedItem = await prisma.customOrderItem.update({
      where: {
        id: parseInt(itemId),
        customOrderId: parseInt(id)
      },
      data: updateData,
      include: {
        customOrder: true
      }
    });
    
    console.log(`✅ Updated custom order item "${updatedItem.title}"`);
    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating custom order item:', error);
    res.status(500).json({ error: 'Failed to update custom order item' });
  }
});

module.exports = router;
