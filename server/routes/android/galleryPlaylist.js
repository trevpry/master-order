/**
 * Android Gallery and Playlist Routes
 * Handles gallery image selection and playlist management for Android app
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create gallery and playlist routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createGalleryPlaylistRoutes(prisma) {
  const router = express.Router();

  // Android Gallery Endpoint - Get Random Gallery Image
  router.get('/gallery/:galleryName/random-image', async (req, res) => {
    console.log('📱 Android app requesting random gallery image...');
    
    try {
      const { galleryName } = req.params;
      
      if (!galleryName) {
        return res.status(400).json({
          type: 'RANDOM_IMAGE_ERROR',
          data: {
            error: 'Gallery name required',
            message: 'Gallery name is required as URL parameter',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      console.log(`📱 Looking for gallery: "${galleryName}"`);
      
      // Find the gallery by exact name match
      const gallery = await prisma.backgroundGallery.findFirst({
        where: {
          name: galleryName
        },
        include: {
          backgrounds: true
        }
      });
      
      if (!gallery) {
        return res.json({
          type: 'RANDOM_IMAGE_ERROR',
          data: {
            error: 'Gallery not found',
            message: `Gallery "${galleryName}" does not exist`,
            galleryName: galleryName,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (!gallery.backgrounds || gallery.backgrounds.length === 0) {
        return res.json({
          type: 'RANDOM_IMAGE_ERROR',
          data: {
            error: 'No images found',
            message: `Gallery "${galleryName}" contains no images`,
            galleryName: galleryName,
            galleryId: gallery.id,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Get random image
      const randomIndex = Math.floor(Math.random() * gallery.backgrounds.length);
      const randomImage = gallery.backgrounds[randomIndex];
      
      // Generate server-local URL for the image instead of external URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const localImageUrl = `${baseUrl}/api/backgrounds/${randomImage.id}/image`;
      
      const androidResponse = {
        type: 'RANDOM_IMAGE_SUCCESS',
        data: {
          success: true,
          galleryName: gallery.name,
          galleryId: gallery.id,
          galleryDescription: gallery.description || null,
          image: {
            id: randomImage.id,
            filename: randomImage.filename || randomImage.url?.split('/').pop() || 'unknown',
            originalName: randomImage.originalName || randomImage.filename || 'Unnamed Image',
            url: localImageUrl, // Use local server URL instead of external URL
            originalUrl: randomImage.url, // Keep original URL for reference
            width: randomImage.width || null,
            height: randomImage.height || null,
            size: randomImage.size || null,
            mimetype: randomImage.mimetype || 'image/jpeg'
          },
          totalImages: gallery.backgrounds.length,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('✅ Random gallery image selected:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android gallery random image endpoint:', error);
      const androidErrorResponse = {
        type: 'RANDOM_IMAGE_ERROR',
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

  // Android Playlist Endpoint - Get Random Playlist Track
  router.get('/playlist/:playlistName/random-track', async (req, res) => {
    console.log('📱 Android app requesting random playlist track...');
    
    try {
      const { playlistName } = req.params;
      
      if (!playlistName) {
        return res.status(400).json({
          type: 'RANDOM_TRACK_ERROR',
          data: {
            error: 'Playlist name required',
            message: 'Playlist name is required as URL parameter',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      console.log(`📱 Looking for playlist: "${playlistName}"`);
      
      // Search both Plex and custom playlists (case-insensitive)
      let playlist = null;
      let playlistType = null;
      let tracks = [];
      
      // First, try to find Plex playlist
      const plexPlaylist = await prisma.plexPlaylist.findFirst({
        where: {
          title: playlistName
        },
        include: {
          items: true
        }
      });
      
      if (plexPlaylist) {
        playlist = plexPlaylist;
        playlistType = 'plex';
        
        console.log(`📱 Found Plex playlist "${plexPlaylist.title}" with ${plexPlaylist.items?.length || 0} items`);
        
        // Get the actual track records based on playlist item ratingKeys
        if (plexPlaylist.items && plexPlaylist.items.length > 0) {
          const trackRatingKeys = plexPlaylist.items.map(item => item.ratingKey);
          console.log(`📱 Looking for tracks with ratingKeys: ${trackRatingKeys.slice(0, 5).join(', ')}${trackRatingKeys.length > 5 ? '...' : ''}`);
          
          tracks = await prisma.plexTrack.findMany({
            where: {
              ratingKey: {
                in: trackRatingKeys
              }
            },
            include: {
              album: {
                include: {
                  artist: true
                }
              }
            }
          });
          
          console.log(`📱 Found ${tracks.length} tracks in database out of ${trackRatingKeys.length} playlist items`);
          
          // Debug: Log missing tracks
          const foundRatingKeys = tracks.map(t => t.ratingKey);
          const missingRatingKeys = trackRatingKeys.filter(rk => !foundRatingKeys.includes(rk));
          if (missingRatingKeys.length > 0) {
            console.log(`📱 ⚠️ Missing tracks in database:`, missingRatingKeys.slice(0, 10));
          }
          
          // Debug: Check key field availability
          const tracksWithoutKey = tracks.filter(t => !t.key);
          if (tracksWithoutKey.length > 0) {
            console.log(`📱 ⚠️ Tracks missing 'key' field:`, tracksWithoutKey.map(t => `${t.ratingKey}: ${t.title}`).slice(0, 5));
          }
          
          // Add playlist-specific metadata (like addedAt from playlist item)
          tracks = tracks.map(track => {
            const playlistItem = plexPlaylist.items.find(item => item.ratingKey === track.ratingKey);
            return {
              ...track,
              addedAt: playlistItem?.addedAt || track.addedAt
            };
          });
        }
        
        console.log(`📱 Found Plex playlist with ${tracks.length} tracks`);
      } else {
        // Try custom playlist
        const customPlaylist = await prisma.customPlaylist.findFirst({
          where: {
            title: playlistName
          },
          include: {
            tracks: true
          }
        });
        
        if (customPlaylist) {
          playlist = customPlaylist;
          playlistType = 'custom';
          
          console.log(`📱 Found custom playlist "${customPlaylist.title}" with ${customPlaylist.tracks?.length || 0} tracks`);
          
          // Get the actual track records based on custom playlist track ratingKeys
          if (customPlaylist.tracks && customPlaylist.tracks.length > 0) {
            const trackRatingKeys = customPlaylist.tracks.map(track => track.ratingKey);
            console.log(`📱 Looking for tracks with ratingKeys: ${trackRatingKeys.slice(0, 5).join(', ')}${trackRatingKeys.length > 5 ? '...' : ''}`);
            
            tracks = await prisma.plexTrack.findMany({
              where: {
                ratingKey: {
                  in: trackRatingKeys
                }
              },
              include: {
                album: {
                  include: {
                    artist: true
                  }
                }
              }
            });
            
            console.log(`📱 Found ${tracks.length} tracks in database out of ${trackRatingKeys.length} custom playlist tracks`);
            
            // Debug: Log missing tracks
            const foundRatingKeys = tracks.map(t => t.ratingKey);
            const missingRatingKeys = trackRatingKeys.filter(rk => !foundRatingKeys.includes(rk));
            if (missingRatingKeys.length > 0) {
              console.log(`📱 ⚠️ Missing tracks in database:`, missingRatingKeys.slice(0, 10));
            }
            
            // Debug: Check key field availability
            const tracksWithoutKey = tracks.filter(t => !t.key);
            if (tracksWithoutKey.length > 0) {
              console.log(`📱 ⚠️ Tracks missing 'key' field:`, tracksWithoutKey.map(t => `${t.ratingKey}: ${t.title}`).slice(0, 5));
            }
            
            // Add custom playlist-specific metadata
            tracks = tracks.map(track => {
              const customTrack = customPlaylist.tracks.find(t => t.ratingKey === track.ratingKey);
              return {
                ...track,
                addedAt: customTrack?.addedAt || track.addedAt
              };
            });
          }
          
          console.log(`📱 Found custom playlist with ${tracks.length} tracks`);
        }
      }
      
      if (!playlist) {
        return res.json({
          type: 'RANDOM_TRACK_ERROR',
          data: {
            error: 'Playlist not found',
            message: `Playlist "${playlistName}" does not exist in Plex or Custom playlists`,
            playlistName: playlistName,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (tracks.length === 0) {
        return res.json({
          type: 'RANDOM_TRACK_ERROR',
          data: {
            error: 'No tracks found',
            message: `Playlist "${playlistName}" contains no tracks`,
            playlistName: playlistName,
            playlistType: playlistType,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Get random track
      const randomIndex = Math.floor(Math.random() * tracks.length);
      const randomTrack = tracks[randomIndex];
      
      console.log(`📱 Selected random track: "${randomTrack.title}" by ${randomTrack.album?.artist?.title || randomTrack.originalTitle || 'Unknown'}`);
      console.log(`📱 Track ratingKey: ${randomTrack.ratingKey}, key: ${randomTrack.key || 'MISSING'}`);
      console.log(`📱 Track data:`, {
        ratingKey: randomTrack.ratingKey,
        title: randomTrack.title,
        hasKey: !!randomTrack.key,
        key: randomTrack.key || 'MISSING',
        album: randomTrack.album?.title || 'Unknown',
        artist: randomTrack.album?.artist?.title || randomTrack.originalTitle || 'Unknown'
      });
      
      // Get Plex settings for stream URL generation
      const settings = await prisma.settings.findFirst();
      const baseUrl = getAndroidApiBaseUrl();
      
      let streamUrl = null;
      let artworkUrl = null;
      let plexUrl = settings?.plexUrl || null;
      
      // Generate stream URL by fetching media part from Plex API
      if (settings?.plexUrl && settings?.plexToken && randomTrack.ratingKey) {
        try {
          console.log(`📱 Fetching Plex metadata for track ${randomTrack.ratingKey}...`);
          const trackResponse = await fetch(`${settings.plexUrl}/library/metadata/${randomTrack.ratingKey}?X-Plex-Token=${settings.plexToken}`, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (trackResponse.ok) {
            const trackData = await trackResponse.json();
            const plexTrackMetadata = trackData.MediaContainer?.Metadata?.[0];
            
            // Get the actual media part for streaming (this is the correct approach)
            const mediaPart = plexTrackMetadata?.Media?.[0]?.Part?.[0];
            if (mediaPart && mediaPart.key) {
              streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
              console.log(`📱 ✅ Generated stream URL from media part: ${streamUrl}`);
            } else {
              console.warn(`📱 ❌ No media part found for track ${randomTrack.ratingKey}`);
            }
            
            // Generate artwork URL with fallback hierarchy (from Plex metadata)
            if (plexTrackMetadata?.thumb) {
              artworkUrl = plexTrackMetadata.thumb.startsWith('http') 
                ? plexTrackMetadata.thumb 
                : `${settings.plexUrl}${plexTrackMetadata.thumb}?X-Plex-Token=${settings.plexToken}`;
            } else if (plexTrackMetadata?.parentThumb) {
              artworkUrl = plexTrackMetadata.parentThumb.startsWith('http')
                ? plexTrackMetadata.parentThumb
                : `${settings.plexUrl}${plexTrackMetadata.parentThumb}?X-Plex-Token=${settings.plexToken}`;
            } else if (plexTrackMetadata?.grandparentThumb) {
              artworkUrl = plexTrackMetadata.grandparentThumb.startsWith('http')
                ? plexTrackMetadata.grandparentThumb
                : `${settings.plexUrl}${plexTrackMetadata.grandparentThumb}?X-Plex-Token=${settings.plexToken}`;
            }
          } else {
            console.warn(`📱 ❌ Failed to fetch Plex metadata for track ${randomTrack.ratingKey}:`, trackResponse.status);
          }
        } catch (error) {
          console.error(`📱 ❌ Error fetching Plex metadata for track ${randomTrack.ratingKey}:`, error);
        }
      } else {
        console.warn(`📱 ❌ Cannot generate stream URL:`, {
          hasPlexUrl: !!settings?.plexUrl,
          hasPlexToken: !!settings?.plexToken,
          hasTrackRatingKey: !!randomTrack.ratingKey,
          reason: !settings?.plexUrl ? 'Missing Plex URL' : 
                 !settings?.plexToken ? 'Missing Plex Token' : 
                 !randomTrack.ratingKey ? 'Missing track ratingKey' : 'Unknown'
        });
      }
      
      const androidResponse = {
        type: 'RANDOM_TRACK_SUCCESS',
        data: {
          success: true,
          playlistName: playlist.title,
          playlistType: playlistType,
          playlistId: playlistType === 'plex' ? playlist.ratingKey : playlist.id,
          playlistDescription: playlist.summary || playlist.description || null,
          track: {
            ratingKey: randomTrack.ratingKey,
            title: randomTrack.title,
            artist: randomTrack.album?.artist?.title || randomTrack.originalTitle || 'Unknown Artist',
            album: randomTrack.album?.title || 'Unknown Album',
            duration: randomTrack.duration || 0,
            type: randomTrack.type || 'track',
            streamUrl: streamUrl,
            artworkUrl: artworkUrl,
            plexUrl: plexUrl,
            year: randomTrack.album?.year ? parseInt(randomTrack.album.year) : null,
            index: randomTrack.index ? parseInt(randomTrack.index) : null,
            parentIndex: randomTrack.album?.index ? parseInt(randomTrack.album.index) : null,
            rating: randomTrack.rating ? parseFloat(randomTrack.rating) : null,
            addedAt: randomTrack.addedAt ? randomTrack.addedAt.toISOString() : null
          },
          totalTracks: tracks.length,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('✅ Random playlist track selected:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android playlist random track endpoint:', error);
      const androidErrorResponse = {
        type: 'RANDOM_TRACK_ERROR',
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

module.exports = createGalleryPlaylistRoutes;
