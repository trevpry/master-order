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
            url: randomImage.url,
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
      
      // Search both Plex and custom playlists
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
        
        // Get the actual track records based on playlist item ratingKeys
        if (plexPlaylist.items && plexPlaylist.items.length > 0) {
          const trackRatingKeys = plexPlaylist.items.map(item => item.ratingKey);
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
          
          // Get the actual track records based on custom playlist track ratingKeys
          if (customPlaylist.tracks && customPlaylist.tracks.length > 0) {
            const trackRatingKeys = customPlaylist.tracks.map(track => track.ratingKey);
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
      
      // Get Plex settings for stream URL generation
      const settings = await prisma.settings.findFirst();
      const baseUrl = getAndroidApiBaseUrl();
      
      let streamUrl = null;
      let artworkUrl = null;
      let plexUrl = settings?.plexUrl || null;
      
      // Generate stream URL if we have Plex configuration
      if (settings?.plexUrl && settings?.plexToken && randomTrack.ratingKey) {
        // Use the correct Plex audio streaming endpoint format
        streamUrl = `${settings.plexUrl}/library/parts/${randomTrack.ratingKey}/stream?X-Plex-Token=${settings.plexToken}`;
        
        // Generate artwork URL with fallback hierarchy
        if (randomTrack.thumb) {
          artworkUrl = randomTrack.thumb.startsWith('http') 
            ? randomTrack.thumb 
            : `${settings.plexUrl}${randomTrack.thumb}?X-Plex-Token=${settings.plexToken}`;
        } else if (randomTrack.parentThumb) {
          artworkUrl = randomTrack.parentThumb.startsWith('http')
            ? randomTrack.parentThumb
            : `${settings.plexUrl}${randomTrack.parentThumb}?X-Plex-Token=${settings.plexToken}`;
        } else if (randomTrack.grandparentThumb) {
          artworkUrl = randomTrack.grandparentThumb.startsWith('http')
            ? randomTrack.grandparentThumb
            : `${settings.plexUrl}${randomTrack.grandparentThumb}?X-Plex-Token=${settings.plexToken}`;
        }
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
