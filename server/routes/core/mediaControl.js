/**
 * Core Media Control Routes
 * Handles media control and custom order operations
 */

const express = require('express');

/**
 * Create media control routes
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createMediaControlRoutes(prisma, services) {
  const router = express.Router();
  
  // Initialize dependencies
  const ArtworkCacheService = require('../../artworkCacheService');
  const artworkCache = new ArtworkCacheService();
  const watchLogService = require('../../watchLogService');
  const plexDb = require('../../plexDatabaseService');
  const subOrderService = require('../../subOrderService');
  
  // Helper function - moved from remaining_routes.js
  async function markCustomOrderItemAsWatched(itemId) {
    // This function logic would need to be extracted from the existing codebase
    // For now, we'll use direct database update
    return await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: { isWatched: true }
    });
  }
  
  // ==================== CUSTOM ORDER ITEM MANAGEMENT ====================
  
  // Delete item from custom order
  router.delete('/api/custom-orders/:id/items/:itemId', async (req, res) => {
    try {
      const { itemId } = req.params;
      
      // Clean up cached artwork for this item
      await artworkCache.cleanupArtwork(parseInt(itemId));
      
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
  router.put('/api/custom-orders/:id/items/:itemId', async (req, res) => {
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
      if (isBookReselect) {
        console.log(`Re-selecting book for item ${itemId}, clearing cached artwork...`);
        await artworkCache.cleanupArtwork(parseInt(itemId));
      }
      
      // If this is a comic re-selection, clear existing cached artwork
      if (isComicReselect) {
        console.log(`Re-selecting comic for item ${itemId}, clearing cached artwork...`);
        await artworkCache.cleanupArtwork(parseInt(itemId));
      }
      
      // If this is a short story re-selection, clear existing cached artwork
      if (isStoryReselect) {
        console.log(`Re-selecting short story for item ${itemId}, clearing cached artwork...`);
        await artworkCache.cleanupArtwork(parseInt(itemId));
      }

      // Check if this update sets reading completion to 100% and auto-mark as watched
      if (req.body.bookPercentRead === 100 || 
          (req.body.bookCurrentPage && req.body.bookPageCount && req.body.bookCurrentPage >= req.body.bookPageCount)) {
        
        // Get the current item to check media type
        const currentItem = await prisma.customOrderItem.findUnique({
          where: { id: parseInt(itemId) }
        });
        
        if (currentItem && (currentItem.mediaType === 'book' || currentItem.mediaType === 'comic' || currentItem.mediaType === 'shortstory')) {
          updateData.isWatched = true;
          console.log(`Setting ${currentItem.mediaType} "${currentItem.title}" as watched (100% completion)`);
        }
      }

      // Add any additional fields from req.body that weren't explicitly destructured
      if (req.body.bookPercentRead !== undefined) updateData.bookPercentRead = req.body.bookPercentRead;
      if (req.body.bookCurrentPage !== undefined) updateData.bookCurrentPage = req.body.bookCurrentPage;
      
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
      if (isWatched !== undefined && isWatched === true && (item.mediaType === 'tv' || item.mediaType === 'movie')) {
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
      if (isBookReselect) {
        console.log(`Re-caching artwork for re-selected book: ${item.title}`);
        artworkCache.ensureArtworkCached(item).catch(error => {
          console.warn(`Failed to cache artwork for re-selected book ${item.id}:`, error.message);
        });
      }
      
      // If this is a comic re-selection, cache new artwork in background
      if (isComicReselect) {
        console.log(`Re-caching artwork for re-selected comic: ${item.title || item.comicSeries + ' #' + item.comicIssue}`);
        artworkCache.ensureArtworkCached(item).catch(error => {
          console.warn(`Failed to cache artwork for re-selected comic ${item.id}:`, error.message);
        });
      }
      
      // If this is a short story re-selection, cache new artwork in background
      if (isStoryReselect) {
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

  // ==================== WATCH STATUS MANAGEMENT ====================

  // Mark custom order item as watched from home page
  router.post('/api/mark-custom-order-item-watched/:itemId', async (req, res) => {
    try {
      const { itemId } = req.params;
      
      if (!itemId) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      // Get the custom order item details first to check what type of media it is
      const customOrderItem = await prisma.customOrderItem.findUnique({
        where: { id: parseInt(itemId) }
      });

      if (!customOrderItem) {
        return res.status(404).json({ error: 'Custom order item not found' });
      }

      // Mark the custom order item as watched
      await markCustomOrderItemAsWatched(itemId);

      // Create a watch log entry for statistics
      let duration = null;
      let mediaType = customOrderItem.mediaType;
      
      // Map custom order media types to watch log media types
      if (customOrderItem.mediaType === 'episode') {
        mediaType = 'tv';
      } else if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
        // For reading media, we don't have duration but we'll log them anyway
        mediaType = customOrderItem.mediaType;
      }

      // Try to get duration from Plex database if available
      if (customOrderItem.plexKey) {
        try {
          if (customOrderItem.mediaType === 'episode') {
            const episodeData = await plexDb.getItemMetadata(customOrderItem.plexKey, 'episode');
            if (episodeData && episodeData.duration) {
              duration = Math.round(episodeData.duration / 60000); // Convert milliseconds to minutes
            }
          } else if (customOrderItem.mediaType === 'movie') {
            const movieData = await plexDb.getMovieByRatingKey(customOrderItem.plexKey);
            if (movieData && movieData.duration) {
              duration = Math.round(movieData.duration / 60000); // Convert milliseconds to minutes
            }
          }
        } catch (error) {
          console.warn('Could not get duration from Plex database:', error.message);
        }
      }

      // For books, comics, and short stories, set completion status to 100%
      if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
        const updateData = {
          bookPercentRead: 100
        };
        
        // If we have page count but no current page, set current page to total pages
        if (customOrderItem.bookPageCount && !customOrderItem.bookCurrentPage) {
          updateData.bookCurrentPage = customOrderItem.bookPageCount;
        }
        
        await prisma.customOrderItem.update({
          where: { id: parseInt(itemId) },
          data: updateData
        });
        
        console.log(`Set ${customOrderItem.mediaType} "${customOrderItem.title}" to 100% completed`);
      }

      // Create watch log entry
      const watchLogParams = {
        mediaType: mediaType,
        title: customOrderItem.title,
        seriesTitle: customOrderItem.seriesTitle,
        seasonNumber: customOrderItem.seasonNumber,
        episodeNumber: customOrderItem.episodeNumber,
        plexKey: customOrderItem.plexKey,
        customOrderItemId: parseInt(itemId),
        duration: duration,
        activityType: (mediaType === 'book' || mediaType === 'comic' || mediaType === 'shortstory') ? 'read' : 'watch',
        isCompleted: true
      };

      await watchLogService.logWatched(watchLogParams);
      console.log(`Created watch log entry for custom order item ${itemId}`);

      // If this is an episode or movie with a plexKey, also mark it as watched in the Plex database
      if (customOrderItem.plexKey && (customOrderItem.mediaType === 'episode' || customOrderItem.mediaType === 'movie')) {
        try {
          if (customOrderItem.mediaType === 'episode') {
            await plexDb.markEpisodeAsWatched(customOrderItem.plexKey);
            console.log(`Marked episode ${customOrderItem.plexKey} as watched in Plex database`);
          } else if (customOrderItem.mediaType === 'movie') {
            await plexDb.markMovieAsWatched(customOrderItem.plexKey);
            console.log(`Marked movie ${customOrderItem.plexKey} as watched in Plex database`);
          }
        } catch (error) {
          console.error(`Error marking ${customOrderItem.mediaType} as watched in Plex database:`, error);
          // Continue anyway since the custom order item was marked as watched
        }
      }
      
      res.json({ success: true, message: 'Item marked as watched and logged for statistics' });
    } catch (error) {
      console.error('Error marking custom order item as watched:', error);
      res.status(500).json({ error: 'Failed to mark item as watched' });
    }
  });

  // Mark a general TV episode or movie as watched (for TV_GENERAL and MOVIES_GENERAL orders)
  router.post('/api/mark-media-watched', async (req, res) => {
    try {
      const { mediaType, ratingKey, episodeRatingKey } = req.body;
      
      if (!mediaType || (!ratingKey && !episodeRatingKey)) {
        return res.status(400).json({ error: 'Media type and ratingKey (or episodeRatingKey for episodes) are required' });
      }

      try {
        let duration = null;
        let mediaData = null;
        let watchLogMediaType = mediaType;

        if (mediaType === 'episode') {
          // For episodes, use episodeRatingKey if available, otherwise ratingKey
          const episodeKey = episodeRatingKey || ratingKey;
          await plexDb.markEpisodeAsWatched(episodeKey);
          console.log(`Marked episode ${episodeKey} as watched in Plex database`);
          
          // Get episode data for watch log
          try {
            mediaData = await plexDb.getItemMetadata(episodeKey, 'episode');
            if (mediaData && mediaData.duration) {
              duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
            }
            watchLogMediaType = 'tv';
          } catch (error) {
            console.warn('Could not get episode data for watch log:', error.message);
          }
        } else if (mediaType === 'movie') {
          await plexDb.markMovieAsWatched(ratingKey);
          console.log(`Marked movie ${ratingKey} as watched in Plex database`);
          
          // Get movie data for watch log
          try {
            mediaData = await plexDb.getMovieByRatingKey(ratingKey);
            if (mediaData && mediaData.duration) {
              duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
            }
          } catch (error) {
            console.warn('Could not get movie data for watch log:', error.message);
          }
        } else {
          return res.status(400).json({ error: 'Unsupported media type. Only episode and movie are supported.' });
        }

        // Create watch log entry if we have media data
        if (mediaData) {
          const watchLogParams = {
            mediaType: watchLogMediaType,
            title: mediaData.title,
            seriesTitle: mediaData.seriesTitle || (mediaData.grandparentTitle || null),
            seasonNumber: mediaData.parentIndex || mediaData.seasonNumber || null,
            episodeNumber: mediaData.index || mediaData.episodeNumber || null,
            plexKey: mediaData.ratingKey || ratingKey || episodeRatingKey,
            duration: duration,
            activityType: 'watch',
            isCompleted: true
          };

          await watchLogService.logWatched(watchLogParams);
          console.log(`Created watch log entry for ${mediaType} ${ratingKey || episodeRatingKey}`);
        }
        
        res.json({ success: true, message: `${mediaType} marked as watched and logged for statistics` });
      } catch (error) {
        console.error(`Error marking ${mediaType} as watched in Plex database:`, error);
        res.status(500).json({ error: `Failed to mark ${mediaType} as watched in database` });
      }
    } catch (error) {
      console.error('Error in mark-media-watched endpoint:', error);
      res.status(500).json({ error: 'Failed to mark media as watched' });
    }
  });

  console.log('📱 Media Control routes initialized');
  
  return router;
}

module.exports = createMediaControlRoutes;
