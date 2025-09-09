/**
 * Android Playback Control Routes
 * Handles media playback control with WebSocket integration for Android app
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create playback control routes for Android app
 * @returns {express.Router} Configured router
 */
function createPlaybackControlRoutes() {
  const router = express.Router();

  // Generic Stash playback control with WebSocket
  router.post('/play', async (req, res) => {
    try {
      const commandData = req.body;
      const action = commandData.action || 'play';
      
      console.log(`📱 Emitting Android companion app message (Stash ${action}):`, JSON.stringify(commandData, null, 2));
      
      // Get WebSocket instance from global
      const io = global.io;
      if (io) {
        // Emit WebSocket message to Android companion app
        io.emit('androidCompanion', {
          type: 'STASH_PLAYBACK',
          action: action.toUpperCase(),
          scene: commandData.scene,
          timestamp: new Date().toISOString()
        });
      }

      // Also attempt to forward to HTTP Android app if available (optional)
      try {
        let endpoint = 'http://localhost:8080/play';
        if (action === 'pause') {
          endpoint = 'http://localhost:8080/pause';
        } else if (action === 'stop') {
          endpoint = 'http://localhost:8080/stop';
        }
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(commandData),
          signal: AbortSignal.timeout(2000) // 2 second timeout
        });

        if (response.ok) {
          console.log(`HTTP command sent successfully to Android app on localhost:8080`);
        }
      } catch (httpError) {
        console.log('Android HTTP app not available on localhost:8080 (this is optional)');
      }

      res.status(200).json({ 
        success: true, 
        message: `${action.charAt(0).toUpperCase() + action.slice(1)} command sent successfully to Android app via WebSocket`,
        method: 'websocket'
      });
    } catch (error) {
      console.error('Failed to send command to Android app:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Plex-specific playback control
  router.post('/play-plex', async (req, res) => {
    console.log('📱 Android app requesting Plex media playback...');
    
    try {
      const { ratingKey, mediaType = 'unknown', title = 'Unknown Media' } = req.body;
      
      if (!ratingKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'PLAY_ERROR',
          'Rating key is required',
          'Unable to play: missing media identifier'
        ));
      }
      
      console.log(`📱 Android play request - ratingKey: ${ratingKey}, mediaType: ${mediaType}, title: ${title}`);
      
      // Send webhook notification (same as web interface)
      try {
        console.log('Sending webhook notification with ratingKey:', ratingKey);
        const baseUrl = getAndroidApiBaseUrl();
        
        const webhookUrl = `${baseUrl}/api/plex/webhook-notification`;
        
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ratingKey: ratingKey,
            mediaType: mediaType,
            title: title,
            source: 'android_app'
          })
        });
        
        if (response.ok) {
          console.log('✅ Webhook notification sent successfully from Android app');
        }
      } catch (webhookError) {
        console.error('❌ Failed to send webhook notification:', webhookError.message);
      }
      
      const androidResponse = createAndroidResponse('PLAY_SUCCESS', {
        success: true,
        action: 'play',
        media: {
          ratingKey: ratingKey,
          mediaType: mediaType,
          title: title
        },
        message: 'Playback initiated successfully'
      });
      
      console.log('📱 Plex play command processed for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Plex play endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'PLAY_ERROR',
        'Failed to initiate playback',
        error.message
      ));
    }
  });

  // Episode-specific playback control
  router.post('/play-episode', async (req, res) => {
    console.log('📱 Android app requesting episode playback...');
    
    try {
      const { episodeKey, position = 0 } = req.body;
      
      if (!episodeKey) {
        return res.status(400).json(createAndroidErrorResponse(
          'EPISODE_PLAY_ERROR',
          'Episode key is required',
          'Unable to play: missing episode identifier'
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
          'The requested episode could not be found'
        ));
      }
      
      const episodeData = await episodeResponse.json();
      
      const androidResponse = createAndroidResponse('EPISODE_PLAY_SUCCESS', {
        success: true,
        episode: episodeData,
        playback: {
          startPosition: position
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

module.exports = createPlaybackControlRoutes;
