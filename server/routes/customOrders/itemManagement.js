/**
 * Custom Orders Item Management Routes
 * Handles individual item operations: get, update, delete
 * Consolidated from duplicate routes in monolithic customOrders.js
 */

const express = require('express');

/**
 * Create item management routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createItemManagementRoutes(prisma, services) {
  const router = express.Router();
  const { artworkCache, watchLogService, subOrderService, bookService } = services;

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

  // Delete item from custom order
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
        // Book/reading progress fields
        bookPercentRead, bookCurrentPage,
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
      
      // Handle progress updates for books (should use unified system, not legacy fields)
      if (bookPercentRead !== undefined || bookCurrentPage !== undefined) {
        console.log('Processing book progress update...');
        
        // Get current item data to check if it uses unified book system
        const currentItem = await prisma.customOrderItem.findUnique({
          where: { id: parseInt(itemId) },
          select: { 
            id: true, 
            bookId: true, 
            mediaType: true,
            bookPageCount: true, 
            bookCurrentPage: true, 
            bookPercentRead: true 
          }
        });
        
        if (currentItem.mediaType === 'book' && currentItem.bookId) {
          // Use unified BookCompletion system
          console.log(`Updating progress for unified book ${currentItem.bookId}`);
          
          try {
            const { BookCompletionService } = require('../../services');
            const bookCompletionService = new BookCompletionService();
            
            const pageCount = bookPageCount !== undefined ? parseInt(bookPageCount) : currentItem?.bookPageCount;
            
            const progressData = {};
            if (bookCurrentPage !== undefined) progressData.currentPage = parseInt(bookCurrentPage);
            if (bookPercentRead !== undefined) progressData.percentRead = parseFloat(bookPercentRead);
            if (pageCount) progressData.totalPages = pageCount;
            
            // Calculate missing values if we have page count
            if (pageCount && pageCount > 0) {
              if (bookPercentRead !== undefined && bookCurrentPage === undefined) {
                progressData.currentPage = Math.round((bookPercentRead / 100) * pageCount);
              }
              if (bookCurrentPage !== undefined && bookPercentRead === undefined) {
                progressData.percentRead = Math.min(100, Math.round((bookCurrentPage / pageCount) * 100));
              }
            }
            
            // Update unified BookCompletion
            await bookCompletionService.updateBookProgress(currentItem.bookId, progressData);
            console.log('Updated unified BookCompletion for book:', currentItem.bookId);
            
            // Mark as watched in CustomOrderItem if 100% complete
            const finalPercentRead = progressData.percentRead || bookPercentRead;
            if (finalPercentRead === 100) {
              updateData.isWatched = true;
              console.log('Marked custom order item as watched (100% completion)');
            }
            
          } catch (error) {
            console.error('Error updating unified book progress:', error);
            console.log('Falling back to legacy progress fields...');
            // Fall back to legacy behavior
            const pageCount = bookPageCount !== undefined ? parseInt(bookPageCount) : currentItem?.bookPageCount;
            if (bookPercentRead !== undefined) updateData.bookPercentRead = bookPercentRead;
            if (bookCurrentPage !== undefined) updateData.bookCurrentPage = bookCurrentPage;
            
            if (pageCount && pageCount > 0) {
              if (bookPercentRead !== undefined && bookCurrentPage === undefined) {
                updateData.bookCurrentPage = Math.round((bookPercentRead / 100) * pageCount);
              }
              if (bookCurrentPage !== undefined && bookPercentRead === undefined) {
                updateData.bookPercentRead = Math.min(100, Math.round((bookCurrentPage / pageCount) * 100));
              }
            }
          }
        } else {
          // For non-unified books or non-books, use legacy fields
          console.log('Using legacy progress fields for non-unified item');
          const pageCount = bookPageCount !== undefined ? parseInt(bookPageCount) : currentItem?.bookPageCount;
          
          if (bookPercentRead !== undefined) updateData.bookPercentRead = bookPercentRead;
          if (bookCurrentPage !== undefined) updateData.bookCurrentPage = bookCurrentPage;
          
          if (pageCount && pageCount > 0) {
            if (bookPercentRead !== undefined && bookCurrentPage === undefined) {
              updateData.bookCurrentPage = Math.round((bookPercentRead / 100) * pageCount);
            }
            if (bookCurrentPage !== undefined && bookPercentRead === undefined) {
              updateData.bookPercentRead = Math.min(100, Math.round((bookCurrentPage / pageCount) * 100));
            }
          }
        }
      }
      
      // Check if this update sets reading completion to 100% and auto-mark as watched
      // For unified books, this is handled in the progress update section above
      // For legacy books/comics, check the legacy fields
      const finalPercentRead = updateData.bookPercentRead !== undefined ? updateData.bookPercentRead : bookPercentRead;
      const finalCurrentPage = updateData.bookCurrentPage !== undefined ? updateData.bookCurrentPage : bookCurrentPage;
      const finalPageCount = bookPageCount !== undefined ? parseInt(bookPageCount) : undefined;
      
      if (finalPercentRead === 100 || 
          (finalCurrentPage !== undefined && finalPageCount !== undefined && finalCurrentPage >= finalPageCount)) {
        
        // Get the current item to check media type (if not already fetched above)
        const currentItem = await prisma.customOrderItem.findUnique({
          where: { id: parseInt(itemId) }
        });
        
        if (currentItem && (currentItem.mediaType === 'book' || currentItem.mediaType === 'comic' || currentItem.mediaType === 'shortstory')) {
          updateData.isWatched = true;
          console.log(`Setting ${currentItem.mediaType} "${currentItem.title}" as watched (100% completion)`);
        }
      }
      
      // Handle general data updates
      if (title !== undefined) updateData.title = title;
      if (seriesTitle !== undefined) updateData.seriesTitle = seriesTitle;
      
      // Handle book data updates for re-select functionality
      if (isBookReselect) {
        console.log('Processing book re-selection - updating unified book system...');
        
        try {
          // Create or update unified book entry
          const bookData = {
            title: bookTitle,
            author: bookAuthor,
            year: bookYear ? parseInt(bookYear) : null,
            isbn: bookIsbn,
            publisher: bookPublisher,
            openLibraryId: bookOpenLibraryId,
            pageCount: bookPageCount ? parseInt(bookPageCount) : null,
            coverUrl: bookCoverUrl,
            // Set source and content type
            source: 'custom-order',
            contentType: 'book'
          };
          
          // Remove undefined values
          Object.keys(bookData).forEach(key => {
            if (bookData[key] === undefined) {
              delete bookData[key];
            }
          });
          
          let unifiedBook;
          
          // Get current item to check if it already has a bookId
          const currentItem = await prisma.customOrderItem.findUnique({
            where: { id: parseInt(itemId) },
            select: { bookId: true, title: true }
          });
          
          if (currentItem.bookId) {
            // Update existing unified book
            console.log(`Updating existing unified book ${currentItem.bookId} with new data`);
            unifiedBook = await bookService.updateBook(currentItem.bookId, bookData);
          } else {
            // Create new unified book
            console.log('Creating new unified book entry');
            unifiedBook = await bookService.createBook(bookData);
            
            // Link the custom order item to the unified book
            updateData.bookId = unifiedBook.id;
            console.log(`Linked custom order item to unified book ${unifiedBook.id}`);
          }
          
          // Clear legacy book fields from custom order item (should not store book data here)
          updateData.bookTitle = null;
          updateData.bookAuthor = null;
          updateData.bookYear = null;
          updateData.bookIsbn = null;
          updateData.bookPublisher = null;
          updateData.bookOpenLibraryId = null;
          updateData.bookPageCount = null;
          updateData.bookCoverUrl = null;
          
          // Clear artwork fields for re-caching since we updated the book
          updateData.localArtworkPath = null;
          updateData.originalArtworkUrl = null;
          updateData.artworkLastCached = null;
          updateData.artworkMimeType = null;
          
          console.log(`Successfully processed book re-selection for "${bookData.title}"`);
          
        } catch (error) {
          console.error('Error processing book re-selection:', error);
          // Fall back to legacy behavior if unified system fails
          console.log('Falling back to legacy book field updates...');
          if (bookTitle !== undefined) updateData.bookTitle = bookTitle;
          if (bookAuthor !== undefined) updateData.bookAuthor = bookAuthor;
          if (bookYear !== undefined) updateData.bookYear = bookYear;
          if (bookIsbn !== undefined) updateData.bookIsbn = bookIsbn;
          if (bookPublisher !== undefined) updateData.bookPublisher = bookPublisher;
          if (bookOpenLibraryId !== undefined) updateData.bookOpenLibraryId = bookOpenLibraryId;
          if (bookPageCount !== undefined) updateData.bookPageCount = bookPageCount ? parseInt(bookPageCount) : null;
          updateData.bookCoverUrl = bookCoverUrl !== undefined ? bookCoverUrl : null;
          updateData.localArtworkPath = null;
          updateData.originalArtworkUrl = bookCoverUrl !== undefined ? bookCoverUrl : null; 
          updateData.artworkLastCached = null;
          updateData.artworkMimeType = null;
        }
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

      // Handle Book creation/update for unified system if this was a book re-selection
      if (isBookReselect && bookService) {
        try {
          console.log(`🔄 Book re-selected for item ${itemId}, creating/updating unified Book record...`);
          
          // Create book data from the updated item
          const bookData = {
            title: item.bookTitle || item.title,
            author: item.bookAuthor,
            year: item.bookYear,
            isbn: item.bookIsbn,
            publisher: item.bookPublisher,
            pageCount: item.bookPageCount,
            openLibraryId: item.bookOpenLibraryId,
            coverUrl: item.bookCoverUrl || item.originalArtworkUrl
          };

          // Create or find existing Book record (createBook handles duplicates)
          const book = await bookService.createBook(bookData);
          console.log(`📚 Created/found Book record:`, book.id);

          // Ensure the Book record has the correct pageCount (update if missing)
          if (item.bookPageCount && !book.pageCount) {
            try {
              await prisma.book.update({
                where: { id: book.id },
                data: { pageCount: item.bookPageCount }
              });
              console.log(`📚 Updated Book ${book.id} pageCount to ${item.bookPageCount}`);
            } catch (pageCountError) {
              console.error(`Error updating Book pageCount:`, pageCountError);
            }
          }

          // Link the CustomOrderItem to the Book
          await prisma.customOrderItem.update({
            where: { id: parseInt(itemId) },
            data: { bookId: book.id }
          });
          console.log(`🔗 Linked CustomOrderItem ${itemId} to Book ${book.id}`);

        } catch (bookError) {
          console.error(`Error creating/updating Book record for item ${itemId}:`, bookError);
          // Don't fail the whole request if Book creation fails
        }
      }

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
      
      // If this is a book re-selection, cache new artwork synchronously
      if (isBookReselect && artworkCache) {
        console.log(`Re-caching artwork for re-selected book: ${item.title}`);
        try {
          await artworkCache.ensureArtworkCached(item);
          console.log(`Successfully cached artwork for re-selected book ${item.id}`);
        } catch (error) {
          console.warn(`Failed to cache artwork for re-selected book ${item.id}:`, error.message);
        }
      }
      
      // If this is a comic re-selection, cache new artwork synchronously
      if (isComicReselect && artworkCache) {
        console.log(`Re-caching artwork for re-selected comic: ${item.title || item.comicSeries + ' #' + item.comicIssue}`);
        try {
          await artworkCache.ensureArtworkCached(item);
          console.log(`Successfully cached artwork for re-selected comic ${item.id}`);
        } catch (error) {
          console.warn(`Failed to cache artwork for re-selected comic ${item.id}:`, error.message);
        }
      }
      
      // If this is a short story re-selection, cache new artwork synchronously
      if (isStoryReselect && artworkCache) {
        console.log(`Re-caching artwork for re-selected short story: ${item.storyTitle || item.title}`);
        try {
          await artworkCache.ensureArtworkCached(item);
          console.log(`Successfully cached artwork for re-selected short story ${item.id}`);
        } catch (error) {
          console.warn(`Failed to cache artwork for re-selected short story ${item.id}:`, error.message);
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error('Error updating custom order item:', error);
      res.status(500).json({ error: 'Failed to update custom order item' });
    }
  });

  return router;
}

module.exports = createItemManagementRoutes;
