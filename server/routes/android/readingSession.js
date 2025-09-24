/**
 * Android Reading Session Routes
 * Handles reading session management for books, comics, and short stories
 * Uses direct service calls for consistency with web interface
 */

const express = require('express');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../../utils/responses');
const { validateRequiredFields } = require('../../middleware/validation');
const WatchLogService = require('../../watchLogService');
const BookCompletionService = require('../../services/BookCompletionService');
const prisma = require('../../prismaClient');

/**
 * Create reading session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createReadingSessionRoutes(prisma) {
  const router = express.Router();
  const watchLogService = new WatchLogService(prisma);
  const bookCompletionService = new BookCompletionService(prisma);

  // Start reading session
  router.post('/reading/start', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to start reading session...');
    console.log('📱 Request body received:', JSON.stringify(req.body, null, 2));
    console.log('📱 Request headers:', JSON.stringify(req.headers, null, 2));
    
    const { mediaType, title, seriesTitle, customOrderItemId, id, historyPlus } = req.body;

    // The Android app might send the custom order item ID as either 'customOrderItemId' or 'id'
    const actualCustomOrderItemId = customOrderItemId || id;

    // Check if this is a History Plus reading session
    const isHistoryPlusSession = historyPlus && historyPlus.orderType === 'HISTORY_PLUS';
    
    console.log(`📱 Session type: ${isHistoryPlusSession ? 'History Plus' : 'Regular'}`);
    
    if (isHistoryPlusSession) {
      console.log('📚 History Plus session detected:', historyPlus);
      
      // For History Plus sessions, we need different validation and handling
      if (!historyPlus.eventId || !historyPlus.contentType || !historyPlus.contentId) {
        return sendBadRequest(res, 'History Plus sessions require eventId, contentType, and contentId');
      }
      
      // Create a special History Plus reading session
      const historyPlusSeriesTitle = `HISTORY_PLUS:${historyPlus.eventId}:${historyPlus.contentType}:${historyPlus.contentId}:${historyPlus.eventTitle || title}`;
      
      console.log(`📚 Starting History Plus reading session: ${historyPlusSeriesTitle}`);
      
      const readingSession = await watchLogService.startReading({
        mediaType: mediaType,
        title: title,
        seriesTitle: historyPlusSeriesTitle,
        customOrderItemId: null // No customOrderItemId for History Plus
      });
      
      const androidResponse = {
        type: 'READING_SESSION_STARTED',
        data: {
          success: true,
          sessionId: readingSession.id,
          title: title,
          mediaType: mediaType,
          customOrderItemId: null, // History Plus doesn't use custom order items
          historyPlus: historyPlus, // Return the History Plus context
          startedAt: readingSession.startedAt,
          isPaused: readingSession.isPaused || false,
          message: `Started History Plus reading session for "${title}"`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ History Plus reading session start successful:', JSON.stringify(androidResponse, null, 2));
      return sendSuccess(res, androidResponse.data);
    }

    // Regular reading session logic (for custom order items)
    // Validate required fields
    if (!mediaType || !title) {
      return sendBadRequest(res, 'mediaType and title are required');
    }

    // Temporarily allow missing customOrderItemId for debugging
    if (!actualCustomOrderItemId) {
      console.log('⚠️ WARNING: Neither customOrderItemId nor id provided - this should be investigated');
    }

    // Validate media type
    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      return sendBadRequest(res, 'Reading sessions are only supported for books, comics, and stories');
    }

    console.log(`📱 Start reading session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}, id: ${id}, actualId: ${actualCustomOrderItemId}`);

    let finalCustomOrderItemId = null;
    
    if (actualCustomOrderItemId) {
      // Validate and parse customOrderItemId (if provided)
      const parsedId = parseInt(actualCustomOrderItemId);
      if (!Number.isInteger(parsedId)) {
        return sendBadRequest(res, 'customOrderItemId must be a valid integer');
      }

      // Verify the custom order item exists
      const existingItem = await prisma.customOrderItem.findUnique({
        where: { id: parsedId }
      });
      
      if (!existingItem) {
        return sendBadRequest(res, `Custom order item with ID ${parsedId} not found`);
      }

      console.log(`✅ Validated customOrderItemId: ${parsedId} for item: "${existingItem.title}"`);
      finalCustomOrderItemId = parsedId;

      // Verify the title matches (optional check for data consistency)
      if (existingItem.title !== title) {
        console.log(`⚠️  Title mismatch: session="${title}" vs item="${existingItem.title}"`);
      }
    } else {
      // Try to find custom order item by title if no ID provided (fallback for debugging)
      console.log(`🔍 No customOrderItemId provided, searching for item by title: "${title}"`);
      
      try {
        const matchingItem = await prisma.customOrderItem.findFirst({
          where: {
            title: {
              equals: title,
              mode: 'insensitive'
            },
            mediaType: mediaType
          }
        });
        
        if (matchingItem) {
          finalCustomOrderItemId = matchingItem.id;
          console.log(`✅ Found matching custom order item by title: ID ${finalCustomOrderItemId}`);
        } else {
          console.log(`📝 No matching custom order item found for title: "${title}"`);
        }
      } catch (searchError) {
        console.error('❌ Error searching for custom order item by title:', searchError);
      }
    }

    // Start reading session using the service directly
    const readingSession = await watchLogService.startReading({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('✅ Reading session started successfully:', readingSession.id);

    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: readingSession.id,
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle,
        customOrderItemId: finalCustomOrderItemId,
        startedAt: readingSession.startedAt,
        isPaused: readingSession.isPaused || false,
        message: `Started reading session for "${title}"`,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Reading session start successful:', JSON.stringify(androidResponse, null, 2));
    return sendSuccess(res, androidResponse.data);
  }));

  // Pause/Resume reading session
  router.post('/reading/pause', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to pause/resume reading session...');
    
    // Get active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    if (!activeSession) {
      return sendBadRequest(res, 'No active reading session found');
    }

    // Pause the reading session
    const updatedSession = await watchLogService.pauseReading(activeSession.id);
    
    console.log('✅ Reading session paused/resumed successfully:', updatedSession.id);

    // Success response in Android format
    const androidResponse = {
      type: updatedSession.isPaused ? 'READING_SESSION_PAUSED' : 'READING_SESSION_RESUMED',
      data: {
        success: true,
        sessionId: updatedSession.id,
        isPaused: updatedSession.isPaused,
        title: updatedSession.title,
        mediaType: updatedSession.mediaType,
        message: updatedSession.isPaused ?
          `Paused reading session for "${updatedSession.title}"` :
          `Resumed reading session for "${updatedSession.title}"`,
        pausedAt: updatedSession.pausedAt,
        totalActiveTime: updatedSession.totalActiveTime,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Reading session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
    return sendSuccess(res, androidResponse.data);
  }));

  // Stop reading session
  router.post('/reading/stop', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to stop reading session...');
    
    const { progress } = req.body;

    // Get active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    if (!activeSession) {
      return sendBadRequest(res, 'No active reading session found');
    }

    // Check if this is a History Plus session
    const isHistoryPlusSession = activeSession.seriesTitle && activeSession.seriesTitle.startsWith('HISTORY_PLUS:');
    
    console.log(`📱 Session type: ${isHistoryPlusSession ? 'History Plus' : 'Regular'}, seriesTitle: ${activeSession.seriesTitle}`);

    // Stop the reading session
    const stoppedSession = await watchLogService.stopReading(activeSession.id);

    // Handle different scenarios based on session outcome
    if (stoppedSession.deleted) {
      // Session was deleted due to being under 1 minute
      console.log('Reading session was deleted (under 1 minute)');
      
      const androidResponse = {
        type: 'READING_SESSION_DELETED',
        data: {
          success: true,
          sessionDeleted: true,
          reason: 'Session duration was less than 1 minute',
          totalTime: stoppedSession.totalTime || 0,
          message: 'Reading session deleted (too short)',
          timestamp: new Date().toISOString()
        }
      };
      
      return sendSuccess(res, androidResponse.data);
    }

    if (isHistoryPlusSession) {
      console.log('📚 Processing History Plus reading session stop...');
      
      // Parse History Plus context from seriesTitle
      const contextParts = activeSession.seriesTitle.split(':');
      if (contextParts.length >= 4) {
        const [prefix, eventId, contentType, contentId] = contextParts;
        
        console.log(`📚 History Plus context: eventId=${eventId}, contentType=${contentType}, contentId=${contentId}`);
        
        // Update progress in the unified book system if we have progress data
        let actuallyMarkedAsRead = false;
        let finalProgressData = null;
        
        if (progress) {
          console.log('📚 Processing History Plus reading progress:', progress);
          
          try {
            // For History Plus sessions, we need to update the underlying book completion
            // We can get the book ID from the content hierarchy
            let bookId = null;
            
            if (contentType === 'book') {
              bookId = parseInt(contentId);
            } else if (contentType === 'chapter') {
              const chapter = await prisma.bookChapter.findUnique({
                where: { id: parseInt(contentId) },
                select: { bookId: true }
              });
              bookId = chapter?.bookId;
            } else if (contentType === 'section') {
              const section = await prisma.bookSection.findUnique({
                where: { id: parseInt(contentId) },
                include: { chapter: { select: { bookId: true } } }
              });
              bookId = section?.chapter?.bookId;
            }
            
            if (bookId) {
              console.log(`📚 Updating History Plus book ${bookId} progress...`);
              
              const sessionData = {};
              
              if (progress.currentPage !== undefined && progress.currentPage >= 0) {
                sessionData.currentPage = progress.currentPage;
              }
              
              if (progress.readPercentage !== undefined && progress.readPercentage >= 0 && progress.readPercentage <= 100) {
                sessionData.percentRead = progress.readPercentage;
                
                if (progress.readPercentage === 100) {
                  sessionData.isCompleted = true;
                  actuallyMarkedAsRead = true;
                  console.log('📚 Marking History Plus book as completed (100% reading progress)');
                }
              }
              
              if (progress.totalPages !== undefined && progress.totalPages > 0) {
                sessionData.totalPages = progress.totalPages;
              }
              
              // Update the unified BookCompletion system
              await bookCompletionService.updateProgressFromSession(bookId, sessionData);
              console.log('📚 History Plus book completion updated successfully');
              
              // Also mark specific chapter/section as completed if 100%
              if (progress.readPercentage === 100) {
                if (contentType === 'chapter') {
                  await bookCompletionService.markChapterCompleted(parseInt(contentId));
                  console.log(`✅ Marked History Plus chapter ${contentId} as completed`);
                } else if (contentType === 'section') {
                  await bookCompletionService.markSectionCompleted(parseInt(contentId));
                  console.log(`✅ Marked History Plus section ${contentId} as completed`);
                }
              }
              
              finalProgressData = {
                currentPage: progress.currentPage,
                totalPages: progress.totalPages,
                readPercentage: progress.readPercentage
              };
            } else {
              console.log('⚠️ Could not determine book ID for History Plus content');
            }
          } catch (progressError) {
            console.error('Error updating History Plus reading progress:', progressError);
          }
        }
        
        // Return History Plus specific response
        const androidResponse = {
          type: 'READING_SESSION_STOPPED',
          data: {
            success: true,
            sessionId: stoppedSession.id,
            title: activeSession.title,
            mediaType: activeSession.mediaType,
            duration: stoppedSession.duration,
            totalActiveTime: stoppedSession.totalTime,
            progressUpdated: finalProgressData ? true : false,
            progress: finalProgressData || progress || null,
            markedAsRead: actuallyMarkedAsRead,
            message: actuallyMarkedAsRead
              ? `Completed reading "${activeSession.title}" and marked as read`
              : `Stopped History Plus reading session for "${activeSession.title}"`,
            completedAt: stoppedSession.endTime,
            timestamp: new Date().toISOString()
          }
        };

        console.log('✅ History Plus reading session stop successful:', JSON.stringify(androidResponse, null, 2));
        return sendSuccess(res, androidResponse.data);
      } else {
        console.log('⚠️ Invalid History Plus seriesTitle format');
      }
    }

    // Regular custom order reading session logic continues below...
    // Check if this will result in 100% completion for better response handling
    const willMarkAsRead = progress?.readPercentage === 100;

    console.log('Stopping session with ID:', activeSession.id);

    // Update reading progress if provided and custom order item exists
    let actuallyMarkedAsRead = false;
    let finalProgressData = null;
    if (progress && activeSession.customOrderItemId) {
      console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        // Get existing item data for calculations
        const existingItem = await prisma.customOrderItem.findUnique({
          where: { id: activeSession.customOrderItemId },
          select: { 
            bookId: true,
            title: true,
            mediaType: true
          }
        });

        // Determine if this is a book or comic/other media
        const isUnifiedBook = existingItem?.bookId !== null;
        const isBookMediaType = activeSession.mediaType === 'book';
        
        console.log(`Media type: ${activeSession.mediaType}, Has bookId: ${!!existingItem?.bookId}, IsUnifiedBook: ${isUnifiedBook}`);

        let updateData = {};
        let currentPage, totalPages, finalReadPercentage;

        if (isUnifiedBook && isBookMediaType) {
          // FOR BOOKS: Only update unified system, do NOT touch CustomOrderItem book fields
          console.log('📚 Processing book progress update - using unified system only');
          
          // Calculate values but don't store in CustomOrderItem
          currentPage = progress.currentPage !== undefined ? progress.currentPage : null;
          totalPages = progress.totalPages !== undefined ? progress.totalPages : null;
          
          // Calculate read percentage if we have current page and total pages
          let calculatedReadPercentage = null;
          if (currentPage !== null && totalPages && totalPages > 0) {
            calculatedReadPercentage = Math.round((currentPage / totalPages) * 100);
            calculatedReadPercentage = Math.min(100, Math.max(0, calculatedReadPercentage));
            console.log(`📚 Calculated read percentage: ${calculatedReadPercentage}% (${currentPage}/${totalPages})`);
          }
          
          finalReadPercentage = progress.readPercentage !== undefined ? progress.readPercentage : calculatedReadPercentage;
          
          // Debug logging for Android percentage values
          console.log(`📊 Debug - Raw progress.readPercentage: ${progress.readPercentage} (type: ${typeof progress.readPercentage})`);
          console.log(`📊 Debug - Final read percentage: ${finalReadPercentage} (type: ${typeof finalReadPercentage})`);
          
          // Convert to number if needed and handle different formats from Android
          let normalizedPercentage = null;
          if (finalReadPercentage !== null && finalReadPercentage !== undefined) {
            // Convert to number if it's a string
            normalizedPercentage = typeof finalReadPercentage === 'string' ? parseFloat(finalReadPercentage) : finalReadPercentage;
            
            // Handle cases where Android might send 1.0 to mean 100%
            if (normalizedPercentage > 0 && normalizedPercentage <= 1) {
              normalizedPercentage = normalizedPercentage * 100;
              console.log(`📊 Converted decimal percentage ${finalReadPercentage} to ${normalizedPercentage}%`);
            }
            
            // Round to handle floating point precision issues
            normalizedPercentage = Math.round(normalizedPercentage * 100) / 100;
            console.log(`📊 Normalized percentage: ${normalizedPercentage}%`);
          }
          
          // Mark as read if 100% (with tolerance for floating point issues)
          const isComplete = normalizedPercentage !== null && normalizedPercentage >= 99.95; // Allow slight precision errors
          if (isComplete) {
            updateData.isWatched = true;
            actuallyMarkedAsRead = true;
            console.log(`✅ Will mark book as read in unified system (${normalizedPercentage}% completion >= 99.95%)`);
          } else if (normalizedPercentage !== null) {
            console.log(`📊 Book not marked as read - completion is ${normalizedPercentage}% (needs >= 99.95%)`);
          }
          
          // Update finalReadPercentage with normalized value for response
          finalReadPercentage = normalizedPercentage;
        } else {
          // FOR COMICS/OTHER: Comics don't use the unified book system
          console.log('📖 Processing comic/other media progress update - unified system not applicable for comics');
          
          // Calculate read percentage for comics (without storing in deprecated fields)
          currentPage = progress.currentPage !== undefined ? progress.currentPage : null;
          totalPages = progress.totalPages !== undefined ? progress.totalPages : null;
          
          let calculatedReadPercentage = null;
          if (currentPage !== null && totalPages && totalPages > 0) {
            calculatedReadPercentage = Math.round((currentPage / totalPages) * 100);
            calculatedReadPercentage = Math.min(100, Math.max(0, calculatedReadPercentage));
            console.log(`Calculated read percentage: ${calculatedReadPercentage}% (${currentPage}/${totalPages})`);
          }
          
          finalReadPercentage = progress.readPercentage !== undefined ? progress.readPercentage : calculatedReadPercentage;
          
          // Debug logging for Android percentage values
          console.log(`📊 Debug - Raw progress.readPercentage: ${progress.readPercentage} (type: ${typeof progress.readPercentage})`);
          console.log(`📊 Debug - Final read percentage: ${finalReadPercentage} (type: ${typeof finalReadPercentage})`);
          
          // Convert to number if needed and handle different formats from Android
          let normalizedPercentage = null;
          if (finalReadPercentage !== null && finalReadPercentage !== undefined) {
            // Convert to number if it's a string
            normalizedPercentage = typeof finalReadPercentage === 'string' ? parseFloat(finalReadPercentage) : finalReadPercentage;
            
            // Handle cases where Android might send 1.0 to mean 100%
            if (normalizedPercentage > 0 && normalizedPercentage <= 1) {
              normalizedPercentage = normalizedPercentage * 100;
              console.log(`📊 Converted decimal percentage ${finalReadPercentage} to ${normalizedPercentage}%`);
            }
            
            // Round to handle floating point precision issues
            normalizedPercentage = Math.round(normalizedPercentage * 100) / 100;
            console.log(`📊 Normalized percentage: ${normalizedPercentage}%`);
          }
          
          // Mark comic as read if 100% (with tolerance for floating point issues)
          const isComplete = normalizedPercentage !== null && normalizedPercentage >= 99.95; // Allow slight precision errors
          if (isComplete) {
            updateData.isWatched = true;
            actuallyMarkedAsRead = true;
            console.log(`✅ Marking comic as read/watched (${normalizedPercentage}% completion >= 99.95%)`);
          } else if (normalizedPercentage !== null) {
            console.log(`📊 Comic not marked as read - completion is ${normalizedPercentage}% (needs >= 99.95%)`);
          }
          
          // Update finalReadPercentage with normalized value for response
          finalReadPercentage = normalizedPercentage;
        }
        
        // Apply updates to CustomOrderItem only for comics/other media (not books)
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          if (isUnifiedBook && isBookMediaType) {
            console.log('📚 Updated book completion status in CustomOrderItem (isWatched only):', updateData);
          } else {
            console.log('📖 Updated reading progress in CustomOrderItem (legacy fields):', updateData);
          }
        }

        // Update unified BookCompletion system for books
        if (isUnifiedBook && isBookMediaType) {
          console.log('📚 Updating unified BookCompletion for book:', existingItem.bookId);
          
          const sessionData = {};
          
          if (currentPage !== undefined && currentPage !== null && currentPage >= 0) {
            sessionData.currentPage = currentPage;
          }
          
          if (finalReadPercentage !== null && finalReadPercentage >= 0 && finalReadPercentage <= 100) {
            sessionData.percentRead = finalReadPercentage;
            
            // Use normalized percentage for completion checking
            if (isComplete) {
              sessionData.isCompleted = true;
              actuallyMarkedAsRead = true; // Update flag for unified system completion
              console.log('📚 Marking book as completed in unified system (normalized percentage >= 99.95%:', normalizedPercentage + '%)');
            }
          }
          
          if (totalPages !== undefined && totalPages > 0) {
            sessionData.totalPages = totalPages;
          }

          // Update the unified BookCompletion system
          const bookCompletionResult = await bookCompletionService.updateProgressFromSession(existingItem.bookId, sessionData);
          console.log('📚 Unified BookCompletion updated successfully for book:', existingItem.bookId);
          
          // Double-check if book was actually marked as completed by the service
          if (bookCompletionResult?.isCompleted && finalReadPercentage === 100) {
            actuallyMarkedAsRead = true;
            console.log('📚 Confirmed: Book marked as completed in unified system');
          }
          
          // Ensure Book record has correct pageCount
          if (totalPages !== undefined && totalPages > 0) {
            try {
              const book = await prisma.book.findUnique({
                where: { id: existingItem.bookId },
                select: { pageCount: true }
              });
              
              if (book && !book.pageCount) {
                await prisma.book.update({
                  where: { id: existingItem.bookId },
                  data: { pageCount: totalPages }
                });
                console.log(`📚 Updated Book ${existingItem.bookId} pageCount to ${totalPages}`);
              }
            } catch (bookUpdateError) {
              console.error('Error updating Book pageCount:', bookUpdateError);
            }
          }

          // For books, get progress data from what we just set
          finalProgressData = {
            currentPage: currentPage,
            totalPages: totalPages,
            readPercentage: finalReadPercentage
          };
        } else {
          console.log('📖 Skipping unified BookCompletion update (not a unified book)');
          
          // For comics/other media, get progress data from calculated values
          finalProgressData = {
            currentPage: currentPage,
            totalPages: totalPages,
            readPercentage: finalReadPercentage
          };
        }
      } catch (progressError) {
        console.error('Error updating reading progress:', progressError);
        // Don't fail the entire request for progress update errors
      }
    } else {
      if (!progress) {
        console.log('No progress data provided');
      } else if (!activeSession.customOrderItemId) {
        console.log('No custom order item ID - standalone reading session');
      }
    }
    
    console.log('✅ Reading session stopped successfully:', stoppedSession.id);

    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: stoppedSession.id,
        title: activeSession.title,
        mediaType: activeSession.mediaType,
        duration: stoppedSession.duration,
        totalActiveTime: stoppedSession.totalTime,
        progressUpdated: finalProgressData ? true : false,
        progress: finalProgressData || progress || null,
        markedAsRead: actuallyMarkedAsRead, // Based on actual database update
        message: actuallyMarkedAsRead
          ? `Completed reading "${activeSession.title}" and marked as read`
          : `Stopped reading session for "${activeSession.title}"`,
        completedAt: stoppedSession.endTime,
        timestamp: new Date().toISOString()
      }
    };

    if (actuallyMarkedAsRead) {
      console.log(`📚 Comic/book marked as read due to 100% completion: ${activeSession.title}`);
    }

    console.log('✅ Reading session stop successful:', JSON.stringify(androidResponse, null, 2));
    return sendSuccess(res, androidResponse.data);
  }));

  return router;
}

module.exports = createReadingSessionRoutes;
