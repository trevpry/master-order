/**
 * Android Viewing Session Routes
 * Handles viewing session management for web videos
 */

const express = require('express');
const ViewingSessionService = require('../../services/watchlog/viewingSessionService');

/**
 * Create viewing session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createViewingSessionRoutes(prisma) {
  const router = express.Router();
  const viewingSessionService = new ViewingSessionService(prisma);

  // Start viewing session
  router.post('/viewing/start', async (req, res) => {
    console.log('📱 Android app starting viewing session...');
    
    try {
      const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
      
      if (!mediaType || !title) {
        return res.status(400).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: 'Media type and title are required',
            details: 'Missing required fields',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (mediaType !== 'webvideo') {
        return res.status(400).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: 'Invalid media type',
            details: 'Viewing sessions only support webvideo media type',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Start viewing session using service
      const session = await viewingSessionService.startViewing({
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle || null,
        customOrderItemId: customOrderItemId || null
      });
      
      const response = {
        type: 'VIEWING_SESSION_STARTED',
        data: {
          success: true,
          sessionId: session.id,
          mediaType: mediaType,
          title: title,
          seriesTitle: seriesTitle || null,
          customOrderItemId: customOrderItemId || null,
          startedAt: session.startTime.toISOString(),
          isPaused: false,
          message: `Started viewing session for "${title}"`,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('📱 Viewing session started for Android app:', session.id);
      res.json(response);
      
    } catch (error) {
      console.error('❌ Error in Android viewing start endpoint:', error);
      
      res.status(500).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Failed to start viewing session',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Pause/Resume viewing session
  router.post('/viewing/pause', async (req, res) => {
    console.log('📱 Android app pausing/resuming viewing session...');
    
    try {
      // Get active viewing session
      const activeSession = await viewingSessionService.getActiveViewingSession();
      
      if (!activeSession) {
        return res.status(404).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: 'No active viewing session found',
            details: 'Start a viewing session first',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Pause or resume the session
      const updatedSession = await viewingSessionService.pauseViewing(activeSession.id);
      
      const isPaused = updatedSession.isPaused;
      const action = isPaused ? 'Paused' : 'Resumed';
      const totalActiveTime = Math.round((updatedSession.totalWatchTime || 0) * 60); // Convert minutes to seconds
      
      const response = {
        type: 'VIEWING_SESSION_PAUSED',
        data: {
          success: true,
          sessionId: updatedSession.id,
          isPaused: isPaused,
          title: updatedSession.title,
          mediaType: updatedSession.mediaType,
          message: `${action} viewing session for "${updatedSession.title}"`,
          pausedAt: isPaused ? updatedSession.endTime.toISOString() : null,
          totalActiveTime: totalActiveTime,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log(`📱 Viewing session ${action.toLowerCase()} for Android app`);
      res.json(response);
      
    } catch (error) {
      console.error('❌ Error in Android viewing pause endpoint:', error);
      
      res.status(500).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Failed to pause viewing session',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Stop viewing session
  router.post('/viewing/stop', async (req, res) => {
    console.log('📱 Android app stopping viewing session...');
    
    try {
      const { progress } = req.body;
      
      // Get active viewing session
      const activeSession = await viewingSessionService.getActiveViewingSession();
      
      if (!activeSession) {
        return res.status(404).json({
          type: 'VIEWING_SESSION_ERROR',
          data: {
            success: false,
            error: 'No active viewing session found',
            details: 'No active session to stop',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Stop the viewing session
      const completedSession = await viewingSessionService.stopViewing(activeSession.customOrderItemId);
      
      const duration = Math.round((completedSession.endTime - completedSession.startTime) / 1000); // Total session duration in seconds
      const totalActiveTime = Math.round((completedSession.totalWatchTime || 0) * 60); // Active watch time in seconds
      
      const response = {
        type: 'VIEWING_SESSION_STOPPED',
        data: {
          success: true,
          sessionId: completedSession.id,
          title: completedSession.title,
          mediaType: completedSession.mediaType,
          duration: duration,
          totalActiveTime: totalActiveTime,
          progressUpdated: !!progress,
          progress: progress || null,
          message: `Stopped viewing session for "${completedSession.title}"`,
          completedAt: completedSession.endTime.toISOString(),
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('📱 Viewing session stopped for Android app');
      res.json(response);
      
    } catch (error) {
      console.error('❌ Error in Android viewing stop endpoint:', error);
      
      res.status(500).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Failed to stop viewing session',
          details: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  return router;
}

module.exports = createViewingSessionRoutes;