/**
 * Android Reading Session Routes
 * Handles reading session management for books, comics, and short stories
 * Delegates to main API endpoints for consistency with web interface
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl } = require('./utilities/androidHelpers');

/**
 * Create reading session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createReadingSessionRoutes(prisma) {
  const router = express.Router();

  // Start reading session
  router.post('/reading/start', async (req, res) => {
    console.log('📱 Android app requesting to start reading session...');
    
    try {
      const { mediaType, title, seriesTitle, customOrderItemId } = req.body;

      if (!mediaType || !title) {
        return res.status(400).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'Missing required fields',
            message: 'mediaType and title are required'
          }
        });
      }

      if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
        return res.status(400).json({
          type: 'READING_SESSION_ERROR',
          data: {
            error: 'Invalid media type',
            message: 'Reading sessions are only supported for books, comics, and stories'
          }
        });
      }

      console.log(`📱 Start reading session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);

      // Use existing reading session start endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const sessionResponse = await fetch(`${baseUrl}/api/reading/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mediaType,
          title,
          seriesTitle,
          customOrderItemId
        })
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        console.error('Failed to start reading session:', sessionData);

        const androidErrorResponse = {
          type: 'READING_SESSION_ERROR',
          data: {
            success: false,
            mediaType: mediaType,
            title: title,
            error: sessionData.error || 'Failed to start reading session',
            details: sessionData.details || 'Check server logs for more information',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(sessionResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Reading session started successfully:', JSON.stringify(sessionData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: 'READING_SESSION_STARTED',
        data: {
          success: true,
          sessionId: sessionData.id,
          mediaType: mediaType,
          title: title,
          seriesTitle: seriesTitle,
          customOrderItemId: customOrderItemId,
          startedAt: sessionData.startedAt,
          isPaused: sessionData.isPaused || false,
          message: `Started reading session for "${title}"`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Reading session start successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session start endpoint:', error);

      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      };

      res.status(500).json(androidErrorResponse);
    }
  });

  // Pause/Resume reading session
  router.post('/reading/pause', async (req, res) => {
    console.log('📱 Android app requesting to pause/resume reading session...');
    
    try {
      // Use existing reading session pause endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const pauseResponse = await fetch(`${baseUrl}/api/reading/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const pauseData = await pauseResponse.json();

      if (!pauseResponse.ok) {
        console.error('Failed to pause/resume reading session:', pauseData);

        const androidErrorResponse = {
          type: 'READING_SESSION_ERROR',
          data: {
            success: false,
            error: pauseData.error || 'Failed to pause/resume reading session',
            details: pauseData.details || 'No active reading session found',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(pauseResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Reading session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: pauseData.isPaused ? 'READING_SESSION_PAUSED' : 'READING_SESSION_RESUMED',
        data: {
          success: true,
          sessionId: pauseData.id,
          isPaused: pauseData.isPaused,
          title: pauseData.title,
          mediaType: pauseData.mediaType,
          message: pauseData.isPaused ?
            `Paused reading session for "${pauseData.title}"` :
            `Resumed reading session for "${pauseData.title}"`,
          pausedAt: pauseData.pausedAt,
          totalActiveTime: pauseData.totalActiveTime,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Reading session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session pause endpoint:', error);

      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      };

      res.status(500).json(androidErrorResponse);
    }
  });

  // Stop reading session
  router.post('/reading/stop', async (req, res) => {
    console.log('📱 Android app requesting to stop reading session...');
    
    try {
      const { progress } = req.body;

      // Check if this will result in 100% completion for better response handling
      const willMarkAsRead = progress?.readPercentage === 100;

      // Use existing reading session stop endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const stopResponse = await fetch(`${baseUrl}/api/reading/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress })
      });

      const stopData = await stopResponse.json();

      if (!stopResponse.ok) {
        console.error('Failed to stop reading session:', stopData);

        const androidErrorResponse = {
          type: 'READING_SESSION_ERROR',
          data: {
            success: false,
            error: stopData.error || 'Failed to stop reading session',
            details: stopData.details || 'No active reading session found',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(stopResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Reading session stopped successfully:', JSON.stringify(stopData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: 'READING_SESSION_STOPPED',
        data: {
          success: true,
          sessionId: stopData.id,
          title: stopData.title,
          mediaType: stopData.mediaType,
          duration: stopData.duration,
          totalActiveTime: stopData.totalActiveTime,
          progressUpdated: progress ? true : false,
          progress: progress || null,
          markedAsRead: willMarkAsRead, // Indicate if item was marked as read due to 100% completion
          message: willMarkAsRead
            ? `Completed reading "${stopData.title}" and marked as read`
            : `Stopped reading session for "${stopData.title}"`,
          completedAt: stopData.completedAt,
          timestamp: new Date().toISOString()
        }
      };

      if (willMarkAsRead) {
        console.log(`📚 Comic/book marked as read due to 100% completion: ${stopData.title}`);
      }

      console.log('✅ Reading session stop successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android reading session stop endpoint:', error);

      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      };

      res.status(500).json(androidErrorResponse);
    }
  });

  return router;
  return router;
}

module.exports = createReadingSessionRoutes;

module.exports = createReadingSessionRoutes;
