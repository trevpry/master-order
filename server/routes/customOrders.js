const express = require('express');
const { PrismaClient } = require('@prisma/client');
const subOrderService = require('../subOrderService');

// Import required services
let artworkCache = null;
let watchLogService = null;
try {
  const ArtworkCacheService = require('../artworkCacheService');
  const WatchLogService = require('../watchLogService');
  artworkCache = new ArtworkCacheService();
  watchLogService = new WatchLogService(new PrismaClient());
} catch (error) {
  console.warn('Required services not available in custom orders routes:', error.message);
}

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Extract individual metadata fields from ComicVine details JSON
 * @param {string} comicVineDetailsJson - The JSON string containing ComicVine data
 * @returns {object} Extracted metadata fields
 */
function extractComicVineMetadata(comicVineDetailsJson) {
  if (!comicVineDetailsJson) return {};
  
  try {
    const data = JSON.parse(comicVineDetailsJson);
    const extracted = {};
    
    // Extract series metadata
    if (data.series) {
      if (data.series.id) extracted.comicVineSeriesId = parseInt(data.series.id);
      if (data.series.publisher?.name) extracted.comicPublisher = data.series.publisher.name;
    }
    
    // Extract issue metadata
    if (data.issue) {
      if (data.issue.id) extracted.comicVineIssueId = parseInt(data.issue.id);
      if (data.issue.name) extracted.comicIssueName = data.issue.name;
      if (data.issue.description) extracted.comicDescription = data.issue.description;
      if (data.issue.cover_date) extracted.comicCoverDate = data.issue.cover_date;
      if (data.issue.store_date) extracted.comicStoreDate = data.issue.store_date;
    }
    
    console.log('Extracted ComicVine metadata:', extracted);
    return extracted;
  } catch (error) {
    console.warn('Failed to extract ComicVine metadata:', error.message);
    return {};
  }
}

// Get a single custom order item by ID
router.get('/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const customOrderItem = await prisma.customOrderItem.findUnique({
      where: { id: parseInt(itemId) },
      include: {
        storyContainedInBook: true,
        containedStories: true,
        referencedCustomOrder: true,
        customOrder: {
          include: {
            plexPlaylist: true,
            customPlaylist: {
              include: {
                _count: {
                  select: { tracks: true }
                }
              }
            }
          }
        }
      }
    });
    
    if (!customOrderItem) {
      return res.status(404).json({ error: 'Custom order item not found' });
    }
    
    // Transform the response to include trackCount for custom playlists
    if (customOrderItem.customOrder?.customPlaylist) {
      customOrderItem.customOrder.customPlaylist.trackCount = 
        customOrderItem.customOrder.customPlaylist._count?.tracks || 0;
    }
    
    res.json(customOrderItem);
  } catch (error) {
    console.error('Error fetching custom order item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all custom orders
router.get('/', async (req, res) => {
  try {
    const customOrders = await prisma.customOrder.findMany({
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        parentOrder: true,
        plexPlaylist: true,
        customPlaylist: {
          include: {
            _count: {
              select: { tracks: true }
            }
          }
        },
        backgroundGallery: true,
        subOrders: {
          include: {
            items: {
              include: {
                storyContainedInBook: true,
                containedStories: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Sync sub-order items for all parent orders (ensure consistency)
    for (const order of customOrders) {
      if (order.subOrders.length > 0) {
        await subOrderService.syncSubOrderItems(order.id);
      }
      
      // Transform custom playlist to include trackCount
      if (order.customPlaylist) {
        order.customPlaylist.trackCount = order.customPlaylist._count?.tracks || 0;
      }
    }
    
    res.json(customOrders);
  } catch (error) {
    console.error('Error fetching custom orders:', error);
    res.status(500).json({ error: 'Failed to fetch custom orders' });
  }
});

// Create a new custom order
router.post('/', async (req, res) => {
  try {
    const { name, description, icon, parentOrderId, playlistRatingKey, customPlaylistId, backgroundGalleryId } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Custom order name is required' });
    }
    
    // Validate parent order exists if specified
    if (parentOrderId) {
      const parentOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(parentOrderId) }
      });
      if (!parentOrder) {
        return res.status(400).json({ error: 'Parent custom order not found' });
      }
    }
    
    // Validate playlist exists if specified
    if (playlistRatingKey) {
      const playlist = await prisma.plexPlaylist.findUnique({
        where: { ratingKey: playlistRatingKey }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Plex playlist not found' });
      }
    }
    
    if (customPlaylistId) {
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: parseInt(customPlaylistId) }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Custom playlist not found' });
      }
    }

    // Validate background gallery exists if specified
    if (backgroundGalleryId) {
      const gallery = await prisma.BackgroundGallery.findUnique({
        where: { id: parseInt(backgroundGalleryId) }
      });
      if (!gallery) {
        return res.status(400).json({ error: 'Background gallery not found' });
      }
    }
    
    const customOrder = await prisma.customOrder.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        parentOrderId: parentOrderId ? parseInt(parentOrderId) : null,
        playlistRatingKey: playlistRatingKey?.trim() || null,
        customPlaylistId: customPlaylistId ? parseInt(customPlaylistId) : null,
        backgroundGalleryId: backgroundGalleryId ? parseInt(backgroundGalleryId) : null
      },
      include: {
        parentOrder: true,
        subOrders: true,
        plexPlaylist: true,
        customPlaylist: true,
        backgroundGallery: true
      }
    });
    
    // If this order has a parent, create a sub-order item in the parent
    if (parentOrderId) {
      await subOrderService.createSubOrderItems(customOrder.id, parseInt(parentOrderId));
    }
    
    res.status(201).json(customOrder);
  } catch (error) {
    console.error('Error creating custom order:', error);
    res.status(500).json({ error: 'Failed to create custom order' });
  }
});

// Get count of custom orders (must come before :id route)
router.get('/count', async (req, res) => {
  try {
    const count = await prisma.customOrder.count();
    res.json({ count });
  } catch (error) {
    console.error('Error counting custom orders:', error);
    res.status(500).json({ error: 'Failed to count custom orders' });
  }
});

// Get available parent orders (excluding sub-orders and the specified order itself)
router.get('/available-parents/:excludeId?', async (req, res) => {
  try {
    const { excludeId } = req.params;
    
    const whereCondition = {
      parentOrderId: null // Only top-level orders can be parents
    };
    
    // Exclude the specified order if provided (prevent self-reference)
    if (excludeId) {
      whereCondition.id = { not: parseInt(excludeId) };
    }
    
    const availableParents = await prisma.customOrder.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(availableParents);
  } catch (error) {
    console.error('Error fetching available parent orders:', error);
    res.status(500).json({ error: 'Failed to fetch available parent orders' });
  }
});

// Get a specific custom order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customOrder = await prisma.customOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        plexPlaylist: true,
        customPlaylist: true,
        backgroundGallery: true
      }
    });
    
    if (!customOrder) {
      return res.status(404).json({ error: 'Custom order not found' });
    }
    
    // Sync sub-order items if this is a parent order
    const hasSubOrders = await prisma.customOrder.count({
      where: { parentOrderId: parseInt(id) }
    });
    
    if (hasSubOrders > 0) {
      await subOrderService.syncSubOrderItems(parseInt(id));
      
      // Re-fetch the order with updated sub-order items
      const updatedOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: {
              storyContainedInBook: true,
              containedStories: true,
              referencedCustomOrder: true
            },
            orderBy: { sortOrder: 'asc' }
          },
          backgroundGallery: true
        }
      });
      
      res.json(updatedOrder);
    } else {
      res.json(customOrder);
    }
  } catch (error) {
    console.error('Error fetching custom order:', error);
    res.status(500).json({ error: 'Failed to fetch custom order' });
  }
});

// Update a custom order
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, icon, parentOrderId, playlistRatingKey, customPlaylistId, backgroundGalleryId } = req.body;
    
    // Get current order to check for parent changes
    const currentOrder = await prisma.customOrder.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentOrder) {
      return res.status(404).json({ error: 'Custom order not found' });
    }
    
    // Validate parent order exists if specified
    if (parentOrderId !== undefined && parentOrderId !== null) {
      // Prevent circular references
      if (parseInt(parentOrderId) === parseInt(id)) {
        return res.status(400).json({ error: 'A custom order cannot be its own parent' });
      }
      
      const parentOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(parentOrderId) }
      });
      if (!parentOrder) {
        return res.status(400).json({ error: 'Parent custom order not found' });
      }
      
      // Check for circular reference (if parent has this order as its parent)
      if (parentOrder.parentOrderId === parseInt(id)) {
        return res.status(400).json({ error: 'Cannot create circular parent-child relationship' });
      }
    }
    
    // Validate playlist exists if specified
    if (playlistRatingKey !== undefined && playlistRatingKey !== null) {
      const playlist = await prisma.plexPlaylist.findUnique({
        where: { ratingKey: playlistRatingKey }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Plex playlist not found' });
      }
    }
    
    if (customPlaylistId !== undefined && customPlaylistId !== null) {
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: parseInt(customPlaylistId) }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Custom playlist not found' });
      }
    }

    // Validate background gallery exists if specified
    if (backgroundGalleryId !== undefined && backgroundGalleryId !== null) {
      const gallery = await prisma.BackgroundGallery.findUnique({
        where: { id: parseInt(backgroundGalleryId) }
      });
      if (!gallery) {
        return res.status(400).json({ error: 'Background gallery not found' });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (icon !== undefined) updateData.icon = icon?.trim() || null;
    if (parentOrderId !== undefined) updateData.parentOrderId = parentOrderId ? parseInt(parentOrderId) : null;
    if (playlistRatingKey !== undefined) updateData.playlistRatingKey = playlistRatingKey?.trim() || null;
    if (customPlaylistId !== undefined) updateData.customPlaylistId = customPlaylistId ? parseInt(customPlaylistId) : null;
    if (backgroundGalleryId !== undefined) updateData.backgroundGalleryId = backgroundGalleryId ? parseInt(backgroundGalleryId) : null;

    const customOrder = await prisma.customOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        parentOrder: true,
        plexPlaylist: true,
        customPlaylist: true,
        backgroundGallery: true,
        subOrders: {
          include: {
            items: {
              include: {
                storyContainedInBook: true,
                containedStories: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
    
    // Handle parent order changes
    const oldParentId = currentOrder.parentOrderId;
    const newParentId = parentOrderId !== undefined ? (parentOrderId ? parseInt(parentOrderId) : null) : oldParentId;
    
    if (oldParentId !== newParentId) {
      // Remove from old parent if it had one
      if (oldParentId) {
        await subOrderService.removeSubOrderItems(parseInt(id));
      }
      
      // Add to new parent if it has one
      if (newParentId) {
        await subOrderService.createSubOrderItems(parseInt(id), newParentId);
      }
    } else if (newParentId) {
      // If parent didn't change but we have a parent, update the sub-order item
      await subOrderService.updateSubOrderItems(parseInt(id));
    }
    
    res.json(customOrder);
  } catch (error) {
    console.error('Error updating custom order:', error);
    res.status(500).json({ error: 'Failed to update custom order' });
  }
});

// Delete a custom order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Remove any sub-order items that reference this order
    await subOrderService.removeSubOrderItems(parseInt(id));
    
    await prisma.customOrder.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Custom order deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom order:', error);
    res.status(500).json({ error: 'Failed to delete custom order' });
  }
});

// Add item to custom order
router.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
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
      comicCoverUrl,
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

    console.log(mediaType);
    
    if (!mediaType || !title) {
      return res.status(400).json({ error: 'mediaType and title are required' });
    }
    
    // Validate media-specific requirements
    if (mediaType === 'comic') {
      if (!comicSeries || !comicIssue) {
        return res.status(400).json({ error: 'For comics: comicSeries and comicIssue are required' });
      }
    } else if (mediaType === 'book') {
      if (!bookTitle || !bookAuthor) {
        return res.status(400).json({ error: 'For books: bookTitle and bookAuthor are required' });
      }
    } else if (mediaType === 'shortstory') {
      console.log(req.body);
      if (!storyTitle) {
        return res.status(400).json({ error: 'For short stories: storyTitle is required' });
      }
    } else if (mediaType === 'webvideo') {
      if (!webTitle || !webUrl) {
        return res.status(400).json({ error: 'For web videos: webTitle and webUrl are required' });
      }
      // Validate URL format
      try {
        new URL(webUrl);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid webUrl format' });
      }
    } else if (mediaType === 'episode') {
      // For TV episodes, either plexKey OR (seriesTitle + seasonNumber + episodeNumber) required
      if (!plexKey && (!seriesTitle || seasonNumber === undefined || episodeNumber === undefined)) {
        return res.status(400).json({ 
          error: 'For episodes: either plexKey (for existing Plex episodes) OR seriesTitle, seasonNumber, and episodeNumber (for episodes not yet in Plex) are required' 
        });
      }
    } else if (mediaType === 'movie') {
      // For movies, either plexKey OR title is required (title alone allows for movies not yet in Plex)
      if (!plexKey && !title) {
        return res.status(400).json({ 
          error: 'For movies: either plexKey (for existing Plex movies) OR title (for movies not yet in Plex) is required' 
        });
      }
    } else {
      // For other media types, plexKey is still required
      if (!plexKey) {
        return res.status(400).json({ error: 'plexKey is required for this media type' });
      }
    }

    // Check for duplicate items
    let existingItem;
    
    if (mediaType === 'comic') {
      // For comics, check for duplicates by series, year, issue, and main title
      // This allows the same comic to be added multiple times with different titles
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'comic',
          comicSeries: comicSeries,
          comicYear: comicYear ? parseInt(comicYear) : null,
          comicIssue: comicIssue ? String(comicIssue) : null,
          title: title // Include title to allow same comic with different custom titles
        }
      });
    } else if (mediaType === 'book') {
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'book',
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          bookYear: bookYear ? parseInt(bookYear) : null
        }
      });
    } else if (mediaType === 'shortstory') {
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'shortstory',
          storyTitle: storyTitle,
          storyAuthor: storyAuthor,
          storyContainedInBookId: storyContainedInBookId ? parseInt(storyContainedInBookId) : null
        }
      });
    } else if (mediaType === 'webvideo') {
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'webvideo',
          webUrl: webUrl
        }
      });
    } else {
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: mediaType,
          plexKey: plexKey || null,
          title: title,
          seriesTitle: seriesTitle || null,
          seasonNumber: seasonNumber !== undefined ? parseInt(seasonNumber) : null,
          episodeNumber: episodeNumber !== undefined ? parseInt(episodeNumber) : null
        }
      });
    }

    if (existingItem) {
      return res.status(409).json({ error: 'This item is already in the custom order' });
    }

    // Get the next sort order
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId: parseInt(id) },
      orderBy: { sortOrder: 'desc' }
    });
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;

    // Extract ComicVine metadata if available
    const comicVineMetadata = extractComicVineMetadata(comicVineDetailsJson);

    // Create the item
    const item = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType,
        plexKey: plexKey || null,
        title,
        seasonNumber: seasonNumber !== undefined ? parseInt(seasonNumber) : null,
        episodeNumber: episodeNumber !== undefined ? parseInt(episodeNumber) : null,
        seriesTitle: seriesTitle || null,
        sortOrder: nextSortOrder,
        // Comic fields (merge provided fields with extracted ComicVine metadata)
        comicSeries: comicSeries || null,
        comicYear: comicYear ? parseInt(comicYear) : null,
        comicIssue: comicIssue ? String(comicIssue) : null,
        comicVolume: comicVolume || null,
        comicPublisher: comicPublisher || comicVineMetadata.comicPublisher || null,
        customTitle: customTitle || null,
        comicVineId: comicVineId ? parseInt(comicVineId) : null,
        comicVineDetailsJson: comicVineDetailsJson || null,
        originalArtworkUrl: comicCoverUrl || null,
        // ComicVine extracted metadata
        comicVineSeriesId: comicVineMetadata.comicVineSeriesId || null,
        comicVineIssueId: comicVineMetadata.comicVineIssueId || null,
        comicIssueName: comicVineMetadata.comicIssueName || null,
        comicDescription: comicVineMetadata.comicDescription || null,
        comicCoverDate: comicVineMetadata.comicCoverDate || null,
        comicStoreDate: comicVineMetadata.comicStoreDate || null,
        // Book fields
        bookTitle: bookTitle || null,
        bookAuthor: bookAuthor || null,
        bookYear: bookYear ? parseInt(bookYear) : null,
        bookIsbn: bookIsbn || null,
        bookPublisher: bookPublisher || null,
        bookOpenLibraryId: bookOpenLibraryId || null,
        bookCoverUrl: bookCoverUrl || null,
        bookPageCount: bookPageCount ? parseInt(bookPageCount) : null,
        // Story fields
        storyTitle: storyTitle || null,
        storyAuthor: storyAuthor || null,
        storyYear: storyYear ? parseInt(storyYear) : null,
        storyUrl: storyUrl || null,
        storyContainedInBookId: storyContainedInBookId ? parseInt(storyContainedInBookId) : null,
        storyCoverUrl: storyCoverUrl || null,
        // Web video fields
        webTitle: webTitle || null,
        webUrl: webUrl || null,
        webDescription: webDescription || null
      }
    });

    // After creation, try to update with TVDB data if applicable
    if (mediaType === 'episode' || mediaType === 'movie') {
      try {
        const tvdbService = require('../tvdbService');
        
        if (mediaType === 'episode' && seriesTitle) {
          // Search for the TV series
          const searchResults = await tvdbService.searchTVSeries(seriesTitle);
          if (searchResults && searchResults.length > 0) {
            const seriesData = searchResults[0];
            
            // Get detailed series information
            const seriesDetails = await tvdbService.getTVSeriesDetails(seriesData.tvdb_id);
            if (seriesDetails && seriesDetails.seasons) {
              const targetSeason = seriesDetails.seasons.find(s => s.number === parseInt(seasonNumber));
              if (targetSeason && targetSeason.episodes) {
                const targetEpisode = targetSeason.episodes.find(e => e.number === parseInt(episodeNumber));
                if (targetEpisode) {
                  // Update the item with TVDB details
                  await prisma.customOrderItem.update({
                    where: { id: item.id },
                    data: {
                      tvdbId: targetEpisode.id?.toString(),
                      tvdbOverview: targetEpisode.overview,
                      // You can add more fields here like air date, rating, etc.
                    }
                  });
                }
              }
            }
          }
        } else if (mediaType === 'movie' && title) {
          // Search for the movie
          const searchResults = await tvdbService.searchMovies(title);
          if (searchResults && searchResults.length > 0) {
            const movieData = searchResults[0];
            
            // Get detailed movie information
            const movieDetails = await tvdbService.getMovieDetails(movieData.tvdb_id);
            if (movieDetails) {
              // Update the item with TVDB details
              await prisma.customOrderItem.update({
                where: { id: item.id },
                data: {
                  // Keep the title from bulk import data, don't overwrite with TVDB movie name
                  // Store other TVDB metadata fields if needed
                  tvdbId: movieDetails.id?.toString(),
                  tvdbOverview: movieDetails.overview,
                  // You can add more fields here like genres, release date, etc.
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch TVDB metadata for ${mediaType} "${title || seriesTitle}":`, error.message);
        // Don't fail the whole request if TVDB lookup fails
      }
    }
    
    // Try to cache artwork for the new item (async, don't wait for completion)
    if (artworkCache) {
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for item ${item.id}:`, error.message);
      });
    }
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item to custom order:', error);
    res.status(500).json({ error: 'Failed to add item to custom order' });
  }
});

// Add TVDB-only item to custom order (doesn't exist in Plex yet)
router.post('/:id/items/tvdb-only', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      mediaType, 
      title, 
      seasonNumber, 
      episodeNumber, 
      seriesTitle,
      tvdbSeriesId,
      tvdbSeasonId,
      tvdbEpisodeId,
      description,
      airDate,
      // Movie fields
      year,
      movieTvdbId
    } = req.body;

    console.log(`Adding TVDB-only ${mediaType} to custom order ${id}:`, { title, seriesTitle, seasonNumber, episodeNumber });

    if (!mediaType || !title) {
      return res.status(400).json({ error: 'mediaType and title are required' });
    }

    // For episodes, we need series info
    if (mediaType === 'episode' && (!seriesTitle || seasonNumber === undefined || episodeNumber === undefined)) {
      return res.status(400).json({ 
        error: 'For TVDB episodes: seriesTitle, seasonNumber, and episodeNumber are required' 
      });
    }

    // Generate a unique plexKey for TVDB-only items (they don't have real Plex keys)
    const finalPlexKey = `tvdb-${mediaType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get the next sort order
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId: parseInt(id) },
      orderBy: { sortOrder: 'desc' }
    });
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;

    const item = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType,
        plexKey: finalPlexKey,
        title,
        seasonNumber,
        episodeNumber,
        seriesTitle,
        sortOrder: nextSortOrder,
        isFromTvdbOnly: true, // Mark as TVDB-only
        // Store TVDB IDs and metadata in custom fields for now
        customTitle: description || title,
        // For episodes, we'll store TVDB data in unused fields temporarily
        comicSeries: tvdbSeriesId ? `tvdb-series-${tvdbSeriesId}` : null,
        comicVolume: tvdbSeasonId ? `tvdb-season-${tvdbSeasonId}` : null,
        comicIssue: tvdbEpisodeId ? `tvdb-episode-${tvdbEpisodeId}` : null,
        // For movies
        bookTitle: mediaType === 'movie' ? title : null,
        bookYear: mediaType === 'movie' ? parseInt(year) : null,
        bookIsbn: movieTvdbId ? `tvdb-movie-${movieTvdbId}` : null,
        // Store air date if provided
        storyYear: airDate ? new Date(airDate).getFullYear() : null
      }
    });

    console.log(`Successfully added TVDB-only ${mediaType}: ${title}`);
    res.status(201).json(item);

  } catch (error) {
    console.error('Error adding TVDB-only item to custom order:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove item from custom order
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Clean up cached artwork for this item
    if (artworkCache) {
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    await prisma.customOrderItem.delete({
      where: { id: parseInt(itemId) }
    });
    res.json({ message: 'Item removed from custom order successfully' });
  } catch (error) {
    console.error('Error removing item from custom order:', error);
    res.status(500).json({ error: 'Failed to remove item from custom order' });
  }
});

// Update item order in custom order
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const { 
      sortOrder, 
      isWatched, 
      title,
      seriesTitle, // For episodes
      // Book fields
      bookTitle, bookAuthor, bookYear, bookIsbn, bookPublisher, bookOpenLibraryId, bookCoverUrl, bookPageCount,
      // Comic fields
      comicSeries, comicYear, comicIssue, comicVolume, comicPublisher, customTitle, comicVineId, comicVineDetailsJson, comicCoverUrl,
      // Story fields
      storyTitle, storyAuthor, storyYear, storyUrl, storyContainedInBookId, storyCoverUrl
    } = req.body;

    console.log('Backend PUT received for itemId:', itemId);
    console.log('Received comicCoverUrl:', comicCoverUrl);
    console.log('Full request body:', req.body);

    // Check if this is a book re-selection (book-specific fields are being updated)
    const isBookReselect = (
      bookTitle !== undefined || 
      bookAuthor !== undefined || 
      bookYear !== undefined || 
      bookIsbn !== undefined || 
      bookPublisher !== undefined || 
      bookOpenLibraryId !== undefined || 
      bookPageCount !== undefined || 
      bookCoverUrl !== undefined
    );

    // Check if this is a comic re-selection (comic-specific fields are being updated)
    const isComicReselect = (
      comicSeries !== undefined || 
      comicYear !== undefined || 
      comicIssue !== undefined || 
      comicVolume !== undefined ||
      comicPublisher !== undefined ||
      customTitle !== undefined ||
      comicVineId !== undefined ||
      comicVineDetailsJson !== undefined ||
      comicCoverUrl !== undefined
    );
    
    // Check if this is a short story re-selection (story-specific fields are being updated)
    const isStoryReselect = (
      storyTitle !== undefined || 
      storyAuthor !== undefined || 
      storyYear !== undefined || 
      storyUrl !== undefined || 
      storyContainedInBookId !== undefined || 
      storyCoverUrl !== undefined
    );
    
    // Prepare update data
    const updateData = {};
    
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (isWatched !== undefined) updateData.isWatched = isWatched;
    if (title !== undefined) updateData.title = title;
    if (seriesTitle !== undefined) updateData.seriesTitle = seriesTitle;
    
    // Book fields
    if (bookTitle !== undefined) updateData.bookTitle = bookTitle;
    if (bookAuthor !== undefined) updateData.bookAuthor = bookAuthor;
    if (bookYear !== undefined) updateData.bookYear = bookYear ? parseInt(bookYear) : null;
    if (bookIsbn !== undefined) updateData.bookIsbn = bookIsbn;
    if (bookPublisher !== undefined) updateData.bookPublisher = bookPublisher;
    if (bookOpenLibraryId !== undefined) updateData.bookOpenLibraryId = bookOpenLibraryId;
    if (bookCoverUrl !== undefined) updateData.bookCoverUrl = bookCoverUrl;
    if (bookPageCount !== undefined) updateData.bookPageCount = bookPageCount ? parseInt(bookPageCount) : null;
    
    // Comic fields
    if (comicSeries !== undefined) updateData.comicSeries = comicSeries;
    if (comicYear !== undefined) updateData.comicYear = comicYear ? parseInt(comicYear) : null;
    if (comicIssue !== undefined) updateData.comicIssue = comicIssue ? String(comicIssue) : null;
    if (comicVolume !== undefined) updateData.comicVolume = comicVolume;
    if (comicPublisher !== undefined) updateData.comicPublisher = comicPublisher;
    if (customTitle !== undefined) updateData.customTitle = customTitle;
    if (comicVineId !== undefined) updateData.comicVineId = comicVineId ? parseInt(comicVineId) : null;
    if (comicVineDetailsJson !== undefined) {
      updateData.comicVineDetailsJson = comicVineDetailsJson;
      
      // Extract ComicVine metadata when ComicVine details are updated
      const comicVineMetadata = extractComicVineMetadata(comicVineDetailsJson);
      if (Object.keys(comicVineMetadata).length > 0) {
        Object.assign(updateData, comicVineMetadata);
      }
    }
    if (comicCoverUrl !== undefined) updateData.originalArtworkUrl = comicCoverUrl;
    
    // Story fields
    if (storyTitle !== undefined) updateData.storyTitle = storyTitle;
    if (storyAuthor !== undefined) updateData.storyAuthor = storyAuthor;
    if (storyYear !== undefined) updateData.storyYear = storyYear ? parseInt(storyYear) : null;
    if (storyUrl !== undefined) updateData.storyUrl = storyUrl;
    if (storyContainedInBookId !== undefined) updateData.storyContainedInBookId = storyContainedInBookId ? parseInt(storyContainedInBookId) : null;
    if (storyCoverUrl !== undefined) updateData.storyCoverUrl = storyCoverUrl;

    const item = await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
      include: {
        storyContainedInBook: true,
        containedStories: true,
        referencedCustomOrder: true
      }
    });

    // Update sub-order watched status if this item belongs to a sub-order
    if (isWatched !== undefined) {
      const customOrder = await prisma.customOrder.findUnique({
        where: { id: item.customOrderId },
        include: {
          items: true
        }
      });

      if (customOrder) {
        // Check if all items in the order are watched
        const isFullyWatched = customOrder.items.every(orderItem => 
          orderItem.id === item.id ? isWatched : orderItem.isWatched
        );

        // Update the sub-order item that represents this custom order in its parent
        const subOrderItem = await prisma.customOrderItem.findFirst({
          where: {
            mediaType: 'suborder',
            referencedCustomOrderId: customOrder.id
          }
        });

        if (subOrderItem) {
          await prisma.customOrderItem.update({
            where: { id: subOrderItem.id },
            data: { isWatched: isFullyWatched }
          });
          
          console.log(`Updated sub-order item for "${customOrder.name}" - watched: ${isFullyWatched}`);
        }
      }
    }

    // If this is a book re-selection, cache new artwork in background
    if (isBookReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected book: ${item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected book ${item.id}:`, error.message);
      });
    }

    // If this is a comic re-selection, cache new artwork in background
    if (isComicReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected comic: ${item.title || item.comicSeries + ' #' + item.comicIssue}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected comic ${item.id}:`, error.message);
      });
    }
    
    // If this is a short story re-selection, cache new artwork in background
    if (isStoryReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected short story: ${item.storyTitle || item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected short story ${item.id}:`, error.message);
      });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error updating custom order item:', error);
    res.status(500).json({ error: 'Failed to update custom order item' });
  }
});

// Delete custom order item and cleanup artwork
router.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Clean up cached artwork for this item
    if (artworkCache) {
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    await prisma.customOrderItem.delete({
      where: { id: parseInt(itemId) }
    });
    res.json({ message: 'Item removed from custom order successfully' });
  } catch (error) {
    console.error('Error removing item from custom order:', error);
    res.status(500).json({ error: 'Failed to remove item from custom order' });
  }
});

// Update custom order item (comprehensive update with re-selection support)
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const { 
      sortOrder, 
      isWatched, 
      title,
      seriesTitle, // For episodes
      // Book fields
      bookTitle, bookAuthor, bookYear, bookIsbn, bookPublisher, bookOpenLibraryId, bookCoverUrl, bookPageCount,
      // Comic fields
      comicSeries, comicYear, comicIssue, comicVolume, comicPublisher, customTitle, comicVineId, comicVineDetailsJson, comicCoverUrl,
      // Story fields
      storyTitle, storyAuthor, storyYear, storyUrl, storyContainedInBookId, storyCoverUrl
    } = req.body;

    console.log('Backend PUT received for itemId:', itemId);
    console.log('Received comicCoverUrl:', comicCoverUrl);
    console.log('Full request body:', req.body);

    // Check if this is a book re-selection (book-specific fields are being updated)
    const isBookReselect = (
      bookTitle !== undefined || 
      bookAuthor !== undefined || 
      bookYear !== undefined || 
      bookIsbn !== undefined || 
      bookPublisher !== undefined || 
      bookOpenLibraryId !== undefined || 
      bookPageCount !== undefined || 
      bookCoverUrl !== undefined
    );
    
    // Check if this is a comic re-selection (comic-specific fields are being updated)
    const isComicReselect = (
      comicSeries !== undefined || 
      comicYear !== undefined || 
      comicIssue !== undefined || 
      comicVolume !== undefined ||
      comicPublisher !== undefined ||
      customTitle !== undefined ||
      comicVineId !== undefined ||
      comicVineDetailsJson !== undefined ||
      comicCoverUrl !== undefined
    );
    
    // Check if this is a short story re-selection (story-specific fields are being updated)
    const isStoryReselect = (
      storyTitle !== undefined || 
      storyAuthor !== undefined || 
      storyYear !== undefined || 
      storyUrl !== undefined || 
      storyContainedInBookId !== undefined || 
      storyCoverUrl !== undefined
    );

    const updateData = {};
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isWatched !== undefined) updateData.isWatched = isWatched;
    
    // If marking a book, comic, or short story as watched, set completion to 100%
    if (isWatched === true) {
      const item = await prisma.customOrderItem.findUnique({
        where: { id: parseInt(itemId) }
      });
      
      if (item && (item.mediaType === 'book' || item.mediaType === 'comic' || item.mediaType === 'shortstory')) {
        updateData.bookPercentRead = 100;
        
        // If we have page count but no current page, set current page to total pages
        if (item.bookPageCount && !item.bookCurrentPage) {
          updateData.bookCurrentPage = item.bookPageCount;
        }
        
        console.log(`Setting ${item.mediaType} "${item.title}" to 100% completed`);
      }
    }
    
    // Handle general data updates
    if (title !== undefined) updateData.title = title;
    if (seriesTitle !== undefined) updateData.seriesTitle = seriesTitle;
    
    // Handle book data updates for re-select functionality
    if (isBookReselect) { 
        if (bookTitle !== undefined) updateData.bookTitle = bookTitle;
        if (bookAuthor !== undefined) updateData.bookAuthor = bookAuthor;
        if (bookYear !== undefined) updateData.bookYear = bookYear;
        if (bookIsbn !== undefined) updateData.bookIsbn = bookIsbn;
        if (bookPublisher !== undefined) updateData.bookPublisher = bookPublisher;
        if (bookOpenLibraryId !== undefined) updateData.bookOpenLibraryId = bookOpenLibraryId;
        if (bookPageCount !== undefined) updateData.bookPageCount = bookPageCount ? parseInt(bookPageCount) : null;
        // Use new bookCoverUrl if provided, otherwise nullify to allow re-caching logic to take over
        updateData.bookCoverUrl = bookCoverUrl !== undefined ? bookCoverUrl : null;
        
        // Clear artwork fields for re-caching if a book is reselected
        updateData.localArtworkPath = null;
        updateData.originalArtworkUrl = bookCoverUrl !== undefined ? bookCoverUrl : null; 
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }
    
    // Handle comic data updates
    if (isComicReselect) { 
        console.log('Processing comic re-selection...');
        if (comicSeries !== undefined) updateData.comicSeries = comicSeries;
        if (comicYear !== undefined) updateData.comicYear = comicYear;
        if (comicIssue !== undefined) updateData.comicIssue = String(comicIssue); // Ensure string
        if (comicVolume !== undefined) updateData.comicVolume = comicVolume;
        if (comicPublisher !== undefined) updateData.comicPublisher = comicPublisher;
        if (customTitle !== undefined) updateData.customTitle = customTitle;
        if (comicVineId !== undefined) updateData.comicVineId = comicVineId;
        if (comicVineDetailsJson !== undefined) updateData.comicVineDetailsJson = comicVineDetailsJson;

        // Extract and store comprehensive ComicVine data if provided
        if (comicVineDetailsJson !== undefined) {
          try {
            const comicVineData = JSON.parse(comicVineDetailsJson);
            
            // Extract comprehensive data from either the new format or legacy format
            if (comicVineData.comprehensiveData) {
              // New comprehensive format
              const data = comicVineData.comprehensiveData;
              updateData.comicVineSeriesId = data.series?.id || null;
              updateData.comicVineIssueId = data.issue?.id || null;
              updateData.comicIssueName = data.issue?.name || null;
              updateData.comicDescription = data.issue?.description || data.series?.description || null;
              updateData.comicCoverDate = data.issue?.cover_date || null;
              updateData.comicStoreDate = data.issue?.store_date || null;
              updateData.comicCreators = data.issue?.person_credits ? JSON.stringify(data.issue.person_credits) : null;
              updateData.comicCharacters = data.issue?.character_credits ? JSON.stringify(data.issue.character_credits) : null;
              updateData.comicStoryArcs = data.issue?.story_arc_credits ? JSON.stringify(data.issue.story_arc_credits) : null;
            } else if (comicVineData.series && comicVineData.issue) {
              // Current format - direct series and issue objects
              updateData.comicVineSeriesId = comicVineData.series?.id || null;
              updateData.comicVineIssueId = comicVineData.issue?.id || null;
              updateData.comicIssueName = comicVineData.issue?.name || null;
              updateData.comicDescription = comicVineData.issue?.description || comicVineData.series?.description || null;
              updateData.comicCoverDate = comicVineData.issue?.cover_date || null;
              updateData.comicStoreDate = comicVineData.issue?.store_date || null;
              updateData.comicCreators = comicVineData.issue?.person_credits ? JSON.stringify(comicVineData.issue.person_credits) : null;
              updateData.comicCharacters = comicVineData.issue?.character_credits ? JSON.stringify(comicVineData.issue.character_credits) : null;
              updateData.comicStoryArcs = comicVineData.issue?.story_arc_credits ? JSON.stringify(comicVineData.issue.story_arc_credits) : null;
            } else {
              // Legacy format - extract what we can from the series data
              updateData.comicVineSeriesId = comicVineData.id || null;
              updateData.comicVineIssueId = comicVineData.issueId || null;
              updateData.comicIssueName = comicVineData.issueName || null;
              updateData.comicDescription = comicVineData.issue_description || comicVineData.description || null;
              updateData.comicCoverDate = comicVineData.issue_cover_date || null;
              updateData.comicStoreDate = comicVineData.issue_store_date || null;
              updateData.comicCreators = comicVineData.person_credits ? JSON.stringify(comicVineData.person_credits) : null;
              updateData.comicCharacters = comicVineData.character_credits ? JSON.stringify(comicVineData.character_credits) : null;
              updateData.comicStoryArcs = comicVineData.story_arc_credits ? JSON.stringify(comicVineData.story_arc_credits) : null;
            }
            
            console.log('Extracted ComicVine data for update:', {
              comicVineSeriesId: updateData.comicVineSeriesId,
              comicVineIssueId: updateData.comicVineIssueId,
              comicIssueName: updateData.comicIssueName
            });
          } catch (error) {
            console.warn('Failed to parse ComicVine details JSON during update:', error);
          }
        }

        // Use the specific cover URL from the selected comic if provided, otherwise let the system derive it
        updateData.originalArtworkUrl = comicCoverUrl !== undefined ? comicCoverUrl : null;
        console.log('Setting originalArtworkUrl to:', updateData.originalArtworkUrl);
        
        // Clear old artwork details to force re-caching with the new artwork URL
        updateData.localArtworkPath = null;
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }
    
    // Handle short story data updates
    if (isStoryReselect) { 
        if (storyTitle !== undefined) updateData.storyTitle = storyTitle;
        if (storyAuthor !== undefined) updateData.storyAuthor = storyAuthor;
        if (storyYear !== undefined) updateData.storyYear = storyYear;
        if (storyUrl !== undefined) updateData.storyUrl = storyUrl;
        if (storyContainedInBookId !== undefined) updateData.storyContainedInBookId = storyContainedInBookId;
        // Use new storyCoverUrl if provided, otherwise nullify
        updateData.storyCoverUrl = storyCoverUrl !== undefined ? storyCoverUrl : null;

        // Clear artwork fields for re-caching
        updateData.localArtworkPath = null;
        updateData.originalArtworkUrl = storyCoverUrl !== undefined ? storyCoverUrl : null; 
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }

    // If this is a book re-selection, clear existing cached artwork file (DB fields cleared above)
    if (isBookReselect && artworkCache) {
      console.log(`Re-selecting book for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    // If this is a comic re-selection, clear existing cached artwork
    if (isComicReselect && artworkCache) {
      console.log(`Re-selecting comic for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    // If this is a short story re-selection, clear existing cached artwork
    if (isStoryReselect && artworkCache) {
      console.log(`Re-selecting short story for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    const item = await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
      include: {
        storyContainedInBook: true,
        referencedCustomOrder: {
          include: { items: true }
        }
      }
    });

    // Log watched activity for TV and movie content
    if (isWatched !== undefined && isWatched === true && (item.mediaType === 'tv' || item.mediaType === 'movie') && watchLogService) {
      try {
        const watchLogData = {
          mediaType: item.mediaType,
          title: item.title,
          customOrderItemId: item.id,
          plexKey: item.plexKey
        };

        // Add episode-specific data for TV content
        if (item.mediaType === 'tv') {
          watchLogData.seriesTitle = item.seriesTitle;
          watchLogData.seasonNumber = item.seasonNumber;
          watchLogData.episodeNumber = item.episodeNumber;
        }

        // Try to get duration from Plex data if available
        if (item.plexKey) {
          try {
            // Attempt to get duration from Plex database
            let plexItem = null;
            if (item.mediaType === 'tv') {
              plexItem = await prisma.plexTVEpisode.findFirst({
                where: { ratingKey: item.plexKey }
              });
            } else if (item.mediaType === 'movie') {
              plexItem = await prisma.plexMovie.findFirst({
                where: { ratingKey: item.plexKey }
              });
            }
            
            if (plexItem && plexItem.duration) {
              // Convert from milliseconds to minutes
              watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
            }
          } catch (plexError) {
            console.warn('Could not retrieve duration from Plex data:', plexError.message);
          }
        }

        // Set default duration if not found
        if (!watchLogData.duration) {
          watchLogData.duration = item.mediaType === 'movie' ? 120 : 45; // Default: 2h for movies, 45min for TV
        }

        await watchLogService.logWatched(watchLogData);
        console.log(`Logged watch activity for ${item.mediaType}: ${item.title}`);
      } catch (watchLogError) {
        console.warn('Failed to log watch activity:', watchLogError.message);
        // Don't fail the whole request if watch logging fails
      }
    }
    
    // If this is a sub-order and it's being marked as watched/unwatched, 
    // check if we need to update all items in the sub-order
    if (item.mediaType === 'suborder' && (isWatched !== undefined)) {
      if (isWatched && item.referencedCustomOrder) {
        // Mark all items in the sub-order as watched
        await prisma.customOrderItem.updateMany({
          where: {
            customOrderId: item.referencedCustomOrder.id,
            isWatched: false
          },
          data: { isWatched: true }
        });
        console.log(`Marked all items in sub-order "${item.referencedCustomOrder.name}" as watched`);
      }
    }
    
    // If this is a regular item in a sub-order and it's being marked as watched,
    // check if all items in the sub-order are now watched and update the parent sub-order item
    if (item.mediaType !== 'suborder' && isWatched !== undefined) {
      const customOrder = await prisma.customOrder.findUnique({
        where: { id: item.customOrderId },
        include: { items: true, parentOrder: true }
      });
      
      if (customOrder && customOrder.parentOrderId) {
        // This is a sub-order, check if it's fully watched and update the parent's sub-order item
        const isFullyWatched = subOrderService.isSubOrderFullyWatched(customOrder);
        
        await prisma.customOrderItem.updateMany({
          where: {
            mediaType: 'suborder',
            referencedCustomOrderId: customOrder.id
          },
          data: { isWatched: isFullyWatched }
        });
        
        console.log(`Updated sub-order item for "${customOrder.name}" - watched: ${isFullyWatched}`);
      }
    }
    
    // If this is a book re-selection, cache new artwork in background
    if (isBookReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected book: ${item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected book ${item.id}:`, error.message);
      });
    }
    
    // If this is a comic re-selection, cache new artwork in background
    if (isComicReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected comic: ${item.title || item.comicSeries + ' #' + item.comicIssue}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected comic ${item.id}:`, error.message);
      });
    }
    
    // If this is a short story re-selection, cache new artwork in background
    if (isStoryReselect && artworkCache) {
      console.log(`Re-caching artwork for re-selected short story: ${item.storyTitle || item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected short story ${item.id}:`, error.message);
      });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error updating custom order item:', error);
    res.status(500).json({ error: 'Failed to update custom order item' });
  }
});

module.exports = router;
