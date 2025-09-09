/**
 * Android Viewing Session Routes
 * Handles viewing session management for TV shows, movies and media tracking
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create viewing session routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createViewingSessionRoutes(prisma) {
  const router = express.Router();

  // Start viewing session
  router.post('/viewing/start', async (req, res) => {
    console.log('📱 Android app starting viewing session...');
    
    try {
      const { mediaType, mediaKey, position = 0, title, season, episode } = req.body;
      
      if (!mediaType || !mediaKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'VIEWING_SESSION_ERROR',
          'Media type and key are required',
          'Missing required fields'
        ));
      }
      
      // Create new viewing session
      const session = await prisma.viewingSession.create({
        data: {
          mediaType: mediaType,
          mediaKey: mediaKey,
          startTime: new Date(),
          position: parseInt(position) || 0,
          platform: 'android',
          title: title || 'Unknown Title',
          season: season ? parseInt(season) : null,
          episode: episode ? parseInt(episode) : null,
          isCompleted: false
        }
      });
      
      const androidResponse = createAndroidResponse('VIEWING_SESSION_STARTED', {
        success: true,
        sessionId: session.id,
        mediaType: mediaType,
        mediaKey: mediaKey,
        startPosition: position,
        timestamp: new Date().toISOString()
      });
      
      console.log('📱 Viewing session started for Android app:', session.id);
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android viewing start endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'VIEWING_SESSION_ERROR',
        'Failed to start viewing session',
        error.message
      ));
    }
  });

  // Pause viewing session
  router.post('/viewing/pause', async (req, res) => {
    console.log('📱 Android app pausing viewing session...');
    
    try {
      const { mediaKey, position } = req.body;
      
      if (!mediaKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'VIEWING_SESSION_ERROR',
          'Media key is required',
          'Missing required field'
        ));
      }
      
      // Find and update most recent active session
      const session = await prisma.viewingSession.findFirst({
        where: {
          mediaKey: mediaKey,
          isCompleted: false,
          platform: 'android'
        },
        orderBy: { startTime: 'desc' }
      });
      
      if (session) {
        await prisma.viewingSession.update({
          where: { id: session.id },
          data: {
            position: parseInt(position) || session.position,
            lastPauseTime: new Date()
          }
        });
      }
      
      const androidResponse = createAndroidResponse('VIEWING_SESSION_PAUSED', {
        success: true,
        sessionId: session?.id,
        position: position,
        timestamp: new Date().toISOString()
      });
      
      console.log('📱 Viewing session paused for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android viewing pause endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'VIEWING_SESSION_ERROR',
        'Failed to pause viewing session',
        error.message
      ));
    }
  });

  // Stop viewing session
  router.post('/viewing/stop', async (req, res) => {
    console.log('📱 Android app stopping viewing session...');
    
    try {
      const { mediaKey, position, completed = false } = req.body;
      
      if (!mediaKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'VIEWING_SESSION_ERROR',
          'Media key is required',
          'Missing required field'
        ));
      }
      
      // Find and complete most recent active session
      const session = await prisma.viewingSession.findFirst({
        where: {
          mediaKey: mediaKey,
          isCompleted: false,
          platform: 'android'
        },
        orderBy: { startTime: 'desc' }
      });
      
      if (session) {
        await prisma.viewingSession.update({
          where: { id: session.id },
          data: {
            position: parseInt(position) || session.position,
            endTime: new Date(),
            isCompleted: completed,
            finalPosition: parseInt(position) || session.position
          }
        });
      }
      
      const androidResponse = createAndroidResponse('VIEWING_SESSION_STOPPED', {
        success: true,
        sessionId: session?.id,
        finalPosition: position,
        completed: completed,
        timestamp: new Date().toISOString()
      });
      
      console.log('📱 Viewing session stopped for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android viewing stop endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'VIEWING_SESSION_ERROR',
        'Failed to stop viewing session',
        error.message
      ));
    }
  });

  // Play episode with session tracking
  router.post('/play-episode', async (req, res) => {
    console.log('📱 Android app requesting episode playback...');
    
    try {
      const { episodeKey, position = 0 } = req.body;
      
      if (!episodeKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'EPISODE_PLAY_ERROR',
          'Episode key is required',
          'Missing required field'
        ));
      }
      
      const baseUrl = getAndroidApiBaseUrl();
      
      // Start viewing session
      const viewingSessionResponse = await fetch(`${baseUrl}/api/android/viewing/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: 'episode',
          mediaKey: episodeKey,
          position: position
        })
      });
      
      if (!viewingSessionResponse.ok) {
        const errorText = await viewingSessionResponse.text();
        console.error('Failed to start viewing session:', errorText);
      }
      
      // Get episode details from Plex
      const episodeResponse = await fetch(`${baseUrl}/api/plex/media/${episodeKey}`);
      
      if (!episodeResponse.ok) {
        return res.status(404).json(createAndroidErrorResponse(
          'EPISODE_PLAY_ERROR',
          'Episode not found',
          'Episode not available'
        ));
      }
      
      const episodeData = await episodeResponse.json();
      
      const androidResponse = createAndroidResponse('EPISODE_PLAY_SUCCESS', {
        success: true,
        episode: episodeData,
        playback: {
          startPosition: position,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('📱 Episode playback initiated for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android episode play endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'EPISODE_PLAY_ERROR',
        'Failed to play episode',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createViewingSessionRoutes;
