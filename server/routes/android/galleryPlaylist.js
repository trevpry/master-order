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

  // Get random image from gallery
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
        return res.json(createAndroidResponse('GALLERY_RANDOM_IMAGE', {
          hasImage: false,
          message: 'No images found in gallery',
          galleryName: galleryName,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Select random image
      const randomIndex = Math.floor(Math.random() * gallery.images.length);
      const randomImage = gallery.images[randomIndex];
      
      const androidResponse = createAndroidResponse('GALLERY_RANDOM_IMAGE', {
        hasImage: true,
        image: randomImage,
        gallery: {
          id: gallery.id,
          title: gallery.title,
          totalImages: gallery.images.length
        },
        timestamp: new Date().toISOString()
      });
      
      console.log('📱 Random gallery image sent to Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android gallery random image endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'GALLERY_IMAGE_ERROR',
        'Failed to get random gallery image',
        error.message
      ));
    }
  });

  // Get random track from playlist
  router.get('/playlist/:playlistName/random-track', async (req, res) => {
    console.log('📱 Android app requesting random playlist track:', req.params.playlistName);
    
    try {
      const { playlistName } = req.params;
      const baseUrl = getAndroidApiBaseUrl();
      
      // Get playlist tracks using existing API
      const playlistResponse = await fetch(`${baseUrl}/api/playlists/search?name=${encodeURIComponent(playlistName)}`);
      
      if (!playlistResponse.ok) {
        return res.json(createAndroidResponse('PLAYLIST_RANDOM_TRACK', {
          hasTrack: false,
          message: 'Playlist not found',
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }));
      }
      
      const playlistData = await playlistResponse.json();
      
      if (!playlistData.tracks || playlistData.tracks.length === 0) {
        return res.json(createAndroidResponse('PLAYLIST_RANDOM_TRACK', {
          hasTrack: false,
          message: 'No tracks found in playlist',
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }));
      }
      
      // Select random track
      const randomIndex = Math.floor(Math.random() * playlistData.tracks.length);
      const randomTrack = playlistData.tracks[randomIndex];
      
      const androidResponse = createAndroidResponse('PLAYLIST_RANDOM_TRACK', {
        hasTrack: true,
        track: randomTrack,
        playlist: {
          name: playlistName,
          totalTracks: playlistData.tracks.length
        },
        timestamp: new Date().toISOString()
      });
      
      console.log('📱 Random playlist track sent to Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android playlist random track endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'PLAYLIST_TRACK_ERROR',
        'Failed to get random playlist track',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createGalleryPlaylistRoutes;
