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
          totalImages: gallery.images.length,
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
        tracks = plexPlaylist.items;
        console.log(`📱 Found Plex playlist with ${tracks.length} tracks`);
      } else {
        // Try custom playlist
        const customPlaylist = await prisma.customPlaylist.findFirst({
          where: {
            title: playlistName
          },
          include: {
            customPlaylistItems: {
              include: {
                plexMusicTrack: true
              }
            }
          }
        });
        
        if (customPlaylist) {
          playlist = customPlaylist;
          playlistType = 'custom';
          tracks = customPlaylist.customPlaylistItems.map(item => item.plexMusicTrack).filter(Boolean);
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
            artist: randomTrack.grandparentTitle || randomTrack.originalTitle || 'Unknown Artist',
            album: randomTrack.parentTitle || 'Unknown Album',
            duration: randomTrack.duration || 0,
            type: randomTrack.type || 'track',
            streamUrl: streamUrl,
            artworkUrl: artworkUrl,
            plexUrl: plexUrl,
            year: randomTrack.year ? parseInt(randomTrack.year) : null,
            index: randomTrack.index ? parseInt(randomTrack.index) : null,
            parentIndex: randomTrack.parentIndex ? parseInt(randomTrack.parentIndex) : null,
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

  // Android Weather Endpoint - Get Current Weather
  router.get('/weather', async (req, res) => {
    console.log('📱 Android app requesting current weather...');
    
    try {
      // Get settings to check weather configuration
      const settings = await prisma.settings.findFirst();
      
      if (!settings?.weatherEnabled) {
        return res.json({
          type: 'WEATHER_ERROR',
          data: {
            error: 'Weather service disabled',
            message: 'Weather functionality is not enabled in settings',
            enabled: false,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (!settings?.weatherApiKey) {
        return res.json({
          type: 'WEATHER_ERROR',
          data: {
            error: 'Weather API key missing',
            message: 'Weather API key is not configured in settings',
            enabled: true,
            configured: false,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      if (!settings?.weatherLocation) {
        return res.json({
          type: 'WEATHER_ERROR',
          data: {
            error: 'Weather location missing',
            message: 'Weather location is not configured in settings',
            enabled: true,
            configured: false,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Use existing weather endpoint to get data
      const baseUrl = getAndroidApiBaseUrl();
      const weatherResponse = await fetch(`${baseUrl}/api/weather/current`);
      
      if (!weatherResponse.ok) {
        const errorText = await weatherResponse.text();
        return res.json({
          type: 'WEATHER_ERROR',
          data: {
            error: 'Weather API error',
            message: `Failed to fetch weather data: ${errorText}`,
            statusCode: weatherResponse.status,
            enabled: true,
            configured: true,
            timestamp: new Date().toISOString()
          }
        });
      }
      
      const weatherData = await weatherResponse.json();
      
      // Transform to Android format
      const androidResponse = {
        type: 'WEATHER_SUCCESS',
        data: {
          success: true,
          location: {
            name: weatherData.name || settings.weatherLocation,
            country: weatherData.sys?.country || 'Unknown',
            coordinates: {
              latitude: weatherData.coord?.lat || null,
              longitude: weatherData.coord?.lon || null
            },
            timezone: weatherData.timezone || null,
            sunrise: weatherData.sys?.sunrise ? new Date(weatherData.sys.sunrise * 1000).toISOString() : null,
            sunset: weatherData.sys?.sunset ? new Date(weatherData.sys.sunset * 1000).toISOString() : null
          },
          current: {
            temperature: weatherData.main?.temp || null,
            feelsLike: weatherData.main?.feels_like || null,
            tempMin: weatherData.main?.temp_min || null,
            tempMax: weatherData.main?.temp_max || null,
            humidity: weatherData.main?.humidity || null,
            pressure: weatherData.main?.pressure || null,
            visibility: weatherData.visibility ? weatherData.visibility / 1000 : null, // Convert to km
            uvIndex: weatherData.uvi || null
          },
          weather: {
            condition: weatherData.weather?.[0]?.main || 'Unknown',
            description: weatherData.weather?.[0]?.description || 'No description',
            icon: weatherData.weather?.[0]?.icon || null,
            iconUrl: weatherData.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png` : null
          },
          wind: {
            speed: weatherData.wind?.speed || null,
            direction: weatherData.wind?.deg || null,
            gust: weatherData.wind?.gust || null
          },
          clouds: {
            cloudiness: weatherData.clouds?.all || null
          },
          rain: {
            oneHour: weatherData.rain?.['1h'] || null,
            threeHours: weatherData.rain?.['3h'] || null
          },
          snow: {
            oneHour: weatherData.snow?.['1h'] || null,
            threeHours: weatherData.snow?.['3h'] || null
          },
          units: {
            system: settings.weatherUnits || 'metric',
            temperature: settings.weatherUnits === 'imperial' ? '°F' : settings.weatherUnits === 'kelvin' ? 'K' : '°C',
            windSpeed: settings.weatherUnits === 'imperial' ? 'mph' : 'm/s',
            pressure: 'hPa',
            visibility: 'km'
          },
          metadata: {
            dataTime: weatherData.dt ? new Date(weatherData.dt * 1000).toISOString() : null,
            requestTime: new Date().toISOString(),
            source: 'OpenWeatherMap',
            apiVersion: '2.5'
          }
        }
      };
      
      console.log('✅ Weather data retrieved successfully');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android weather endpoint:', error);
      const androidErrorResponse = {
        type: 'WEATHER_ERROR',
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
