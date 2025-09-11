/**
 * Android Reading Session Routes
 * Handles reading session management for books, comics, and short stories
 */

const express = require('express');
const ReadingSessionService = require('../../services/watchlog/readingSessionService');

/**
 * Create reading session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createReadingSessionRoutes(prisma) {
  const router = express.Router();
  const readingSessionService = new ReadingSessionService(prisma);

  // Start reading session
  router.post('/reading/start', async (req, res) => {
    console.log('📱 Android app requesting to start reading session...');
    
    try {
      const { mediaType, title, customOrderItemId } = req.body;

      // Validate required fields per documentation
      if (!mediaType) {
        return res.status(400).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'Missing mediaType',
            message: 'mediaType is required and must be "book", "comic", or "shortstory"',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate mediaType per documentation
      if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
        return res.status(400).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'Invalid mediaType',
            message: 'mediaType must be "book", "comic", or "shortstory"',
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log(`📱 Starting reading session: ${mediaType} - ${title || 'Unknown Title'}`);

      // Use the reading session service to start the session
      const session = await readingSessionService.startReading({
        mediaType,
        title: title || 'Unknown Title',
        customOrderItemId: customOrderItemId || null
      });

      const androidResponse = {
        type: 'READING_SESSION_STARTED',
        data: {
          success: true,
          sessionId: session.id,
          mediaType: session.mediaType,
          title: session.title,
          customOrderItemId: session.customOrderItemId,
          startTime: session.startTime.toISOString(),
          status: 'active',
          message: `Started reading session for "${session.title}"`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📱 Reading session started successfully for Android app');
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session start endpoint:', error);
      
      res.status(500).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Failed to start reading session',
          message: error.message || 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Pause reading session
  router.post('/reading/pause', async (req, res) => {
    console.log('📱 Android app requesting to pause reading session...');
    
    try {
      // Find the active reading session (no sessionId required as per documentation)
      const activeSession = await prisma.watchLog.findFirst({
        where: {
          activityType: 'read',
          endTime: null
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      if (!activeSession) {
        return res.status(404).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'No active reading session',
            message: 'No active reading session found to pause',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Use the reading session service to pause/resume the session
      const updatedSession = await readingSessionService.pauseReading(activeSession.id);

      const androidResponse = {
        type: 'READING_SESSION_PAUSED',
        data: {
          success: true,
          sessionId: updatedSession.id,
          mediaType: updatedSession.mediaType,
          title: updatedSession.title,
          status: updatedSession.isPaused ? 'paused' : 'active',
          totalTime: updatedSession.totalWatchTime || 0,
          message: updatedSession.isPaused ? 
            `Paused reading session for "${updatedSession.title}"` : 
            `Resumed reading session for "${updatedSession.title}"`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📱 Reading session pause/resume completed for Android app');
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session pause endpoint:', error);
      
      res.status(500).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Failed to pause reading session',
          message: error.message || 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Stop reading session
  router.post('/reading/stop', async (req, res) => {
    console.log('📱 Android app requesting to stop reading session...');
    
    try {
      const { markAsRead } = req.body;

      // Find the active reading session (no sessionId required as per documentation)
      const activeSession = await prisma.watchLog.findFirst({
        where: {
          activityType: 'read',
          endTime: null
        },
        orderBy: {
          startTime: 'desc'
        }
      });

      if (!activeSession) {
        return res.status(404).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'No active reading session',
            message: 'No active reading session found to stop',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Use the reading session service to stop the session
      const stoppedSession = await readingSessionService.stopReading(activeSession.id, markAsRead);

      const androidResponse = {
        type: 'READING_SESSION_STOPPED',
        data: {
          success: true,
          sessionId: stoppedSession.id,
          mediaType: stoppedSession.mediaType,
          title: stoppedSession.title,
          totalTime: stoppedSession.totalWatchTime || 0,
          isCompleted: stoppedSession.isCompleted,
          markedAsRead: markAsRead || false,
          message: `Stopped reading session for "${stoppedSession.title}" (${stoppedSession.totalWatchTime || 0} minutes)`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('📱 Reading session stopped successfully for Android app');
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session stop endpoint:', error);
      
      res.status(500).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Failed to stop reading session',
          message: error.message || 'An unexpected error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  return router;
}

module.exports = createReadingSessionRoutes;
