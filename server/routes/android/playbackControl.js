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

  // Android app reports current music playback state for dashboard monitoring
  router.post('/music/state', async (req, res) => {
    try {
      const {
        title,
        artist,
        album,
        ratingKey = null,
        userRating = null,
        artworkUrl = null,
        thumb = null,
        parentThumb = null,
        grandparentThumb = null,
        art = null,
        isPlaying = true,
        positionMs = null,
        durationMs = null,
        source = 'android_app',
        appName = null,
      } = req.body || {};

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          type: 'MUSIC_STATE_ERROR',
          data: {
            success: false,
            error: 'title is required',
            message: 'Provide at least a track title for Android music state updates',
          },
        });
      }

      const normalized = {
        title: title.trim(),
        artist: typeof artist === 'string' ? artist.trim() || null : null,
        album: typeof album === 'string' ? album.trim() || null : null,
        ratingKey: typeof ratingKey === 'string' ? ratingKey.trim() || null : null,
        userRating: Number.isFinite(Number(userRating)) ? Number(userRating) : null,
        artworkUrl: typeof artworkUrl === 'string' ? artworkUrl.trim() || null : null,
        thumb: typeof thumb === 'string' ? thumb.trim() || null : null,
        parentThumb: typeof parentThumb === 'string' ? parentThumb.trim() || null : null,
        grandparentThumb: typeof grandparentThumb === 'string' ? grandparentThumb.trim() || null : null,
        art: typeof art === 'string' ? art.trim() || null : null,
        isPlaying: Boolean(isPlaying),
        positionMs: Number.isFinite(Number(positionMs)) ? Number(positionMs) : null,
        durationMs: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
        source,
        appName: typeof appName === 'string' ? appName.trim() || null : null,
        updatedAt: new Date().toISOString(),
      };

      // Store in global process memory for lightweight dashboard monitoring.
      global.androidMusicState = normalized;

      return res.json({
        type: 'MUSIC_STATE_UPDATED',
        data: {
          success: true,
          message: 'Android music state updated',
          state: normalized,
        },
      });
    } catch (error) {
      console.error('Failed to update Android music state:', error);
      return res.status(500).json({
        type: 'MUSIC_STATE_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
        },
      });
    }
  });

  // Explicitly clear Android music playback state
  router.post('/music/stop', async (req, res) => {
    try {
      global.androidMusicState = {
        title: null,
        artist: null,
        album: null,
        ratingKey: null,
        userRating: null,
        artworkUrl: null,
        thumb: null,
        parentThumb: null,
        grandparentThumb: null,
        art: null,
        isPlaying: false,
        positionMs: null,
        durationMs: null,
        source: 'android_app',
        appName: null,
        updatedAt: new Date().toISOString(),
      };

      return res.json({
        type: 'MUSIC_STATE_STOPPED',
        data: {
          success: true,
          message: 'Android music state cleared',
        },
      });
    } catch (error) {
      console.error('Failed to clear Android music state:', error);
      return res.status(500).json({
        type: 'MUSIC_STATE_ERROR',
        data: {
          success: false,
          error: 'Internal server error',
          details: error.message,
        },
      });
    }
  });

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
        const webhookResponse = await fetch(`${baseUrl}/api/webhook/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ratingKey: ratingKey,
            action: 'play_on_plex',
            title: title,
            type: mediaType,
            timestamp: new Date().toISOString(),
            source: 'android_app'
          }),
        });
        
        if (webhookResponse.ok) {
          console.log('✅ Webhook notification sent successfully');
        } else {
          console.warn('⚠️ Webhook notification failed:', await webhookResponse.text());
        }
      } catch (webhookError) {
        console.warn('⚠️ Failed to send webhook notification:', webhookError);
        // Don't stop the Plex playback if webhook fails
      }
      
      // Use existing Plex play endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const playResponse = await fetch(`${baseUrl}/api/plex/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKey
        }),
      });
      
      const playData = await playResponse.json();
      
      if (playResponse.ok) {
        // Success response in Android format
        const androidResponse = {
          type: 'PLAY_SUCCESS',
          data: {
            success: true,
            ratingKey: ratingKey,
            title: title,
            mediaType: mediaType,
            player: playData.player || 'Unknown Player',
            message: `Playing "${title}" on ${playData.player || 'Plex'}`,
            timestamp: new Date().toISOString()
          }
        };
        
        console.log('✅ Playback started successfully:', JSON.stringify(androidResponse, null, 2));
        res.json(androidResponse);
      } else {
        // Error response in Android format
        let errorMessage = playData.error || 'Failed to start playback';
        
        // Provide helpful error messages for common issues
        if (errorMessage.includes('No player specified') || errorMessage.includes('not found')) {
          errorMessage = 'No Plex player available. Please ensure a Plex client is connected and configured.';
        }
        
        const androidErrorResponse = {
          type: 'PLAY_ERROR',
          data: {
            success: false,
            ratingKey: ratingKey,
            title: title,
            mediaType: mediaType,
            error: playData.error || 'Failed to start playback',
            message: errorMessage,
            timestamp: new Date().toISOString()
          }
        };
        
        console.log('❌ Playback failed:', JSON.stringify(androidErrorResponse, null, 2));
        res.status(playResponse.status).json(androidErrorResponse);
      }
      
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
    console.log('📱 Android app requesting custom order media playback...');
    
    try {
      const { 
        seriesTitle, 
        seasonNumber, 
        episodeNumber, 
        movieTitle, // Support direct movie title for movie playback
        webUrl, // Support web video URL for web video playback
        mediaType: requestedMediaType, // Support explicit media type
        customOrderItemId, 
        title = 'Unknown Media' 
      } = req.body;
      
      // Determine media type and request type
      const isEpisodeRequest = seriesTitle && seasonNumber !== undefined && episodeNumber !== undefined;
      const isMovieRequest = movieTitle || (!isEpisodeRequest && !webUrl && title);
      const isWebVideoRequest = webUrl || requestedMediaType === 'webvideo';
      
      if (!isEpisodeRequest && !isMovieRequest && !isWebVideoRequest) {
        return res.status(400).json({ 
          type: 'PLAY_ERROR',
          data: {
            error: 'Missing media identification',
            message: 'Provide (seriesTitle, seasonNumber, episodeNumber) for episodes, movieTitle for movies, or webUrl/mediaType for web videos',
            received: { seriesTitle, seasonNumber, episodeNumber, movieTitle, webUrl, requestedMediaType, title }
          }
        });
      }
      
      const mediaTitle = isEpisodeRequest ? seriesTitle : (movieTitle || title);
      const mediaType = isEpisodeRequest ? 'episode' : isWebVideoRequest ? 'webvideo' : 'movie';
      
      console.log(`📱 Android ${mediaType} request - ${mediaTitle}${isEpisodeRequest ? ` S${seasonNumber}E${episodeNumber}` : isWebVideoRequest ? ` (webURL: ${webUrl})` : ''} (customOrderItemId: ${customOrderItemId})`);
      
      // Handle web video playback
      if (isWebVideoRequest) {
        console.log('📱 Processing web video playback request...');
        
        // For web videos, automatically start a viewing session
        try {
          const baseUrl = getAndroidApiBaseUrl();
          const viewingSessionResponse = await fetch(`${baseUrl}/api/android/viewing/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              mediaType: 'webvideo',
              title: mediaTitle,
              seriesTitle: seriesTitle,
              customOrderItemId: customOrderItemId
            })
          });
          
          const viewingSessionData = await viewingSessionResponse.json();
          
          if (viewingSessionResponse.ok) {
            console.log('✅ Viewing session started for web video:', viewingSessionData);
            
            // Success response for web video with viewing session info
            const androidResponse = {
              type: 'PLAY_WEB_VIDEO_SUCCESS',
              data: {
                success: true,
                webUrl: webUrl,
                title: mediaTitle,
                customOrderItemId: customOrderItemId,
                viewingSession: {
                  sessionId: viewingSessionData.data?.sessionId,
                  startedAt: viewingSessionData.data?.startedAt,
                  isPaused: false
                },
                message: `Started viewing session for "${mediaTitle}"`,
                timestamp: new Date().toISOString()
              }
            };
            
            console.log('✅ Web video playback successful with viewing session:', JSON.stringify(androidResponse, null, 2));
            res.json(androidResponse);
            return;
          } else {
            console.warn('⚠️ Failed to start viewing session, proceeding without it:', viewingSessionData);
            // Continue with regular web video response
          }
        } catch (viewingError) {
          console.warn('⚠️ Error starting viewing session, proceeding without it:', viewingError);
          // Continue with regular web video response
        }
        
        // Regular web video response (fallback if viewing session fails)
        const androidResponse = {
          type: 'PLAY_WEB_VIDEO_SUCCESS',
          data: {
            success: true,
            webUrl: webUrl,
            title: mediaTitle,
            customOrderItemId: customOrderItemId,
            message: `Playing web video "${mediaTitle}"`,
            timestamp: new Date().toISOString()
          }
        };
        
        console.log('✅ Web video playback successful:', JSON.stringify(androidResponse, null, 2));
        res.json(androidResponse);
        return;
      }
      
      // For episodes and movies, search Plex to find rating keys
      const prisma = require('../../prismaClient');
      let episodeRatingKey = null;
      let movieRatingKey = null;
      let foundMediaMetadata = null;
      
      try {
        // Get Plex settings
        const settings = await prisma.settings.findFirst();
        if (!settings?.plexUrl || !settings?.plexToken) {
          return res.status(500).json({
            type: 'PLAY_ERROR',
            data: {
              error: 'Plex not configured',
              message: 'Plex server URL and token are required'
            }
          });
        }
        
        // Search for the media in Plex
        const searchUrl = `${settings.plexUrl}/search?query=${encodeURIComponent(mediaTitle)}&X-Plex-Token=${settings.plexToken}`;
        const searchResponse = await fetch(searchUrl);
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.text();
          const xml2js = require('xml2js');
          const parser = new xml2js.Parser();
          const result = await parser.parseStringPromise(searchData);
          
          if (isEpisodeRequest) {
            // Look for TV series first for episode requests
            const tvResults = result?.MediaContainer?.Directory?.filter(item => 
              item.$.type === 'show' && 
              item.$.title.toLowerCase() === seriesTitle.toLowerCase()
            ) || [];
            
            if (tvResults.length > 0) {
              // Found TV series, now get episodes
              const seriesRatingKey = tvResults[0].$.ratingKey;
              const episodesUrl = `${settings.plexUrl}/library/metadata/${seriesRatingKey}/allLeaves?X-Plex-Token=${settings.plexToken}`;
              const episodesResponse = await fetch(episodesUrl);
              
              if (episodesResponse.ok) {
                const episodesData = await episodesResponse.text();
                const episodesResult = await parser.parseStringPromise(episodesData);
                
                // Find the specific episode
                const episodes = episodesResult?.MediaContainer?.Video || [];
                const targetEpisode = episodes.find(ep => 
                  parseInt(ep.$.parentIndex) === seasonNumber && 
                  parseInt(ep.$.index) === episodeNumber
                );
                
                if (targetEpisode) {
                  episodeRatingKey = targetEpisode.$.ratingKey;
                  foundMediaMetadata = {
                    type: 'episode',
                    ratingKey: targetEpisode.$.ratingKey,
                    title: targetEpisode.$.title,
                    seriesTitle: tvResults[0].$.title,
                    seasonNumber: parseInt(targetEpisode.$.parentIndex),
                    episodeNumber: parseInt(targetEpisode.$.index),
                    summary: targetEpisode.$.summary || '',
                    duration: parseInt(targetEpisode.$.duration) || 0,
                    thumb: targetEpisode.$.thumb || '',
                    art: targetEpisode.$.art || tvResults[0].$.art || '',
                    seriesRatingKey: seriesRatingKey
                  };
                  console.log(`✅ Found episode rating key: ${episodeRatingKey}`);
                }
              }
            }
          }
          
          // Look for movies (either for movie requests or as fallback for episode requests)
          if (!episodeRatingKey) {
            const movieResults = result?.MediaContainer?.Video?.filter(item => 
              item.$.type === 'movie' && 
              (item.$.title.toLowerCase() === mediaTitle.toLowerCase() ||
               item.$.title.toLowerCase().includes(mediaTitle.toLowerCase()))
            ) || [];
            
            if (movieResults.length > 0) {
              const movie = movieResults[0];
              movieRatingKey = movie.$.ratingKey;
              foundMediaMetadata = {
                type: 'movie',
                ratingKey: movie.$.ratingKey,
                title: movie.$.title,
                year: parseInt(movie.$.year) || null,
                duration: parseInt(movie.$.duration) || 0,
                summary: movie.$.summary || '',
                studio: movie.$.studio || '',
                rating: parseFloat(movie.$.rating) || 0,
                thumb: movie.$.thumb || '',
                art: movie.$.art || '',
                originallyAvailableAt: movie.$.originallyAvailableAt || null
              };
              console.log(`✅ Found movie rating key: ${movieRatingKey}`);
            }
          }
        }
      } catch (plexError) {
        console.warn('⚠️ Failed to search Plex for media:', plexError.message);
      }
      
      // Use the found rating key or return error
      const ratingKeyToUse = episodeRatingKey || movieRatingKey;
      
      if (!ratingKeyToUse) {
        return res.status(404).json({
          type: 'PLAY_ERROR',
          data: {
            error: 'Media not found',
            message: `Could not find ${mediaTitle}${isEpisodeRequest ? ` S${seasonNumber}E${episodeNumber}` : ''} in Plex library`,
            mediaTitle,
            mediaType,
            ...(isEpisodeRequest && { seasonNumber, episodeNumber })
          }
        });
      }
      
      // Send webhook notification
      try {
        console.log('Sending webhook notification for media:', title);
        const baseUrl = getAndroidApiBaseUrl();
        const webhookResponse = await fetch(`${baseUrl}/api/webhook/notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ratingKey: ratingKeyToUse,
            action: 'play_on_plex',
            title: foundMediaMetadata?.title || mediaTitle,
            type: mediaType,
            ...(isEpisodeRequest && { 
              seriesTitle,
              seasonNumber,
              episodeNumber 
            }),
            ...(isMovieRequest && {
              movieTitle: mediaTitle
            }),
            customOrderItemId,
            timestamp: new Date().toISOString(),
            source: 'android_app'
          }),
        });
        
        if (webhookResponse.ok) {
          console.log('✅ Webhook notification sent successfully');
        } else {
          console.warn('⚠️ Webhook notification failed:', await webhookResponse.text());
        }
      } catch (webhookError) {
        console.warn('⚠️ Failed to send webhook notification:', webhookError);
      }
      
      // Use existing Plex play endpoint
      const baseUrl = getAndroidApiBaseUrl();
      const playResponse = await fetch(`${baseUrl}/api/plex/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKeyToUse
        }),
      });
      
      const playData = await playResponse.json();
      
      if (playResponse.ok) {
        // Helper function to get proper artwork URL
        const getAndroidArtworkUrl = (metadata) => {
          if (!metadata) return null;
          
          const baseUrl = getAndroidApiBaseUrl();
          const thumb = metadata.thumb;
          
          if (!thumb) return null;
          
          // Check if thumb is already a full URL (starts with http)
          if (thumb.startsWith('http')) {
            console.log('📱 Using full artwork URL:', thumb);
            return thumb;
          }
          
          // Otherwise, it's a relative path, so add the base URL
          console.log('📱 Using Plex artwork:', thumb);
          return `${baseUrl}/api/artwork${thumb}`;
        };
        
        // Success response in Android format based on media type
        let androidResponse;
        
        if (foundMediaMetadata?.type === 'episode') {
          // Episode response format
          androidResponse = {
            type: 'PLAY_EPISODE_SUCCESS',
            data: {
              success: true,
              ratingKey: ratingKeyToUse,
              episodeRatingKey: episodeRatingKey,
              seriesRatingKey: foundMediaMetadata.seriesRatingKey,
              title: foundMediaMetadata.seriesTitle,
              episodeTitle: foundMediaMetadata.title,
              seasonNumber: foundMediaMetadata.seasonNumber,
              episodeNumber: foundMediaMetadata.episodeNumber,
              duration: foundMediaMetadata.duration,
              summary: foundMediaMetadata.summary,
              artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
              customOrderItemId: customOrderItemId || null,
              player: playData.player || 'Unknown Player',
              message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
              timestamp: new Date().toISOString()
            }
          };
        } else if (foundMediaMetadata?.type === 'movie') {
          // Movie response format
          androidResponse = {
            type: 'PLAY_MOVIE_SUCCESS',
            data: {
              success: true,
              ratingKey: ratingKeyToUse,
              title: foundMediaMetadata.title,
              year: foundMediaMetadata.year,
              duration: foundMediaMetadata.duration,
              summary: foundMediaMetadata.summary,
              studio: foundMediaMetadata.studio,
              rating: foundMediaMetadata.rating,
              artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
              customOrderItemId: customOrderItemId || null,
              player: playData.player || 'Unknown Player',
              message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
              timestamp: new Date().toISOString()
            }
          };
        } else {
          // Fallback response format - should use PLAY_ERROR for unknown media
          androidResponse = {
            type: 'PLAY_ERROR',
            data: {
              success: false,
              error: 'Unknown media type',
              message: `Unable to determine media type for "${mediaTitle}"`,
              ratingKey: ratingKeyToUse,
              title: mediaTitle,
              customOrderItemId: customOrderItemId,
              timestamp: new Date().toISOString()
            }
          };
        }
        
        console.log('✅ Media playback successful:', JSON.stringify(androidResponse, null, 2));
        res.json(androidResponse);
      } else {
        // Error response in Android format
        const androidErrorResponse = {
          type: 'PLAY_ERROR',
          data: {
            success: false,
            ratingKey: ratingKeyToUse,
            title: foundMediaMetadata?.title || mediaTitle,
            mediaType: mediaType,
            ...(isEpisodeRequest && {
              seriesTitle,
              seasonNumber,
              episodeNumber
            }),
            customOrderItemId,
            error: playData.error || 'Failed to start playback',
            message: playData.error || `Failed to play ${mediaTitle}`,
            timestamp: new Date().toISOString()
          }
        };
        
        console.log('❌ Media playback failed:', JSON.stringify(androidErrorResponse, null, 2));
        res.status(playResponse.status).json(androidErrorResponse);
      }
      
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
