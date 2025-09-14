/**
 * Android Viewing Session Routes
 * Handles viewing session management for web videos using delegation pattern
 */

const express = require('express');

/**
 * Helper function to get the base URL for API calls
 */
function getAndroidApiBaseUrl() {
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Create viewing session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createViewingSessionRoutes(prisma) {
  const router = express.Router();

  // Start viewing session
  router.post('/viewing/start', async (req, res) => {
    console.log('� Android app requesting to start viewing session...');
    
    try {
      const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
      
      if (!mediaType || !title) {
        return res.status(400).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            error: 'Missing required fields',
            message: 'mediaType and title are required'
          }
        });
      }

      if (!['webvideo'].includes(mediaType)) {
        return res.status(400).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            error: 'Invalid media type',
            message: 'Viewing sessions are only supported for web videos'
          }
        });
      }

      console.log(`🔲 Start viewing session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);

      // Use existing viewing session start endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const sessionResponse = await fetch(`${baseUrl}/api/viewing/start`, {
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
        console.error('Failed to start viewing session:', sessionData);

        const androidErrorResponse = {
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            mediaType: mediaType,
            title: title,
            error: sessionData.error || 'Failed to start viewing session',
            details: sessionData.details || 'Check server logs for more information',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(sessionResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Viewing session started successfully:', JSON.stringify(sessionData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: 'VIEWING_SESSION_STARTED',
        data: {
          success: true,
          sessionId: sessionData.id,
          mediaType: mediaType,
          title: title,
          seriesTitle: seriesTitle,
          customOrderItemId: customOrderItemId,
          startedAt: sessionData.startedAt,
          isPaused: sessionData.isPaused || false,
          message: `Started viewing session for "${title}"`,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Viewing session start successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android viewing session start endpoint:', error);

      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
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

  // Pause/Resume viewing session
  router.post('/viewing/pause', async (req, res) => {
    console.log('� Android app requesting to pause/resume viewing session...');
    
    try {
      // Use existing viewing session pause endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const pauseResponse = await fetch(`${baseUrl}/api/viewing/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const pauseData = await pauseResponse.json();

      if (!pauseResponse.ok) {
        console.error('Failed to pause/resume viewing session:', pauseData);

        const androidErrorResponse = {
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: pauseData.error || 'Failed to pause/resume viewing session',
            details: pauseData.details || 'No active viewing session found',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(pauseResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Viewing session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: pauseData.isPaused ? 'VIEWING_SESSION_PAUSED' : 'VIEWING_SESSION_RESUMED',
        data: {
          success: true,
          sessionId: pauseData.id,
          isPaused: pauseData.isPaused,
          title: pauseData.title,
          mediaType: pauseData.mediaType,
          message: pauseData.isPaused ?
            `Paused viewing session for "${pauseData.title}"` :
            `Resumed viewing session for "${pauseData.title}"`,
          pausedAt: pauseData.pausedAt,
          totalActiveTime: pauseData.totalActiveTime,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Viewing session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android viewing session pause endpoint:', error);

      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
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

  // Stop viewing session
  router.post('/viewing/stop', async (req, res) => {
    console.log('� Android app requesting to stop viewing session...');
    
    try {
      const { progress } = req.body;

      // Use existing viewing session stop endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const stopResponse = await fetch(`${baseUrl}/api/viewing/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ progress })
      });

      const stopData = await stopResponse.json();

      if (!stopResponse.ok) {
        console.error('Failed to stop viewing session:', stopData);

        const androidErrorResponse = {
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: stopData.error || 'Failed to stop viewing session',
            details: stopData.details || 'No active viewing session found',
            timestamp: new Date().toISOString()
          }
        };

        return res.status(stopResponse.status).json(androidErrorResponse);
      }

      console.log('✅ Viewing session stopped successfully:', JSON.stringify(stopData, null, 2));

      // Success response in Android format
      const androidResponse = {
        type: 'VIEWING_SESSION_STOPPED',
        data: {
          success: true,
          sessionId: stopData.id,
          title: stopData.title,
          mediaType: stopData.mediaType,
          duration: stopData.duration,
          totalActiveTime: stopData.totalActiveTime,
          progressUpdated: progress ? true : false,
          progress: progress || null,
          message: `Stopped viewing session for "${stopData.title}"`,
          completedAt: stopData.completedAt,
          timestamp: new Date().toISOString()
        }
      };

      console.log('✅ Viewing session stop successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);

    } catch (error) {
      console.error('❌ Error in Android viewing session stop endpoint:', error);

      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
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
}

module.exports = createViewingSessionRoutes;