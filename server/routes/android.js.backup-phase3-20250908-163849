/**
 * Android Companion App Routes
 * Part of Eddie Life Management - Mobile App Integration Module
 * 
 * Handles all Android companion app API endpoints with specialized response formats
 * Provides WebSocket integration, media playback controls, and activity tracking
 */

const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Use shared Prisma client and services
const prisma = require('../prismaClient');
const { getNextCustomOrder } = require('../getNextCustomOrder');
const getNextMovie = require('../getNextMovie');
const getNextEpisode = require('../getNextEpisode');

/**
 * Helper function to get Android API base URL
 */
function getAndroidApiBaseUrl() {
  const PORT = process.env.PORT || 3001;
  const externalIp = process.env.EXTERNAL_IP;
  return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
}

/**
 * Helper function to generate artwork URL for Android app
 */
function getAndroidArtworkUrl(media, baseUrl) {
  // Web videos don't have artwork
  if (media?.type === 'webvideo') {
    return null;
  }
  
  // First priority: Check for cached artwork (works for all media types)
  if (media?.localArtworkPath) {
    const filename = media.localArtworkPath.includes('\\') || media.localArtworkPath.includes('/')
      ? media.localArtworkPath.split(/[\\\/]/).pop() 
      : media.localArtworkPath;
    console.log('📱 Using cached artwork:', filename);
    return `${baseUrl}/api/artwork/${filename}`;
  }
  
  // Second priority: Use Plex artwork proxy for Plex content
  if (media?.thumb && (media?.type === 'episode' || media?.type === 'movie')) {
    console.log('📱 Using Plex artwork proxy:', media.thumb);
    return `${baseUrl}/api/artwork${media.thumb}`;
  }
  
  return null;
}

/**
 * POST /api/android/play - Stash playback proxy endpoint
 * Forwards playback commands to Android app via WebSocket and HTTP
 */
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
      
      const fetch = require('node-fetch');
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

/**
 * GET /api/android/up-next - Get next content for Android app
 * Returns up next TV/Movie/Custom order content with Android-specific formatting
 */
router.get('/up-next', async (req, res) => {
  console.log('📱 Android app requesting up next content...');
  
  try {
    // Call the internal getNextEpisode function directly to ensure consistent data
    console.log('📱 Calling getNextEpisode() directly...');
    const data = await getNextEpisode(); // This handles order type selection internally
    
    console.log('📱 getNextEpisode() returned:', {
      orderType: data?.orderType,
      title: data?.title,
      ratingKey: data?.ratingKey,
      episodeRatingKey: data?.episodeRatingKey
    });
    
    let upNextData;
    // If movies were selected, use the new getNextMovie function
    if (data.orderType === 'MOVIES_GENERAL') {
      console.log('📱 Movie order type selected, using getNextMovie function');
      upNextData = await getNextMovie();
    } else if (data.orderType === 'CUSTOM_ORDER') {
      console.log('📱 Custom order type selected, using getNextCustomOrder function');
      upNextData = await getNextCustomOrder(req);
    } else {
      // TV General selection
      upNextData = data;
    }
    
    // Get base URL for Android API (needed for artwork URLs)
    const baseUrl = getAndroidApiBaseUrl();
    console.log('📱 Using base URL for Android API:', baseUrl);
    console.log('📱 Up next data received:', JSON.stringify(upNextData, null, 2));
    
    if (!upNextData || upNextData.error) {
      return res.status(404).json({ 
        error: 'No content available',
        message: upNextData?.error || 'No content found for up next.' 
      });
    }
    
    // Add artwork URL to the response
    if (upNextData) {
      upNextData.artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
    }
    
    console.log('📱 Final up next response for Android:', JSON.stringify(upNextData, null, 2));
    res.json(upNextData);
    
  } catch (error) {
    console.error('❌ Error in Android up-next endpoint:', error);
    res.status(500).json({
      error: 'Failed to get up next content',
      message: error.message
    });
  }
});

/**
 * Note: Additional Android endpoints for comprehensive mobile app support
 */

/**
 * GET /api/android/stash/images - Get Stash images for Android app
 * Returns formatted image data for the Android companion app
 */
router.get('/stash/images', async (req, res) => {
  console.log('📱 Android app requesting Stash images...');
  
  try {
    const { page = 1, perPage = 50 } = req.query;
    
    const images = await prisma.stashImage.findMany({
      skip: (parseInt(page) - 1) * parseInt(perPage),
      take: parseInt(perPage),
      orderBy: { createdAt: 'desc' },
      include: {
        gallery: {
          select: {
            id: true,
            title: true,
            studio: true
          }
        },
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const baseUrl = getAndroidApiBaseUrl();
    
    const androidResponse = {
      type: 'STASH_IMAGES_SUCCESS',
      data: {
        success: true,
        images: images.map(image => ({
          id: image.id,
          title: image.title || 'Untitled',
          path: image.path,
          url: `${baseUrl}/api/stash-image-proxy/${image.path}`,
          width: image.width,
          height: image.height,
          filesize: image.filesize,
          gallery: image.gallery ? {
            id: image.gallery.id,
            title: image.gallery.title,
            studio: image.gallery.studio
          } : null,
          performers: image.performers?.map(p => ({
            id: p.performer.id,
            name: p.performer.name
          })) || [],
          tags: image.tags?.map(t => ({
            id: t.tag.id,
            name: t.tag.name
          })) || [],
          createdAt: image.createdAt,
          updatedAt: image.updatedAt
        })),
        pagination: {
          page: parseInt(page),
          perPage: parseInt(perPage),
          hasMore: images.length === parseInt(perPage)
        },
        timestamp: new Date().toISOString()
      }
    };

    console.log(`📱 Returning ${images.length} Stash images for Android app`);
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Stash images endpoint:', error);
    
    const androidErrorResponse = {
      type: 'STASH_IMAGES_ERROR',
      data: {
        success: false,
        error: 'Failed to fetch Stash images',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/play-plex - Play Plex media through Android app
 * Triggers Plex media playback with webhook notifications
 */
router.post('/play-plex', async (req, res) => {
  console.log('📱 Android app requesting Plex media playback...');
  
  try {
    const { ratingKey, mediaType = 'unknown', title = 'Unknown Media' } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ 
        type: 'PLAY_ERROR',
        data: {
          error: 'Rating key is required',
          message: 'Unable to play: missing media identifier'
        }
      });
    }
    
    console.log(`📱 Android play request - ratingKey: ${ratingKey}, mediaType: ${mediaType}, title: ${title}`);
    
    // Send webhook notification (same as web interface)
    try {
      console.log('Sending webhook notification with ratingKey:', ratingKey);
      const baseUrl = getAndroidApiBaseUrl();
      
      const webhookUrl = `${baseUrl}/api/plex/webhook-notification`;
      const fetch = require('node-fetch');
      
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
    
    const androidResponse = {
      type: 'PLAY_SUCCESS',
      data: {
        success: true,
        action: 'play',
        media: {
          ratingKey: ratingKey,
          mediaType: mediaType,
          title: title
        },
        message: 'Playback initiated successfully',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Plex play command processed for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Plex play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAY_ERROR',
      data: {
        success: false,
        error: 'Failed to initiate playback',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/mark-watched - Mark content as watched
 * Updates watch status for various media types
 */
router.post('/mark-watched', async (req, res) => {
  console.log('📱 Android app requesting to mark content as watched...');
  
  try {
    const { mediaType, ratingKey, customOrderItemId, title } = req.body;
    
    if (!mediaType) {
      return res.status(400).json({
        type: 'MARK_WATCHED_ERROR',
        data: {
          error: 'Media type is required',
          message: 'Unable to mark as watched: missing media type'
        }
      });
    }
    
    let result = null;
    
    if (mediaType === 'episode' || mediaType === 'movie') {
      if (!ratingKey) {
        return res.status(400).json({
          type: 'MARK_WATCHED_ERROR',
          data: {
            error: 'Rating key is required for Plex content',
            message: 'Unable to mark as watched: missing rating key'
          }
        });
      }
      
      // Handle Plex content
      result = await prisma.watchLog.create({
        data: {
          ratingKey: ratingKey,
          mediaType: mediaType,
          title: title || 'Unknown Title',
          watchedAt: new Date(),
          source: 'android_app'
        }
      });
      
    } else if (customOrderItemId) {
      // Handle custom order content
      result = await prisma.customOrderItem.update({
        where: { id: customOrderItemId },
        data: { 
          watched: true,
          watchedAt: new Date()
        }
      });
    }
    
    const androidResponse = {
      type: 'MARK_WATCHED_SUCCESS',
      data: {
        success: true,
        action: 'mark_watched',
        media: {
          mediaType: mediaType,
          ratingKey: ratingKey,
          customOrderItemId: customOrderItemId,
          title: title
        },
        message: 'Content marked as watched successfully',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Content marked as watched for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android mark watched endpoint:', error);
    
    const androidErrorResponse = {
      type: 'MARK_WATCHED_ERROR',
      data: {
        success: false,
        error: 'Failed to mark as watched',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/reading/start - Start reading session
 * Tracks reading activity for books, comics, and short stories
 */
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
          message: 'Media type must be book, comic, or shortstory'
        }
      });
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
    
    const androidResponse = {
      type: 'READING_SESSION_SUCCESS',
      data: {
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
        message: 'Reading session started successfully',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Reading session started for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to start reading session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/reading/pause - Pause reading session
 * Pauses active reading session
 */
router.post('/reading/pause', async (req, res) => {
  console.log('📱 Android app requesting to pause reading session...');
  
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Session ID is required',
          message: 'Unable to pause: missing session identifier'
        }
      });
    }
    
    const session = await prisma.readingSession.update({
      where: { id: sessionId },
      data: {
        active: false,
        pausedAt: new Date()
      }
    });
    
    const androidResponse = {
      type: 'READING_SESSION_SUCCESS',
      data: {
        success: true,
        action: 'pause_reading',
        session: {
          id: session.id,
          active: session.active,
          pausedAt: session.pausedAt
        },
        message: 'Reading session paused successfully',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Reading session paused for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to pause reading session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/reading/stop - Stop reading session
 * Ends reading session and records total duration
 */
router.post('/reading/stop', async (req, res) => {
  console.log('📱 Android app requesting to stop reading session...');
  
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Session ID is required',
          message: 'Unable to stop: missing session identifier'
        }
      });
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
    
    const androidResponse = {
      type: 'READING_SESSION_SUCCESS',
      data: {
        success: true,
        action: 'stop_reading',
        session: {
          id: session.id,
          active: session.active,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: Math.floor(duration / 1000) // duration in seconds
        },
        message: 'Reading session stopped successfully',
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Reading session stopped for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to stop reading session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * GET /api/android/stash/next - Get next Stash content for Android app
 * Returns the next Stash clip with Android-specific formatting
 */
router.get('/stash/next', async (req, res) => {
  console.log('📱 Android app requesting next Stash content...');
  
  try {
    const baseUrl = getAndroidApiBaseUrl();
    
    // Get next clip using existing logic
    const nextClipResponse = await fetch(`${baseUrl}/api/stash/clips/next`);
    
    if (!nextClipResponse.ok) {
      const errorText = await nextClipResponse.text();
      console.error('Failed to get next clip:', errorText);
      return res.status(500).json({ 
        error: 'Failed to get next clip',
        details: errorText 
      });
    }
    
    const nextClipData = await nextClipResponse.json();
    
    if (!nextClipData || !nextClipData.clip) {
      return res.json({
        type: 'STASH_NEXT_CONTENT',
        data: {
          hasContent: false,
          message: 'No clips available',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const androidResponse = {
      type: 'STASH_NEXT_CONTENT',
      data: {
        hasContent: true,
        clip: nextClipData.clip,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Next Stash content sent to Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Stash next endpoint:', error);
    
    const androidErrorResponse = {
      type: 'STASH_CONTENT_ERROR',
      data: {
        success: false,
        error: 'Failed to get next Stash content',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * GET /api/android/stash/scene/next - Get next Stash scene for Android app
 * Returns the next Stash scene with Android-specific formatting
 */
router.get('/stash/scene/next', async (req, res) => {
  console.log('📱 Android app requesting next Stash scene...');
  
  try {
    const baseUrl = getAndroidApiBaseUrl();
    
    // Get next scene using existing logic
    const nextSceneResponse = await fetch(`${baseUrl}/api/stash/scenes/next`);
    
    if (!nextSceneResponse.ok) {
      const errorText = await nextSceneResponse.text();
      console.error('Failed to get next scene:', errorText);
      return res.status(500).json({ 
        error: 'Failed to get next scene',
        details: errorText 
      });
    }
    
    const nextSceneData = await nextSceneResponse.json();
    
    if (!nextSceneData || !nextSceneData.scene) {
      return res.json({
        type: 'STASH_NEXT_SCENE',
        data: {
          hasContent: false,
          message: 'No scenes available',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const androidResponse = {
      type: 'STASH_NEXT_SCENE',
      data: {
        hasContent: true,
        scene: nextSceneData.scene,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Next Stash scene sent to Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Stash scene next endpoint:', error);
    
    const androidErrorResponse = {
      type: 'STASH_SCENE_ERROR',
      data: {
        success: false,
        error: 'Failed to get next Stash scene',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/stash/scene/:id/watched - Mark Stash scene as watched from Android app
 * Updates scene watch status with Android-specific response
 */
router.post('/stash/scene/:id/watched', async (req, res) => {
  console.log('📱 Android app marking Stash scene as watched:', req.params.id);
  
  try {
    const sceneId = parseInt(req.params.id);
    const baseUrl = getAndroidApiBaseUrl();
    
    // Mark scene as watched using existing logic
    const watchedResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}/watched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    
    if (!watchedResponse.ok) {
      const errorText = await watchedResponse.text();
      console.error('Failed to mark scene as watched:', errorText);
      return res.status(500).json({ 
        error: 'Failed to mark scene as watched',
        details: errorText 
      });
    }
    
    const watchedData = await watchedResponse.json();
    
    const androidResponse = {
      type: 'STASH_SCENE_WATCHED',
      data: {
        success: true,
        sceneId: sceneId,
        result: watchedData,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Stash scene marked as watched for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Stash scene watched endpoint:', error);
    
    const androidErrorResponse = {
      type: 'STASH_SCENE_WATCHED_ERROR',
      data: {
        success: false,
        error: 'Failed to mark scene as watched',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * DELETE /api/android/stash/scene/:id - Delete Stash scene from Android app
 * Removes scene with Android-specific response
 */
router.delete('/stash/scene/:id', async (req, res) => {
  console.log('📱 Android app deleting Stash scene:', req.params.id);
  
  try {
    const sceneId = parseInt(req.params.id);
    const baseUrl = getAndroidApiBaseUrl();
    
    // Delete scene using existing logic
    const deleteResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}`, {
      method: 'DELETE'
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('Failed to delete scene:', errorText);
      return res.status(500).json({ 
        error: 'Failed to delete scene',
        details: errorText 
      });
    }
    
    const deleteData = await deleteResponse.json();
    
    const androidResponse = {
      type: 'STASH_SCENE_DELETED',
      data: {
        success: true,
        sceneId: sceneId,
        result: deleteData,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Stash scene deleted for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android Stash scene delete endpoint:', error);
    
    const androidErrorResponse = {
      type: 'STASH_SCENE_DELETE_ERROR',
      data: {
        success: false,
        error: 'Failed to delete scene',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/play-episode - Play episode from Android app
 * Enhanced episode playback with viewing session tracking
 */
router.post('/play-episode', async (req, res) => {
  console.log('📱 Android app requesting episode playback...');
  
  try {
    const { episodeKey, position = 0 } = req.body;
    
    if (!episodeKey) {
      return res.status(400).json({
        type: 'EPISODE_PLAY_ERROR',
        data: {
          success: false,
          error: 'Episode key is required',
          timestamp: new Date().toISOString()
        }
      });
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
      return res.status(404).json({
        type: 'EPISODE_PLAY_ERROR',
        data: {
          success: false,
          error: 'Episode not found',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const episodeData = await episodeResponse.json();
    
    const androidResponse = {
      type: 'EPISODE_PLAY_SUCCESS',
      data: {
        success: true,
        episode: episodeData,
        playback: {
          startPosition: position,
          timestamp: new Date().toISOString()
        }
      }
    };
    
    console.log('📱 Episode playback initiated for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android episode play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'EPISODE_PLAY_ERROR',
      data: {
        success: false,
        error: 'Failed to play episode',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/viewing/start - Start viewing session from Android app
 * Tracks viewing session for TV shows and movies
 */
router.post('/viewing/start', async (req, res) => {
  console.log('📱 Android app starting viewing session...');
  
  try {
    const { mediaType, mediaKey, position = 0, title, season, episode } = req.body;
    
    if (!mediaType || !mediaKey) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Media type and media key are required',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Create viewing session record
    const session = await prisma.viewingSession.create({
      data: {
        mediaType: mediaType,
        mediaKey: mediaKey,
        title: title || 'Unknown Title',
        season: season || null,
        episode: episode || null,
        startTime: new Date(),
        position: parseInt(position) || 0,
        isCompleted: false,
        platform: 'android'
      }
    });
    
    const androidResponse = {
      type: 'VIEWING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: session.id,
        mediaType: mediaType,
        mediaKey: mediaKey,
        startPosition: position,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Viewing session started for Android app:', session.id);
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to start viewing session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/viewing/pause - Pause viewing session from Android app
 * Updates viewing session with pause position
 */
router.post('/viewing/pause', async (req, res) => {
  console.log('📱 Android app pausing viewing session...');
  
  try {
    const { mediaKey, position } = req.body;
    
    if (!mediaKey) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Media key is required',
          timestamp: new Date().toISOString()
        }
      });
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
    
    const androidResponse = {
      type: 'VIEWING_SESSION_PAUSED',
      data: {
        success: true,
        sessionId: session?.id,
        position: position,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Viewing session paused for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to pause viewing session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * POST /api/android/viewing/stop - Stop viewing session from Android app
 * Completes viewing session with final position
 */
router.post('/viewing/stop', async (req, res) => {
  console.log('📱 Android app stopping viewing session...');
  
  try {
    const { mediaKey, position, completed = false } = req.body;
    
    if (!mediaKey) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: 'Media key is required',
          timestamp: new Date().toISOString()
        }
      });
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
    
    const androidResponse = {
      type: 'VIEWING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: session?.id,
        finalPosition: position,
        completed: completed,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Viewing session stopped for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Failed to stop viewing session',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * GET /api/android/gallery/:galleryName/random-image - Get random image from gallery for Android app
 * Returns random image from specified Stash gallery
 */
router.get('/gallery/:galleryName/random-image', async (req, res) => {
  console.log('📱 Android app requesting random gallery image:', req.params.galleryName);
  
  try {
    const { galleryName } = req.params;
    
    // Find gallery by name
    const gallery = await prisma.stashGallery.findFirst({
      where: {
        title: {
          contains: galleryName,
          mode: 'insensitive'
        }
      },
      include: {
        images: true
      }
    });
    
    if (!gallery || gallery.images.length === 0) {
      return res.json({
        type: 'GALLERY_RANDOM_IMAGE',
        data: {
          hasImage: false,
          message: 'No images found in gallery',
          galleryName: galleryName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random image
    const randomIndex = Math.floor(Math.random() * gallery.images.length);
    const randomImage = gallery.images[randomIndex];
    
    const androidResponse = {
      type: 'GALLERY_RANDOM_IMAGE',
      data: {
        hasImage: true,
        image: randomImage,
        gallery: {
          id: gallery.id,
          title: gallery.title,
          totalImages: gallery.images.length
        },
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random gallery image sent to Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android gallery random image endpoint:', error);
    
    const androidErrorResponse = {
      type: 'GALLERY_IMAGE_ERROR',
      data: {
        success: false,
        error: 'Failed to get random gallery image',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

/**
 * GET /api/android/playlist/:playlistName/random-track - Get random track from playlist for Android app
 * Returns random track from specified Plex playlist
 */
router.get('/playlist/:playlistName/random-track', async (req, res) => {
  console.log('📱 Android app requesting random playlist track:', req.params.playlistName);
  
  try {
    const { playlistName } = req.params;
    const baseUrl = getAndroidApiBaseUrl();
    
    // Get playlist tracks using existing API
    const playlistResponse = await fetch(`${baseUrl}/api/playlists/search?name=${encodeURIComponent(playlistName)}`);
    
    if (!playlistResponse.ok) {
      return res.json({
        type: 'PLAYLIST_RANDOM_TRACK',
        data: {
          hasTrack: false,
          message: 'Playlist not found',
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const playlistData = await playlistResponse.json();
    
    if (!playlistData.tracks || playlistData.tracks.length === 0) {
      return res.json({
        type: 'PLAYLIST_RANDOM_TRACK',
        data: {
          hasTrack: false,
          message: 'No tracks found in playlist',
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random track
    const randomIndex = Math.floor(Math.random() * playlistData.tracks.length);
    const randomTrack = playlistData.tracks[randomIndex];
    
    const androidResponse = {
      type: 'PLAYLIST_RANDOM_TRACK',
      data: {
        hasTrack: true,
        track: randomTrack,
        playlist: {
          name: playlistName,
          totalTracks: playlistData.tracks.length
        },
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random playlist track sent to Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android playlist random track endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAYLIST_TRACK_ERROR',
      data: {
        success: false,
        error: 'Failed to get random playlist track',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

module.exports = router;
