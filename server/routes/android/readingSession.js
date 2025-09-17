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
    
    const { mediaType, title, seriesTitle, customOrderItemId, id } = req.body;

    // The Android app might send the custom order item ID as either 'customOrderItemId' or 'id'
    const actualCustomOrderItemId = customOrderItemId || id;

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

    // Check if this will result in 100% completion for better response handling
    const willMarkAsRead = progress?.readPercentage === 100;

    // Get active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    if (!activeSession) {
      return sendBadRequest(res, 'No active reading session found');
    }

    console.log('Stopping session with ID:', activeSession.id);

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

    // Update reading progress if provided and custom order item exists
    let actuallyMarkedAsRead = false;
    let finalProgressData = null;
    if (progress && activeSession.customOrderItemId) {
      console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        // Get existing item data for calculations
        const existingItem = await prisma.customOrderItem.findUnique({
          where: { id: activeSession.customOrderItemId },
          select: { 
            bookPageCount: true, 
            bookCurrentPage: true, 
            bookPercentRead: true,
            bookId: true,
            title: true
          }
        });

        // Update current page (allow 0 as valid page number)
        if (progress.currentPage !== undefined && progress.currentPage !== null && progress.currentPage >= 0) {
          updateData.bookCurrentPage = progress.currentPage;
          console.log(`Setting current page to: ${progress.currentPage}`);
        }
        
        // Calculate read percentage if we have current page and total pages
        let calculatedReadPercentage = null;
        const currentPage = progress.currentPage !== undefined ? progress.currentPage : existingItem?.bookCurrentPage;
        const totalPages = progress.totalPages !== undefined ? progress.totalPages : existingItem?.bookPageCount;
        
        if (currentPage !== null && totalPages && totalPages > 0) {
          calculatedReadPercentage = Math.round((currentPage / totalPages) * 100);
          calculatedReadPercentage = Math.min(100, Math.max(0, calculatedReadPercentage)); // Clamp to 0-100
          console.log(`Calculated read percentage: ${calculatedReadPercentage}% (${currentPage}/${totalPages})`);
        }
        
        // Update read percentage (use provided value or calculated value)
        const finalReadPercentage = progress.readPercentage !== undefined ? progress.readPercentage : calculatedReadPercentage;
        
        if (finalReadPercentage !== null && finalReadPercentage >= 0 && finalReadPercentage <= 100) {
          updateData.bookPercentRead = finalReadPercentage;
          console.log(`Setting read percentage to: ${finalReadPercentage}%`);
          
          // If read percentage is 100%, mark as read/watched
          if (finalReadPercentage === 100) {
            updateData.isWatched = true;
            actuallyMarkedAsRead = true;
            console.log('Marking item as read/watched (100% completion)');
          }
        }
        
        
        // Update total page count only if not already set (during initial import)
        if (progress.totalPages !== undefined && progress.totalPages !== null && progress.totalPages > 0) {
          // Only set page count if it hasn't been set before (during import)
          if (!existingItem?.bookPageCount) {
            updateData.bookPageCount = progress.totalPages;
            console.log(`Setting initial total page count to: ${progress.totalPages}`);
          } else {
            console.log(`Total page count already set: ${existingItem.bookPageCount} (not changing)`);
          }
        }
        
        // Apply the updates to legacy fields if there are any
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Reading progress updated successfully (legacy fields):', updateData);
        } else {
          console.log('No valid progress data to update (legacy fields)');
        }

        // Update unified BookCompletion system if bookId exists
        if (existingItem?.bookId) {
          console.log('Updating unified BookCompletion for book:', existingItem.bookId);
          
          const sessionData = {};
          
          if (progress.currentPage !== undefined && progress.currentPage > 0) {
            sessionData.currentPage = progress.currentPage;
          }
          
          if (finalReadPercentage !== null && finalReadPercentage >= 0 && finalReadPercentage <= 100) {
            sessionData.percentRead = finalReadPercentage;
            
            // Mark as completed if 100%
            if (finalReadPercentage === 100) {
              sessionData.isCompleted = true;
              console.log('Marking book as completed in unified system (100% reading progress)');
            }
          }
          
          if (progress.totalPages !== undefined && progress.totalPages > 0) {
            sessionData.totalPages = progress.totalPages;
          }

          // Update the unified BookCompletion system
          await bookCompletionService.updateProgressFromSession(existingItem.bookId, sessionData);
          console.log('Unified BookCompletion updated successfully for book:', existingItem.bookId);
          
          // Ensure Book record has correct pageCount (migrate from CustomOrderItem if needed)
          if (progress.totalPages !== undefined && progress.totalPages > 0) {
            try {
              const book = await prisma.book.findUnique({
                where: { id: existingItem.bookId },
                select: { pageCount: true }
              });
              
              if (book && !book.pageCount) {
                await prisma.book.update({
                  where: { id: existingItem.bookId },
                  data: { pageCount: progress.totalPages }
                });
                console.log(`📚 Updated Book ${existingItem.bookId} pageCount to ${progress.totalPages}`);
              }
            } catch (bookUpdateError) {
              console.error('Error updating Book pageCount:', bookUpdateError);
            }
          }
        } else {
          console.log('CustomOrderItem has no linked bookId - cannot update unified progress');
        }
        
        // Store the final progress data for response
        finalProgressData = {
          currentPage: updateData.bookCurrentPage || currentPage,
          totalPages: updateData.bookPageCount || totalPages,
          readPercentage: updateData.bookPercentRead || finalReadPercentage
        };
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
