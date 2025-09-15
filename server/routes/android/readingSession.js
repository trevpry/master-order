/**
 * Android Reading Session Routes
 * Handles reading session management for books, comics, and short stories
 * Uses direct service calls for consistency with web interface
 */

const express = require('express');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../../utils/responses');
const { validateRequiredFields } = require('../../middleware/validation');
const WatchLogService = require('../../watchLogService');
const prisma = require('../../prismaClient');

/**
 * Create reading session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createReadingSessionRoutes(prisma) {
  const router = express.Router();
  const watchLogService = new WatchLogService(prisma);

  // Start reading session
  router.post('/reading/start', asyncHandler(async (req, res) => {
    console.log('📱 Android app requesting to start reading session...');
    
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;

    // Validate required fields
    if (!mediaType || !title) {
      return sendBadRequest(res, 'mediaType and title are required');
    }

    // Validate media type
    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      return sendBadRequest(res, 'Reading sessions are only supported for books, comics, and stories');
    }

    console.log(`📱 Start reading session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);

    // Validate customOrderItemId if provided
    let finalCustomOrderItemId = null;
    if (customOrderItemId) {
      const parsedId = parseInt(customOrderItemId);
      if (Number.isInteger(parsedId)) {
        const existingItem = await prisma.customOrderItem.findUnique({
          where: { id: parsedId }
        });
        
        if (existingItem) {
          finalCustomOrderItemId = parsedId;
          console.log(`✅ Validated customOrderItemId: ${finalCustomOrderItemId}`);
        } else {
          console.log(`⚠️  CustomOrderItem ${parsedId} not found - proceeding without link`);
        }
      } else {
        console.log('⚠️  Invalid customOrderItemId format - proceeding without link');
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
    if (progress && activeSession.customOrderItemId) {
      console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        // Update current page (allow 0 as valid page number)
        if (progress.currentPage !== undefined && progress.currentPage !== null && progress.currentPage >= 0) {
          updateData.bookCurrentPage = progress.currentPage;
          console.log(`Setting current page to: ${progress.currentPage}`);
        }
        
        // Update read percentage
        if (progress.readPercentage !== undefined && progress.readPercentage !== null && progress.readPercentage >= 0 && progress.readPercentage <= 100) {
          updateData.bookPercentRead = progress.readPercentage;
          console.log(`Setting read percentage to: ${progress.readPercentage}%`);
          
          // If read percentage is 100%, mark as read/watched
          if (progress.readPercentage === 100) {
            updateData.isWatched = true;
            actuallyMarkedAsRead = true;
            console.log('Marking item as read/watched (100% completion)');
          }
        }
        
        // Update total page count only if not already set (during initial import)
        if (progress.totalPages !== undefined && progress.totalPages !== null && progress.totalPages > 0) {
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { bookPageCount: true }
          });
          
          // Only set page count if it hasn't been set before (during import)
          if (!existingItem?.bookPageCount) {
            updateData.bookPageCount = progress.totalPages;
            console.log(`Setting initial total page count to: ${progress.totalPages}`);
          } else {
            console.log(`Total page count already set: ${existingItem.bookPageCount} (not changing)`);
          }
        }
        
        // Apply the updates if there are any
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Reading progress updated successfully:', updateData);
        } else {
          console.log('No valid progress data to update');
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
        progressUpdated: progress ? true : false,
        progress: progress || null,
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
