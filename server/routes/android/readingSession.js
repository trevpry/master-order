/**
 * Android Reading Session Routes
 * Handles reading session management for books, comics, and short stories
 */

const express = require('express');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

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
        return res.status(400).json(createAndroidErrorResponse(
          'READING_SESSION_ERROR',
          'Missing required fields',
          'mediaType and title are required'
        ));
      }
      
      if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
        return res.status(400).json(createAndroidErrorResponse(
          'READING_SESSION_ERROR',
          'Invalid media type',
          'Media type must be book, comic, or shortstory'
        ));
      }
      
      // Create reading session
      const session = await prisma.readingSession.create({
        data: {
          mediaType: mediaType,
          title: title,
          seriesTitle: seriesTitle,
          customOrderItemId: customOrderItemId,
          startTime: new Date(),
          source: 'android_app',
          active: true
        }
      });
      
      const androidResponse = createAndroidResponse('READING_SESSION_SUCCESS', {
        success: true,
        action: 'start_reading',
        session: {
          id: session.id,
          mediaType: session.mediaType,
          title: session.title,
          seriesTitle: session.seriesTitle,
          startTime: session.startTime,
          active: session.active
        },
        message: 'Reading session started successfully'
      });
      
      console.log('📱 Reading session started for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android reading start endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'READING_SESSION_ERROR',
        'Failed to start reading session',
        error.message
      ));
    }
  });

  // Pause reading session
  router.post('/reading/pause', async (req, res) => {
    console.log('📱 Android app requesting to pause reading session...');
    
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json(createAndroidErrorResponse(
          'READING_SESSION_ERROR',
          'Session ID is required',
          'Unable to pause: missing session identifier'
        ));
      }
      
      const session = await prisma.readingSession.update({
        where: { id: sessionId },
        data: {
          active: false,
          pausedAt: new Date()
        }
      });
      
      const androidResponse = createAndroidResponse('READING_SESSION_SUCCESS', {
        success: true,
        action: 'pause_reading',
        session: {
          id: session.id,
          active: session.active,
          pausedAt: session.pausedAt
        },
        message: 'Reading session paused successfully'
      });
      
      console.log('📱 Reading session paused for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android reading pause endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'READING_SESSION_ERROR',
        'Failed to pause reading session',
        error.message
      ));
    }
  });

  // Stop reading session
  router.post('/reading/stop', async (req, res) => {
    console.log('📱 Android app requesting to stop reading session...');
    
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json(createAndroidErrorResponse(
          'READING_SESSION_ERROR',
          'Session ID is required',
          'Unable to stop: missing session identifier'
        ));
      }
      
      const session = await prisma.readingSession.update({
        where: { id: sessionId },
        data: {
          active: false,
          endTime: new Date()
        }
      });
      
      // Calculate duration
      const duration = session.endTime - session.startTime;
      
      const androidResponse = createAndroidResponse('READING_SESSION_SUCCESS', {
        success: true,
        action: 'stop_reading',
        session: {
          id: session.id,
          active: session.active,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: Math.floor(duration / 1000) // duration in seconds
        },
        message: 'Reading session stopped successfully'
      });
      
      console.log('📱 Reading session stopped for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android reading stop endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'READING_SESSION_ERROR',
        'Failed to stop reading session',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createReadingSessionRoutes;
