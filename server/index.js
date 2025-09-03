const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // For Android companion app proxy
const getNextEpisode = require('./getNextEpisode');
const getNextMovie = require('./getNextMovie');
const { getNextCustomOrder, markCustomOrderItemAsWatched } = require('./getNextCustomOrder');
const datingRoutes = require('./routes/dating');
const notesRoutes = require('./routes/notes');

/**
 * Generate optimized clips for a scene, merging short final clips with the penultimate clip
 * @param {string} sceneId - The scene ID
 * @param {number} sceneDuration - Total scene duration in seconds
 * @param {number} clipDuration - Desired clip duration (default 60 seconds)
 * @returns {Array} Array of clip objects ready for database insertion
 */
function generateOptimizedClips(sceneId, sceneDuration, clipDuration = 60) {
  const clipsToCreate = [];
  const totalFullClips = Math.floor(sceneDuration / clipDuration);
  const remainingTime = sceneDuration % clipDuration;
  
  // If no clips can be created, return empty array
  if (totalFullClips === 0) {
    return [];
  }
  
  // If there's no remaining time or remaining time is >= 60 seconds, use standard logic
  if (remainingTime === 0 || remainingTime >= 60) {
    for (let i = 0; i < totalFullClips; i++) {
      const startTime = i * clipDuration;
      const endTime = Math.min(startTime + clipDuration, sceneDuration);
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: i,
        startTime: startTime,
        endTime: endTime,
        duration: endTime - startTime,
        watched: false
      });
    }
    
    // Add final partial clip if it's >= 60 seconds
    if (remainingTime >= 60) {
      const startTime = totalFullClips * clipDuration;
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: totalFullClips,
        startTime: startTime,
        endTime: sceneDuration,
        duration: remainingTime,
        watched: false
      });
    }
  } else {
    // Remaining time is < 60 seconds, merge with penultimate clip
    // Create all clips except the last two
    for (let i = 0; i < totalFullClips - 1; i++) {
      const startTime = i * clipDuration;
      const endTime = (i + 1) * clipDuration;
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: i,
        startTime: startTime,
        endTime: endTime,
        duration: clipDuration,
        watched: false
      });
    }
    
    // Create the final extended clip that includes the last full clip + remaining time
    if (totalFullClips >= 1) {
      const startTime = (totalFullClips - 1) * clipDuration;
      const endTime = sceneDuration;
      const extendedDuration = endTime - startTime;
      
      clipsToCreate.push({
        sceneId: sceneId,
        clipIndex: totalFullClips - 1,
        startTime: startTime,
        endTime: endTime,
        duration: extendedDuration,
        watched: false
      });
      
      console.log(`🔗 Merged short final clip (${remainingTime}s) with penultimate clip. Final clip duration: ${extendedDuration}s`);
    }
  }
  
  return clipsToCreate;
}
const prisma = require('./prismaClient'); // Import the shared client
const PlexDatabaseService = require('./plexDatabaseService');
const TvdbDatabaseService = require('./tvdbDatabaseService'); // Added import
const TVDBService = require('./tvdbService'); // Added import
const PlexSyncService = require('./plexSyncService'); // Added import
const BackgroundSyncService = require('./backgroundSyncService'); // Added import
const StashBackgroundSyncService = require('./stashBackgroundSyncService'); // Added import
const ArtworkCacheService = require('./artworkCacheService'); // Added import
const subOrderService = require('./subOrderService'); // Added import
const WatchLogService = require('./watchLogService'); // Added import
const openLibraryService = require('./openLibraryService'); // Added import
const mm = require('music-metadata');
const comicSearchService = require('./comicSearchService'); // Added import
const { getTimezoneAwarePeriodBounds, getTimezoneAwareDateGrouping, formatDateInTimezone } = require('./utils/timezoneUtils');
const StatisticsService = require('./services/statisticsService');
const WatchStatsRoutes = require('./routes/watchStatsRoutes');

// Initialize services
const plexDb = new PlexDatabaseService();
const tvdbDb = new TvdbDatabaseService();
const plexSync = new PlexSyncService(); // Initialize the sync service
const backgroundSync = new BackgroundSyncService(); // Initialize background sync service
const stashBackgroundSync = new StashBackgroundSyncService(); // Initialize Stash background sync service
const artworkCache = new ArtworkCacheService(); // Initialize artwork cache service
const watchLogService = new WatchLogService(prisma); // Initialize watch log service
const statisticsService = new StatisticsService(prisma, watchLogService);
const watchStatsRoutes = new WatchStatsRoutes(watchLogService, statisticsService);
const PlexPlayerService = require('./plexPlayerService');
const plexPlayer = new PlexPlayerService(); // Initialize Plex player service
const StashService = require('./stashService');
const StashSyncService = require('./stashSyncService');
const StashSyncServiceOptimized = require('./stashSyncServiceOptimized');
let stashService = StashService; // Use the singleton instance directly
let stashSyncService = null; // Initialize later with settings
let stashSyncServiceOptimized = null; // Optimized sync service

// Configuration for sync service type
const SYNC_SERVICE_TYPE = process.env.STASH_SYNC_OPTIMIZED === 'false' ? 'legacy' : 'optimized';

// Initialize Stash service with current settings
async function initializeStashService() {
  try {
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    // Use database settings, fall back to environment variable if needed
    const stashUrl = settings?.stashUrl || process.env.STASH_URL;
    const stashApiKey = settings?.stashApiKey || process.env.STASH_API_KEY;
    
    console.log('🔍 Initializing Stash service...');
    console.log('   - Settings loaded:', !!settings);
    console.log('   - Database Stash URL:', settings?.stashUrl || 'NOT SET');
    console.log('   - Environment STASH_URL:', process.env.STASH_URL || 'NOT SET');
    console.log('   - Final Stash URL:', stashUrl || 'NOT SET');
    console.log('   - Stash API Key:', stashApiKey ? 'SET' : 'NOT SET');
    
    if (stashUrl) {
      // Configure the existing singleton instance
      stashService.configure(stashUrl, stashApiKey || null);
      console.log('✅ Stash service initialized');
      console.log('   - Service configured:', stashService.isConfigured());
    } else {
      // Reset the configuration if no URL is set
      stashService.configure(null, null);
      console.log('ℹ️  Stash service not initialized - missing URL in both settings and environment');
    }
  } catch (error) {
    console.error('❌ Error initializing Stash service:', error.message);
    // Reset configuration on error
    stashService.configure(null, null);
  }
}

async function initializeStashSyncService() {
  try {
    // Initialize both services
    stashSyncService = new StashSyncService();
    stashSyncServiceOptimized = new StashSyncServiceOptimized();
    
    console.log('✅ Stash sync services initialized');
    console.log('   - Legacy sync service: Available');
    console.log('   - Optimized sync service: Available');
    console.log('   - Active sync type:', SYNC_SERVICE_TYPE);
  } catch (error) {
    console.error('❌ Error initializing Stash sync services:', error.message);
    stashSyncService = null;
    stashSyncServiceOptimized = null;
  }
}

// Helper function to get the active sync service
function getActiveSyncService() {
  return SYNC_SERVICE_TYPE === 'optimized' ? stashSyncServiceOptimized : stashSyncService;
}

// Add Docker startup diagnostics for artwork cache issues
if (process.env.NODE_ENV === 'production') {
  console.log('🐳 Docker environment detected - artwork cache diagnostics enabled');
  console.log('   Orphaned cache entries will be cleaned up automatically on startup');
}

// Initialize the app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for mobile access
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

// Set up multer for handling multipart form data (Plex webhooks)
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  console.log('Serving static files from:', clientBuildPath);
}

// Dating API routes
app.use('/api/dating', datingRoutes);

// Notes API routes
app.use('/api/notes', notesRoutes);

// Helper function for generating a simple hash (used for web video uniqueness)
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Ensure positive integer
}

// API Routes
// Health check endpoint for Docker
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Weather API endpoint
app.get('/api/weather', async (req, res) => {
  try {
    // Get Eddie settings for weather configuration
    const eddieSettings = await prisma.eddieSettings.findFirst();
    
    if (!eddieSettings?.weatherEnabled) {
      return res.status(400).json({
        error: 'Weather is not enabled in settings'
      });
    }
    
    if (!eddieSettings?.weatherApiKey) {
      return res.status(400).json({
        error: 'Weather API key not configured'
      });
    }
    
    if (!eddieSettings?.weatherLocation) {
      return res.status(400).json({
        error: 'Weather location not configured'
      });
    }
    
    const apiKey = eddieSettings.weatherApiKey;
    const location = eddieSettings.weatherLocation;
    const units = eddieSettings.weatherUnits || 'metric';
    
    // Check if location is coordinates (lat,lon) or city name
    let weatherUrl;
    // Check if it's coordinates by looking for numeric lat,lon pattern
    const coordPattern = /^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$/;
    if (coordPattern.test(location.trim())) {
      // It's coordinates format "lat,lon"
      const [lat, lon] = location.split(',').map(coord => coord.trim());
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
    } else {
      // It's a city name (possibly with state/country)
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`;
    }
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    const weatherData = await response.json();
    
    // Add units info to response
    weatherData.units = units;
    weatherData.tempUnit = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K';
    weatherData.speedUnit = units === 'metric' ? 'm/s' : 'mph';
    
    res.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather data',
      details: error.message
    });
  }
});

// Eddie Settings API endpoints
app.get('/api/eddie-settings', async (req, res) => {
  try {
    let settings = await prisma.eddieSettings.findFirst();
    
    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.eddieSettings.create({
        data: {
          weatherEnabled: false,
          weatherUnits: 'metric'
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching Eddie settings:', error);
    res.status(500).json({
      error: 'Failed to fetch Eddie settings',
      details: error.message
    });
  }
});

app.put('/api/eddie-settings', async (req, res) => {
  try {
    const {
      weatherApiKey,
      weatherLocation,
      weatherUnits,
      weatherEnabled
    } = req.body;
    
    // Get or create settings
    let settings = await prisma.eddieSettings.findFirst();
    
    if (settings) {
      // Update existing settings
      settings = await prisma.eddieSettings.update({
        where: { id: settings.id },
        data: {
          ...(weatherApiKey !== undefined && { weatherApiKey }),
          ...(weatherLocation !== undefined && { weatherLocation }),
          ...(weatherUnits !== undefined && { weatherUnits }),
          ...(weatherEnabled !== undefined && { weatherEnabled }),
        }
      });
    } else {
      // Create new settings
      settings = await prisma.eddieSettings.create({
        data: {
          weatherApiKey: weatherApiKey || null,
          weatherLocation: weatherLocation || null,
          weatherUnits: weatherUnits || 'metric',
          weatherEnabled: weatherEnabled || false,
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating Eddie settings:', error);
    res.status(500).json({
      error: 'Failed to update Eddie settings',
      details: error.message
    });
  }
});

// Android companion app proxy endpoint
app.post('/api/android/play', async (req, res) => {
  try {
    const commandData = req.body;
    const action = commandData.action || 'play';
    
    console.log(`📱 Emitting Android companion app message (Stash ${action}):`, JSON.stringify(commandData, null, 2));
    
    // Emit WebSocket message to Android companion app
    io.emit('androidCompanion', {
      type: 'STASH_PLAYBACK',
      action: action.toUpperCase(),
      scene: commandData.scene,
      timestamp: new Date().toISOString()
    });

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

app.get('/api/up_next', async (req, res) => {
  try {
    const data = await getNextEpisode(); // This handles order type selection internally
    
    // If movies were selected, use the new getNextMovie function
    if (data.orderType === 'MOVIES_GENERAL') {
      console.log('Movie order type selected, using getNextMovie function');    const movieData = await getNextMovie();
      res.json(movieData);
    } else if (data.orderType === 'CUSTOM_ORDER') {
      console.log('Custom order type selected, using getNextCustomOrder function');
      const customOrderData = await getNextCustomOrder(req);
      res.json(customOrderData);
    } else {
      // TV General selection
      res.json(data);
    }
  } catch (error) {
    console.error('Failed to fetch data:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to get next item',
      details: error.message 
    });
  }
});

// Find the earliest episode from a completed series in the selected collection
app.get('/api/start-new-series', async (req, res) => {
  try {
    const startNewSeriesService = require('./startNewSeriesService');
    const result = await startNewSeriesService.findNewSeries();
    
    console.log(`🎬 Successfully found new series to start: ${result.seriesTitle}`);
    res.json(result);
    
  } catch (error) {
    console.error('Error finding new series:', error);
    res.status(500).json({ 
      error: 'Failed to find new series',
      details: error.message 
    });
  }
});

// API endpoint to check artwork cache health
app.get('/api/artwork-cache/health', async (req, res) => {
  try {
    const items = await prisma.customOrderItem.findMany({
      where: {
        localArtworkPath: { not: null }
      },
      select: {
        id: true,
        title: true,
        localArtworkPath: true
      }
    });

    let validFiles = 0;
    let missingFiles = 0;
    const orphanedEntries = [];

    for (const item of items) {
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
        ? item.localArtworkPath.split(/[\\\/]/).pop() 
        : item.localArtworkPath;
      
      const filePath = artworkCache.getCachedFilePath(filename);
      
      try {
        await require('fs').promises.access(filePath);
        validFiles++;
      } catch (error) {
        missingFiles++;
        orphanedEntries.push({
          id: item.id,
          title: item.title,
          filename: filename
        });
      }
    }

    res.json({
      status: 'ok',
      totalEntries: items.length,
      validFiles,
      missingFiles,
      orphanedEntries: orphanedEntries.slice(0, 10) // Limit to first 10 for response size
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// API endpoint to manually repair artwork cache
app.post('/api/artwork-cache/repair', async (req, res) => {
  try {
    console.log('🔧 Manual artwork cache repair requested...');
    
    const items = await prisma.customOrderItem.findMany({
      where: {
        localArtworkPath: { not: null }
      },
      include: {
        storyContainedInBook: true
      }
    });

    let cleanedEntries = 0;
    let recachedItems = 0;

    for (const item of items) {
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
        ? item.localArtworkPath.split(/[\\\/]/).pop() 
        : item.localArtworkPath;
      
      const filePath = artworkCache.getCachedFilePath(filename);
      
      try {
        await require('fs').promises.access(filePath);
        // File exists, no action needed
      } catch (error) {
        console.log(`Repairing orphaned entry: ${item.title}`);
        
        // Try to re-cache first
        try {
          const result = await artworkCache.ensureArtworkCached(item);
          if (result.success) {
            recachedItems++;
            console.log(`Successfully re-cached: ${item.title}`);
          } else {
            throw new Error(result.error || 'Re-caching failed');
          }
        } catch (recacheError) {
          // Clean up orphaned entry if re-caching fails
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: {
              localArtworkPath: null,
              originalArtworkUrl: null,
              artworkLastCached: null,
              artworkMimeType: null
            }
          });
          cleanedEntries++;
          console.log(`Cleaned up orphaned entry: ${item.title}`);
        }
      }
    }

    console.log(`🎉 Repair complete - Re-cached: ${recachedItems}, Cleaned: ${cleanedEntries}`);
    
    res.json({
      status: 'success',
      totalItems: items.length,
      recachedItems,
      cleanedEntries,
      message: `Repair complete! Re-cached ${recachedItems} items and cleaned up ${cleanedEntries} orphaned entries.`
    });
    
  } catch (error) {
    console.error('Artwork cache repair failed:', error.message);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Serve cached artwork files (must come before wildcard Plex route)
app.get('/api/artwork/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = artworkCache.getCachedFilePath(filename);
    
    // Check if file exists
    const fs = require('fs').promises;
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).send('Cached artwork not found');
    }
    
    // Get file stats and MIME type
    const path = require('path');
    const extension = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };
    const mimeType = mimeMap[extension] || 'image/jpeg';
    
    // Set headers
    res.set({
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    // Stream the file
    const fs_stream = require('fs');
    const stream = fs_stream.createReadStream(filePath);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Error serving cached artwork:', error);
    res.status(500).send('Error loading cached artwork');
  }
});

// Proxy endpoint for Plex artwork
app.get('/api/artwork/*', async (req, res) => {
  try {
    const artworkPath = req.params[0]; // Get everything after /api/artwork/
    
    // Get settings using cached database utility
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.plexUrl || !settings.plexToken) {
      return res.status(500).send('Plex settings not configured');
    }
    
    const artworkUrl = `${settings.plexUrl}/${artworkPath}?X-Plex-Token=${settings.plexToken}`;
    
    const axios = require('axios');
    const response = await axios.get(artworkUrl, {
      responseType: 'stream'
    });
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'],
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    
    // Pipe the image data
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying artwork:', error);
    res.status(500).send('Error loading artwork');
  }
});

// Get full Plex media data by plexKey (for custom order navigation)
app.get('/api/plex-media/:plexKey', async (req, res) => {
  try {
    const { plexKey } = req.params;
    
    if (!plexKey) {
      return res.status(400).json({ error: 'Missing plexKey parameter' });
    }
    
    console.log(`📺 Fetching full Plex data for plexKey: ${plexKey}`);
    
    const plexDatabaseService = require('./plexDatabaseService');
    const plexDb = new plexDatabaseService();
    
    // Try to get item metadata (works for episodes, movies, shows)
    const itemData = await plexDb.getItemMetadata(plexKey);
    if (itemData && itemData.type === 'episode') {
      console.log(`📺 Found episode: ${itemData.grandparentTitle} - S${itemData.parentIndex}E${itemData.index} - ${itemData.title}`);
      
      // Get TVDB artwork for the episode
      const tvdbService = require('./tvdbCachedService');
      const tvdbArtwork = await tvdbService.getCurrentSeasonArtwork(
        itemData.grandparentTitle, 
        itemData.parentIndex, 
        itemData.index
      );
      
      const responseData = {
        type: 'episode',
        id: itemData.ratingKey,
        title: itemData.title,
        seriesTitle: itemData.grandparentTitle,
        season: itemData.parentIndex,
        episode: itemData.index,
        currentSeason: itemData.parentIndex,
        currentEpisode: itemData.index,
        nextEpisodeTitle: itemData.title,
        episodeRatingKey: plexKey,
        plexKey: plexKey,
        thumb: itemData.thumb,
        art: itemData.art,
        tvdbArtwork: tvdbArtwork,
        ratingKey: plexKey,
        // Add series-level data
        seriesRatingKey: itemData.grandparentRatingKey,
        seasonTitle: itemData.parentTitle,
        // Add any other relevant episode data
        duration: itemData.duration,
        year: itemData.year,
        addedAt: itemData.addedAt,
        updatedAt: itemData.updatedAt
      };
      
      return res.json(responseData);
    }
    
    // Try to get movie data
    if (itemData && itemData.type === 'movie') {
      console.log(`🎬 Found movie: ${itemData.title} (${itemData.year})`);
      
      const responseData = {
        type: 'movie',
        id: itemData.ratingKey,
        title: itemData.title,
        year: itemData.year,
        plexKey: plexKey,
        ratingKey: plexKey,
        thumb: itemData.thumb,
        art: itemData.art,
        // Add any other relevant movie data
        duration: itemData.duration,
        addedAt: itemData.addedAt,
        updatedAt: itemData.updatedAt,
        summary: itemData.summary
      };
      
      return res.json(responseData);
    }
    
    // If no item found or not the right type
    if (!itemData) {
      console.warn(`⚠️ No media found for plexKey: ${plexKey}`);
    } else {
      console.warn(`⚠️ Unsupported media type '${itemData.type}' for plexKey: ${plexKey}`);
    }
    return res.status(404).json({ error: 'Media not found or unsupported type' });
    
  } catch (error) {
    console.error('Error fetching Plex media data:', error);
    res.status(500).json({ error: 'Failed to fetch Plex media data' });
  }
});

// Proxy endpoint for Stash images
app.get('/api/stash-image-proxy/*', async (req, res) => {
  try {
    const imagePath = req.params[0]; // Get everything after /api/stash-image-proxy/
    
    // Get settings using cached database utility
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.stashUrl) {
      return res.status(500).send('Stash settings not configured');
    }
    
    // Stash serves images through specific GraphQL endpoints or image endpoints
    // We need to extract the image ID from the database and use Stash's image serving API
    
    let imageUrl;
    
    // If the path is already a full HTTP URL, use it directly
    if (imagePath.startsWith('http')) {
      imageUrl = imagePath;
    } else {
      // For file paths, we need to find the image by path and get its ID from Stash
      // Then use Stash's image endpoint: /image/{imageId}/image
      
      // First, try to find the image ID from our database
      const image = await prisma.stashImage.findFirst({
        where: {
          OR: [
            { path: imagePath },
            { path: decodeURIComponent(imagePath) }
          ]
        }
      });
      
      if (image && image.id) {
        // Use Stash's image endpoint with the image ID
        // Normalize the URL to avoid double slashes
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/image/${image.id}/image`;
      } else {
        // Fallback: try to use the path directly (may not work for all cases)
        console.warn(`Could not find image ID for path: ${imagePath}, trying direct path`);
        
        // Remove leading slash if present and normalize base URL
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/${cleanPath}`;
      }
    }
    
    console.log(`Proxying Stash image: ${imageUrl}`);
    
    // Validate URL construction to avoid double slashes
    if (imageUrl.includes('//') && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.warn(`Warning: Double slash detected in image URL: ${imageUrl}`);
    }
    
    // Add API key if available
    const headers = {};
    if (settings.stashApiKey) {
      headers['ApiKey'] = settings.stashApiKey;
    }
    
    const axios = require('axios');
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      headers,
      timeout: 15000 // 15 second timeout
    });
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*' // Allow cross-origin for images
    });
    
    // Pipe the image data
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying Stash image:', error.message);
    console.error('Image path attempted:', req.params[0]);
    
    // Return a placeholder or 404 instead of 500
    res.status(404).send('Image not found');
  }
});

// Proxy endpoint for TVDB artwork
app.get('/api/tvdb-artwork', async (req, res) => {
  try {
    const artworkUrl = req.query.url;
    if (!artworkUrl) {
      return res.status(400).send('Missing artwork URL');
    }
    
    const axios = require('axios');
    const response = await axios.get(artworkUrl, {
      responseType: 'stream',
      timeout: 10000 // 10 second timeout
    });
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    // Pipe the image data
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying TVDB artwork:', error);
    res.status(500).send('Error loading TVDB artwork');
  }
});

// Proxy endpoint for ComicVine artwork
app.get('/api/comicvine-artwork', async (req, res) => {
  try {
    const artworkUrl = req.query.url;
    if (!artworkUrl) {
      return res.status(400).send('Missing artwork URL');
    }
    
    const axios = require('axios');
    // Use longer timeout for mobile devices and better User-Agent
    const timeout = req.get('User-Agent')?.includes('Mobile') ? 20000 : 10000;
    const userAgent = req.get('User-Agent') || 'MasterOrder/1.0';
    
    console.log(`Loading ComicVine artwork: ${artworkUrl} (timeout: ${timeout}ms, UA: ${userAgent})`);
    
    const response = await axios.get(artworkUrl, {
      responseType: 'stream',
      timeout: timeout,
      headers: {
        'User-Agent': userAgent, // Use original user agent to avoid blocking
        'Accept': 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*' // Allow cross-origin access
    });
    
    // Pipe the image data
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying ComicVine artwork:', error.message);
    if (error.code === 'ECONNABORTED') {
      console.error('ComicVine artwork request timed out');
      res.status(408).send('ComicVine artwork request timed out');
    } else if (error.response) {
      console.error('ComicVine returned:', error.response.status, error.response.statusText);
      res.status(error.response.status).send(`ComicVine error: ${error.response.statusText}`);
    } else {
      res.status(500).send('Error loading ComicVine artwork');
    }
  }
});

// Komga test connection endpoint
app.get('/api/komga/test', async (req, res) => {
  try {
    const komgaService = require('./komgaService');
    const result = await komgaService.testConnection();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Komga connection successful',
        configured: true
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.message,
        configured: false
      });
    }
  } catch (error) {
    console.error('Error testing Komga connection:', error);
    res.status(500).json({ 
      error: 'Failed to test Komga connection',
      message: error.message,
      configured: false
    });
  }
});

// Komga search endpoint
app.get('/api/komga/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const komgaService = require('./komgaService');
    const results = await komgaService.searchSeries(query);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching Komga:', error);
    res.status(500).json({ error: 'Failed to search Komga', message: error.message });
  }
});

// Komga comic search endpoint (searches for specific comic issue)
app.get('/api/komga/search-comic', async (req, res) => {
  try {
    const { series, issue, year } = req.query;
    
    if (!series || !issue) {
      return res.status(400).json({ error: 'series and issue parameters are required' });
    }
    
    const komgaService = require('./komgaService');
    const result = await komgaService.searchComic(series, issue, year ? parseInt(year) : null);
    
    if (result) {
      res.json({ found: true, data: result });
    } else {
      res.json({ found: false, data: null });
    }
  } catch (error) {
    console.error('Error searching Komga for comic:', error);
    res.status(500).json({ error: 'Failed to search Komga for comic', message: error.message });
  }
});

// Stash test connection endpoint
app.get('/api/stash/test', async (req, res) => {
  try {
    console.log('🧪 Testing Stash connection...');
    
    if (!stashSyncService) {
      console.log('⚠️ StashSyncService not initialized, initializing now...');
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      console.log('❌ StashSyncService still not available after initialization');
      return res.status(400).json({ 
        success: false, 
        message: 'Stash sync service not configured',
        configured: false
      });
    }

    console.log('🔍 Calling stashSyncService.testConnection()...');
    const version = await stashSyncService.testConnection();
    console.log('✅ Stash connection test successful:', version);
    
    // Get the Stash URL from settings
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    
    // Prioritize environment variables for API response
    const finalStashUrl = (process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                          process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3 || 
                          settings?.stashUrl)?.replace(/\/+$/, '');

    console.log('📋 Stash connection test results:', {
      success: true,
      version: version,
      finalStashUrl,
      hasApiKey: !!(settings?.stashApiKey)
    });
    
    res.json({ 
      success: true, 
      message: 'Stash connection successful',
      configured: true,
      version: version,
      stashUrl: finalStashUrl || null,
      apiKey: settings?.stashApiKey || null // Include API key for frontend video streaming
    });
  } catch (error) {
    console.error('❌ Error testing Stash connection:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      configured: false
    });
  }
});

// Stash scenes endpoint
app.get('/api/stash/scenes', async (req, res) => {
  try {
    const { page = 1, perPage = 20, sort = 'createdAt', direction = 'DESC', filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { title: { contains: filter, mode: 'insensitive' } },
        { details: { contains: filter, mode: 'insensitive' } },
        { studio: { contains: filter, mode: 'insensitive' } },
        { code: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Build sort order
    const orderBy = {};
    const sortField = sort === 'date' ? 'date' : sort === 'title' ? 'title' : 'createdAt';
    orderBy[sortField] = direction.toLowerCase();
    
    // Get total count
    const total = await prisma.stashScene.count({
      where: searchFilter
    });
    
    // Get scenes with related data
    const scenes = await prisma.stashScene.findMany({
      where: searchFilter,
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      },
      orderBy: orderBy,
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedScenes = scenes.map(scene => ({
      id: scene.id,
      title: scene.title,
      details: scene.details,
      url: scene.url,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      path: scene.path,
      duration: scene.duration,
      studio: scene.studioObject ? { 
        id: scene.studioObject.id, 
        name: scene.studioObject.name,
        url: scene.studioObject.url,
        image: scene.studioObject.image
      } : scene.studio ? { name: scene.studio } : null,
      code: scene.code,
      director: scene.director,
      synopsis: scene.synopsis,
      // Play status fields
      playCount: scene.playCount,
      lastPlayedAt: scene.lastPlayedAt,
      resumeTime: scene.resumeTime,
      playDuration: scene.playDuration,
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        name: sp.performer.name
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name
      }))
    }));
    
    res.json({
      success: true,
      data: transformedScenes,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash scenes from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash scenes',
      message: error.message 
    });
  }
});

// Get random unwatched Stash scene for "Next Stash" functionality
app.get('/api/stash/scenes/next', async (req, res) => {
  try {
    console.log('🎲 Getting random unwatched scene...');
    
    // Find scenes with play_count = 0 or null, and exclude scenes with "__Watched" tag
    const unwatchedScenes = await prisma.stashScene.findMany({
      where: {
        AND: [
          // Play count is 0 or null
          {
            OR: [
              { playCount: 0 },
              { playCount: null }
            ]
          },
          // Exclude scenes with "__Watched" tag
          {
            NOT: {
              tags: {
                some: {
                  tag: {
                    name: '__Watched'
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      }
    });

    console.log(`📊 Found ${unwatchedScenes.length} unwatched scenes (excluding "__Watched" tags)`);

    if (unwatchedScenes.length === 0) {
      return res.json({
        success: false,
        message: 'No unwatched scenes available (all scenes have been watched)',
        scene: null
      });
    }

    // Select a random scene from the unwatched scenes
    const randomIndex = Math.floor(Math.random() * unwatchedScenes.length);
    const randomScene = unwatchedScenes[randomIndex];

    console.log(`🎯 Selected random scene: ${randomScene.title} (ID: ${randomScene.id})`);

    res.json({
      success: true,
      scene: randomScene,
      totalUnwatched: unwatchedScenes.length,
      message: `Selected 1 of ${unwatchedScenes.length} unwatched scenes`
    });
  } catch (error) {
    console.error('Error getting random unwatched scene:', error);
    res.status(500).json({ 
      error: 'Failed to get random unwatched scene',
      message: error.message 
    });
  }
});

// Stash scene by ID endpoint
app.get('/api/stash/scenes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const scene = await prisma.stashScene.findUnique({
      where: { id: id },
      include: {
        performers: {
          include: {
            performer: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        },
        studioObject: true
      }
    });
    
    if (!scene) {
      return res.status(404).json({ 
        error: 'Scene not found',
        message: `Scene with ID ${id} not found in database`
      });
    }
    
    // Transform data to match expected format
    const transformedScene = {
      id: scene.id,
      title: scene.title,
      details: scene.details,
      url: scene.url,
      date: scene.date,
      rating: scene.rating,
      organized: scene.organized,
      osHash: scene.osHash,
      checksum: scene.checksum,
      phash: scene.phash,
      oCounter: scene.oCounter,
      path: scene.path,
      duration: scene.duration,
      fileModTime: scene.fileModTime,
      studio: scene.studioObject ? { 
        id: scene.studioObject.id, 
        name: scene.studioObject.name,
        url: scene.studioObject.url,
        image: scene.studioObject.image
      } : scene.studio ? { name: scene.studio } : null,
      code: scene.code,
      director: scene.director,
      synopsis: scene.synopsis,
      // Play status fields
      playCount: scene.playCount,
      lastPlayedAt: scene.lastPlayedAt,
      resumeTime: scene.resumeTime,
      playDuration: scene.playDuration,
      performers: scene.performers.map(sp => ({
        id: sp.performer.id,
        name: sp.performer.name,
        disambiguation: sp.performer.disambiguation,
        alias: sp.performer.alias,
        favorite: sp.performer.favorite,
        birthdate: sp.performer.birthdate,
        ethnicity: sp.performer.ethnicity,
        country: sp.performer.country,
        eye_color: sp.performer.eye_color,
        height: sp.performer.height,
        measurements: sp.performer.measurements,
        fake_tits: sp.performer.fake_tits,
        career_length: sp.performer.career_length,
        tattoos: sp.performer.tattoos,
        piercings: sp.performer.piercings,
        image: sp.performer.image,
        instagram: sp.performer.instagram,
        twitter: sp.performer.twitter,
        url: sp.performer.url
      })),
      tags: scene.tags.map(st => ({
        id: st.tag.id,
        name: st.tag.name,
        description: st.tag.description,
        image: st.tag.image
      }))
    };
    
    res.json({
      success: true,
      data: transformedScene
    });
  } catch (error) {
    console.error('Error fetching Stash scene from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash scene',
      message: error.message 
    });
  }
});

// Mark Stash scene as watched
app.post('/api/stash/scenes/:id/watched', async (req, res) => {
  try {
    const sceneId = req.params.id;
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    // Update our local database
    const updatedScene = await prisma.stashScene.update({
      where: { id: sceneId },
      data: {
        playCount: {
          increment: 1
        },
        lastPlayedAt: new Date()
      }
    });

    // Handle the case where playCount was null before increment
    // SQLite increment on null results in null, so we need to fix this
    let finalPlayCount = updatedScene.playCount;
    if (finalPlayCount === null) {
      const fixedScene = await prisma.stashScene.update({
        where: { id: sceneId },
        data: { playCount: 1 }
      });
      finalPlayCount = 1;
      updatedScene.playCount = 1;
    }

    // Also increment play count in Stash itself
    let stashResult = null;
    console.log('🔍 Checking Stash service for play count increment...');
    console.log('   - stashService exists:', !!stashService);
    console.log('   - stashService.isConfigured():', stashService ? stashService.isConfigured() : 'N/A');
    
    if (stashService && stashService.isConfigured()) {
      console.log('📡 Incrementing play count in Stash...');
      stashResult = await stashService.incrementScenePlayCount(sceneId);
      if (!stashResult.success) {
        console.warn('Failed to increment play count in Stash:', stashResult.error);
      } else {
        console.log('✅ Play count incremented in Stash successfully');
      }
    } else {
      console.warn('Stash service not configured, skipping remote play count increment');
      console.warn('   - Service exists:', !!stashService);
      console.warn('   - Service configured:', stashService ? stashService.isConfigured() : false);
    }

    res.json({
      success: true,
      message: 'Scene marked as watched',
      scene: updatedScene,
      stashUpdate: stashResult
    });
  } catch (error) {
    console.error('Error marking Stash scene as watched:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ 
        error: 'Scene not found',
        message: 'The requested scene does not exist'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to mark scene as watched',
        message: error.message 
      });
    }
  }
});

// Delete Stash scene (from both local database and Stash itself)
app.delete('/api/stash/scenes/:id', async (req, res) => {
  try {
    const sceneId = req.params.id;
    const { deleteFile = false } = req.query; // Query parameter to optionally delete the actual file
    
    if (!sceneId) {
      return res.status(400).json({ error: 'Invalid scene ID' });
    }

    console.log('🗑️ Deleting scene:', sceneId, 'deleteFile:', deleteFile);

    // Delete from local database first
    let localDeleted = false;
    let clipsDeleted = 0;
    try {
      // First, delete all clips associated with this scene
      const clipDeletionResult = await prisma.stashClip.deleteMany({
        where: { sceneId: sceneId }
      });
      clipsDeleted = clipDeletionResult.count;
      if (clipsDeleted > 0) {
        console.log(`✅ Deleted ${clipsDeleted} clips associated with scene`);
      }
      
      // Then delete the scene
      await prisma.stashScene.delete({
        where: { id: sceneId }
      });
      localDeleted = true;
      console.log('✅ Scene deleted from local database');
    } catch (localError) {
      if (localError.code === 'P2025') {
        console.log('ℹ️ Scene not found in local database (may not have been synced)');
      } else {
        console.error('❌ Error deleting from local database:', localError);
        throw localError;
      }
    }

    // Delete from Stash itself
    let stashResult = null;
    if (stashService && stashService.isConfigured()) {
      console.log('🗑️ Deleting scene from Stash...');
      stashResult = await stashService.deleteScene(
        sceneId, 
        deleteFile === 'true', // Convert string to boolean
        true // Always delete generated files (thumbnails, etc.)
      );
      
      if (!stashResult.success) {
        console.warn('Failed to delete scene from Stash:', stashResult.error);
      } else {
        console.log('✅ Scene deleted from Stash successfully');
      }
    } else {
      console.warn('Stash service not configured, skipping remote deletion');
    }

    res.json({
      success: true,
      message: 'Scene deletion completed',
      localDeleted,
      clipsDeleted,
      stashDeleted: stashResult?.success || false,
      stashResult
    });
  } catch (error) {
    console.error('Error deleting Stash scene:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ 
        error: 'Scene not found',
        message: 'The requested scene does not exist in local database'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to delete scene',
        message: error.message 
      });
    }
  }
});

// Generate clips for a scene
app.post('/api/stash/scenes/:id/clips/generate', async (req, res) => {
  try {
    const sceneId = req.params.id;
    console.log(`🎬 Generating clips for scene: ${sceneId}`);
    
    // Get the scene to check duration
    const scene = await prisma.stashScene.findUnique({
      where: { id: sceneId },
      select: { 
        id: true, 
        title: true, 
        duration: true,
        clips: {
          orderBy: { clipIndex: 'asc' }
        }
      }
    });
    
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    
    if (!scene.duration || scene.duration <= 0) {
      return res.status(400).json({ error: 'Scene duration not available' });
    }
    
    // Check if clips already exist
    if (scene.clips && scene.clips.length > 0) {
      console.log(`Clips already exist for scene ${sceneId} (${scene.clips.length} clips)`);
      return res.json({ 
        message: 'Clips already exist',
        clipCount: scene.clips.length,
        clips: scene.clips
      });
    }
    
    // Generate clips (1 minute each) with optimized final clip handling
    const clipDuration = 60; // 1 minute in seconds
    const totalDuration = scene.duration;
    
    console.log(`🎬 Generating optimized clips for scene ${sceneId} (${totalDuration}s)`);
    const clipsToCreate = generateOptimizedClips(sceneId, totalDuration, clipDuration);
    
    if (clipsToCreate.length === 0) {
      return res.status(400).json({ 
        error: 'Scene too short for clip generation',
        suggestion: 'Scene must be longer than 60 seconds',
        sceneDuration: totalDuration
      });
    }
    
    // Create clips in database
    const createdClips = await prisma.stashClip.createMany({
      data: clipsToCreate
    });
    
    console.log(`✅ Generated ${createdClips.count} clips for scene ${sceneId}`);
    
    // Return the created clips
    const clips = await prisma.stashClip.findMany({
      where: { sceneId: sceneId },
      orderBy: { clipIndex: 'asc' }
    });
    
    res.json({
      message: 'Clips generated successfully',
      clipCount: clips.length,
      totalDuration: totalDuration,
      clipDuration: clipDuration,
      clips: clips
    });
    
  } catch (error) {
    console.error('Error generating clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all clips with pagination and filtering
app.get('/api/stash/clips', async (req, res) => {
  try {
    console.log('📋 Getting all clips with pagination...');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || parseInt(req.query.perPage) || 20;
    const search = req.query.search || '';
    const watchStatus = req.query.watched; // 'true', 'false', or undefined for all
    const sortBy = req.query.sortBy || 'createdAt';
    const sortDirection = req.query.sortDirection || 'desc';
    
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where = {};
    
    // Add search filter
    if (search) {
      where.scene = {
        title: {
          contains: search,
          mode: 'insensitive'
        }
      };
    }
    
    // Add watch status filter
    if (watchStatus !== undefined) {
      where.watched = watchStatus === 'true';
    }
    
    // Build sort object
    const validSortFields = ['createdAt', 'sceneTitle', 'duration', 'startTime', 'watchedAt', 'clipIndex'];
    const validatedSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    
    const orderBy = {};
    if (validatedSortBy === 'sceneTitle') {
      orderBy.scene = { title: sortDirection };
    } else {
      orderBy[validatedSortBy] = sortDirection;
    }
    
    // Get clips with pagination
    const clips = await prisma.stashClip.findMany({
      where,
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            duration: true,
            performers: {
              select: {
                performer: {
                  select: {
                    name: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limit
    });
    
    // Get total count
    const totalClips = await prisma.stashClip.count({ where });
    const totalPages = Math.ceil(totalClips / limit);
    
    console.log(`📋 Found ${clips.length} clips (page ${page}/${totalPages})`);
    
    res.json({
      clips,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: totalClips,
        itemsPerPage: limit,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error getting clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark clip as watched
app.post('/api/stash/clips/:id/watched', async (req, res) => {
  try {
    const clipId = parseInt(req.params.id);
    console.log(`✅ Marking clip ${clipId} as watched...`);
    
    const updatedClip = await prisma.stashClip.update({
      where: { id: clipId },
      data: { 
        watched: true,
        watchedAt: new Date()
      },
      include: {
        scene: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    
    console.log(`✅ Clip ${clipId} marked as watched`);
    
    res.json({
      message: 'Clip marked as watched',
      clip: updatedClip
    });
    
  } catch (error) {
    console.error('Error marking clip as watched:', error);
    res.status(500).json({ error: error.message });
  }
});

// Play a specific clip by ID
app.post('/api/stash/clips/:id/play', async (req, res) => {
  try {
    const clipId = parseInt(req.params.id);
    console.log(`▶️ Playing clip: ${clipId}`);

    // Get the clip with scene information
    const clip = await prisma.stashClip.findUnique({
      where: { id: clipId },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            url: true
          }
        }
      }
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip not found' });
    }

    console.log(`▶️ Found clip for scene: ${clip.scene.title}`);

    // Construct streaming URL
    const stashUrl = process.env.STASH_URL;
    let streamUrl = `${stashUrl}/scene/${clip.sceneId}/stream.m3u8`;
    
    console.log(`▶️ Stream URL: ${streamUrl}`);

    res.json({
      success: true,
      clip,
      streamUrl,
      message: `Playing clip ${clip.clipIndex + 1} from "${clip.scene.title}"`
    });

  } catch (error) {
    console.error('Error playing clip:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get clips for a specific scene
app.get('/api/stash/scenes/:id/clips', async (req, res) => {
  try {
    const sceneId = req.params.id;
    console.log(`📋 Getting clips for scene: ${sceneId}`);
    
    const clips = await prisma.stashClip.findMany({
      where: { sceneId: sceneId },
      orderBy: { clipIndex: 'asc' }
    });
    
    const watchedCount = clips.filter(clip => clip.watched).length;
    const unwatchedCount = clips.length - watchedCount;
    
    res.json({
      clips: clips,
      stats: {
        total: clips.length,
        watched: watchedCount,
        unwatched: unwatchedCount,
        watchedPercentage: clips.length > 0 ? Math.round((watchedCount / clips.length) * 100) : 0
      }
    });
    
  } catch (error) {
    console.error('Error getting scene clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset all clips watched status (for testing)
app.post('/api/stash/clips/reset', async (req, res) => {
  try {
    console.log('🔄 Resetting all clips watched status...');
    
    const result = await prisma.stashClip.updateMany({
      where: { watched: true },
      data: { 
        watched: false,
        watchedAt: null
      }
    });
    
    console.log(`✅ Reset ${result.count} clips to unwatched`);
    
    res.json({
      message: 'All clips reset to unwatched',
      resetCount: result.count
    });
    
  } catch (error) {
    console.error('Error resetting clips:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clip Play - Get random unwatched clip and start playback
app.post('/api/stash/clip-play', async (req, res) => {
  try {
    console.log('🎬 Starting Clip Play - selecting random scene and checking/generating clips...');
    
    // First, get all scenes from Stash database
    const allScenes = await prisma.stashScene.findMany({
      select: {
        id: true,
        title: true,
        path: true,
        duration: true
      },
      where: {
        duration: { gt: 60 } // Only scenes longer than 1 minute
      }
    });
    
    if (allScenes.length === 0) {
      return res.status(404).json({ 
        error: 'No scenes available for clip generation',
        suggestion: 'Sync with Stash to populate scene library'
      });
    }

    // ALWAYS start by selecting a random scene first
    const randomSceneIndex = Math.floor(Math.random() * allScenes.length);
    const selectedScene = allScenes[randomSceneIndex];
    
    console.log(`🎲 Selected random scene: ${selectedScene.title}`);
    
    let selectedClip;
    
    // Check if this scene has any clips
    const existingClips = await prisma.stashClip.findMany({
      where: { sceneId: selectedScene.id },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            path: true,
            duration: true
          }
        }
      }
    });
    
    if (existingClips.length > 0) {
      // Scene has clips - check if any are unwatched
      const unwatchedClips = existingClips.filter(clip => !clip.watched);
      
      if (unwatchedClips.length > 0) {
        // Select random unwatched clip from this scene
        const randomIndex = Math.floor(Math.random() * unwatchedClips.length);
        selectedClip = unwatchedClips[randomIndex];
        console.log(`� Found ${unwatchedClips.length} unwatched clips, selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedScene.title}`);
      } else {
        // All clips from this scene are watched - reset them and pick random one
        await prisma.stashClip.updateMany({
          where: { sceneId: selectedScene.id },
          data: { 
            watched: false,
            watchedAt: null
          }
        });
        
        // Select random clip from the reset clips
        const randomClipIndex = Math.floor(Math.random() * existingClips.length);
        selectedClip = existingClips[randomClipIndex];
        selectedClip.watched = false;
        console.log(`♻️ Reset ${existingClips.length} clips for scene: ${selectedScene.title}, selected clip ${selectedClip.clipIndex + 1}`);
      }
    } else {
      // Scene has no clips - generate them
      const clipDuration = 60; // 1 minute clips
      
      console.log(`🎬 Generating optimized clips for scene: ${selectedScene.title} (${selectedScene.duration}s)`);
      const clipsToCreate = generateOptimizedClips(selectedScene.id, selectedScene.duration, clipDuration);
      
      if (clipsToCreate.length === 0) {
        return res.status(400).json({ 
          error: 'Selected scene too short for clip generation',
          suggestion: 'Scene must be longer than 60 seconds'
        });
      }
      
      // Bulk create clips
      await prisma.stashClip.createMany({
        data: clipsToCreate
      });
      
      // Get a random generated clip
      const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
      selectedClip = await prisma.stashClip.findFirst({
        where: { 
          sceneId: selectedScene.id,
          clipIndex: randomClipIndex
        },
        include: {
          scene: {
            select: {
              id: true,
              title: true,
              path: true,
              duration: true
            }
          }
        }
      });
      
      console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
    }
    
    // Get connection status for stream URL
    const settings = await prisma.settings.findFirst();
    let stashUrl = process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                   process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3 || 
                   settings?.stashUrl;
    
    // Normalize URL - remove trailing slashes
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    if (!stashUrl) {
      return res.status(400).json({ error: 'Stash URL not configured in settings or environment' });
    }
    
    // Build stream URL (stashUrl is already normalized)
    const streamUrl = `${stashUrl}/scene/${selectedClip.scene.id}/stream`;
    
    // Build Android companion app message
    const androidMessage = {
      type: 'STASH_PLAYBACK',
      action: 'PLAY_CLIP',
      scene: {
        id: selectedClip.scene.id,
        title: selectedClip.scene.title,
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration,
        clipIndex: selectedClip.clipIndex + 1, // Human-readable index
        totalClips: Math.floor(selectedClip.scene.duration / 60),
        stashUrl: stashUrl
      },
      clip: {
        id: selectedClip.id,
        clipIndex: selectedClip.clipIndex,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`🎯 Selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedClip.scene.title}`);
    console.log(`📱 Emitting Android companion app message (Clip Play):`, JSON.stringify(androidMessage, null, 2));
    
    // Emit WebSocket message to Android companion app
    io.emit('androidCompanion', androidMessage);
    
    // Also attempt HTTP forward for legacy support
    try {
      const response = await fetch('http://localhost:8080/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'play_clip',
          scene: androidMessage.scene,
          clip: androidMessage.clip
        }),
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        console.log('HTTP clip play command sent successfully to Android app');
      }
    } catch (httpError) {
      console.log('Android HTTP app not available (using WebSocket only)');
    }
    
    // Mark clip as watched
    await prisma.stashClip.update({
      where: { id: selectedClip.id },
      data: { 
        watched: true,
        watchedAt: new Date()
      }
    });
    
    console.log(`✅ Clip ${selectedClip.id} marked as watched`);
    
    // Get current count of unwatched clips across all scenes
    const totalUnwatchedClips = await prisma.stashClip.count({
      where: { watched: false }
    });
    
    res.json({
      message: 'Clip play started successfully',
      clip: selectedClip,
      totalUnwatchedClips: totalUnwatchedClips,
      playbackInfo: {
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      }
    });
    
  } catch (error) {
    console.error('Error in clip play:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get next random clip for continuous playback
app.get('/api/stash/clips/next', async (req, res) => {
  try {
    console.log('🎬 Getting next random clip for continuous playback...');
    
    // Get all scenes from Stash database
    const allScenes = await prisma.stashScene.findMany({
      select: {
        id: true,
        title: true,
        path: true,
        duration: true
      },
      where: {
        duration: { gt: 60 } // Only scenes longer than 1 minute
      }
    });
    
    if (allScenes.length === 0) {
      return res.status(404).json({ 
        error: 'No scenes available for clip generation',
        suggestion: 'Sync with Stash to populate scene library'
      });
    }

    // ALWAYS start by selecting a random scene first (same logic as clip-play)
    const randomSceneIndex = Math.floor(Math.random() * allScenes.length);
    const selectedScene = allScenes[randomSceneIndex];
    
    console.log(`🎲 Selected random scene for next clip: ${selectedScene.title}`);
    
    let selectedClip;
    
    // Check if this scene has any clips
    const existingClips = await prisma.stashClip.findMany({
      where: { sceneId: selectedScene.id },
      include: {
        scene: {
          select: {
            id: true,
            title: true,
            path: true,
            duration: true
          }
        }
      }
    });
    
    if (existingClips.length > 0) {
      // Scene has clips - check if any are unwatched
      const unwatchedClips = existingClips.filter(clip => !clip.watched);
      
      if (unwatchedClips.length > 0) {
        // Select random unwatched clip from this scene
        const randomIndex = Math.floor(Math.random() * unwatchedClips.length);
        selectedClip = unwatchedClips[randomIndex];
        console.log(`🎯 Found ${unwatchedClips.length} unwatched clips, selected clip ${selectedClip.clipIndex + 1} from scene: ${selectedScene.title}`);
      } else {
        // All clips from this scene are watched - reset them and pick random one
        await prisma.stashClip.updateMany({
          where: { sceneId: selectedScene.id },
          data: { 
            watched: false,
            watchedAt: null
          }
        });
        
        // Select random clip from the reset clips
        const randomClipIndex = Math.floor(Math.random() * existingClips.length);
        selectedClip = existingClips[randomClipIndex];
        selectedClip.watched = false;
        console.log(`♻️ Reset ${existingClips.length} clips for scene: ${selectedScene.title}, selected clip ${selectedClip.clipIndex + 1}`);
      }
    } else {
      // Scene has no clips - generate them
      const clipDuration = 60; // 1 minute clips
      
      console.log(`🎬 Generating optimized clips for scene: ${selectedScene.title} (${selectedScene.duration}s)`);
      const clipsToCreate = generateOptimizedClips(selectedScene.id, selectedScene.duration, clipDuration);
      
      if (clipsToCreate.length === 0) {
        return res.status(400).json({ 
          error: 'Selected scene too short for clip generation',
          suggestion: 'Scene must be longer than 60 seconds'
        });
      }
      
      // Bulk create clips
      await prisma.stashClip.createMany({
        data: clipsToCreate
      });
      
      // Get a random generated clip
      const randomClipIndex = Math.floor(Math.random() * clipsToCreate.length);
      selectedClip = await prisma.stashClip.findFirst({
        where: { 
          sceneId: selectedScene.id,
          clipIndex: randomClipIndex
        },
        include: {
          scene: {
            select: {
              id: true,
              title: true,
              path: true,
              duration: true
            }
          }
        }
      });
      
      console.log(`✅ Generated ${clipsToCreate.length} optimized clips for scene: ${selectedScene.title}, selected clip ${randomClipIndex + 1}`);
    }
    
    // Get connection status for stream URL
    const settings = await prisma.settings.findFirst();
    let stashUrl = process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                   process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3 || 
                   settings?.stashUrl;
    
    // Normalize URL - remove trailing slashes
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    if (!stashUrl) {
      return res.status(400).json({ error: 'Stash URL not configured in settings or environment' });
    }
    
    // Build stream URL (stashUrl is already normalized)  
    const streamUrl = `${stashUrl}/scene/${selectedClip.scene.id}/stream`;
    
    // Mark clip as watched immediately
    await prisma.stashClip.update({
      where: { id: selectedClip.id },
      data: { 
        watched: true,
        watchedAt: new Date()
      }
    });
    
    console.log(`✅ Next clip ${selectedClip.id} marked as watched`);
    
    // Get current count of unwatched clips across all scenes
    const totalUnwatchedClips = await prisma.stashClip.count({
      where: { watched: false }
    });
    
    res.json({
      message: 'Next clip selected successfully',
      clip: selectedClip,
      totalUnwatchedClips: totalUnwatchedClips,
      playbackInfo: {
        streamUrl: streamUrl,
        startTime: selectedClip.startTime,
        endTime: selectedClip.endTime,
        duration: selectedClip.duration
      }
    });
    
  } catch (error) {
    console.error('Error getting next clip:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to see clip statistics
app.get('/api/stash/clips/debug', async (req, res) => {
  try {
    const totalClips = await prisma.stashClip.count();
    const watchedClips = await prisma.stashClip.count({ where: { watched: true } });
    const unwatchedClips = await prisma.stashClip.count({ where: { watched: false } });
    
    const clipsByScene = await prisma.stashClip.groupBy({
      by: ['sceneId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    const sceneDetails = await Promise.all(
      clipsByScene.slice(0, 10).map(async (group) => {
        const scene = await prisma.stashScene.findUnique({
          where: { id: group.sceneId },
          select: { id: true, title: true, duration: true }
        });
        const sceneWatched = await prisma.stashClip.count({
          where: { sceneId: group.sceneId, watched: true }
        });
        const sceneUnwatched = await prisma.stashClip.count({
          where: { sceneId: group.sceneId, watched: false }
        });
        return {
          scene,
          totalClips: group._count.id,
          watchedClips: sceneWatched,
          unwatchedClips: sceneUnwatched
        };
      })
    );
    
    res.json({
      totalClips,
      watchedClips,
      unwatchedClips,
      topScenesWithClips: sceneDetails
    });
  } catch (error) {
    console.error('Error getting clip debug info:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Stash database statistics
app.get('/api/stash/stats', async (req, res) => {
  try {
    console.log('📊 Fetching Stash database statistics...');
    
    // Get counts from each table
    const [scenesCount, performersCount, studiosCount] = await Promise.all([
      prisma.stashScene.count(),
      prisma.stashPerformer.count(),
      prisma.stashStudio.count()
    ]);

    // Get top 10 performers by scene count
    const topPerformers = await prisma.stashPerformer.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: {
            scenes: true
          }
        }
      },
      orderBy: {
        scenes: {
          _count: 'desc'
        }
      },
      take: 10
    });

    // Get top 10 studios by scene count
    const topStudios = await prisma.stashStudio.findMany({
      where: {
        name: {
          not: 'Only Fans'
        }
      },
      select: {
        id: true,
        name: true,
        image: true,
        _count: {
          select: {
            scenes: true
          }
        }
      },
      orderBy: {
        scenes: {
          _count: 'desc'
        }
      },
      take: 10
    });

    const stats = {
      scenes: scenesCount,
      performers: performersCount,
      studios: studiosCount,
      topPerformers: topPerformers.map(p => ({
        id: p.id,
        name: p.name,
        image: p.image,
        sceneCount: p._count.scenes
      })),
      topStudios: topStudios.map(s => ({
        id: s.id,
        name: s.name,
        image: s.image,
        sceneCount: s._count.scenes
      })),
      lastUpdated: new Date().toISOString()
    };

    console.log('📊 Stats retrieved:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching Stash stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash statistics',
      message: error.message 
    });
  }
});

// Debug endpoint to test Stash service initialization
app.get('/api/debug/stash-service', async (req, res) => {
  try {
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    console.log('🔍 Debug: Manual Stash service test');
    console.log('   - Settings:', JSON.stringify(settings, null, 2));
    
    // Prioritize environment variables for debug response
    const finalStashUrl = (process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                          process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3 || 
                          settings?.stashUrl)?.replace(/\/+$/, '');
    
    const result = {
      settingsLoaded: !!settings,
      databaseStashUrl: settings?.stashUrl || null,
      environmentStashUrl: process.env.STASH_URL || null,
      finalStashUrl: finalStashUrl || null,
      stashApiKey: !!settings?.stashApiKey,
      globalServiceExists: !!stashService,
      globalServiceConfigured: stashService ? stashService.isConfigured() : false
    };
    
    console.log('   - Debug result:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stash performers endpoint
app.get('/api/stash/performers', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { name: { contains: filter, mode: 'insensitive' } },
        { alias: { contains: filter, mode: 'insensitive' } },
        { disambiguation: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get total count
    const total = await prisma.stashPerformer.count({
      where: searchFilter
    });
    
    // Get performers with related data
    const performers = await prisma.stashPerformer.findMany({
      where: searchFilter,
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        scenes: {
          include: {
            scene: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedPerformers = performers.map(performer => ({
      id: performer.id,
      name: performer.name,
      disambiguation: performer.disambiguation,
      alias: performer.alias,
      favorite: performer.favorite,
      ignore_auto_tag: performer.ignore_auto_tag,
      birthdate: performer.birthdate,
      ethnicity: performer.ethnicity,
      country: performer.country,
      eye_color: performer.eye_color,
      height: performer.height,
      measurements: performer.measurements,
      fake_tits: performer.fake_tits,
      career_length: performer.career_length,
      tattoos: performer.tattoos,
      piercings: performer.piercings,
      image: performer.image,
      instagram: performer.instagram,
      twitter: performer.twitter,
      url: performer.url,
      tags: performer.tags.map(pt => ({
        id: pt.tag.id,
        name: pt.tag.name
      })),
      scene_count: performer.scenes.length
    }));
    
    res.json({
      success: true,
      data: transformedPerformers,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash performers from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash performers',
      message: error.message 
    });
  }
});

// Stash studios endpoint
app.get('/api/stash/studios', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      name: { contains: filter, mode: 'insensitive' }
    } : {};
    
    // Get total count
    const total = await prisma.stashStudio.count({
      where: searchFilter
    });
    
    // Get studios with scene counts using the relationship
    const studios = await prisma.stashStudio.findMany({
      where: searchFilter,
      include: {
        scenes: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedStudios = studios.map(studio => ({
      id: studio.id,
      name: studio.name,
      url: studio.url,
      image: studio.image,
      scene_count: studio.scenes.length
    }));
    
    res.json({
      success: true,
      data: transformedStudios,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash studios from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash studios',
      message: error.message 
    });
  }
});

// Stash tags endpoint
app.get('/api/stash/tags', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { name: { contains: filter, mode: 'insensitive' } },
        { description: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Get total count
    const total = await prisma.stashTag.count({
      where: searchFilter
    });
    
    // Get tags with usage counts
    const tags = await prisma.stashTag.findMany({
      where: searchFilter,
      include: {
        scenes: {
          select: {
            sceneId: true
          }
        },
        performers: {
          select: {
            performerId: true
          }
        }
      },
      orderBy: { name: 'asc' },
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedTags = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      description: tag.description,
      image: tag.image,
      scene_count: tag.scenes.length,
      performer_count: tag.performers.length
    }));
    
    res.json({
      success: true,
      data: transformedTags,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash tags from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash tags',
      message: error.message 
    });
  }
});

app.get('/api/stash/galleries', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '', sortBy = 'title', sortDirection = 'asc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter
    const searchFilter = filter ? {
      OR: [
        { title: { contains: filter, mode: 'insensitive' } },
        { details: { contains: filter, mode: 'insensitive' } },
        { photographer: { contains: filter, mode: 'insensitive' } },
        { studio: { contains: filter, mode: 'insensitive' } }
      ]
    } : {};
    
    // Build sort order
    const orderBy = {};
    orderBy[sortBy] = sortDirection.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.stashGallery.count({
      where: searchFilter
    });
    
    // Get galleries with related data
    const galleries = await prisma.stashGallery.findMany({
      where: searchFilter,
      include: {
        images: {
          select: {
            id: true,
            path: true
          }
        },
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
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
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      orderBy: orderBy,
      skip: skip,
      take: take
    });
    
    // Transform data to match expected format
    const transformedGalleries = galleries.map(gallery => ({
      id: gallery.id,
      title: gallery.title,
      code: gallery.code,
      date: gallery.date,
      details: gallery.details,
      photographer: gallery.photographer,
      url: gallery.url,
      rating: gallery.rating,
      organized: gallery.organized,
      studio: gallery.studio,
      studioId: gallery.studioId,
      path: gallery.path,
      checksum: gallery.checksum,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      imageCount: gallery.images.length,
      images: gallery.images,
      performers: gallery.performers.map(p => p.performer),
      tags: gallery.tags.map(t => t.tag),
      studioObject: gallery.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedGalleries,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash galleries from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash galleries',
      message: error.message 
    });
  }
});

app.get('/api/stash/galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const gallery = await prisma.stashGallery.findUnique({
      where: { id: id },
      include: {
        images: {
          select: {
            id: true,
            title: true,
            path: true,
            checksum: true
          }
        },
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
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
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    });
    
    if (!gallery) {
      return res.status(404).json({ 
        success: false,
        error: 'Gallery not found' 
      });
    }
    
    // Transform data
    const transformedGallery = {
      id: gallery.id,
      title: gallery.title,
      code: gallery.code,
      date: gallery.date,
      details: gallery.details,
      photographer: gallery.photographer,
      url: gallery.url,
      rating: gallery.rating,
      organized: gallery.organized,
      studio: gallery.studio,
      studioId: gallery.studioId,
      path: gallery.path,
      checksum: gallery.checksum,
      createdAt: gallery.createdAt,
      updatedAt: gallery.updatedAt,
      images: gallery.images,
      performers: gallery.performers.map(p => p.performer),
      tags: gallery.tags.map(t => t.tag),
      studioObject: gallery.studioObject
    };
    
    res.json({
      success: true,
      data: transformedGallery
    });
  } catch (error) {
    console.error('Error fetching Stash gallery from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash gallery',
      message: error.message 
    });
  }
});

app.get('/api/stash/images/random', async (req, res) => {
  try {
    // Get a random image from all galleries
    const totalImages = await prisma.stashImage.count();
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get a random offset
    const randomOffset = Math.floor(Math.random() * totalImages);
    
    const randomImage = await prisma.stashImage.findMany({
      skip: randomOffset,
      take: 1,
      include: {
        gallery: {
          select: {
            id: true,
            title: true,
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (randomImage.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No random image found' 
      });
    }
    
    const image = randomImage[0];
    
    res.json({
      success: true,
      data: {
        id: image.id,
        title: image.title,
        path: image.path,
        checksum: image.checksum,
        gallery: {
          id: image.gallery.id,
          title: image.gallery.title,
          performers: image.gallery.performers.map(p => p.performer)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching random image from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random image',
      message: error.message 
    });
  }
});

// Stash random images endpoint for slideshow
app.get('/api/stash/images/slideshow', async (req, res) => {
  try {
    const { count = 10, includeGalleries = true, includeStandalone = true } = req.query;
    const requestedCount = Math.max(1, Math.min(parseInt(count), 100)); // Limit between 1 and 100
    
    // Build conditions based on what to include
    const conditions = [];
    
    if (includeGalleries === 'true' || includeGalleries === true) {
      // Include images from galleries
      conditions.push({ galleryId: { not: null } });
    }
    
    if (includeStandalone === 'true' || includeStandalone === true) {
      // Include standalone images
      conditions.push({ galleryId: null });
    }
    
    if (conditions.length === 0) {
      return res.status(400).json({ 
        error: 'Must include at least galleries or standalone images' 
      });
    }
    
    // Get total count of matching images
    const totalImages = await prisma.stashImage.count({
      where: {
        OR: conditions
      }
    });
    
    if (totalImages === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'No images found' 
      });
    }
    
    // Get random images
    const images = [];
    const usedOffsets = new Set();
    
    // Try to get the requested number of unique random images
    let attempts = 0;
    const maxAttempts = Math.min(requestedCount * 3, 200); // Avoid infinite loops
    
    while (images.length < requestedCount && attempts < maxAttempts) {
      const randomOffset = Math.floor(Math.random() * totalImages);
      
      if (!usedOffsets.has(randomOffset)) {
        usedOffsets.add(randomOffset);
        
        const randomImages = await prisma.stashImage.findMany({
          where: {
            OR: conditions
          },
          skip: randomOffset,
          take: 1,
          include: {
            gallery: {
              select: {
                id: true,
                title: true,
                performers: {
                  include: {
                    performer: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
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
            },
            studioObject: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
        
        if (randomImages.length > 0) {
          images.push(randomImages[0]);
        }
      }
      
      attempts++;
    }
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      path: image.path,
      checksum: image.checksum,
      photographer: image.photographer,
      studio: image.studio,
      rating: image.rating,
      date: image.date,
      details: image.details,
      gallery: image.gallery ? {
        id: image.gallery.id,
        title: image.gallery.title,
        performers: image.gallery.performers.map(p => p.performer)
      } : null,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      meta: {
        requested: requestedCount,
        returned: images.length,
        totalAvailable: totalImages
      }
    });
  } catch (error) {
    console.error('Error fetching random images for slideshow:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random images for slideshow',
      message: error.message 
    });
  }
});

// Stash standalone images endpoint
app.get('/api/stash/images', async (req, res) => {
  try {
    const { page = 1, perPage = 20, filter = '', sortBy = 'title', sortDirection = 'asc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(perPage);
    const take = parseInt(perPage);
    
    // Build search filter for standalone images (not part of any gallery)
    const searchFilter = {
      galleryId: null, // Only standalone images
      ...(filter ? {
        OR: [
          { title: { contains: filter, mode: 'insensitive' } },
          { code: { contains: filter, mode: 'insensitive' } },
          { details: { contains: filter, mode: 'insensitive' } },
          { photographer: { contains: filter, mode: 'insensitive' } },
          { studio: { contains: filter, mode: 'insensitive' } }
        ]
      } : {})
    };
    
    // Build sort order
    const orderBy = {};
    orderBy[sortBy] = sortDirection.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    // Get total count
    const total = await prisma.stashImage.count({
      where: searchFilter
    });
    
    // Get standalone images with related data
    const images = await prisma.stashImage.findMany({
      where: searchFilter,
      include: {
        performers: {
          include: {
            performer: {
              select: {
                id: true,
                name: true,
                image: true
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
        },
        studioObject: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      },
      skip: skip,
      take: take,
      orderBy: orderBy
    });
    
    // Transform the data
    const transformedImages = images.map(image => ({
      id: image.id,
      title: image.title,
      code: image.code,
      date: image.date,
      details: image.details,
      photographer: image.photographer,
      url: image.url,
      rating: image.rating,
      organized: image.organized,
      studio: image.studio,
      path: image.path,
      checksum: image.checksum,
      fileModTime: image.fileModTime,
      performers: image.performers.map(p => p.performer),
      tags: image.tags.map(t => t.tag),
      studioObject: image.studioObject
    }));
    
    res.json({
      success: true,
      data: transformedImages,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        total: total,
        totalPages: Math.ceil(total / parseInt(perPage))
      }
    });
  } catch (error) {
    console.error('Error fetching Stash standalone images from database:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stash standalone images',
      message: error.message 
    });
  }
});

// Stash search endpoint
app.get('/api/stash/search', async (req, res) => {
  try {
    const { query, types = 'scene' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const searchTypes = types.split(',').map(t => t.trim());
    const results = {};
    
    // Search scenes
    if (searchTypes.includes('scene')) {
      const scenes = await prisma.stashScene.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { details: { contains: query, mode: 'insensitive' } },
            { studio: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
            { director: { contains: query, mode: 'insensitive' } },
            { synopsis: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
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
          },
          studioObject: true
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
      
      results.scenes = scenes.map(scene => ({
        id: scene.id,
        title: scene.title,
        details: scene.details,
        url: scene.url,
        date: scene.date,
        rating: scene.rating,
        duration: scene.duration,
        studio: scene.studioObject ? { 
          id: scene.studioObject.id, 
          name: scene.studioObject.name,
          url: scene.studioObject.url,
          image: scene.studioObject.image
        } : scene.studio ? { name: scene.studio } : null,
        performers: scene.performers.map(sp => sp.performer),
        tags: scene.tags.map(st => st.tag)
      }));
    }
    
    // Search performers
    if (searchTypes.includes('performer')) {
      const performers = await prisma.stashPerformer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { alias: { contains: query, mode: 'insensitive' } },
            { disambiguation: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          scenes: {
            select: {
              sceneId: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.performers = performers.map(performer => ({
        id: performer.id,
        name: performer.name,
        disambiguation: performer.disambiguation,
        alias: performer.alias,
        favorite: performer.favorite,
        birthdate: performer.birthdate,
        image: performer.image,
        scene_count: performer.scenes.length
      }));
    }
    
    // Search studios
    if (searchTypes.includes('studio')) {
      const studios = await prisma.stashStudio.findMany({
        where: {
          name: { contains: query, mode: 'insensitive' }
        },
        include: {
          scenes: {
            select: {
              id: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.studios = studios.map(studio => ({
        id: studio.id,
        name: studio.name,
        url: studio.url,
        image: studio.image,
        scene_count: studio.scenes.length
      }));
    }
    
    // Search tags
    if (searchTypes.includes('tag')) {
      const tags = await prisma.stashTag.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          scenes: {
            select: {
              sceneId: true
            }
          }
        },
        take: 20,
        orderBy: { name: 'asc' }
      });
      
      results.tags = tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        image: tag.image,
        scene_count: tag.scenes.length
      }));
    }
    
    res.json({
      success: true,
      query: query,
      results: results
    });
  } catch (error) {
    console.error('Error searching Stash database:', error);
    res.status(500).json({ 
      error: 'Failed to search Stash',
      message: error.message 
    });
  }
});

// Stash sync endpoints
app.post('/api/stash/sync', async (req, res) => {
  try {
    if (!stashSyncService || !stashSyncServiceOptimized) {
      await initializeStashSyncService();
    }
    
    const activeSyncService = getActiveSyncService();
    if (!activeSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured',
        message: 'Please configure Stash URL in settings'
      });
    }
    
    // Check if background sync is in progress
    if (stashBackgroundSync && stashBackgroundSync.syncInProgress) {
      return res.status(409).json({
        error: 'Sync already in progress',
        message: 'Background Stash sync is currently running. Please wait for it to complete.'
      });
    }
    
    console.log(`Starting manual Stash full sync (${SYNC_SERVICE_TYPE})...`);
    const startTime = Date.now();
    
    // Use optimized sync if available, fallback to legacy
    const results = SYNC_SERVICE_TYPE === 'optimized' && activeSyncService.fullSyncOptimized
      ? await activeSyncService.fullSyncOptimized()
      : await activeSyncService.fullSync();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Manual Stash sync (${SYNC_SERVICE_TYPE}) completed in ${duration}s`);
    
    res.json({
      success: true,
      message: `Stash sync (${SYNC_SERVICE_TYPE}) completed successfully in ${duration}s`,
      syncType: SYNC_SERVICE_TYPE,
      duration: duration,
      results: results,
      performanceImprovement: results?.performanceImprovement || null
    });
  } catch (error) {
    console.error(`Error during manual Stash sync (${SYNC_SERVICE_TYPE}):`, error);
    res.status(500).json({ 
      error: 'Stash sync failed',
      message: error.message,
      syncType: SYNC_SERVICE_TYPE,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Sync configuration and performance endpoint
app.get('/api/stash/sync/config', async (req, res) => {
  try {
    res.json({
      success: true,
      syncType: SYNC_SERVICE_TYPE,
      availableTypes: ['legacy', 'optimized'],
      services: {
        legacy: !!stashSyncService,
        optimized: !!stashSyncServiceOptimized
      },
      configuration: {
        optimizedPageSize: stashSyncServiceOptimized?.pageSize || 500,
        legacyPageSize: 250,
        memoryCache: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled',
        parallelSync: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled',
        batchTransactions: SYNC_SERVICE_TYPE === 'optimized' ? 'enabled' : 'disabled'
      }
    });
  } catch (error) {
    console.error('Error getting sync configuration:', error);
    res.status(500).json({
      error: 'Failed to get sync configuration',
      message: error.message
    });
  }
});

// Performance testing endpoint  
app.post('/api/stash/sync/benchmark', async (req, res) => {
  try {
    if (!stashSyncService || !stashSyncServiceOptimized) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService || !stashSyncServiceOptimized) {
      return res.status(400).json({ 
        error: 'Stash sync services not configured',
        message: 'Please configure Stash URL in settings'
      });
    }
    
    const { testType = 'tags', pageCount = 2 } = req.body;
    
    console.log(`Starting sync performance benchmark (${testType}, ${pageCount} pages)...`);
    
    // Test legacy sync
    console.log('🐌 Testing legacy sync performance...');
    const legacyStart = Date.now();
    let legacyCount = 0;
    
    for (let page = 1; page <= pageCount; page++) {
      let result;
      switch (testType) {
        case 'tags':
          result = await stashSyncService.syncTags(page, 100); // Smaller page size for testing
          legacyCount += result.tags.length;
          break;
        case 'studios':
          result = await stashSyncService.syncStudios(page, 100);
          legacyCount += result.studios.length;
          break;
        case 'performers':
          result = await stashSyncService.syncPerformers(page, 100);
          legacyCount += result.performers.length;
          break;
        default:
          throw new Error(`Unsupported test type: ${testType}`);
      }
    }
    
    const legacyTime = Date.now() - legacyStart;
    
    // Test optimized sync
    console.log('🚀 Testing optimized sync performance...');
    const optimizedStart = Date.now();
    let optimizedCount = 0;
    
    for (let page = 1; page <= pageCount; page++) {
      let result;
      switch (testType) {
        case 'tags':
          result = await stashSyncServiceOptimized.syncTagsOptimized(page);
          optimizedCount += result.tags.length;
          break;
        case 'studios':
          result = await stashSyncServiceOptimized.syncStudiosOptimized(page);
          optimizedCount += result.studios.length;
          break;
        case 'performers':
          result = await stashSyncServiceOptimized.syncPerformersOptimized(page);
          optimizedCount += result.performers.length;
          break;
        default:
          throw new Error(`Unsupported test type: ${testType}`);
      }
    }
    
    const optimizedTime = Date.now() - optimizedStart;
    
    // Calculate performance improvement
    const speedup = (legacyTime / optimizedTime).toFixed(2);
    const timeSaved = legacyTime - optimizedTime;
    const timeSavedPercent = ((timeSaved / legacyTime) * 100).toFixed(1);
    
    console.log(`✅ Benchmark completed - ${speedup}x speedup achieved`);
    
    res.json({
      success: true,
      benchmark: {
        testType,
        pageCount,
        legacy: {
          timeMs: legacyTime,
          count: legacyCount,
          itemsPerSecond: (legacyCount / (legacyTime / 1000)).toFixed(2)
        },
        optimized: {
          timeMs: optimizedTime,
          count: optimizedCount,
          itemsPerSecond: (optimizedCount / (optimizedTime / 1000)).toFixed(2)
        },
        improvement: {
          speedupMultiplier: parseFloat(speedup),
          timeSavedMs: timeSaved,
          timeSavedPercent: parseFloat(timeSavedPercent),
          summary: `${speedup}x faster (${timeSavedPercent}% time saved)`
        }
      }
    });
    
  } catch (error) {
    console.error('Error during sync benchmark:', error);
    res.status(500).json({
      error: 'Benchmark failed',
      message: error.message
    });
  }
});

app.post('/api/stash/sync/scenes', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash scenes sync (page ${page})...`);
    
    const results = await stashSyncService.syncScenes(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.scenes.length} scenes from page ${page}`,
      results: {
        synced: results.scenes.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash scenes:', error);
    res.status(500).json({ 
      error: 'Stash scenes sync failed',
      message: error.message 
    });
  }
});

app.post('/api/stash/sync/performers', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash performers sync (page ${page})...`);
    
    const results = await stashSyncService.syncPerformers(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.performers.length} performers from page ${page}`,
      results: {
        synced: results.performers.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash performers:', error);
    res.status(500).json({ 
      error: 'Stash performers sync failed',
      message: error.message 
    });
  }
});

app.post('/api/stash/sync/studios', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash studios sync (page ${page})...`);
    
    const results = await stashSyncService.syncStudios(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.studios.length} studios from page ${page}`,
      results: {
        synced: results.studios.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash studios:', error);
    res.status(500).json({ 
      error: 'Stash studios sync failed',
      message: error.message 
    });
  }
});

app.post('/api/stash/sync/tags', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash tags sync (page ${page})...`);
    
    const results = await stashSyncService.syncTags(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.tags.length} tags from page ${page}`,
      results: {
        synced: results.tags.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash tags:', error);
    res.status(500).json({ 
      error: 'Stash tags sync failed',
      message: error.message 
    });
  }
});

app.post('/api/stash/sync/galleries', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash galleries sync (page ${page})...`);
    
    const results = await stashSyncService.syncGalleries(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.galleries.length} galleries from page ${page}`,
      results: {
        synced: results.galleries.length,
        hasMore: results.hasMore,
        totalCount: results.totalCount
      }
    });
  } catch (error) {
    console.error('Error syncing Stash galleries:', error);
    res.status(500).json({ 
      error: 'Stash galleries sync failed',
      message: error.message 
    });
  }
});

app.post('/api/stash/sync/images', async (req, res) => {
  try {
    if (!stashSyncService) {
      await initializeStashSyncService();
    }
    
    if (!stashSyncService) {
      return res.status(400).json({ 
        error: 'Stash sync service not configured'
      });
    }
    
    const { page = 1, perPage = 100 } = req.body;
    console.log(`Starting Stash standalone images sync (page ${page})...`);
    
    const results = await stashSyncService.syncAllImages(parseInt(page), parseInt(perPage));
    
    res.json({
      success: true,
      message: `Synced ${results.images.length} standalone images from page ${page}`,
      results: {
        synced: results.images.length,
        hasMore: results.hasMore,
        total: results.total,
        page: results.page
      }
    });
  } catch (error) {
    console.error('Error syncing Stash standalone images:', error);
    res.status(500).json({ 
      error: 'Stash standalone images sync failed',
      message: error.message 
    });
  }
});

// Get Stash sync status
app.get('/api/stash/sync/status', async (req, res) => {
  try {
    const backgroundSyncStatus = stashBackgroundSync ? stashBackgroundSync.getSyncStatus() : null;
    
    res.json({
      backgroundSync: backgroundSyncStatus,
      serviceInitialized: !!stashSyncService,
      configuration: {
        stashUrlConfigured: !!(await prisma.settings.findFirst())?.stashUrl,
        stashApiKeyConfigured: !!(await prisma.settings.findFirst())?.stashApiKey
      }
    });
  } catch (error) {
    console.error('Error getting Stash sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

// ComicVine search endpoint
app.get('/api/comicvine/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const comicVineService = require('./comicVineService');
    const results = await comicVineService.searchSeries(query);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching ComicVine:', error);
    res.status(500).json({ error: 'Failed to search ComicVine' });
  }
});

// ComicVine search with issue filtering and cover art
app.get('/api/comicvine/search-with-issues', async (req, res) => {
  try {
    const { query, issueNumber, issueTitle } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    if (!issueNumber) {
      return res.status(400).json({ error: 'Missing issue number' });
    }

    const comicVineService = require('./comicVineService');
    
    // First get all series matching the search
    const allSeries = await comicVineService.searchSeries(query);
    
    // Filter series that actually have the requested issue number
    const filteredSeries = [];
    
    for (const series of allSeries) {
      try {
        // Check if this series has the requested issue
        const issue = await comicVineService.getIssueByNumber(series.id, issueNumber);
        if (issue) {
          // Add cover art URL from the issue
          const coverUrl = issue.image?.original_url || issue.image?.screen_url || issue.image?.small_url;
          
          // Create comprehensive ComicVine data object
          const comprehensiveData = {
            // Series information
            series: {
              id: series.id,
              name: series.name,
              aliases: series.aliases,
              api_detail_url: series.api_detail_url,
              count_of_issues: series.count_of_issues,
              description: series.description,
              first_issue: series.first_issue,
              last_issue: series.last_issue,
              publisher: series.publisher,
              start_year: series.start_year,
              site_detail_url: series.site_detail_url,
              image: series.image,
              deck: series.deck
            },
            // Issue information  
            issue: {
              id: issue.id,
              name: issue.name,
              aliases: issue.aliases,
              api_detail_url: issue.api_detail_url,
              cover_date: issue.cover_date,
              date_added: issue.date_added,
              date_last_updated: issue.date_last_updated,
              deck: issue.deck,
              description: issue.description,
              has_staff_review: issue.has_staff_review,
              image: issue.image,
              issue_number: issue.issue_number,
              site_detail_url: issue.site_detail_url,
              store_date: issue.store_date,
              // Character and creator data if available
              character_credits: issue.character_credits,
              character_died_in: issue.character_died_in,
              concept_credits: issue.concept_credits,
              location_credits: issue.location_credits,
              object_credits: issue.object_credits,
              person_credits: issue.person_credits,
              story_arc_credits: issue.story_arc_credits,
              team_credits: issue.team_credits
            },
            // Enhanced metadata
            enhanced: {
              searchQuery: query,
              searchTimestamp: new Date().toISOString(),
              confidence: series.similarity || 1.0,
              isFuzzyMatch: series.isFuzzyMatch || false
            }
          };
          
          filteredSeries.push({
            ...series,
            hasIssue: true,
            coverUrl: coverUrl,
            issueId: issue.id,
            issueName: issue.name,
            issue_number: issueNumber,
            // Store comprehensive data for the frontend to use
            comprehensiveData: comprehensiveData,
            // Keep the original flat structure for backward compatibility
            issue_description: issue.description,
            issue_cover_date: issue.cover_date,
            issue_store_date: issue.store_date,
            character_credits: issue.character_credits,
            person_credits: issue.person_credits,
            story_arc_credits: issue.story_arc_credits
          });
        }
      } catch (error) {
        console.warn(`Error checking issue ${issueNumber} for series ${series.name}:`, error.message);
        // Continue checking other series
      }
    }    // Helper function to calculate word matching score with exact match priority
    const calculateWordMatchingScore = (seriesName, searchQuery) => {
      if (!seriesName || !searchQuery) return 0;
      
      const originalSearchLower = searchQuery.toLowerCase().trim();
      const originalSeriesLower = seriesName.toLowerCase().trim();
      
      // Exact match without any normalization (highest priority)
      if (originalSearchLower === originalSeriesLower) {
        return 1.0;
      }
      
      // Normalize titles by removing common variations
      const normalize = (title) => {
        return title.toLowerCase()
          .replace(/\s*\((\d{4})\)\s*/g, ' ') // Remove years like (2005)
          .replace(/\s*\(uk\)\s*/gi, ' ') // Remove (UK)
          .replace(/\s*\(us\)\s*/gi, ' ') // Remove (US)
          .replace(/\s*\(american\)\s*/gi, ' ') // Remove (American)
          .replace(/\s*\(british\)\s*/gi, ' ') // Remove (British)
          .replace(/\s*\(original\)\s*/gi, ' ') // Remove (Original)
          .replace(/\s*\(reboot\)\s*/gi, ' ') // Remove (Reboot)
          .replace(/\s*\(remake\)\s*/gi, ' ') // Remove (Remake)
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
      };
      
      const normalizedSearch = normalize(searchQuery);
      const normalizedSeries = normalize(seriesName);
      
      // Exact match after normalization (second highest priority)
      if (normalizedSearch === normalizedSeries) {
        // Give a slight penalty based on how much normalization was needed
        const originalLength = originalSeriesLower.length;
        const normalizedLength = normalizedSeries.length;
        const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
        return 0.95 - normalizationPenalty; // Score between 0.85-0.95
      }
      
      // Word matching logic (lower priority than exact matches)
      // Clean and split search query into words (ignore common words)
      const searchWords = normalizedSearch
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .split(/\s+/)
        .filter(word => word.length > 2 && !['the', 'and', 'vol', 'volume'].includes(word));
      
      // Clean series name
      const seriesNameNormalized = normalizedSeries
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Count how many search words appear in the series name
      const matchingWords = searchWords.filter(word => 
        seriesNameNormalized.includes(word)
      );
      
      // Calculate score: (matching words / total search words) with bonus for more matches
      const matchRatio = matchingWords.length / Math.max(searchWords.length, 1);
      const bonusForMoreMatches = matchingWords.length * 0.05; // Small bonus for absolute number of matches
      
      // Scale word matching score to be lower than exact matches (0.1-0.8)
      return 0.1 + (matchRatio * 0.6) + bonusForMoreMatches;
    };

    // Sort results with multiple criteria for better accuracy
    if (filteredSeries.length > 1) {
      console.log(`Sorting ${filteredSeries.length} results with multiple criteria...`);
      
      // Sort with comprehensive ranking:
      // 1. Word matching score (prioritize series with most words from input)
      // 2. DC Comics publisher gets high priority (main US publisher for most series)
      // 3. Earlier publication years get priority (original series vs international reprints)
      // 4. Title matches (if issueTitle provided)
      // 5. Higher issue count (main series typically have more issues)
      filteredSeries.sort((a, b) => {
        // 1. Word matching score - highest priority
        const aWordScore = calculateWordMatchingScore(a.name, query);
        const bWordScore = calculateWordMatchingScore(b.name, query);
        
        console.log(`  Word matching: "${a.name}" = ${aWordScore.toFixed(3)}, "${b.name}" = ${bWordScore.toFixed(3)}`);
        
        if (Math.abs(aWordScore - bWordScore) > 0.1) { // Only prioritize if significant difference
          return bWordScore - aWordScore; // Higher word score wins
        }
        
        // 2. Publisher priority - DC Comics first, then Marvel, then others
        const getPublisherPriority = (series) => {
          const publisher = (series.publisher?.name || '').toLowerCase();
          if (publisher.includes('dc comics') || publisher === 'dc') return 100;
          if (publisher.includes('marvel')) return 90;
          if (publisher.includes('image')) return 80;
          if (publisher.includes('dark horse')) return 70;
          return 0; // International/reprint publishers get lowest priority
        };
        
        const aPublisherPriority = getPublisherPriority(a);
        const bPublisherPriority = getPublisherPriority(b);
        
        if (aPublisherPriority !== bPublisherPriority) {
          return bPublisherPriority - aPublisherPriority;
        }
        
        // 2. Earlier publication year gets priority (original vs reprints)
        const aYear = parseInt(a.start_year) || 9999;
        const bYear = parseInt(b.start_year) || 9999;
        
        if (Math.abs(aYear - bYear) > 5) { // Only consider if significant difference
          return aYear - bYear;
        }
          // 3. Title matching (if issueTitle provided)
        if (issueTitle) {
          // Normalize titles for comparison - remove punctuation and extra spaces
          const normalizeTitle = (title) => {
            return title.toLowerCase()
              .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
              .replace(/\s+/g, ' ')     // Collapse multiple spaces
              .trim();
          };
          
          const aTitle = normalizeTitle(a.issueName || '');
          const bTitle = normalizeTitle(b.issueName || '');
          const targetTitle = normalizeTitle(issueTitle);
          
          console.log(`  Title comparison for "${a.publisher?.name || 'Unknown'}" ${a.name}:`);
          console.log(`    Issue title: "${a.issueName}" -> normalized: "${aTitle}"`);
          console.log(`    Target title: "${issueTitle}" -> normalized: "${targetTitle}"`);
          
          // Check for exact matches
          const aExactMatch = aTitle === targetTitle;
          const bExactMatch = bTitle === targetTitle;
          
          if (aExactMatch && !bExactMatch) {
            console.log(`    ✅ Exact match for ${a.name}!`);
            return -1;
          }
          if (!aExactMatch && bExactMatch) {
            console.log(`    ✅ Exact match for ${b.name}!`);
            return 1;
          }
          
          // Check for partial matches
          const aPartialMatch = aTitle.includes(targetTitle) || targetTitle.includes(aTitle);
          const bPartialMatch = bTitle.includes(targetTitle) || targetTitle.includes(bTitle);
          
          if (aPartialMatch && !bPartialMatch) {
            console.log(`    ✅ Partial match for ${a.name}!`);
            return -1;
          }
          if (!aPartialMatch && bPartialMatch) {
            console.log(`    ✅ Partial match for ${b.name}!`);
            return 1;
          }
          
          console.log(`    ❌ No title match for either series`);
        }
        
        // 4. Higher issue count suggests main series
        const aIssueCount = a.count_of_issues || 0;
        const bIssueCount = b.count_of_issues || 0;
        
        return bIssueCount - aIssueCount;
      });
      
      // Log the sorting results
      console.log('Sorted results:');
      filteredSeries.forEach((series, index) => {
        const publisher = series.publisher?.name || 'Unknown';
        const titleMatch = issueTitle && series.issueName && 
          series.issueName.toLowerCase().includes(issueTitle.toLowerCase()) ? '✅' : '❌';
        const wordScore = calculateWordMatchingScore(series.name, query);
        console.log(`  ${index + 1}. ${series.name} (${series.start_year}) - ${publisher} - "${series.issueName}" ${titleMatch} - Word Score: ${wordScore.toFixed(3)}`);
      });
    }

    console.log(`Filtered ${allSeries.length} series down to ${filteredSeries.length} with issue #${issueNumber}`);
    res.json(filteredSeries);
  } catch (error) {
    console.error('Error searching ComicVine with issue filtering:', error);
    res.status(500).json({ error: 'Failed to search ComicVine with issue filtering' });
  }
});

// ComicVine cover artwork endpoint
app.get('/api/comicvine-cover', async (req, res) => {
  try {
    const { comic } = req.query;
    if (!comic) {
      return res.status(400).send('Missing comic parameter');
    }

    const comicVineService = require('./comicVineService');
    const comicDetails = await comicVineService.getComicCoverArt(comic);
    
    if (comicDetails && comicDetails.coverUrl) {
      // Return the cover image by proxying it
      const axios = require('axios');
      const response = await axios.get(comicDetails.coverUrl, {
        responseType: 'stream',
        timeout: 10000,
        headers: {
          'User-Agent': 'MasterOrder/1.0'
        }
      });
      
      // Set appropriate headers
      res.set({
        'Content-Type': response.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      });
      
      // Pipe the image data
      response.data.pipe(res);
    } else {
      // Return a 404 if no cover found
      res.status(404).send('Comic cover not found');
    }
  } catch (error) {
    console.error('Error getting ComicVine cover for comic:', req.query.comic);
    console.error('ComicVine cover error details:', error);
    res.status(500).send(`Error loading ComicVine cover: ${error.message}`);
  }
});

// OpenLibrary search endpoint
app.get('/api/openlibrary/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const openLibraryService = require('./openLibraryService');
    const results = await openLibraryService.searchBooks(query, parseInt(limit) || 20);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching OpenLibrary:', error);
    res.status(500).json({ error: 'Failed to search OpenLibrary' });
  }
});

// OpenLibrary book details endpoint
app.get('/api/openlibrary/book/*', async (req, res) => {
  try {
    const bookKey = req.params[0]; // Use wildcard parameter
    if (!bookKey) {
      return res.status(400).json({ error: 'Missing book key' });
    }

    const openLibraryService = require('./openLibraryService');
    const bookDetails = await openLibraryService.getBookDetails(bookKey);
    
    if (!bookDetails) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(bookDetails);
  } catch (error) {
    console.error('Error getting book details:', error);
    res.status(500).json({ error: 'Failed to get book details' });
  }
});

// OpenLibrary cover artwork proxy
app.get('/api/openlibrary-artwork', async (req, res) => {
  try {
    const artworkUrl = req.query.url;
    if (!artworkUrl) {
      return res.status(400).send('Missing artwork URL');
    }
    
    const axios = require('axios');
    const response = await axios.get(artworkUrl, {
      responseType: 'stream',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'MasterOrder/1.0'
      }
    });
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });
    
    // Pipe the image data
    response.data.pipe(res);  } catch (error) {
    console.error('Error proxying OpenLibrary artwork:', error);
    res.status(500).send('Error loading OpenLibrary artwork');
  }
});


app.get('/api/settings', async (req, res) => {
  try {
    const { getSettings } = require('./databaseUtils');
    let settings = await getSettings();

    if (!settings) {
      settings = {};
    } else {
      // Parse JSON strings for ignored collections if they exist
      if (settings.ignoredMovieCollections && typeof settings.ignoredMovieCollections === 'string') {
        try {
          settings.ignoredMovieCollections = JSON.parse(settings.ignoredMovieCollections);
        } catch (e) {
          console.warn('Failed to parse ignoredMovieCollections JSON:', e);
          settings.ignoredMovieCollections = [];
        }
      }

      if (settings.ignoredTVCollections && typeof settings.ignoredTVCollections === 'string') {
        try {
          settings.ignoredTVCollections = JSON.parse(settings.ignoredTVCollections);
        } catch (e) {
          console.warn('Failed to parse ignoredTVCollections JSON:', e);
          settings.ignoredTVCollections = [];
        }
      }

      // Set default arrays if null
      if (!settings.ignoredMovieCollections) {
        settings.ignoredMovieCollections = [];
      }
      if (!settings.ignoredTVCollections) {
        settings.ignoredTVCollections = [];
      }
    }

    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: 'Something went wrong' });  }
});

// Plex webhook endpoint
app.post('/webhook', upload.single('thumb'), async (req, res) => {
  try {
    console.log('\n🎬 =================================');
    console.log('🎬 PLEX WEBHOOK RECEIVED');
    console.log('🎬 =================================');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🔗 Headers:', JSON.stringify(req.headers, null, 2));
    
    // Parse the JSON payload
    let payload;
    if (req.body.payload) {
      payload = JSON.parse(req.body.payload);
      console.log('📦 Raw payload found in req.body.payload');
    } else {
      payload = req.body;
      console.log('📦 Using req.body directly');
    }

    console.log('🎯 Event Type:', payload.event);
    console.log('👤 User:', payload.Account?.title || 'Unknown User');
    console.log('📱 Player:', payload.Player?.title || 'Unknown Player');
    console.log('🖥️  Server:', payload.Server?.title || 'Unknown Server');
    
    if (payload.Metadata) {
      console.log('📺 Media Details:');
      console.log('   Type:', payload.Metadata.type);
      console.log('   Title:', payload.Metadata.title);
      console.log('   Year:', payload.Metadata.year);
      console.log('   Duration:', payload.Metadata.duration);
      console.log('   Rating Key:', payload.Metadata.ratingKey);
      
      if (payload.Metadata.type === 'episode') {
        console.log('   Series:', payload.Metadata.grandparentTitle);
        console.log('   Season:', payload.Metadata.parentIndex);
        console.log('   Episode:', payload.Metadata.index);
      }
    }
    
    console.log('📄 Full Payload:', JSON.stringify(payload, null, 2));
    console.log('🎬 =================================\n');

    // Check if we should filter by selected Plex user
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    const selectedPlexUser = settings?.selectedPlexUser;
    const webhookUser = payload.Account?.title || payload.Account?.name;

    if (selectedPlexUser && webhookUser && webhookUser !== selectedPlexUser) {
      console.log(`🚫 Ignoring webhook from user "${webhookUser}" (only processing "${selectedPlexUser}")`);
      res.status(200).send('OK - Ignored (different user)');
      return;
    }

    if (selectedPlexUser) {
      console.log(`✅ Processing webhook from selected user: "${webhookUser}"`);
    }

    // Only process media.play and media.scrobble events
    if (payload.event === 'media.play') {
      const notification = {
        event: payload.event,
        user: payload.Account?.title || 'Unknown User',
        player: payload.Player?.title || 'Unknown Player',
        server: payload.Server?.title || 'Unknown Server',
        media: {
          type: payload.Metadata?.type || 'unknown',
          title: payload.Metadata?.title || 'Unknown Title',
          year: payload.Metadata?.year,
          summary: payload.Metadata?.summary,
          duration: payload.Metadata?.duration,
          // For TV shows
          grandparentTitle: payload.Metadata?.grandparentTitle, // Series name
          parentTitle: payload.Metadata?.parentTitle, // Season name
          index: payload.Metadata?.index, // Episode number
          parentIndex: payload.Metadata?.parentIndex, // Season number
          // For music
          artistTitle: payload.Metadata?.grandparentTitle,
          albumTitle: payload.Metadata?.parentTitle,
          trackNumber: payload.Metadata?.index,
          // Generic
          thumb: payload.Metadata?.thumb,
          art: payload.Metadata?.art,
          ratingKey: payload.Metadata?.ratingKey,
          guid: payload.Metadata?.guid,
          librarySectionType: payload.Metadata?.librarySectionType
        },
        timestamp: new Date().toISOString()
      };

      // Emit to all connected clients
      io.emit('plexPlayback', notification);
      console.log('✅ Emitted Plex playback notification to WebSocket clients');
    }

    // Process media.scrobble events to mark items as watched
    if (payload.event === 'media.scrobble') {
      console.log('\n🎯 Processing media.scrobble event for automatic watched marking...');
      
      // Only process episodes and movies, skip music tracks and other media types
      const mediaType = payload.Metadata?.type;
      if (mediaType !== 'episode' && mediaType !== 'movie') {
        console.log(`   🎵 Skipping scrobble for media type: "${mediaType}" (only episodes and movies are tracked)`);
        res.status(200).send('OK');
        return;
      }
      
      const ratingKey = payload.Metadata?.ratingKey;
      
      if (ratingKey) {
        try {
          // Find custom order item with this ratingKey (plexKey)
          const customOrderItem = await prisma.customOrderItem.findFirst({
            where: { plexKey: ratingKey.toString() },
            include: {
              customOrder: true
            }
          });

          if (customOrderItem && !customOrderItem.isWatched) {
            console.log(`   📺 Found matching item in custom order: "${customOrderItem.title}"`);
            
            // Mark as watched in custom order
            await markCustomOrderItemAsWatched(customOrderItem.id);
            
            // Create watch log entry
            let watchLogMediaType = customOrderItem.mediaType;
            
            // Map custom order media types to watch log media types (same as manual marking)
            if (customOrderItem.mediaType === 'episode') {
              watchLogMediaType = 'tv';
            }
            
            const watchLogData = {
              mediaType: watchLogMediaType,
              title: customOrderItem.title,
              plexKey: ratingKey.toString(),
              customOrderItemId: customOrderItem.id,
              isCompleted: true
            };

            // Add series-specific data for TV episodes
            if (customOrderItem.mediaType === 'episode') {
              watchLogData.seriesTitle = customOrderItem.seriesTitle;
              watchLogData.seasonNumber = customOrderItem.seasonNumber;
              watchLogData.episodeNumber = customOrderItem.episodeNumber;
            }

            // Try to get duration from Plex data
            try {
              if (customOrderItem.mediaType === 'episode') {
                const plexItem = await plexDb.getItemMetadata(ratingKey, 'episode');
                if (plexItem && plexItem.duration) {
                  watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
                }
              } else if (customOrderItem.mediaType === 'movie') {
                const plexItem = await plexDb.getMovieByRatingKey(ratingKey);
                if (plexItem && plexItem.duration) {
                  watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
                }
              }
            } catch (plexError) {
              console.warn(`   ⚠️  Could not get duration from Plex: ${plexError.message}`);
            }

            // Set default duration if not found
            if (!watchLogData.duration) {
              watchLogData.duration = customOrderItem.mediaType === 'movie' ? 120 : 45;
            }
            watchLogData.totalWatchTime = watchLogData.duration;

            // Log the watch activity
            await watchLogService.logWatched(watchLogData);

            // Mark as watched in Plex database
            try {
              if (customOrderItem.mediaType === 'episode') {
                await plexDb.markEpisodeAsWatched(ratingKey);
                console.log(`   📺 Marked episode as watched in Plex database`);
              } else if (customOrderItem.mediaType === 'movie') {
                await plexDb.markMovieAsWatched(ratingKey);
                console.log(`   🎬 Marked movie as watched in Plex database`);
              }
            } catch (plexMarkError) {
              console.warn(`   ⚠️  Could not mark as watched in Plex database: ${plexMarkError.message}`);
            }

            console.log(`   ✅ Successfully marked "${customOrderItem.title}" as watched via Plex scrobble`);
            console.log(`   📊 Custom order: "${customOrderItem.customOrder.name}"`);
            console.log(`   ⏱️  Duration: ${watchLogData.duration} minutes`);
          } else if (customOrderItem && customOrderItem.isWatched) {
            console.log(`   ℹ️  Item "${customOrderItem.title}" is already marked as watched`);
          } else {
            console.log(`   ❓ No matching custom order item found for ratingKey: ${ratingKey}`);
            console.log(`   📝 Creating watch log entry for non-custom order item...`);
            
            // Still create a watch log entry even if not in custom order
            try {
              const watchLogData = {
                title: payload.Metadata?.title || 'Unknown Title',
                plexKey: ratingKey.toString(),
                isCompleted: true
              };

              // Determine media type and add appropriate data
              if (payload.Metadata?.type === 'episode') {
                watchLogData.mediaType = 'tv';  // Use 'tv' for consistency with stats queries
                watchLogData.seriesTitle = payload.Metadata?.grandparentTitle;
                watchLogData.seasonNumber = payload.Metadata?.parentIndex;
                watchLogData.episodeNumber = payload.Metadata?.index;
              } else if (payload.Metadata?.type === 'movie') {
                watchLogData.mediaType = 'movie';
              } else {
                watchLogData.mediaType = payload.Metadata?.type || 'unknown';
              }

              // Get duration from payload or Plex database
              let duration = null;
              if (payload.Metadata?.duration) {
                duration = Math.round(payload.Metadata.duration / (1000 * 60)); // Convert from ms to minutes
              }

              // If no duration in payload, try to get from Plex database
              if (!duration) {
                try {
                  if (watchLogData.mediaType === 'episode') {
                    const plexItem = await plexDb.getItemMetadata(ratingKey, 'episode');
                    if (plexItem && plexItem.duration) {
                      duration = Math.round(plexItem.duration / (1000 * 60));
                    }
                  } else if (watchLogData.mediaType === 'movie') {
                    const plexItem = await plexDb.getMovieByRatingKey(ratingKey);
                    if (plexItem && plexItem.duration) {
                      duration = Math.round(plexItem.duration / (1000 * 60));
                    }
                  }
                } catch (plexError) {
                  console.warn(`   ⚠️  Could not get duration from Plex database: ${plexError.message}`);
                }
              }

              // Set default duration if still not found
              if (!duration) {
                duration = watchLogData.mediaType === 'movie' ? 120 : 45;
              }
              
              watchLogData.duration = duration;
              watchLogData.totalWatchTime = duration;

              // Log the watch activity
              await watchLogService.logWatched(watchLogData);

              // Mark as watched in Plex database
              try {
                if (watchLogData.mediaType === 'tv' || payload.Metadata?.type === 'episode') {
                  await plexDb.markEpisodeAsWatched(ratingKey);
                  console.log(`   📺 Marked episode as watched in Plex database`);
                } else if (watchLogData.mediaType === 'movie') {
                  await plexDb.markMovieAsWatched(ratingKey);
                  console.log(`   🎬 Marked movie as watched in Plex database`);
                }
              } catch (plexMarkError) {
                console.warn(`   ⚠️  Could not mark as watched in Plex database: ${plexMarkError.message}`);
              }

              console.log(`   ✅ Successfully logged "${watchLogData.title}" as watched via Plex scrobble`);
              console.log(`   📺 Media type: ${watchLogData.mediaType}`);
              console.log(`   ⏱️  Duration: ${duration} minutes`);
              if (watchLogData.seriesTitle) {
                console.log(`   📺 Series: "${watchLogData.seriesTitle}" S${watchLogData.seasonNumber}E${watchLogData.episodeNumber}`);
              }
            } catch (watchLogError) {
              console.error(`   ❌ Failed to create watch log for non-custom order item: ${watchLogError.message}`);
            }
          }
        } catch (error) {
          console.error(`   ❌ Error processing scrobble event: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️  No ratingKey found in scrobble payload`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { 
      collectionName, 
      tvGeneralPercent, 
      moviesGeneralPercent, 
      customOrderPercent,
      partiallyWatchedCollectionPercent,
      comicVineApiKey, 
      plexSyncInterval,
      stashSyncInterval,
      plexToken,
      plexUrl,
      tvdbApiKey,
      tvdbBearerToken,
      selectedPlayer,
      selectedPlexUser,
      timezone,
      ignoredMovieCollections,
      ignoredTVCollections,
      christmasFilterEnabled,
      komgaApiKey,
      komgaUrl,
      stashApiKey,
      stashUrl
    } = req.body;

    // Validate percentages if provided
    if (tvGeneralPercent !== undefined && (tvGeneralPercent < 0 || tvGeneralPercent > 100)) {
      return res.status(400).json({ error: 'TV General percentage must be between 0 and 100' });
    }
    if (moviesGeneralPercent !== undefined && (moviesGeneralPercent < 0 || moviesGeneralPercent > 100)) {
      return res.status(400).json({ error: 'Movies General percentage must be between 0 and 100' });
    }
    if (customOrderPercent !== undefined && (customOrderPercent < 0 || customOrderPercent > 100)) {
      return res.status(400).json({ error: 'Custom Order percentage must be between 0 and 100' });
    }
    if (partiallyWatchedCollectionPercent !== undefined && (partiallyWatchedCollectionPercent < 0 || partiallyWatchedCollectionPercent > 100)) {
      return res.status(400).json({ error: 'Partially Watched Collection percentage must be between 0 and 100' });
    }

    // Validate sync interval if provided
    if (plexSyncInterval !== undefined && (plexSyncInterval < 1 || plexSyncInterval > 168)) {
      return res.status(400).json({ error: 'Plex sync interval must be between 1 and 168 hours (1 week)' });
    }
    if (stashSyncInterval !== undefined && (stashSyncInterval < 1 || stashSyncInterval > 168)) {
      return res.status(400).json({ error: 'Stash sync interval must be between 1 and 168 hours (1 week)' });
    }

    // Validate that percentages add up to 100% if all three are provided
    if (tvGeneralPercent !== undefined && moviesGeneralPercent !== undefined && customOrderPercent !== undefined) {
      const total = tvGeneralPercent + moviesGeneralPercent + customOrderPercent;
      if (total !== 100) {
        return res.status(400).json({ 
          error: `Order type percentages must add up to exactly 100%. Current total: ${total}%` 
        });
      }
    }    // Prepare update data - only include defined fields
    const updateData = {};
    if (collectionName !== undefined) updateData.collectionName = collectionName;
    if (tvGeneralPercent !== undefined) updateData.tvGeneralPercent = tvGeneralPercent;
    if (moviesGeneralPercent !== undefined) updateData.moviesGeneralPercent = moviesGeneralPercent;
    if (customOrderPercent !== undefined) updateData.customOrderPercent = customOrderPercent;
    if (partiallyWatchedCollectionPercent !== undefined) updateData.partiallyWatchedCollectionPercent = partiallyWatchedCollectionPercent;
    if (comicVineApiKey !== undefined) updateData.comicVineApiKey = comicVineApiKey.trim() || null;
    if (plexSyncInterval !== undefined) updateData.plexSyncInterval = plexSyncInterval;
    if (stashSyncInterval !== undefined) updateData.stashSyncInterval = stashSyncInterval;
    if (plexToken !== undefined) updateData.plexToken = plexToken.trim() || null;
    if (plexUrl !== undefined) updateData.plexUrl = plexUrl.trim() || null;
    if (tvdbApiKey !== undefined) updateData.tvdbApiKey = tvdbApiKey.trim() || null;
    if (tvdbBearerToken !== undefined) updateData.tvdbBearerToken = tvdbBearerToken.trim() || null;
    if (selectedPlayer !== undefined) updateData.selectedPlayer = selectedPlayer.trim() || null;
    if (selectedPlexUser !== undefined) updateData.selectedPlexUser = selectedPlexUser.trim() || null;
    if (timezone !== undefined) updateData.timezone = timezone.trim() || 'UTC';
    if (ignoredMovieCollections !== undefined) updateData.ignoredMovieCollections = Array.isArray(ignoredMovieCollections) ? JSON.stringify(ignoredMovieCollections) : ignoredMovieCollections;
    if (ignoredTVCollections !== undefined) updateData.ignoredTVCollections = Array.isArray(ignoredTVCollections) ? JSON.stringify(ignoredTVCollections) : ignoredTVCollections;
    if (christmasFilterEnabled !== undefined) updateData.christmasFilterEnabled = christmasFilterEnabled;
    if (komgaApiKey !== undefined) updateData.komgaApiKey = komgaApiKey.trim() || null;
    if (komgaUrl !== undefined) updateData.komgaUrl = komgaUrl.trim() || null;
    if (stashApiKey !== undefined) updateData.stashApiKey = stashApiKey.trim() || null;
    if (stashUrl !== undefined) updateData.stashUrl = stashUrl.trim() || null;

    // Upsert settings (create if doesn't exist, update if it does)
    const { updateSettings } = require('./databaseUtils');
    const settings = await updateSettings({
      ...updateData,
      // Provide defaults for create case
      collectionName: collectionName || undefined,
      tvGeneralPercent: tvGeneralPercent ?? 50, 
      moviesGeneralPercent: moviesGeneralPercent ?? 50,
      customOrderPercent: customOrderPercent ?? 0,
      partiallyWatchedCollectionPercent: partiallyWatchedCollectionPercent ?? 75,
      plexSyncInterval: plexSyncInterval ?? 12,
      stashSyncInterval: stashSyncInterval ?? 24,
      christmasFilterEnabled: christmasFilterEnabled ?? false
    });

    // Update background sync interval if it was changed
    if (plexSyncInterval !== undefined) {
      try {
        await backgroundSync.updateSyncInterval();
        console.log('Background sync interval updated');
      } catch (error) {
        console.error('Failed to update background sync interval:', error);
      }
    }

    // Update Stash background sync interval if it was changed
    if (stashSyncInterval !== undefined) {
      try {
        await stashBackgroundSync.updateSyncInterval();
        console.log('Stash background sync interval updated');
      } catch (error) {
        console.error('Failed to update Stash background sync interval:', error);
      }
    }

    // Refresh Plex player client if Plex settings were changed
    if (plexToken !== undefined || plexUrl !== undefined) {
      try {
        await plexPlayer.refreshClient();
        console.log('Plex player client refreshed due to settings update');
      } catch (error) {
        console.error('Failed to refresh Plex player client:', error);
        // Don't fail the whole request if this fails
      }
    }
    
    // Refresh Stash service if Stash settings were changed
    if (req.body.stashUrl !== undefined || req.body.stashApiKey !== undefined) {
      try {
        await initializeStashService();
        console.log('Stash service refreshed due to settings update');
      } catch (error) {
        console.error('Failed to refresh Stash service:', error);
        // Don't fail the whole request if this fails
      }
    }    console.log('Saved settings:', settings);
    res.json({ message: 'Settings saved successfully', settings });
  } catch (error) {
    console.error('Failed to save settings:', error.message);
    res.status(500).json({ error: 'Something went wrong' });  }
});

// Plex sync endpoints
app.post('/api/plex/sync', async (req, res) => {
  try {
    const result = await plexSync.fullSync();
    res.json(result);
  } catch (error) {
    console.error('Plex sync failed:', error);
    res.status(500).json({ 
      error: 'Plex sync failed', 
      details: error.message 
    });
  }
});

app.get('/api/plex/sync-status', async (req, res) => {
  try {
    const status = await plexSync.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get sync status',
      details: error.message 
    });
  }
});

// Background sync management endpoints
app.get('/api/plex/background-sync-status', async (req, res) => {
  try {
    const status = backgroundSync.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get background sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get background sync status',
      details: error.message 
    });
  }
});

app.post('/api/plex/background-sync/start', async (req, res) => {
  try {
    await backgroundSync.start();
    res.json({ message: 'Background sync service started successfully' });
  } catch (error) {
    console.error('Failed to start background sync:', error);
    res.status(500).json({ 
      error: 'Failed to start background sync',
      details: error.message 
    });
  }
});

app.post('/api/plex/background-sync/stop', async (req, res) => {
  try {
    await backgroundSync.stop();
    res.json({ message: 'Background sync service stopped successfully' });
  } catch (error) {
    console.error('Failed to stop background sync:', error);
    res.status(500).json({ 
      error: 'Failed to stop background sync',
      details: error.message 
    });
  }
});

app.post('/api/plex/background-sync/force-now', async (req, res) => {
  try {
    const result = await backgroundSync.forceSyncNow();
    res.json({ message: 'Background sync completed', result });
  } catch (error) {
    console.error('Failed to force background sync:', error);
    res.status(500).json({ 
      error: 'Failed to force background sync',
      details: error.message 
    });
  }
});

// Stash Background Sync Endpoints
app.get('/api/stash/background-sync-status', async (req, res) => {
  try {
    const status = stashBackgroundSync.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get Stash background sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get Stash background sync status',
      details: error.message 
    });
  }
});

app.post('/api/stash/background-sync/start', async (req, res) => {
  try {
    await stashBackgroundSync.start();
    res.json({ message: 'Stash background sync service started successfully' });
  } catch (error) {
    console.error('Failed to start Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to start Stash background sync',
      details: error.message 
    });
  }
});

app.post('/api/stash/background-sync/stop', async (req, res) => {
  try {
    await stashBackgroundSync.stop();
    res.json({ message: 'Stash background sync service stopped successfully' });
  } catch (error) {
    console.error('Failed to stop Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to stop Stash background sync',
      details: error.message 
    });
  }
});

app.post('/api/stash/background-sync/force-now', async (req, res) => {
  try {
    const result = await stashBackgroundSync.forceSyncNow();
    res.json({ message: 'Stash background sync completed', result });
  } catch (error) {
    console.error('Failed to force Stash background sync:', error);
    res.status(500).json({ 
      error: 'Failed to force Stash background sync',
      details: error.message 
    });
  }
});

// Get available collections endpoint
app.get('/api/plex/collections', async (req, res) => {
  try {
    // Get all collections from both TV shows and movies
    const tvCollections = await plexDb.getAllTVCollections();
    const movieCollections = await plexDb.getAllMovieCollections();
    
    // Combine and deduplicate collections
    const allCollections = [...new Set([...tvCollections, ...movieCollections])];
    
    // Sort alphabetically and format for dropdown
    const formattedCollections = allCollections
      .sort()
      .map(collection => ({
        value: collection,
        label: collection
      }));
    
    res.json(formattedCollections);
  } catch (error) {
    console.error('Failed to fetch collections:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collections',
      details: error.message 
    });  }
});

// Get available Plex players endpoint
app.get('/api/plex/players', async (req, res) => {
  try {
    const players = await plexPlayer.getPlayers();
    
    // Format players for dropdown
    const formattedPlayers = players.map(player => ({
      value: player.machineIdentifier,
      label: player.isFallback 
        ? `${player.name} [Fallback]`
        : `${player.name} (${player.product}) - ${player.platform}`,
      ...player
    }));
    
    res.json(formattedPlayers);
  } catch (error) {
    console.error('Failed to fetch Plex players:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Plex players',
      details: error.message 
    });
  }
});

// Get selected player details endpoint
app.get('/api/plex/selected-player', async (req, res) => {
  try {
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.selectedPlayer) {
      return res.json({ selectedPlayer: null, message: 'No player selected' });
    }
    
    const players = await plexPlayer.getPlayers();
    const selectedPlayerDetails = players.find(player => player.machineIdentifier === settings.selectedPlayer);
    
    if (!selectedPlayerDetails) {
      return res.json({ 
        selectedPlayer: settings.selectedPlayer, 
        message: 'Selected player not currently available',
        available: false
      });
    }
    
    res.json({ 
      selectedPlayer: settings.selectedPlayer,
      playerDetails: selectedPlayerDetails,
      available: true
    });
  } catch (error) {
    console.error('Failed to get selected player:', error);
    res.status(500).json({ 
      error: 'Failed to get selected player',
      details: error.message 
    });
  }
});

// Get available Plex users endpoint
app.get('/api/plex/users', async (req, res) => {
  try {
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();

    if (!settings || !settings.plexUrl || !settings.plexToken) {
      return res.status(400).json({ error: 'Plex settings not configured' });
    }

    // Use axios to make direct API call to get users
    const axios = require('axios');
    const url = new URL(settings.plexUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    const response = await axios.get(`${baseUrl}/accounts`, {
      headers: {
        'X-Plex-Token': settings.plexToken,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (response.data && response.data.MediaContainer && response.data.MediaContainer.Account) {
      const users = response.data.MediaContainer.Account.map(account => ({
        id: account.id,
        name: account.name || account.title,
        title: account.title || account.name
      }));

      // Add the server owner (admin) if not already included
      const adminResponse = await axios.get(`${baseUrl}/`, {
        headers: {
          'X-Plex-Token': settings.plexToken,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (adminResponse.data && adminResponse.data.MediaContainer) {
        const serverOwner = adminResponse.data.MediaContainer.friendlyName || 'Server Owner';
        
        // Check if server owner is already in the list
        const ownerExists = users.some(user => 
          user.name === serverOwner || user.title === serverOwner
        );

        if (!ownerExists) {
          users.unshift({
            id: 'admin',
            name: serverOwner,
            title: serverOwner
          });
        }
      }

      res.json(users);
    } else {
      // If no shared users, return just the server owner
      const adminResponse = await axios.get(`${baseUrl}/`, {
        headers: {
          'X-Plex-Token': settings.plexToken,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const serverOwner = adminResponse.data?.MediaContainer?.friendlyName || 'Server Owner';
      
      res.json([{
        id: 'admin',
        name: serverOwner,
        title: serverOwner
      }]);
    }
  } catch (error) {
    console.error('Failed to fetch Plex users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Plex users',
      details: error.message 
    });
  }
});

// Start playback on selected player endpoint
app.post('/api/plex/play', async (req, res) => {
  try {
    const { ratingKey, offset = 0, playerId } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ error: 'ratingKey is required' });
    }
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (!settings || !settings.selectedPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlayer;
    }

    const result = await plexPlayer.playMedia(targetPlayerId, ratingKey, offset);
    res.json(result);
  } catch (error) {
    console.error('Failed to start playback:', error);
    res.status(500).json({ 
      error: 'Failed to start playback',
      details: error.message 
    });
  }
});

// Start playback with mobile retry endpoint
app.post('/api/plex/play-with-retry', async (req, res) => {
  try {
    const { ratingKey, offset = 0, playerId } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ error: 'ratingKey is required' });
    }
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (!settings || !settings.selectedPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlayer;
    }

    const result = await plexPlayer.playMediaWithMobileRetry(targetPlayerId, ratingKey, offset);
    res.json(result);
  } catch (error) {
    console.error('Failed to start playback with retry:', error);
    res.status(500).json({ 
      error: 'Failed to start playback',
      details: error.message 
    });
  }
});

// Start playback via Plex.tv discovery endpoint
app.post('/api/plex/play-via-plex-tv', async (req, res) => {
  try {
    const { ratingKey, offset = 0, playerId } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ error: 'ratingKey is required' });
    }
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (!settings || !settings.selectedPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlayer;
    }

    const result = await plexPlayer.playMediaViaPlex(targetPlayerId, ratingKey, offset);
    res.json(result);
  } catch (error) {
    console.error('Failed to start playback via Plex.tv:', error);
    res.status(500).json({ 
      error: 'Failed to start playback via Plex.tv',
      details: error.message 
    });
  }
});

// Test TVDB token endpoint
app.get('/api/tvdb/test-token', async (req, res) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (!settings || !settings.tvdbBearerToken) {
      return res.json({
        success: false,
        error: 'No TVDB Bearer Token configured',
        hasToken: false
      });
    }
    
    // Test the token with a simple API call
    const testResponse = await fetch('https://api4.thetvdb.com/v4/search?query=test&type=series', {
      headers: {
        'Authorization': `Bearer ${settings.tvdbBearerToken}`
      }
    });
    
    if (testResponse.ok) {
      const data = await testResponse.json();
      res.json({
        success: true,
        message: 'TVDB Bearer Token is valid',
        hasToken: true,
        tokenLength: settings.tvdbBearerToken.length,
        testResultCount: data.data?.length || 0
      });
    } else {
      const errorData = await testResponse.text();
      res.json({
        success: false,
        error: `TVDB API returned ${testResponse.status}: ${errorData}`,
        hasToken: true,
        tokenLength: settings.tvdbBearerToken.length,
        status: testResponse.status
      });
    }
  } catch (error) {
    console.error('TVDB token test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test TVDB token',
      details: error.message
    });
  }
});

// Test AndroidTV notification endpoint
app.post('/api/plex/test-androidtv-notification', async (req, res) => {
  try {
    const { ratingKey, offset = 0, playerId } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ error: 'ratingKey is required' });
    }
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (!settings || !settings.selectedPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlayer;
    }

    console.log('Testing AndroidTV notification approach for device:', targetPlayerId);
    
    // Initialize the Plex client
    await plexPlayer.initializeClient();
    
    // Get media details
    const mediaResponse = await plexPlayer.client.query(`/library/metadata/${ratingKey}`);
    if (!mediaResponse?.MediaContainer?.Metadata?.[0]) {
      throw new Error('Media not found');
    }
    
    const media = mediaResponse.MediaContainer.Metadata[0];
    console.log('Media details:', media.title);
    
    // Try multiple notification approaches
    const results = {};
    
    // Method 1: Timeline notification
    try {
      console.log('Trying timeline notification...');
      const timelineParams = {
        ratingKey: ratingKey,
        key: media.key,
        state: 'playing',
        time: offset * 1000,
        duration: media.duration || 0,
        machineIdentifier: targetPlayerId
      };
      
      const timelineResponse = await plexPlayer.client.query('/:/timeline', 'POST', timelineParams);
      results.timeline = { success: true, response: timelineResponse };
      console.log('Timeline notification success');
    } catch (error) {
      results.timeline = { success: false, error: error.message };
      console.log('Timeline notification failed:', error.message);
    }
    
    // Method 2: Direct notification
    try {
      console.log('Trying direct notification...');
      const notifyParams = {
        type: 'playing',
        machineIdentifier: targetPlayerId,
        key: media.key,
        offset: offset * 1000
      };
      
      const notifyResponse = await plexPlayer.client.query('/:/notify', 'POST', notifyParams);
      results.notify = { success: true, response: notifyResponse };
      console.log('Direct notification success');
    } catch (error) {
      results.notify = { success: false, error: error.message };
      console.log('Direct notification failed:', error.message);
    }
    
    // Method 3: Play queue creation
    try {
      console.log('Trying play queue creation...');
      const queueParams = {
        type: 'video',
        uri: `library:///directory/${media.key}`,
        machineIdentifier: targetPlayerId,
        offset: offset * 1000
      };
      
      const queueResponse = await plexPlayer.client.query('/playQueues', 'POST', queueParams);
      results.playQueue = { success: true, response: queueResponse };
      console.log('Play queue creation success');
    } catch (error) {
      results.playQueue = { success: false, error: error.message };
      console.log('Play queue creation failed:', error.message);
    }
    
    res.json({
      success: true,
      message: 'AndroidTV notification test completed',
      media: media.title,
      targetDevice: targetPlayerId,
      results: results
    });
    
  } catch (error) {
    console.error('Failed to test AndroidTV notification:', error);
    res.status(500).json({ 
      error: 'Failed to test AndroidTV notification',
      details: error.message 
    });
  }
});// Control playback endpoint
app.post('/api/plex/control/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { playerId } = req.body;
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      if (!settings || !settings.selectedPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlayer;
    }
    
    const result = await plexPlayer.controlPlayback(targetPlayerId, action);
    res.json(result);
  } catch (error) {
    console.error(`Failed to ${action} playback:`, error);
    res.status(500).json({ 
      error: `Failed to ${action} playback`,
      details: error.message 
    });
  }
});

// Test Plex connection endpoint
app.get('/api/plex/test-connection', async (req, res) => {
  try {
    const result = await plexPlayer.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Failed to test Plex connection:', error);
    res.status(500).json({ 
      error: 'Failed to test Plex connection',
      details: error.message 
    });
  }
});

// Check specific device status endpoint
app.get('/api/plex/device-status/:machineIdentifier', async (req, res) => {
  try {
    const { machineIdentifier } = req.params;
    
    if (!machineIdentifier) {
      return res.status(400).json({ error: 'Machine identifier is required' });
    }
    
    console.log(`Checking device status for: ${machineIdentifier}`);
    
    // Get all available players first
    const allPlayers = await plexPlayer.getPlayers();
    const altPlayers = await plexPlayer.getPlayersAlternative();
    const combinedPlayers = [...allPlayers, ...altPlayers];
    
    // Find the specific device
    const device = combinedPlayers.find(p => p.machineIdentifier === machineIdentifier);
    
    if (!device) {
      return res.json({
        success: false,
        found: false,
        message: 'Device not found in current player list',
        machineIdentifier: machineIdentifier,
        availableDevices: combinedPlayers.length,
        timestamp: new Date().toISOString()
      });
    }
    
    const status = {
      success: true,
      found: true,
      device: {
        name: device.name,
        product: device.product,
        platform: device.platform,
        platformVersion: device.platformVersion,
        device: device.device,
        version: device.version,
        address: device.address,
        port: device.port,
        local: device.local,
        owned: device.owned,
        isRegistered: device.isRegistered,
        isFallback: device.isFallback
      },
      timestamp: new Date().toISOString()
    };
    
    // Try to check if device is responsive (for AndroidTV devices)
    if (device.isRegistered || device.platform === 'Android') {
      console.log('Attempting to check device responsiveness...');
      
      try {
        // Try the wake-up/status check method
        const wakeupResult = await plexPlayer.checkAndWakeUpDevice(machineIdentifier);
        status.responsiveness = {
          checked: true,
          result: wakeupResult,
          responsive: wakeupResult.success
        };
      } catch (responsiveError) {
        console.log('Responsiveness check failed:', responsiveError.message);
        status.responsiveness = {
          checked: true,
          result: { success: false, message: responsiveError.message },
          responsive: false
        };
      }
    } else {
      status.responsiveness = {
        checked: false,
        reason: 'Not an AndroidTV/registered device - responsiveness check skipped'
      };
    }
    
    // Try to get active sessions to see if device is currently playing
    try {
      const sessionsResponse = await plexPlayer.client.query('/status/sessions');
      const sessions = sessionsResponse?.MediaContainer?.Metadata || [];
      const deviceSession = sessions.find(session => 
        session.Player?.machineIdentifier === machineIdentifier
      );
      
      status.activeSession = {
        hasSession: !!deviceSession,
        sessionInfo: deviceSession ? {
          state: deviceSession.Player?.state,
          title: deviceSession.title,
          type: deviceSession.type,
          user: deviceSession.User?.title
        } : null
      };
    } catch (sessionError) {
      console.log('Session check failed:', sessionError.message);
      status.activeSession = {
        hasSession: false,
        error: sessionError.message
      };
    }
    
    console.log('Device status check completed:', status);
    res.json(status);
    
  } catch (error) {
    console.error('Failed to check device status:', error);
    res.status(500).json({ 
      error: 'Failed to check device status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test different Plex API endpoints
app.get('/api/plex/debug', async (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      endpoints: {}
    };

    // Test basic connection
    try {
      const connectionTest = await plexPlayer.testConnection();
      debugInfo.connection = connectionTest;
    } catch (error) {
      debugInfo.connection = { success: false, error: error.message };
    }

    // Test /clients endpoint
    try {
      const players = await plexPlayer.getPlayers();
      debugInfo.endpoints.clients = {
        success: true,
        playerCount: players.length,
        players: players
      };
    } catch (error) {
      debugInfo.endpoints.clients = {
        success: false,
        error: error.message
      };
    }

    // Test alternative methods
    try {
      const altPlayers = await plexPlayer.getPlayersAlternative();
      debugInfo.endpoints.alternative = {
        success: true,
        playerCount: altPlayers.length,
        players: altPlayers
      };
    } catch (error) {
      debugInfo.endpoints.alternative = {
        success: false,
        error: error.message
      };
    }

    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint failed:', error);
    res.status(500).json({ 
      error: 'Debug endpoint failed',
      details: error.message 
    });
  }
});

// Webhook notification endpoint
app.post('/api/webhook/notify', async (req, res) => {
  try {
    const { ratingKey, action, title, type, timestamp } = req.body;
    
    console.log('Sending webhook notification to Node-RED:', {
      ratingKey,
      action,
      title,
      type,
      timestamp
    });
    
    // Prepare the data to send
    const postData = JSON.stringify({
      ratingKey,
      action,
      title,
      type,
      timestamp
    });
    
    // HTTP request options
    const options = {
      hostname: '192.168.1.117',
      port: 1880,
      path: '/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Master-Order-App/1.0',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.NODE_RED_TOKEN}`
      }
    };
    
    // Make the HTTP request to Node-RED
    const request = http.request(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        console.log(`Node-RED response status: ${response.statusCode}`);
        console.log(`Node-RED response headers:`, response.headers);
        console.log(`Node-RED response body:`, data);
        
        if (response.statusCode >= 200 && response.statusCode < 300) {
          console.log('Webhook notification sent successfully to Node-RED');
          res.json({ success: true, message: 'Webhook notification sent' });
        } else {
          console.error('Node-RED webhook failed with status:', response.statusCode);
          res.status(500).json({ 
            success: false, 
            error: `Node-RED webhook failed with status ${response.statusCode}`,
            responseBody: data,
            responseHeaders: response.headers
          });
        }
      });
    });
    
    request.on('error', (error) => {
      console.error('Failed to send webhook notification:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send webhook notification',
        details: error.message 
      });
    });
    
    // Send the data
    request.write(postData);
    request.end();
    
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Webhook endpoint error',
      details: error.message 
    });
  }
});

// Raw Plex API debug endpoint
app.get('/api/plex/debug-raw', async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Test connection first
    const connectionTest = await plexPlayer.testConnection();
    
    // Get raw responses from multiple endpoints
    const rawResponses = {};
    
    try {
      console.log('Fetching raw /clients response...');
      rawResponses.clients = await plexPlayer.client.query('/clients');
    } catch (error) {
      rawResponses.clients = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /status/sessions response...');
      rawResponses.sessions = await plexPlayer.client.query('/status/sessions');
    } catch (error) {
      rawResponses.sessions = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /devices response...');
      rawResponses.devices = await plexPlayer.client.query('/devices');
    } catch (error) {
      rawResponses.devices = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /myplex/resources response...');
      rawResponses.resources = await plexPlayer.client.query('/myplex/resources');
    } catch (error) {
      rawResponses.resources = { error: error.message };
    }
    
    // Get processed players for comparison
    const processedPlayers = await plexPlayer.getPlayers().catch(error => ({ error: error.message }));
    const alternativePlayers = await plexPlayer.getPlayersAlternative().catch(error => ({ error: error.message }));
    
    res.json({
      timestamp,
      connection: connectionTest,
      rawResponses,
      processedResults: {
        main: Array.isArray(processedPlayers) ? { success: true, count: processedPlayers.length, players: processedPlayers } : processedPlayers,
        alternative: Array.isArray(alternativePlayers) ? { success: true, count: alternativePlayers.length, players: alternativePlayers } : alternativePlayers
      }
    });
  } catch (error) {
    console.error('Raw debug endpoint error:', error);
    res.status(500).json({ 
      error: 'Raw debug failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// TVDB cache clear endpoint
app.post('/api/tvdb/clear-cache', async (req, res) => {
  try {
    console.log('Starting TVDB cache clear...');
    await tvdbDb.cleanupOldCache(0); // Pass 0 hours to clear all cache
    console.log('TVDB cache cleared successfully');
    res.json({ 
      success: true, 
      message: 'TVDB cache cleared successfully' 
    });
  } catch (error) {
    console.error('TVDB cache clear failed:', error);
    res.status(500).json({ 
      error: 'TVDB cache clear failed', 
      details: error.message 
    });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const data = await callPlex(); // Call the imported function
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch data:', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Order routes
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, status } = req.body;
    const newOrder = await prisma.order.create({
      data: {
        customerName,
        status,
      }
    });
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, status } = req.body;
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        customerName,
        status,
      }
    });
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.order.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// Custom order next item endpoint (for testing and direct access)
app.get('/api/get-next-custom-order', async (req, res) => {
  try {
    const customOrderData = await getNextCustomOrder(req);
    res.json(customOrderData);
  } catch (error) {
    console.error('Failed to get next custom order item:', error.message);
    res.status(500).json({ 
      error: 'Failed to get next custom order item',
      details: error.message 
    });
  }
});

// Get a single custom order item by ID
app.get('/api/custom-orders/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const customOrderItem = await prisma.customOrderItem.findUnique({
      where: { id: parseInt(itemId) },
      include: {
        storyContainedInBook: true,
        containedStories: true,
        referencedCustomOrder: true,
        customOrder: {
          include: {
            plexPlaylist: true,
            customPlaylist: {
              include: {
                _count: {
                  select: { tracks: true }
                }
              }
            }
          }
        }
      }
    });
    
    if (!customOrderItem) {
      return res.status(404).json({ error: 'Custom order item not found' });
    }
    
    // Transform the response to include trackCount for custom playlists
    if (customOrderItem.customOrder?.customPlaylist) {
      customOrderItem.customOrder.customPlaylist.trackCount = 
        customOrderItem.customOrder.customPlaylist._count?.tracks || 0;
    }
    
    res.json(customOrderItem);
  } catch (error) {
    console.error('Error fetching custom order item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Custom Order Management Endpoints

// Get all custom orders
app.get('/api/custom-orders', async (req, res) => {
  try {
    const customOrders = await prisma.customOrder.findMany({
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        parentOrder: true,
        plexPlaylist: true,
        customPlaylist: {
          include: {
            _count: {
              select: { tracks: true }
            }
          }
        },
        subOrders: {
          include: {
            items: {
              include: {
                storyContainedInBook: true,
                containedStories: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Sync sub-order items for all parent orders (ensure consistency)
    for (const order of customOrders) {
      if (order.subOrders.length > 0) {
        await subOrderService.syncSubOrderItems(order.id);
      }
      
      // Transform custom playlist to include trackCount
      if (order.customPlaylist) {
        order.customPlaylist.trackCount = order.customPlaylist._count?.tracks || 0;
      }
    }
    
    res.json(customOrders);
  } catch (error) {
    console.error('Error fetching custom orders:', error);
    res.status(500).json({ error: 'Failed to fetch custom orders' });
  }
});

// Create a new custom order
app.post('/api/custom-orders', async (req, res) => {
  try {
    const { name, description, icon, parentOrderId, playlistRatingKey, customPlaylistId } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Custom order name is required' });
    }
    
    // Validate parent order exists if specified
    if (parentOrderId) {
      const parentOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(parentOrderId) }
      });
      if (!parentOrder) {
        return res.status(400).json({ error: 'Parent custom order not found' });
      }
    }
    
    // Validate playlist exists if specified
    if (playlistRatingKey) {
      const playlist = await prisma.plexPlaylist.findUnique({
        where: { ratingKey: playlistRatingKey }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Plex playlist not found' });
      }
    }
    
    if (customPlaylistId) {
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: parseInt(customPlaylistId) }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Custom playlist not found' });
      }
    }
    
    const customOrder = await prisma.customOrder.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        parentOrderId: parentOrderId ? parseInt(parentOrderId) : null,
        playlistRatingKey: playlistRatingKey?.trim() || null,
        customPlaylistId: customPlaylistId ? parseInt(customPlaylistId) : null
      },
      include: {
        parentOrder: true,
        subOrders: true,
        plexPlaylist: true,
        customPlaylist: true
      }
    });
    
    // If this order has a parent, create a sub-order item in the parent
    if (parentOrderId) {
      await subOrderService.createSubOrderItems(customOrder.id, parseInt(parentOrderId));
    }
    
    res.status(201).json(customOrder);
  } catch (error) {
    console.error('Error creating custom order:', error);
    res.status(500).json({ error: 'Failed to create custom order' });
  }
});

// Get available playlists for linking to custom orders
app.get('/api/playlists/available', async (req, res) => {
  try {
    const [plexPlaylists, customPlaylists] = await Promise.all([
      prisma.plexPlaylist.findMany({
        select: {
          ratingKey: true,
          title: true,
          playlistType: true,
          leafCount: true,
          duration: true
        },
        orderBy: { title: 'asc' }
      }),
      prisma.customPlaylist.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          isPublic: true,
          createdBy: true,
          _count: {
            select: { tracks: true }
          }
        },
        orderBy: { title: 'asc' }
      })
    ]);

    res.json({
      plexPlaylists,
      customPlaylists: customPlaylists.map(playlist => ({
        ...playlist,
        trackCount: playlist._count.tracks
      }))
    });
  } catch (error) {
    console.error('Error fetching available playlists:', error);
    res.status(500).json({ error: 'Failed to fetch available playlists' });
  }
});

// Get count of custom orders (must come before :id route)
app.get('/api/custom-orders/count', async (req, res) => {
  try {
    const count = await prisma.customOrder.count();
    res.json({ count });
  } catch (error) {
    console.error('Error counting custom orders:', error);
    res.status(500).json({ error: 'Failed to count custom orders' });
  }
});

// Get available parent orders (excluding sub-orders and the specified order itself)
app.get('/api/custom-orders/available-parents/:excludeId?', async (req, res) => {
  try {
    const { excludeId } = req.params;
    
    const whereCondition = {
      parentOrderId: null // Only top-level orders can be parents
    };
    
    // Exclude the specified order if provided (prevent self-reference)
    if (excludeId) {
      whereCondition.id = { not: parseInt(excludeId) };
    }
    
    const availableParents = await prisma.customOrder.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(availableParents);
  } catch (error) {
    console.error('Error fetching available parent orders:', error);
    res.status(500).json({ error: 'Failed to fetch available parent orders' });
  }
});

// Get a specific custom order
app.get('/api/custom-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customOrder = await prisma.customOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        plexPlaylist: true,
        customPlaylist: true
      }
    });
    
    if (!customOrder) {
      return res.status(404).json({ error: 'Custom order not found' });
    }
    
    // Sync sub-order items if this is a parent order
    const hasSubOrders = await prisma.customOrder.count({
      where: { parentOrderId: parseInt(id) }
    });
    
    if (hasSubOrders > 0) {
      await subOrderService.syncSubOrderItems(parseInt(id));
      
      // Re-fetch the order with updated sub-order items
      const updatedOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: {
              storyContainedInBook: true,
              containedStories: true,
              referencedCustomOrder: true
            },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      
      res.json(updatedOrder);
    } else {
      res.json(customOrder);
    }
  } catch (error) {
    console.error('Error fetching custom order:', error);
    res.status(500).json({ error: 'Failed to fetch custom order' });
  }
});

// Update a custom order
app.put('/api/custom-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, icon, parentOrderId, playlistRatingKey, customPlaylistId } = req.body;
    
    // Get current order to check for parent changes
    const currentOrder = await prisma.customOrder.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentOrder) {
      return res.status(404).json({ error: 'Custom order not found' });
    }
    
    // Validate parent order exists if specified
    if (parentOrderId !== undefined && parentOrderId !== null) {
      // Prevent circular references
      if (parseInt(parentOrderId) === parseInt(id)) {
        return res.status(400).json({ error: 'A custom order cannot be its own parent' });
      }
      
      const parentOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(parentOrderId) }
      });
      if (!parentOrder) {
        return res.status(400).json({ error: 'Parent custom order not found' });
      }
      
      // Check for circular reference (if parent has this order as its parent)
      if (parentOrder.parentOrderId === parseInt(id)) {
        return res.status(400).json({ error: 'Cannot create circular parent-child relationship' });
      }
    }
    
    // Validate playlist exists if specified
    if (playlistRatingKey !== undefined && playlistRatingKey !== null) {
      const playlist = await prisma.plexPlaylist.findUnique({
        where: { ratingKey: playlistRatingKey }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Plex playlist not found' });
      }
    }
    
    if (customPlaylistId !== undefined && customPlaylistId !== null) {
      const playlist = await prisma.customPlaylist.findUnique({
        where: { id: parseInt(customPlaylistId) }
      });
      if (!playlist) {
        return res.status(400).json({ error: 'Custom playlist not found' });
      }
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (icon !== undefined) updateData.icon = icon?.trim() || null;
    if (parentOrderId !== undefined) updateData.parentOrderId = parentOrderId ? parseInt(parentOrderId) : null;
    if (playlistRatingKey !== undefined) updateData.playlistRatingKey = playlistRatingKey?.trim() || null;
    if (customPlaylistId !== undefined) updateData.customPlaylistId = customPlaylistId ? parseInt(customPlaylistId) : null;

    const customOrder = await prisma.customOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          include: {
            storyContainedInBook: true,
            containedStories: true,
            referencedCustomOrder: true // Include referenced custom order for sub-order items
          },
          orderBy: { sortOrder: 'asc' }
        },
        parentOrder: true,
        plexPlaylist: true,
        customPlaylist: true,
        subOrders: {
          include: {
            items: {
              include: {
                storyContainedInBook: true,
                containedStories: true
              },
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      }
    });
    
    // Handle parent order changes
    const oldParentId = currentOrder.parentOrderId;
    const newParentId = parentOrderId !== undefined ? (parentOrderId ? parseInt(parentOrderId) : null) : oldParentId;
    
    if (oldParentId !== newParentId) {
      // Remove from old parent if it had one
      if (oldParentId) {
        await subOrderService.removeSubOrderItems(parseInt(id));
      }
      
      // Add to new parent if it has one
      if (newParentId) {
        await subOrderService.createSubOrderItems(parseInt(id), newParentId);
      }
    } else if (newParentId) {
      // If parent didn't change but we have a parent, update the sub-order item
      await subOrderService.updateSubOrderItems(parseInt(id));
    }
    
    res.json(customOrder);
  } catch (error) {
    console.error('Error updating custom order:', error);
    res.status(500).json({ error: 'Failed to update custom order' });
  }
});

// Delete a custom order
app.delete('/api/custom-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Remove any sub-order items that reference this order
    await subOrderService.removeSubOrderItems(parseInt(id));
    
    await prisma.customOrder.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Custom order deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom order:', error);
    res.status(500).json({ error: 'Failed to delete custom order' });
  }
});

// Add item to custom order
app.post('/api/custom-orders/:id/items', async (req, res) => {
  try {
    const { id } = req.params;    const {
      mediaType,
      plexKey,
      title,
      seasonNumber,
      episodeNumber,
      seriesTitle,      comicSeries,
      comicYear,
      comicIssue,
      comicVolume,
      comicPublisher,
      customTitle,
      comicVineId,
      comicVineDetailsJson,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount,
      storyTitle,
      storyAuthor,
      storyYear,
      storyUrl,
      storyContainedInBookId,
      storyCoverUrl,
      webTitle,
      webUrl,
      webDescription
    } = req.body;

    console.log(mediaType)
    
    if (!mediaType || !title) {
      return res.status(400).json({ error: 'mediaType and title are required' });
    }      // Validate media-specific requirements
    if (mediaType === 'comic') {
      if (!comicSeries || !comicIssue) {
        return res.status(400).json({ error: 'For comics: comicSeries and comicIssue are required' });
      }
    } else if (mediaType === 'book') {
      if (!bookTitle || !bookAuthor) {
        return res.status(400).json({ error: 'For books: bookTitle and bookAuthor are required' });
      }    } else if (mediaType === 'shortstory') {
        console.log(req.body)
      if (!storyTitle) {
        return res.status(400).json({ error: 'For short stories: storyTitle is required' });
      }
    } else if (mediaType === 'webvideo') {
      if (!webTitle || !webUrl) {
        return res.status(400).json({ error: 'For web videos: webTitle and webUrl are required' });
      }
      // Validate URL format
      try {
        new URL(webUrl);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid webUrl format' });
      }
    } else if (mediaType === 'episode') {
      // For TV episodes, either plexKey OR (seriesTitle + seasonNumber + episodeNumber) required
      if (!plexKey && (!seriesTitle || seasonNumber === undefined || episodeNumber === undefined)) {
        return res.status(400).json({ 
          error: 'For episodes: either plexKey (for existing Plex episodes) OR seriesTitle, seasonNumber, and episodeNumber (for episodes not yet in Plex) are required' 
        });
      }
    } else if (mediaType === 'movie') {
      // For movies, either plexKey OR title is required (title alone allows for movies not yet in Plex)
      if (!plexKey && !title) {
        return res.status(400).json({ 
          error: 'For movies: either plexKey (for existing Plex movies) OR title (for movies not yet in Plex) is required' 
        });
      }
    } else {
      // For other media types, plexKey is still required
      if (!plexKey) {
        return res.status(400).json({ error: 'plexKey is required for this media type' });
      }
    }// Check for duplicate items
    let existingItem;    if (mediaType === 'comic') {
      // For comics, check for duplicates by series, year, issue, and main title
      // This allows the same comic to be added multiple times with different titles
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'comic',
          comicSeries: comicSeries,
          comicYear: comicYear ? parseInt(comicYear) : null,
          comicIssue: String(comicIssue),
          title: title // Use main title instead of customTitle for duplicate checking
        }
      });} else if (mediaType === 'book') {
      // For books, check for duplicates by title and author
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'book',
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          bookYear: bookYear ? parseInt(bookYear) : null
        }
      });} else if (mediaType === 'shortstory') {      // For short stories, check for duplicates by title, author (if provided), and year
      const whereCondition = {
        customOrderId: parseInt(id),
        mediaType: 'shortstory',
        storyTitle: storyTitle,
        storyYear: storyYear ? parseInt(storyYear) : null
      };
      
      // Only include author in the check if it's provided
      if (storyAuthor) {
        whereCondition.storyAuthor = storyAuthor;
      } else {
        whereCondition.storyAuthor = null;
      }
        existingItem = await prisma.customOrderItem.findFirst({
        where: whereCondition
      });
    } else if (mediaType === 'webvideo') {
      // For web videos, check for duplicates by URL (primary identifier)
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'webvideo',
          webUrl: webUrl
        }
      });
    } else if (mediaType === 'episode' && !plexKey) {
      // For episodes not yet in Plex, check by series, season, and episode
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'episode',
          seriesTitle: seriesTitle,
          seasonNumber: seasonNumber,
          episodeNumber: episodeNumber
        }
      });
    } else if (mediaType === 'movie' && !plexKey) {
      // For movies not yet in Plex, check by title and year
      const whereCondition = {
        customOrderId: parseInt(id),
        mediaType: 'movie',
        title: title
      };
      
      if (bookYear) {
        whereCondition.bookYear = parseInt(bookYear);
      }
      
      existingItem = await prisma.customOrderItem.findFirst({
        where: whereCondition
      });
    } else {
      // For other media with plexKey, check by plexKey
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          plexKey: plexKey
        }
      });
    }
    
    if (existingItem) {
      return res.status(409).json({ 
        error: 'This item is already in the custom order',
        existingItem: {
          title: existingItem.title,
          mediaType: existingItem.mediaType
        }
      });
    }
    
    // Get the highest sort order for this custom order
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId: parseInt(id) },
      orderBy: { sortOrder: 'desc' }
    });
    
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;    // Generate a unique plexKey for items without existing Plex keys
    let finalPlexKey;
    if (mediaType === 'comic') {
      finalPlexKey = `comic-${comicSeries}-${comicYear}-${comicIssue}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'book') {
      finalPlexKey = `book-${bookTitle}-${bookAuthor}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'shortstory') {
      const authorPart = storyAuthor ? `-${storyAuthor}` : '';
      finalPlexKey = `shortstory-${storyTitle}${authorPart}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'webvideo') {
      const urlHash = simpleHash(webUrl || ''); // Hash of the URL, ensure webUrl is not null
      const cleanWebTitle = (webTitle || title || 'untitled').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      finalPlexKey = `webvideo-${cleanWebTitle}-${urlHash}`;
      // Truncate if too long, ensuring it fits within typical database limits for such keys
      if (finalPlexKey.length > 250) { 
        finalPlexKey = finalPlexKey.substring(0, 250);
      }
    } else if (mediaType === 'episode' && !plexKey) {
      // Generate key for episodes not yet in Plex
      finalPlexKey = `tvdb-episode-${seriesTitle}-s${seasonNumber}e${episodeNumber}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'movie' && !plexKey) {
      // Generate key for movies not yet in Plex  
      const yearPart = bookYear ? `-${bookYear}` : ''; // Using bookYear as it's the year field available
      finalPlexKey = `tvdb-movie-${title}${yearPart}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else {
      finalPlexKey = plexKey;
    }

    // Handle OpenLibrary integration for books
    let finalBookData = {
      bookTitle,
      bookAuthor,
      bookYear: bookYear ? parseInt(bookYear) : null,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount: bookPageCount ? parseInt(bookPageCount) : null
    };

    if (mediaType === 'book' && bookOpenLibraryId && !bookPageCount) {
      try {
        console.log(`Fetching OpenLibrary details for: ${bookOpenLibraryId}`);
        const bookDetails = await openLibraryService.getBookDetails(bookOpenLibraryId);
        if (bookDetails) {
          // Update book data with OpenLibrary details
          finalBookData.bookPageCount = bookDetails.pageCount || null;
          if (!bookCoverUrl && bookDetails.coverUrl) {
            finalBookData.bookCoverUrl = bookDetails.coverUrl;
          }
          console.log(`Enhanced book with OpenLibrary data: pages=${bookDetails.pageCount}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch OpenLibrary details for ${bookOpenLibraryId}:`, error.message);
        // Continue without OpenLibrary data
      }
    }
    
    // Handle Comic Search Integration (Komga first, then ComicVine)
    let comicSearchResult = null;
    let enhancedComicData = {};
    
    // Enhanced comic processing - ComicVine first, then Komga enhancement
    let comicVineExtractedData = {};
    let komgaEnhancementData = {};
    
    if (mediaType === 'comic') {
      // First, handle ComicVine data extraction if provided
      if (comicVineDetailsJson) {
        try {
          console.log(`\n🔍 Processing ComicVine data for: "${comicSeries}" #${comicIssue}`);
          const comicVineData = JSON.parse(comicVineDetailsJson);
          
          // Extract data from ComicVine
          comicVineExtractedData = {
            comicVineId: comicVineData.issue?.id || null,
            comicYear: comicVineData.issue?.cover_date ? new Date(comicVineData.issue.cover_date).getFullYear() : (comicYear ? parseInt(comicYear) : null),
            comicPublisher: comicVineData.series?.publisher?.name || comicPublisher,
            // Add any other ComicVine extracted fields as needed
          };
          
          console.log('✅ ComicVine data extracted successfully');
        } catch (error) {
          console.error('Error parsing ComicVine data:', error);
        }
      }
      
      // Then, search Komga for the same comic to enhance with Komga data
      try {
        console.log(`\n🔍 Searching Komga for enhancement: "${comicSeries}" #${comicIssue}` + (comicYear ? ` (${comicYear})` : ''));
        const komgaService = require('./komgaService');
        const komgaResult = await komgaService.searchComic(comicSeries, comicIssue, comicYear);
        
        if (komgaResult) {
          console.log('✅ Found matching comic in Komga - adding Komga URLs');
          komgaEnhancementData = {
            komgaSeriesId: komgaResult.series.id,
            komgaBookId: komgaResult.book.id,
            komgaUrl: komgaResult.komgaUrl,
            komgaSeriesUrl: komgaResult.komgaSeriesUrl,
            komgaMetadata: JSON.stringify(komgaResult.metadata)
          };
        } else {
          console.log('ℹ️  Comic not found in Komga - will use ComicVine data only');
        }
      } catch (error) {
        console.error('Error searching Komga for enhancement:', error);
        // Continue without Komga enhancement if search fails
      }
    }

    // Handle ComicVine data extraction for comics
    if (mediaType === 'comic' && comicVineDetailsJson) {
      try {
        const comicVineData = JSON.parse(comicVineDetailsJson);
        
        // Extract comprehensive data from either the new format or legacy format
        if (comicVineData.comprehensiveData) {
          // New comprehensive format
          const data = comicVineData.comprehensiveData;
          comicVineExtractedData = {
            comicVineSeriesId: data.series?.id || null,
            comicVineIssueId: data.issue?.id || null,
            comicIssueName: data.issue?.name || null,
            comicDescription: data.issue?.description || data.series?.description || null,
            comicCoverDate: data.issue?.cover_date || null,
            comicStoreDate: data.issue?.store_date || null,
            comicCreators: data.issue?.person_credits ? JSON.stringify(data.issue.person_credits) : null,
            comicCharacters: data.issue?.character_credits ? JSON.stringify(data.issue.character_credits) : null,
            comicStoryArcs: data.issue?.story_arc_credits ? JSON.stringify(data.issue.story_arc_credits) : null
          };
        } else if (comicVineData.series && comicVineData.issue) {
          // Current format - direct series and issue objects
          comicVineExtractedData = {
            comicVineSeriesId: comicVineData.series?.id || null,
            comicVineIssueId: comicVineData.issue?.id || null,
            comicIssueName: comicVineData.issue?.name || null,
            comicDescription: comicVineData.issue?.description || comicVineData.series?.description || null,
            comicCoverDate: comicVineData.issue?.cover_date || null,
            comicStoreDate: comicVineData.issue?.store_date || null,
            comicCreators: comicVineData.issue?.person_credits ? JSON.stringify(comicVineData.issue.person_credits) : null,
            comicCharacters: comicVineData.issue?.character_credits ? JSON.stringify(comicVineData.issue.character_credits) : null,
            comicStoryArcs: comicVineData.issue?.story_arc_credits ? JSON.stringify(comicVineData.issue.story_arc_credits) : null
          };
        } else {
          // Legacy format - extract what we can from the series data
          comicVineExtractedData = {
            comicVineSeriesId: comicVineData.id || null,
            comicVineIssueId: comicVineData.issueId || null,
            comicIssueName: comicVineData.issueName || null,
            comicDescription: comicVineData.issue_description || comicVineData.description || null,
            comicCoverDate: comicVineData.issue_cover_date || null,
            comicStoreDate: comicVineData.issue_store_date || null,
            comicCreators: comicVineData.person_credits ? JSON.stringify(comicVineData.person_credits) : null,
            comicCharacters: comicVineData.character_credits ? JSON.stringify(comicVineData.character_credits) : null,
            comicStoryArcs: comicVineData.story_arc_credits ? JSON.stringify(comicVineData.story_arc_credits) : null
          };
        }
        
        console.log('Extracted ComicVine data:', comicVineExtractedData);
      } catch (error) {
        console.warn('Failed to parse ComicVine details JSON:', error);
        comicVineExtractedData = {};
      }
    }

    const item = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType,
        plexKey: finalPlexKey,
        title,
        seasonNumber,
        episodeNumber,
        seriesTitle,
        comicSeries,
        comicYear: comicYear ? parseInt(comicYear) : null,
        comicIssue: mediaType === 'comic' ? String(comicIssue) : null,
        comicVolume,
        comicPublisher,
        customTitle,
        comicVineId,
        comicVineDetailsJson,
        // Add the new comprehensive ComicVine fields
        ...comicVineExtractedData,
        bookTitle: finalBookData.bookTitle,
        bookAuthor: finalBookData.bookAuthor,
        bookYear: finalBookData.bookYear,
        bookIsbn: finalBookData.bookIsbn,
        bookPublisher: finalBookData.bookPublisher,
        bookOpenLibraryId: finalBookData.bookOpenLibraryId,
        bookCoverUrl: finalBookData.bookCoverUrl,
        bookPageCount: finalBookData.bookPageCount,
        storyTitle,
        storyAuthor,
        storyYear: storyYear ? parseInt(storyYear) : null,
        storyUrl,
        storyContainedInBookId,
        storyCoverUrl,
        webTitle,
        webUrl,
        webDescription,
        sortOrder: nextSortOrder,
        // Add Komga enhancement fields if found in Komga
        ...komgaEnhancementData,
        // Mark as TVDB-only if no plexKey was provided for episodes/movies
        isFromTvdbOnly: (mediaType === 'episode' || mediaType === 'movie') && !plexKey
      }
    });

    // Fetch TVDB metadata for non-Plex items
    if ((mediaType === 'episode' || mediaType === 'movie') && !plexKey) {
      try {
        console.log(`Fetching TVDB metadata for ${mediaType}: ${title || seriesTitle}`);
        
        if (mediaType === 'episode' && seriesTitle) {
          // Search for the series and get episode details
          const seriesResults = await TVDBService.searchSeries(seriesTitle);
          if (seriesResults && seriesResults.length > 0) {
            const bestMatch = seriesResults[0]; // Take the first/best match
            console.log(`Found TVDB series: ${bestMatch.name} (ID: ${bestMatch.tvdb_id})`);
            
            // Get series details and find the episode
            const episode = await TVDBService.findEpisodeBySeasonAndNumber(
              bestMatch.tvdb_id, 
              seasonNumber, 
              episodeNumber
            );
            
            if (episode) {
              console.log(`Found TVDB episode: ${episode.name}, but keeping bulk import title: ${title}`);
              // Update the item with TVDB metadata but preserve bulk import title
              await prisma.customOrderItem.update({
                where: { id: item.id },
                data: {
                  // Keep the title from bulk import data, don't overwrite with TVDB episode name
                  // Store other TVDB metadata fields if needed
                  tvdbId: episode.id?.toString(),
                  tvdbOverview: episode.overview,
                  // You can add more fields here like genres, air date, etc.
                }
              });
            }
          }
        } else if (mediaType === 'movie' && title) {
          // Search for the movie
          const movieResults = await TVDBService.searchMovies(title);
          if (movieResults && movieResults.length > 0) {
            const bestMatch = movieResults[0]; // Take the first/best match
            console.log(`Found TVDB movie: ${bestMatch.name} (ID: ${bestMatch.tvdb_id})`);
            
            // Get movie details
            const movieDetails = await TVDBService.getMovieDetails(bestMatch.tvdb_id);
            if (movieDetails) {
              console.log(`Got TVDB movie details: ${movieDetails.name}`);
              // Update the item with TVDB metadata
              await prisma.customOrderItem.update({
                where: { id: item.id },
                data: {
                  title: movieDetails.name || title,
                  // You can add more fields here like overview, release date, etc.
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch TVDB metadata for ${mediaType} "${title || seriesTitle}":`, error.message);
        // Don't fail the whole request if TVDB lookup fails
      }
    }
    
    // Try to cache artwork for the new item (async, don't wait for completion)
    artworkCache.ensureArtworkCached(item).catch(error => {
      console.warn(`Failed to cache artwork for item ${item.id}:`, error.message);
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item to custom order:', error);
    res.status(500).json({ error: 'Failed to add item to custom order' });
  }
});

// Add TVDB-only item to custom order (doesn't exist in Plex yet)
app.post('/api/custom-orders/:id/items/tvdb-only', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      mediaType, 
      title, 
      seasonNumber, 
      episodeNumber, 
      seriesTitle,
      tvdbSeriesId,
      tvdbSeasonId,
      tvdbEpisodeId,
      description,
      airDate,
      // Movie fields
      year,
      movieTvdbId
    } = req.body;

    console.log(`Adding TVDB-only ${mediaType} to custom order ${id}:`, { title, seriesTitle, seasonNumber, episodeNumber });

    // Validate required fields
    if (!mediaType || !title) {
      return res.status(400).json({ error: 'mediaType and title are required' });
    }

    if (mediaType === 'episode' && (!seriesTitle || !seasonNumber || !episodeNumber)) {
      return res.status(400).json({ error: 'seriesTitle, seasonNumber, and episodeNumber are required for episodes' });
    }

    if (mediaType === 'movie' && !year) {
      return res.status(400).json({ error: 'year is required for movies' });
    }

    // Generate a unique plexKey for the TVDB item
    let finalPlexKey;
    if (mediaType === 'episode') {
      finalPlexKey = `tvdb-episode-${seriesTitle}-s${seasonNumber}e${episodeNumber}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'movie') {
      finalPlexKey = `tvdb-movie-${title}-${year}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    }

    // Check if this TVDB item already exists in the custom order
    const existingItem = await prisma.customOrderItem.findFirst({
      where: {
        customOrderId: parseInt(id),
        plexKey: finalPlexKey
      }
    });

    if (existingItem) {
      return res.status(409).json({ 
        error: 'This TVDB item is already in the custom order',
        existingItem: {
          title: existingItem.title,
          mediaType: existingItem.mediaType
        }
      });
    }

    // Get the highest sort order for this custom order
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId: parseInt(id) },
      orderBy: { sortOrder: 'desc' }
    });

    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;

    // Create the TVDB-only item
    const item = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType,
        plexKey: finalPlexKey,
        title,
        seasonNumber,
        episodeNumber,
        seriesTitle,
        sortOrder: nextSortOrder,
        isFromTvdbOnly: true, // Mark as TVDB-only
        // Store TVDB IDs and metadata in custom fields for now
        customTitle: description || title,
        // For episodes, we'll store TVDB data in unused fields temporarily
        comicSeries: tvdbSeriesId ? `tvdb-series-${tvdbSeriesId}` : null,
        comicVolume: tvdbSeasonId ? `tvdb-season-${tvdbSeasonId}` : null,
        comicIssue: tvdbEpisodeId ? `tvdb-episode-${tvdbEpisodeId}` : null,
        // For movies
        bookTitle: mediaType === 'movie' ? title : null,
        bookYear: mediaType === 'movie' ? parseInt(year) : null,
        bookIsbn: movieTvdbId ? `tvdb-movie-${movieTvdbId}` : null,
        // Store air date if provided
        storyYear: airDate ? new Date(airDate).getFullYear() : null
      }
    });

    console.log(`Successfully added TVDB-only ${mediaType}: ${title}`);
    res.status(201).json(item);

  } catch (error) {
    console.error('Error adding TVDB-only item to custom order:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove item from custom order
app.delete('/api/custom-orders/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Clean up cached artwork for this item
    await artworkCache.cleanupArtwork(parseInt(itemId));
    
    await prisma.customOrderItem.delete({
      where: { id: parseInt(itemId) }
    });
    res.json({ message: 'Item removed from custom order successfully' });
  } catch (error) {
    console.error('Error removing item from custom order:', error);
    res.status(500).json({ error: 'Failed to remove item from custom order' });
  }
});

// Update item order in custom order
app.put('/api/custom-orders/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const { 
      sortOrder, 
      isWatched, 
      title,
      seriesTitle, // For episodes
      // Book fields
      bookTitle, bookAuthor, bookYear, bookIsbn, bookPublisher, bookOpenLibraryId, bookCoverUrl, bookPageCount,
      // Comic fields
      comicSeries, comicYear, comicIssue, comicVolume, comicPublisher, customTitle, comicVineId, comicVineDetailsJson, comicCoverUrl,
      // Story fields
      storyTitle, storyAuthor, storyYear, storyUrl, storyContainedInBookId, storyCoverUrl
    } = req.body;

    console.log('Backend PUT received for itemId:', itemId);
    console.log('Received comicCoverUrl:', comicCoverUrl);
    console.log('Full request body:', req.body);

    // Check if this is a book re-selection (book-specific fields are being updated)
    const isBookReselect = (
      bookTitle !== undefined || 
      bookAuthor !== undefined || 
      bookYear !== undefined || 
      bookIsbn !== undefined || 
      bookPublisher !== undefined || 
      bookOpenLibraryId !== undefined || 
      bookPageCount !== undefined || 
      bookCoverUrl !== undefined
    );    // Check if this is a comic re-selection (comic-specific fields are being updated)
    const isComicReselect = (
      comicSeries !== undefined || 
      comicYear !== undefined || 
      comicIssue !== undefined || 
      comicVolume !== undefined ||
      comicPublisher !== undefined ||
      customTitle !== undefined ||
      comicVineId !== undefined ||
      comicVineDetailsJson !== undefined ||
      comicCoverUrl !== undefined
    );
    
    // Check if this is a short story re-selection (story-specific fields are being updated)
    const isStoryReselect = (
      storyTitle !== undefined || 
      storyAuthor !== undefined || 
      storyYear !== undefined || 
      storyUrl !== undefined || 
      storyContainedInBookId !== undefined || 
      storyCoverUrl !== undefined
    );const updateData = {};
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isWatched !== undefined) updateData.isWatched = isWatched;
    
    // If marking a book, comic, or short story as watched, set completion to 100%
    if (isWatched === true) {
      const item = await prisma.customOrderItem.findUnique({
        where: { id: parseInt(itemId) }
      });
      
      if (item && (item.mediaType === 'book' || item.mediaType === 'comic' || item.mediaType === 'shortstory')) {
        updateData.bookPercentRead = 100;
        
        // If we have page count but no current page, set current page to total pages
        if (item.bookPageCount && !item.bookCurrentPage) {
          updateData.bookCurrentPage = item.bookPageCount;
        }
        
        console.log(`Setting ${item.mediaType} "${item.title}" to 100% completed`);
      }
    }
    
    // Handle general data updates
    if (title !== undefined) updateData.title = title;
    if (seriesTitle !== undefined) updateData.seriesTitle = seriesTitle;
    
    // Handle book data updates for re-select functionality
    if (isBookReselect) { 
        if (bookTitle !== undefined) updateData.bookTitle = bookTitle;
        if (bookAuthor !== undefined) updateData.bookAuthor = bookAuthor;
        if (bookYear !== undefined) updateData.bookYear = bookYear;
        if (bookIsbn !== undefined) updateData.bookIsbn = bookIsbn;
        if (bookPublisher !== undefined) updateData.bookPublisher = bookPublisher;
        if (bookOpenLibraryId !== undefined) updateData.bookOpenLibraryId = bookOpenLibraryId;
        if (bookPageCount !== undefined) updateData.bookPageCount = bookPageCount ? parseInt(bookPageCount) : null;
        // Use new bookCoverUrl if provided, otherwise nullify to allow re-caching logic to take over
        updateData.bookCoverUrl = bookCoverUrl !== undefined ? bookCoverUrl : null;
        
        // Clear artwork fields for re-caching if a book is reselected
        updateData.localArtworkPath = null;
        updateData.originalArtworkUrl = bookCoverUrl !== undefined ? bookCoverUrl : null; 
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }    // Handle comic data updates
    if (isComicReselect) { 
        console.log('Processing comic re-selection...');
        if (comicSeries !== undefined) updateData.comicSeries = comicSeries;
        if (comicYear !== undefined) updateData.comicYear = comicYear;
        if (comicIssue !== undefined) updateData.comicIssue = String(comicIssue); // Ensure string
        if (comicVolume !== undefined) updateData.comicVolume = comicVolume;
        if (comicPublisher !== undefined) updateData.comicPublisher = comicPublisher;
        if (customTitle !== undefined) updateData.customTitle = customTitle;
        if (comicVineId !== undefined) updateData.comicVineId = comicVineId;
        if (comicVineDetailsJson !== undefined) updateData.comicVineDetailsJson = comicVineDetailsJson;

        // Extract and store comprehensive ComicVine data if provided
        if (comicVineDetailsJson !== undefined) {
          try {
            const comicVineData = JSON.parse(comicVineDetailsJson);
            
            // Extract comprehensive data from either the new format or legacy format
            if (comicVineData.comprehensiveData) {
              // New comprehensive format
              const data = comicVineData.comprehensiveData;
              updateData.comicVineSeriesId = data.series?.id || null;
              updateData.comicVineIssueId = data.issue?.id || null;
              updateData.comicIssueName = data.issue?.name || null;
              updateData.comicDescription = data.issue?.description || data.series?.description || null;
              updateData.comicCoverDate = data.issue?.cover_date || null;
              updateData.comicStoreDate = data.issue?.store_date || null;
              updateData.comicCreators = data.issue?.person_credits ? JSON.stringify(data.issue.person_credits) : null;
              updateData.comicCharacters = data.issue?.character_credits ? JSON.stringify(data.issue.character_credits) : null;
              updateData.comicStoryArcs = data.issue?.story_arc_credits ? JSON.stringify(data.issue.story_arc_credits) : null;
            } else if (comicVineData.series && comicVineData.issue) {
              // Current format - direct series and issue objects
              updateData.comicVineSeriesId = comicVineData.series?.id || null;
              updateData.comicVineIssueId = comicVineData.issue?.id || null;
              updateData.comicIssueName = comicVineData.issue?.name || null;
              updateData.comicDescription = comicVineData.issue?.description || comicVineData.series?.description || null;
              updateData.comicCoverDate = comicVineData.issue?.cover_date || null;
              updateData.comicStoreDate = comicVineData.issue?.store_date || null;
              updateData.comicCreators = comicVineData.issue?.person_credits ? JSON.stringify(comicVineData.issue.person_credits) : null;
              updateData.comicCharacters = comicVineData.issue?.character_credits ? JSON.stringify(comicVineData.issue.character_credits) : null;
              updateData.comicStoryArcs = comicVineData.issue?.story_arc_credits ? JSON.stringify(comicVineData.issue.story_arc_credits) : null;
            } else {
              // Legacy format - extract what we can from the series data
              updateData.comicVineSeriesId = comicVineData.id || null;
              updateData.comicVineIssueId = comicVineData.issueId || null;
              updateData.comicIssueName = comicVineData.issueName || null;
              updateData.comicDescription = comicVineData.issue_description || comicVineData.description || null;
              updateData.comicCoverDate = comicVineData.issue_cover_date || null;
              updateData.comicStoreDate = comicVineData.issue_store_date || null;
              updateData.comicCreators = comicVineData.person_credits ? JSON.stringify(comicVineData.person_credits) : null;
              updateData.comicCharacters = comicVineData.character_credits ? JSON.stringify(comicVineData.character_credits) : null;
              updateData.comicStoryArcs = comicVineData.story_arc_credits ? JSON.stringify(comicVineData.story_arc_credits) : null;
            }
            
            console.log('Extracted ComicVine data for update:', {
              comicVineSeriesId: updateData.comicVineSeriesId,
              comicVineIssueId: updateData.comicVineIssueId,
              comicIssueName: updateData.comicIssueName
            });
          } catch (error) {
            console.warn('Failed to parse ComicVine details JSON during update:', error);
          }
        }

        // Use the specific cover URL from the selected comic if provided, otherwise let the system derive it
        updateData.originalArtworkUrl = comicCoverUrl !== undefined ? comicCoverUrl : null;
        console.log('Setting originalArtworkUrl to:', updateData.originalArtworkUrl);
        
        // Clear old artwork details to force re-caching with the new artwork URL
        updateData.localArtworkPath = null;
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }
    
    // Handle short story data updates
    if (isStoryReselect) { 
        if (storyTitle !== undefined) updateData.storyTitle = storyTitle;
        if (storyAuthor !== undefined) updateData.storyAuthor = storyAuthor;
        if (storyYear !== undefined) updateData.storyYear = storyYear;
        if (storyUrl !== undefined) updateData.storyUrl = storyUrl;
        if (storyContainedInBookId !== undefined) updateData.storyContainedInBookId = storyContainedInBookId;
        // Use new storyCoverUrl if provided, otherwise nullify
        updateData.storyCoverUrl = storyCoverUrl !== undefined ? storyCoverUrl : null;

        // Clear artwork fields for re-caching
        updateData.localArtworkPath = null;
        updateData.originalArtworkUrl = storyCoverUrl !== undefined ? storyCoverUrl : null; 
        updateData.artworkLastCached = null;
        updateData.artworkMimeType = null;
    }

    // If this is a book re-selection, clear existing cached artwork file (DB fields cleared above)
    if (isBookReselect) {
      console.log(`Re-selecting book for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
      // If this is a comic re-selection, clear existing cached artwork
    if (isComicReselect) {
      console.log(`Re-selecting comic for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    // If this is a short story re-selection, clear existing cached artwork
    if (isStoryReselect) {
      console.log(`Re-selecting short story for item ${itemId}, clearing cached artwork...`);
      await artworkCache.cleanupArtwork(parseInt(itemId));
    }
    
    const item = await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: updateData,
      include: {
        storyContainedInBook: true,
        referencedCustomOrder: {
          include: { items: true }
        }
      }
    });

    // Log watched activity for TV and movie content
    if (isWatched !== undefined && isWatched === true && (item.mediaType === 'tv' || item.mediaType === 'movie')) {
      try {
        const watchLogData = {
          mediaType: item.mediaType,
          title: item.title,
          customOrderItemId: item.id,
          plexKey: item.plexKey
        };

        // Add episode-specific data for TV content
        if (item.mediaType === 'tv') {
          watchLogData.seriesTitle = item.seriesTitle;
          watchLogData.seasonNumber = item.seasonNumber;
          watchLogData.episodeNumber = item.episodeNumber;
        }

        // Try to get duration from Plex data if available
        if (item.plexKey) {
          try {
            // Attempt to get duration from Plex database
            let plexItem = null;
            if (item.mediaType === 'tv') {
              plexItem = await prisma.plexTVEpisode.findFirst({
                where: { ratingKey: item.plexKey }
              });
            } else if (item.mediaType === 'movie') {
              plexItem = await prisma.plexMovie.findFirst({
                where: { ratingKey: item.plexKey }
              });
            }
            
            if (plexItem && plexItem.duration) {
              // Convert from milliseconds to minutes
              watchLogData.duration = Math.round(plexItem.duration / (1000 * 60));
            }
          } catch (plexError) {
            console.warn('Could not retrieve duration from Plex data:', plexError.message);
          }
        }

        // Set default duration if not found
        if (!watchLogData.duration) {
          watchLogData.duration = item.mediaType === 'movie' ? 120 : 45; // Default: 2h for movies, 45min for TV
        }

        await watchLogService.logWatched(watchLogData);
        console.log(`Logged watch activity for ${item.mediaType}: ${item.title}`);
      } catch (watchLogError) {
        console.warn('Failed to log watch activity:', watchLogError.message);
        // Don't fail the whole request if watch logging fails
      }
    }
    
    // If this is a sub-order and it's being marked as watched/unwatched, 
    // check if we need to update all items in the sub-order
    if (item.mediaType === 'suborder' && (isWatched !== undefined)) {
      if (isWatched && item.referencedCustomOrder) {
        // Mark all items in the sub-order as watched
        await prisma.customOrderItem.updateMany({
          where: {
            customOrderId: item.referencedCustomOrder.id,
            isWatched: false
          },
          data: { isWatched: true }
        });
        console.log(`Marked all items in sub-order "${item.referencedCustomOrder.name}" as watched`);
      }
    }
    
    // If this is a regular item in a sub-order and it's being marked as watched,
    // check if all items in the sub-order are now watched and update the parent sub-order item
    if (item.mediaType !== 'suborder' && isWatched !== undefined) {
      const customOrder = await prisma.customOrder.findUnique({
        where: { id: item.customOrderId },
        include: { items: true, parentOrder: true }
      });
      
      if (customOrder && customOrder.parentOrderId) {
        // This is a sub-order, check if it's fully watched and update the parent's sub-order item
        const isFullyWatched = subOrderService.isSubOrderFullyWatched(customOrder);
        
        await prisma.customOrderItem.updateMany({
          where: {
            mediaType: 'suborder',
            referencedCustomOrderId: customOrder.id
          },
          data: { isWatched: isFullyWatched }
        });
        
        console.log(`Updated sub-order item for "${customOrder.name}" - watched: ${isFullyWatched}`);
      }
    }
      // If this is a book re-selection, cache new artwork in background
    if (isBookReselect) {
      console.log(`Re-caching artwork for re-selected book: ${item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected book ${item.id}:`, error.message);
      });
    }
      // If this is a comic re-selection, cache new artwork in background
    if (isComicReselect) {
      console.log(`Re-caching artwork for re-selected comic: ${item.title || item.comicSeries + ' #' + item.comicIssue}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected comic ${item.id}:`, error.message);
      });
    }
    
    // If this is a short story re-selection, cache new artwork in background
    if (isStoryReselect) {
      console.log(`Re-caching artwork for re-selected short story: ${item.storyTitle || item.title}`);
      artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for re-selected short story ${item.id}:`, error.message);
      });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error updating custom order item:', error);
    res.status(500).json({ error: 'Failed to update custom order item' });
  }
});

// Create a reference book (for containing short stories) without adding to collection order
app.post('/api/books/reference', async (req, res) => {
  try {
    const {
      title,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount,
      customOrderId // Order context is needed due to schema constraints
    } = req.body;

    // Check if this book already exists globally by OpenLibrary ID
    const existingBook = await prisma.customOrderItem.findFirst({
      where: {
        mediaType: 'book',
        bookOpenLibraryId: bookOpenLibraryId
      }
    });

    if (existingBook) {
      return res.json(existingBook);
    }

    // If no customOrderId provided, we can't create the book due to schema constraints
    if (!customOrderId) {
      return res.status(400).json({ error: 'customOrderId is required to create a book' });
    }

    // Generate a unique plexKey for the book (since it's required by schema)
    const bookPlexKey = `book_${bookOpenLibraryId || Date.now()}`;    // Create the book entry in the specified order
    const book = await prisma.customOrderItem.create({
      data: {
        mediaType: 'book',
        plexKey: bookPlexKey,
        title: title,
        bookTitle: bookTitle,
        bookAuthor: bookAuthor,
        bookYear: bookYear,
        bookIsbn: bookIsbn,
        bookPublisher: bookPublisher,
        bookOpenLibraryId: bookOpenLibraryId,
        bookCoverUrl: bookCoverUrl,
        bookPageCount: bookPageCount ? parseInt(bookPageCount) : null,
        sortOrder: 0,
        customOrderId: customOrderId,
        isWatched: true // Reference books are automatically marked as watched
      }
    });

    res.status(201).json(book);
  } catch (error) {
    console.error('Error creating reference book:', error);
    res.status(500).json({ error: 'Failed to create reference book' });  }
});

// Mark custom order item as watched from home page
app.post('/api/mark-custom-order-item-watched/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    // Get the custom order item details first to check what type of media it is
    const customOrderItem = await prisma.customOrderItem.findUnique({
      where: { id: parseInt(itemId) }
    });

    if (!customOrderItem) {
      return res.status(404).json({ error: 'Custom order item not found' });
    }

    // Mark the custom order item as watched
    await markCustomOrderItemAsWatched(itemId);

    // Create a watch log entry for statistics
    let duration = null;
    let mediaType = customOrderItem.mediaType;
    
    // Map custom order media types to watch log media types
    if (customOrderItem.mediaType === 'episode') {
      mediaType = 'tv';
    } else if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
      // For reading media, we don't have duration but we'll log them anyway
      mediaType = customOrderItem.mediaType;
    }

    // Try to get duration from Plex database if available
    if (customOrderItem.plexKey) {
      try {
        if (customOrderItem.mediaType === 'episode') {
          const episodeData = await plexDb.getItemMetadata(customOrderItem.plexKey, 'episode');
          if (episodeData && episodeData.duration) {
            duration = Math.round(episodeData.duration / 60000); // Convert milliseconds to minutes
          }
        } else if (customOrderItem.mediaType === 'movie') {
          const movieData = await plexDb.getMovieByRatingKey(customOrderItem.plexKey);
          if (movieData && movieData.duration) {
            duration = Math.round(movieData.duration / 60000); // Convert milliseconds to minutes
          }
        }
      } catch (error) {
        console.warn('Could not get duration from Plex database:', error.message);
      }
    }

    // For books, comics, and short stories, set completion status to 100%
    if (customOrderItem.mediaType === 'book' || customOrderItem.mediaType === 'comic' || customOrderItem.mediaType === 'shortstory') {
      const updateData = {
        bookPercentRead: 100
      };
      
      // If we have page count but no current page, set current page to total pages
      if (customOrderItem.bookPageCount && !customOrderItem.bookCurrentPage) {
        updateData.bookCurrentPage = customOrderItem.bookPageCount;
      }
      
      await prisma.customOrderItem.update({
        where: { id: parseInt(itemId) },
        data: updateData
      });
      
      console.log(`Set ${customOrderItem.mediaType} "${customOrderItem.title}" to 100% completed`);
    }

    // Create watch log entry
    const watchLogParams = {
      mediaType: mediaType,
      title: customOrderItem.title,
      seriesTitle: customOrderItem.seriesTitle,
      seasonNumber: customOrderItem.seasonNumber,
      episodeNumber: customOrderItem.episodeNumber,
      plexKey: customOrderItem.plexKey,
      customOrderItemId: parseInt(itemId),
      duration: duration,
      activityType: (mediaType === 'book' || mediaType === 'comic' || mediaType === 'shortstory') ? 'read' : 'watch',
      isCompleted: true
    };

    await watchLogService.logWatched(watchLogParams);
    console.log(`Created watch log entry for custom order item ${itemId}`);

    // If this is an episode or movie with a plexKey, also mark it as watched in the Plex database
    if (customOrderItem.plexKey && (customOrderItem.mediaType === 'episode' || customOrderItem.mediaType === 'movie')) {
      try {
        if (customOrderItem.mediaType === 'episode') {
          await plexDb.markEpisodeAsWatched(customOrderItem.plexKey);
          console.log(`Marked episode ${customOrderItem.plexKey} as watched in Plex database`);
        } else if (customOrderItem.mediaType === 'movie') {
          await plexDb.markMovieAsWatched(customOrderItem.plexKey);
          console.log(`Marked movie ${customOrderItem.plexKey} as watched in Plex database`);
        }
      } catch (error) {
        console.error(`Error marking ${customOrderItem.mediaType} as watched in Plex database:`, error);
        // Continue anyway since the custom order item was marked as watched
      }
    }
    
    res.json({ success: true, message: 'Item marked as watched and logged for statistics' });
  } catch (error) {
    console.error('Error marking custom order item as watched:', error);
    res.status(500).json({ error: 'Failed to mark item as watched' });  }
});

// Mark a general TV episode or movie as watched (for TV_GENERAL and MOVIES_GENERAL orders)
app.post('/api/mark-media-watched', async (req, res) => {
  try {
    const { mediaType, ratingKey, episodeRatingKey } = req.body;
    
    if (!mediaType || (!ratingKey && !episodeRatingKey)) {
      return res.status(400).json({ error: 'Media type and ratingKey (or episodeRatingKey for episodes) are required' });
    }

    try {
      let duration = null;
      let mediaData = null;
      let watchLogMediaType = mediaType;

      if (mediaType === 'episode') {
        // For episodes, use episodeRatingKey if available, otherwise ratingKey
        const episodeKey = episodeRatingKey || ratingKey;
        await plexDb.markEpisodeAsWatched(episodeKey);
        console.log(`Marked episode ${episodeKey} as watched in Plex database`);
        
        // Get episode data for watch log
        try {
          mediaData = await plexDb.getItemMetadata(episodeKey, 'episode');
          if (mediaData && mediaData.duration) {
            duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
          }
          watchLogMediaType = 'tv';
        } catch (error) {
          console.warn('Could not get episode data for watch log:', error.message);
        }
      } else if (mediaType === 'movie') {
        await plexDb.markMovieAsWatched(ratingKey);
        console.log(`Marked movie ${ratingKey} as watched in Plex database`);
        
        // Get movie data for watch log
        try {
          mediaData = await plexDb.getMovieByRatingKey(ratingKey);
          if (mediaData && mediaData.duration) {
            duration = Math.round(mediaData.duration / 60000); // Convert milliseconds to minutes
          }
        } catch (error) {
          console.warn('Could not get movie data for watch log:', error.message);
        }
      } else {
        return res.status(400).json({ error: 'Unsupported media type. Only episode and movie are supported.' });
      }

      // Create watch log entry if we have media data
      if (mediaData) {
        const watchLogParams = {
          mediaType: watchLogMediaType,
          title: mediaData.title,
          seriesTitle: mediaData.seriesTitle || (mediaData.grandparentTitle || null),
          seasonNumber: mediaData.parentIndex || mediaData.seasonNumber || null,
          episodeNumber: mediaData.index || mediaData.episodeNumber || null,
          plexKey: mediaData.ratingKey || ratingKey || episodeRatingKey,
          duration: duration,
          activityType: 'watch',
          isCompleted: true
        };

        await watchLogService.logWatched(watchLogParams);
        console.log(`Created watch log entry for ${mediaType} ${ratingKey || episodeRatingKey}`);
      }
      
      res.json({ success: true, message: `${mediaType} marked as watched and logged for statistics` });
    } catch (error) {
      console.error(`Error marking ${mediaType} as watched in Plex database:`, error);
      res.status(500).json({ error: `Failed to mark ${mediaType} as watched in database` });
    }
  } catch (error) {
    console.error('Error in mark-media-watched endpoint:', error);
    res.status(500).json({ error: 'Failed to mark media as watched' });
  }
});

// Search Plex media endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query, type, year } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
        }

    // Parse year filter if provided

    // Parse year filter if provided
    let yearFilter = null;
    if (year) {
      const parsedYear = parseInt(year);
      if (!isNaN(parsedYear) && parsedYear > 1800 && parsedYear <= new Date().getFullYear() + 10) {
        yearFilter = parsedYear;
      }
    }    if (type === 'tv' || type === 'television') {
      // Search for TV shows and their episodes in the database
      try {
        // First search for TV shows that match the query
        console.log(`TV Search Debug: Searching for TV shows with query: "${query}" and yearFilter: ${yearFilter}`);
        const tvShows = await plexDb.searchTVShows(query, yearFilter);
        console.log(`TV Search Debug: Found ${tvShows.length} TV shows`);
        
        const allEpisodes = [];
        for (const show of tvShows) {
          try {
            const episodes = await plexDb.getAllEpisodesForShow(show.ratingKey);
            console.log(`TV Search Debug: Found ${episodes.length} episodes for show: ${show.title}`);
            allEpisodes.push(...episodes);
          } catch (error) {
            console.error(`Error fetching episodes for series ${show.title}:`, error.message);
          }
        }
        
        // Format results for episodes
        const filteredResults = allEpisodes.map(episode => ({
          ratingKey: episode.ratingKey,
          title: episode.title,
          type: 'episode',
          year: episode.year,
          parentIndex: episode.parentIndex, // Season number
          index: episode.index, // Episode number
          grandparentTitle: episode.grandparentTitle, // Series title
          parentTitle: episode.parentTitle, // Season title
          thumb: episode.thumb,
          art: episode.art
        }));
        
        res.json(filteredResults);
      } catch (error) {
        console.error('Error searching TV series:', error.message);
        res.json([]);
      }    } else {
      // Search across all media types in the database
      try {
        const [movies, episodes] = await Promise.all([
          plexDb.searchMovies(query, yearFilter),
          plexDb.searchEpisodes(query, yearFilter)
        ]);

        // Format and combine results
        const movieResults = movies.map(movie => ({
          ratingKey: movie.ratingKey,
          title: movie.title,
          type: 'movie',
          year: movie.year,
          thumb: movie.thumb,
          art: movie.art
        }));

        const episodeResults = episodes.map(episode => ({
          ratingKey: episode.ratingKey,
          title: episode.title,
          type: 'episode',
          year: episode.year,
          parentIndex: episode.parentIndex,
          index: episode.index,          grandparentTitle: episode.grandparentTitle,
          parentTitle: episode.parentTitle,
          thumb: episode.thumb,
          art: episode.art
        }));

        const allResults = [...movieResults, ...episodeResults].slice(0, 20);
        res.json(allResults);
      } catch (error) {
        console.error('Error searching media:', error.message);
        res.status(500).json({ error: 'Failed to search media' });
      }
    }
  } catch (error) {
    console.error('Error searching Plex media:', error);
    res.status(500).json({ error: 'Failed to search Plex media' });
  }
});

// Debug endpoint to check Plex library sections
app.get('/api/debug/sections', async (req, res) => {
  try {
    const sections = await plexDb.getLibrarySections();
    
    res.json({
      totalSections: sections.length,
      sections: sections.map(section => ({
        key: section.key,
        title: section.title,
        type: section.type,
        scanner: section.scanner
      }))
    });
  } catch (error) {
    console.error('Error getting Plex sections:', error);
    res.status(500).json({ error: 'Failed to get Plex sections' });
  }
});

// ==================== READING SESSION ENDPOINTS ====================

// Start a reading session
app.post('/api/reading/start', async (req, res) => {
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Reading session start request:', { mediaType, title, seriesTitle, customOrderItemId });
    
    if (!mediaType || !title) {
      console.log('Missing required fields - mediaType or title');
      return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
    }

    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return res.status(400).json({ error: 'Invalid media type for reading' });
    }

    // Validate customOrderItemId if provided - Fix for foreign key constraint error
    let finalCustomOrderItemId = null;
    if (customOrderItemId) {
      const parsedId = parseInt(customOrderItemId);
      if (Number.isInteger(parsedId)) {
        // Verify the customOrderItem exists before using it
        const existingItem = await prisma.customOrderItem.findUnique({
          where: { id: parsedId }
        });
        
        if (existingItem) {
          finalCustomOrderItemId = parsedId;
          console.log(`✅ Validated customOrderItemId: ${finalCustomOrderItemId}`);
        } else {
          console.log(`⚠️  CustomOrderItem ${parsedId} not found - proceeding without link`);
        }
      } else {
        console.log('⚠️  Invalid customOrderItemId format - proceeding without link');
      }
    }
    
    const readingSession = await watchLogService.startReading({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('Reading session started successfully:', readingSession.id);
    
    // Emit Android companion app message if this is part of a custom order
    if (customOrderItemId) {
      try {
        const customOrderItem = await prisma.customOrderItem.findUnique({
          where: { id: parseInt(customOrderItemId) },
          include: {
            customOrder: {
              include: {
                plexPlaylist: true,
                customPlaylist: {
                  include: {
                    _count: {
                      select: { tracks: true }
                    }
                  }
                }
              }
            }
          }
        });

        if (customOrderItem?.customOrder) {
          const customOrder = customOrderItem.customOrder;
          
          // Build Android companion app message
          let androidMessage = {
            action: 'START_READ_SESSION',
            mediaTitle: title,
            mediaType: mediaType,
            customOrderName: customOrder.name,
            customOrderDescription: customOrder.description,
            timestamp: new Date().toISOString()
          };

          // Add playlist information if available
          if (customOrder.plexPlaylist || customOrder.customPlaylist) {
            if (customOrder.plexPlaylist) {
              androidMessage.playlistName = customOrder.plexPlaylist.title;
              androidMessage.playlistPath = `plex://playlist/${customOrder.plexPlaylist.ratingKey}`;
              androidMessage.playlistType = 'plex';
              androidMessage.playlistTrackCount = customOrder.plexPlaylist.leafCount || 0;
              androidMessage.playlistMetadata = {
                ratingKey: customOrder.plexPlaylist.ratingKey,
                playlistType: customOrder.plexPlaylist.playlistType || 'audio',
                duration: customOrder.plexPlaylist.duration
              };
            } else if (customOrder.customPlaylist) {
              // Transform custom playlist to include trackCount
              customOrder.customPlaylist.trackCount = customOrder.customPlaylist._count?.tracks || 0;
              
              androidMessage.playlistName = customOrder.customPlaylist.title;
              androidMessage.playlistPath = `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/custom-playlists/${customOrder.customPlaylist.id}/play`;
              androidMessage.playlistType = 'custom';
              androidMessage.playlistTrackCount = customOrder.customPlaylist.trackCount;
              androidMessage.playlistDescription = customOrder.customPlaylist.description;
              androidMessage.playlistMetadata = {
                id: customOrder.customPlaylist.id,
                trackCount: customOrder.customPlaylist.trackCount,
                isPublic: customOrder.customPlaylist.isPublic,
                createdBy: customOrder.customPlaylist.createdBy
              };
            }
          } else {
            androidMessage.note = 'Custom order has no linked playlist';
          }

          // Emit to Android companion app clients
          console.log('📱 Emitting Android companion app message:', JSON.stringify(androidMessage, null, 2));
          io.emit('androidCompanion', androidMessage);
        }
      } catch (error) {
        console.warn('Could not fetch custom order info for Android companion app:', error);
      }
    } else {
      // Still emit a message for standalone reading sessions
      const androidMessage = {
        action: 'START_READ_SESSION',
        mediaTitle: title,
        mediaType: mediaType,
        note: 'Standalone reading session - not part of a custom order',
        timestamp: new Date().toISOString()
      };
      
      console.log('📱 Emitting Android companion app message (standalone):', JSON.stringify(androidMessage, null, 2));
      io.emit('androidCompanion', androidMessage);
    }
    
    res.json(readingSession);
  } catch (error) {
    console.error('Error starting reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause/Resume the active reading session
app.post('/api/reading/pause', async (req, res) => {
  try {
    console.log('Attempting to pause/resume reading session...');
    
    // Find the active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active reading session found');
      return res.status(404).json({ error: 'No active reading session found' });
    }

    console.log('Pausing/resuming session with ID:', activeSession.id);
    const updatedSession = await watchLogService.pauseReading(activeSession.id);
    console.log('Session paused/resumed successfully');
    res.json(updatedSession);
  } catch (error) {
    console.error('Error pausing reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop the active reading session
app.post('/api/reading/stop', async (req, res) => {
  try {
    console.log('Attempting to stop reading session...');
    const { progress } = req.body;
    
    // Find the active reading session
    const activeSession = await watchLogService.getActiveReadingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active reading session found');
      return res.status(404).json({ error: 'No active reading session found' });
    }

    console.log('Stopping session with ID:', activeSession.id);
    
    // Stop the reading session
    const completedSession = await watchLogService.stopReading(activeSession.id);
    
    // Update reading progress if provided and session wasn't deleted
    if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
      console.log('Updating reading progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        if (progress.currentPage !== undefined && progress.currentPage > 0) {
          updateData.bookCurrentPage = progress.currentPage;
        }
        
        if (progress.readPercentage !== undefined && progress.readPercentage >= 0 && progress.readPercentage <= 100) {
          updateData.bookPercentRead = progress.readPercentage;
          
          // If read percentage is 100%, mark as read/watched
          if (progress.readPercentage === 100) {
            updateData.isWatched = true;
            console.log('Marking item as read/watched (100% completion)');
          }
        }
        
        if (progress.totalPages !== undefined && progress.totalPages > 0) {
          // Also update the total page count if provided and not already set
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { bookPageCount: true }
          });
          
          if (!existingItem?.bookPageCount) {
            updateData.bookPageCount = progress.totalPages;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Reading progress updated successfully:', updateData);
        }
      } catch (progressError) {
        console.error('Error updating reading progress:', progressError);
        // Don't fail the whole request if progress update fails
      }
    }
    
    console.log('Session stopped successfully');
    res.json(completedSession);
  } catch (error) {
    console.error('Error stopping reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get the current active reading session
app.get('/api/reading/active', async (req, res) => {
  try {
    console.log('Getting active reading session...');
    const activeSession = await watchLogService.getActiveReadingSession();
    console.log('Active session:', activeSession);
    res.json(activeSession);
  } catch (error) {
    console.error('Error getting active reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual reading log endpoint (for testing)
app.post('/api/reading/log', async (req, res) => {
  try {
    const watchLogData = {
      mediaType: req.body.mediaType,
      activityType: 'read',
      title: req.body.title,
      seriesTitle: req.body.seriesTitle,
      customOrderItemId: req.body.customOrderItemId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      totalWatchTime: req.body.totalWatchTime,
      isCompleted: true
    };

    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json({ success: true, watchLog });
  } catch (error) {
    console.error('Error logging reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== VIEWING SESSION ENDPOINTS ====================

// Start a viewing session for web videos
app.post('/api/viewing/start', async (req, res) => {
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    console.log('Viewing session start request:', { mediaType, title, seriesTitle, customOrderItemId });
    
    if (!mediaType || !title) {
      console.log('Missing required fields - mediaType or title');
      return res.status(400).json({ error: 'Missing required fields: mediaType and title are required' });
    }

    if (!customOrderItemId) {
      console.log('No customOrderItemId provided - this viewing session will not be linked to a custom order');
    }

    if (!['webvideo'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return res.status(400).json({ error: 'Invalid media type for viewing' });
    }

    // Only use customOrderItemId if it's a valid integer, otherwise pass null
    const finalCustomOrderItemId = customOrderItemId && Number.isInteger(parseInt(customOrderItemId)) 
      ? parseInt(customOrderItemId) 
      : null;
    
    const viewingSession = await watchLogService.startViewing({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('Viewing session started successfully:', viewingSession.id);
    res.json(viewingSession);
  } catch (error) {
    console.error('Error starting viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause/Resume the active viewing session
app.post('/api/viewing/pause', async (req, res) => {
  try {
    console.log('Attempting to pause/resume viewing session...');
    
    // Find the active viewing session
    const activeSession = await watchLogService.getActiveViewingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active viewing session found');
      return res.status(404).json({ error: 'No active viewing session found' });
    }

    console.log('Pausing/resuming session with ID:', activeSession.id);
    const updatedSession = await watchLogService.pauseViewing(activeSession.id);
    console.log('Session paused/resumed successfully');
    res.json(updatedSession);
  } catch (error) {
    console.error('Error pausing viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stop the active viewing session
app.post('/api/viewing/stop', async (req, res) => {
  try {
    console.log('Attempting to stop viewing session...');
    const { progress } = req.body;
    
    // Find the active viewing session
    const activeSession = await watchLogService.getActiveViewingSession();
    
    console.log('Active session found:', activeSession);
    
    if (!activeSession) {
      console.log('No active viewing session found');
      return res.status(404).json({ error: 'No active viewing session found' });
    }

    console.log('Stopping session with ID:', activeSession.id);
    
    // Stop the viewing session
    const completedSession = await watchLogService.stopViewing(activeSession.customOrderItemId);
    
    // Update viewing progress if provided and session wasn't deleted
    if (progress && !completedSession.deleted && activeSession.customOrderItemId) {
      console.log('Updating viewing progress for item:', activeSession.customOrderItemId, progress);
      
      try {
        const updateData = {};
        
        if (progress.watchedPercentage !== undefined && progress.watchedPercentage >= 0 && progress.watchedPercentage <= 100) {
          updateData.webvideoPercentWatched = progress.watchedPercentage;
          
          // If watched percentage is 100%, mark as watched
          if (progress.watchedPercentage === 100) {
            updateData.isWatched = true;
            console.log('Marking item as watched (100% completion)');
          }
        }
        
        if (progress.currentTime !== undefined && progress.currentTime >= 0) {
          updateData.webvideoCurrentTime = progress.currentTime;
        }
        
        if (progress.totalDuration !== undefined && progress.totalDuration > 0) {
          // Also update the total duration if provided and not already set
          const existingItem = await prisma.customOrderItem.findUnique({
            where: { id: activeSession.customOrderItemId },
            select: { webvideoDuration: true }
          });
          
          if (!existingItem?.webvideoDuration) {
            updateData.webvideoDuration = progress.totalDuration;
          }
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.customOrderItem.update({
            where: { id: activeSession.customOrderItemId },
            data: updateData
          });
          
          console.log('Viewing progress updated successfully:', updateData);
        }
      } catch (progressError) {
        console.error('Error updating viewing progress:', progressError);
        // Don't fail the whole request if progress update fails
      }
    }
    
    console.log('Session stopped successfully');
    res.json(completedSession);
  } catch (error) {
    console.error('Error stopping viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get the current active viewing session
app.get('/api/viewing/active', async (req, res) => {
  try {
    console.log('Getting active viewing session...');
    const activeSession = await watchLogService.getActiveViewingSession();
    console.log('Active session:', activeSession);
    res.json(activeSession);
  } catch (error) {
    console.error('Error getting active viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual viewing log endpoint (for testing)
app.post('/api/viewing/log', async (req, res) => {
  try {
    const watchLogData = {
      mediaType: req.body.mediaType,
      activityType: 'view',
      title: req.body.title,
      seriesTitle: req.body.seriesTitle,
      customOrderItemId: req.body.customOrderItemId,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      totalWatchTime: req.body.totalWatchTime,
      isCompleted: true
    };

    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json({ success: true, watchLog });
  } catch (error) {
    console.error('Error logging viewing session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== WATCH STATISTICS ENDPOINTS ====================

// Get watch statistics with flexible date filtering
app.get('/api/watch-stats', watchStatsRoutes.getWatchStats.bind(watchStatsRoutes));

// Get recent watch activity
app.get('/api/watch-stats/recent', watchStatsRoutes.getRecentActivity.bind(watchStatsRoutes));

// Get today's watch statistics
app.get('/api/watch-stats/today', watchStatsRoutes.getTodayStats.bind(watchStatsRoutes));

// Manual watch log entry (for items not automatically tracked)
app.post('/api/watch-logs', async (req, res) => {
  try {
    const watchLogData = req.body;
    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json(watchLog);
  } catch (error) {
    console.error('Error creating watch log:', error);
    res.status(500).json({ error: 'Failed to create watch log' });
  }
});

// Delete a watch log entry
app.delete('/api/watch-logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedLog = await watchLogService.deleteWatchLog(id);
    res.json({ success: true, deletedLog, message: 'Watch log entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting watch log:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Watch log entry not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete watch log entry' });
    }
  }
});

// Get custom order statistics
app.get('/api/watch-stats/custom-orders', watchStatsRoutes.getCustomOrderStats.bind(watchStatsRoutes));

// Debug endpoint to fix webvideo completion status
app.post('/api/debug/fix-webvideo-completion', async (req, res) => {
  try {
    // Update webvideo sessions that have endTime but aren't marked as completed
    const result = await prisma.watchLog.updateMany({
      where: {
        mediaType: 'webvideo',
        endTime: { not: null },
        isCompleted: false
      },
      data: {
        isCompleted: true
      }
    });
    
    res.json({
      message: 'Fixed webvideo completion status',
      updated: result.count
    });
  } catch (error) {
    console.error('Error fixing webvideo completion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check webvideo sessions
app.get('/api/debug/webvideo-sessions', async (req, res) => {
  try {
    const sessions = await prisma.watchLog.findMany({
      where: {
        mediaType: 'webvideo'
      },
      orderBy: {
        startTime: 'desc'
      }
    });
    
    res.json({
      count: sessions.length,
      sessions: sessions
    });
  } catch (error) {
    console.error('Error getting webvideo sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get media type specific statistics
app.get('/api/watch-stats/media-type/:mediaType', watchStatsRoutes.getMediaTypeStats.bind(watchStatsRoutes));

// Get all activity across all media types
app.get('/api/watch-stats/all-activity', watchStatsRoutes.getAllActivity.bind(watchStatsRoutes));

// ==================== END WATCH STATISTICS ENDPOINTS ====================

// ========================
// MUSIC API ENDPOINTS
// ========================
// NOTE: These routes MUST be defined before the catch-all route (*) to work in production

// Music API endpoints
app.get('/api/music/sections', async (req, res) => {
  try {
    const sections = await plexDb.getMusicSections();
    console.log('Returning music sections:', sections);
    res.json(sections);
  } catch (error) {
    console.error('Error fetching music sections:', error);
    res.status(500).json({ error: 'Failed to fetch music sections' });
  }
});

app.get('/api/music/stats', async (req, res) => {
  try {
    const stats = await plexDb.getMusicStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching music statistics:', error);
    res.status(500).json({ error: 'Failed to fetch music statistics' });
  }
});

app.get('/api/music/collections', async (req, res) => {
  try {
    const { section } = req.query;
    
    let artistCollections, albumCollections;
    
    if (section && section !== 'all') {
      // Filter collections by section
      artistCollections = await plexDb.getAllMusicArtistCollectionsBySection(section);
      albumCollections = await plexDb.getAllMusicAlbumCollectionsBySection(section);
    } else {
      // Get all collections
      artistCollections = await plexDb.getAllMusicArtistCollections();
      albumCollections = await plexDb.getAllMusicAlbumCollections();
    }
    
    // Combine and deduplicate collections
    const allCollections = [...new Set([...artistCollections, ...albumCollections])];
    
    // Format for response
    const formattedCollections = allCollections
      .sort()
      .map(collection => ({
        value: collection,
        label: collection,
        type: 'music'
      }));
    
    res.json(formattedCollections);
  } catch (error) {
    console.error('Error fetching music collections:', error);
    res.status(500).json({ error: 'Failed to fetch music collections' });
  }
});

app.get('/api/music/playlists', async (req, res) => {
  try {
    const playlists = await plexDb.getAllPlaylists();
    res.json(playlists);
  } catch (error) {
    console.error('Error fetching music playlists:', error);
    res.status(500).json({ error: 'Failed to fetch music playlists' });
  }
});

app.get('/api/music/custom-playlists', async (req, res) => {
  try {
    const customPlaylists = await prisma.customPlaylist.findMany({
      include: {
        tracks: {
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    res.json(customPlaylists);
  } catch (error) {
    console.error('Error fetching custom playlists:', error);
    res.status(500).json({ error: 'Failed to fetch custom playlists' });
  }
});

// Create a new custom playlist
app.post('/api/music/custom-playlists', async (req, res) => {
  try {
    const { title, description, isPublic, createdBy } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Playlist title is required' });
    }

    const customPlaylist = await prisma.customPlaylist.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        isPublic: isPublic || false,
        createdBy: createdBy || 'User'
      },
      include: {
        tracks: {
          orderBy: {
            sortOrder: 'asc'
          }
        }
      }
    });

    res.status(201).json(customPlaylist);
  } catch (error) {
    console.error('Error creating custom playlist:', error);
    res.status(500).json({ error: 'Failed to create custom playlist' });
  }
});

// Delete a custom playlist
app.delete('/api/music/custom-playlists/:id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    
    // Check if playlist exists
    const playlist = await prisma.customPlaylist.findUnique({
      where: { id: playlistId }
    });
    
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Delete the playlist (tracks will be deleted due to cascade)
    await prisma.customPlaylist.delete({
      where: { id: playlistId }
    });

    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom playlist:', error);
    res.status(500).json({ error: 'Failed to delete custom playlist' });
  }
});

// Add a track to a custom playlist
app.post('/api/music/custom-playlists/:id/tracks', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const { ratingKey, title, artist, album, duration } = req.body;
    
    if (!ratingKey || !title) {
      return res.status(400).json({ error: 'Track ratingKey and title are required' });
    }

    // Check if playlist exists
    const playlist = await prisma.customPlaylist.findUnique({
      where: { id: playlistId }
    });
    
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Check if track is already in the playlist
    const existingTrack = await prisma.customPlaylistTrack.findFirst({
      where: {
        playlistId: playlistId,
        ratingKey: ratingKey
      }
    });

    if (existingTrack) {
      return res.status(409).json({ error: 'Track is already in this playlist' });
    }

    // Get the next sort order
    const lastTrack = await prisma.customPlaylistTrack.findFirst({
      where: { playlistId: playlistId },
      orderBy: { sortOrder: 'desc' }
    });
    
    const nextSortOrder = (lastTrack?.sortOrder || 0) + 1;

    // Add the track to the playlist
    const playlistTrack = await prisma.customPlaylistTrack.create({
      data: {
        playlistId: playlistId,
        ratingKey: ratingKey,
        title: title,
        artist: artist || null,
        album: album || null,
        duration: duration ? parseInt(duration) : null,
        sortOrder: nextSortOrder
      }
    });

    // Update playlist's updatedAt timestamp
    await prisma.customPlaylist.update({
      where: { id: playlistId },
      data: { updatedAt: new Date() }
    });

    res.status(201).json(playlistTrack);
  } catch (error) {
    console.error('Error adding track to custom playlist:', error);
    res.status(500).json({ error: 'Failed to add track to playlist' });
  }
});

// Remove a track from a custom playlist
app.delete('/api/music/custom-playlists/:id/tracks/:trackId', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id);
    const trackId = parseInt(req.params.trackId);
    
    // Check if playlist exists
    const playlist = await prisma.customPlaylist.findUnique({
      where: { id: playlistId }
    });
    
    if (!playlist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // Check if track exists in playlist
    const track = await prisma.customPlaylistTrack.findFirst({
      where: {
        id: trackId,
        playlistId: playlistId
      }
    });

    if (!track) {
      return res.status(404).json({ error: 'Track not found in playlist' });
    }

    // Delete the track
    await prisma.customPlaylistTrack.delete({
      where: { id: trackId }
    });

    // Update playlist's updatedAt timestamp
    await prisma.customPlaylist.update({
      where: { id: playlistId },
      data: { updatedAt: new Date() }
    });

    res.json({ message: 'Track removed from playlist successfully' });
  } catch (error) {
    console.error('Error removing track from custom playlist:', error);
    res.status(500).json({ error: 'Failed to remove track from playlist' });
  }
});

app.get('/api/music/artists', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    if (search) {
      // For search, get all matching artists (existing behavior for compatibility)
      const artists = await plexDb.searchArtists(search);
      res.json(artists);
    } else {
      // For regular requests, use pagination
      const artists = await plexDb.getAllArtists(parseInt(limit), offset);
      const totalArtists = await plexDb.getArtistsCount();
      
      res.json({
        artists,
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalArtists,
        hasMore: offset + artists.length < totalArtists
      });
    }
  } catch (error) {
    console.error('Error fetching all artists:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// Artists by section endpoint
app.get('/api/music/artists/section/:sectionKey', async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    console.log(`Artists requested for section: ${sectionKey}, page: ${pageNum}, limit: ${limitNum}, search: ${search}`);

    let artists;
    let total;

    if (search) {
      artists = await plexDb.searchArtistsBySection(sectionKey, search, limitNum, offset);
      total = await plexDb.getArtistsBySectionCount(sectionKey); // For simplicity, using section total
    } else {
      artists = await plexDb.getArtistsBySection(sectionKey, limitNum, offset);
      total = await plexDb.getArtistsBySectionCount(sectionKey);
    }

    console.log(`Returning ${artists.length} artists for section ${sectionKey}, total: ${total}`);

    const hasMore = offset + artists.length < total;

    res.json({
      artists,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching artists by section:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// Get individual artist by rating key
app.get('/api/music/artists/:ratingKey', async (req, res) => {
  try {
    const { ratingKey } = req.params;
    
    const artist = await plexDb.getArtistByRatingKey(ratingKey);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    res.json(artist);
  } catch (error) {
    console.error('Error fetching artist:', error);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// Albums endpoints
app.get('/api/music/albums', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let albums;
    let total;

    if (search) {
      albums = await plexDb.searchAlbums(search, limitNum, offset);
      total = await plexDb.getAlbumsCount(); // For simplicity, using total count
    } else {
      albums = await plexDb.getAllAlbums(limitNum, offset);
      total = await plexDb.getAlbumsCount();
    }

    const hasMore = offset + albums.length < total;

    res.json({
      albums,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching all albums:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

app.get('/api/music/albums/section/:sectionKey', async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const { search, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    console.log(`Albums requested for section: ${sectionKey}, page: ${pageNum}, limit: ${limitNum}`);

    let albums;
    let total;

    if (search) {
      albums = await plexDb.searchAlbumsBySection(search, sectionKey, limitNum, offset);
      total = await plexDb.getAlbumsBySectionCount(sectionKey); // For simplicity
    } else {
      albums = await plexDb.getAlbumsBySection(sectionKey, limitNum, offset);
      total = await plexDb.getAlbumsBySectionCount(sectionKey);
    }

    console.log(`Returning ${albums.length} albums for section ${sectionKey}, total: ${total}`);

    const hasMore = offset + albums.length < total;

    res.json({
      albums,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching albums by section:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

app.get('/api/music/albums/artist/:artistRatingKey', async (req, res) => {
  try {
    const { artistRatingKey } = req.params;
    const albums = await plexDb.getAlbumsByArtist(artistRatingKey);
    res.json(albums);
  } catch (error) {
    console.error('Error fetching albums by artist:', error);
    res.status(500).json({ error: 'Failed to fetch albums' });
  }
});

// Get individual album by rating key
app.get('/api/music/albums/:ratingKey', async (req, res) => {
  try {
    const { ratingKey } = req.params;
    
    const album = await plexDb.getAlbumByRatingKey(ratingKey);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    res.json(album);
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({ error: 'Failed to fetch album' });
  }
});

// Extract metadata from album files
app.post('/api/music/albums/:ratingKey/extract-file-metadata', async (req, res) => {
  try {
    const { ratingKey } = req.params;
    
    // Get album and its tracks from database
    const album = await plexDb.getAlbumByRatingKey(ratingKey);
    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }
    
    const tracks = await plexDb.getTracksByAlbum(ratingKey);
    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ error: 'No tracks found for this album' });
    }

    // Get Plex settings for API access
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.plexUrl || !settings.plexToken) {
      return res.status(400).json({ error: 'Plex configuration not found in settings' });
    }

    const extractedMetadata = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(`Starting metadata extraction for ${tracks.length} tracks from album ${ratingKey}`);
    
    for (const track of tracks) {
      try {
        // Fetch full track metadata from Plex API to get file paths
        const plexResponse = await fetch(`${settings.plexUrl}/library/metadata/${track.ratingKey}?X-Plex-Token=${settings.plexToken}`, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!plexResponse.ok) {
          throw new Error(`Plex API error: ${plexResponse.status}`);
        }
        
        const plexData = await plexResponse.json();
        const plexTrack = plexData.MediaContainer?.Metadata?.[0];
        
        if (!plexTrack || !plexTrack.Media || plexTrack.Media.length === 0) {
          throw new Error('No media information found in Plex metadata');
        }
        
        const mediaPart = plexTrack.Media[0].Part?.[0];
        if (!mediaPart || !mediaPart.file) {
          throw new Error('No file path found in Plex metadata');
        }
        
        // Map Plex file path to container path
        let filePath = mediaPart.file;
        const originalPath = filePath;
        
        // Map Plex paths to actual file system paths
        // In Docker: use container mount points
        // In development: use environment variables to map to local paths
        const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
        
        if (isDocker) {
          // Docker environment: Map to container mount points
          if (filePath.includes('/mnt/user/Media/Music/')) {
            filePath = filePath.replace('/mnt/user/Media/Music/', '/music/');
          } else if (filePath.includes('/mnt/user/Media/Classical/')) {
            filePath = filePath.replace('/mnt/user/Media/Classical/', '/classical/');
          } else if (filePath.includes('/mnt/user/Media/PopMusic/')) {
            filePath = filePath.replace('/mnt/user/Media/PopMusic/', '/pop_music/');
          } else if (filePath.startsWith('/classical/') || filePath.startsWith('/music/') || filePath.startsWith('/pop_music/')) {
            // Path is already in container format, no mapping needed
            console.log(`Path already in container format: ${filePath}`);
          } else {
            console.warn(`Unknown Docker path pattern for file: ${mediaPart.file}`);
            throw new Error(`Docker path mapping not configured for: ${mediaPart.file}`);
          }
        } else {
          // Development environment: Map to local file system using environment variables
          if (filePath.startsWith('/classical/')) {
            const classicalPath = process.env.CLASSICAL_PATH;
            if (!classicalPath) {
              throw new Error('CLASSICAL_PATH environment variable not set. Add CLASSICAL_PATH to your .env file.');
            }
            filePath = filePath.replace('/classical/', classicalPath + path.sep);
          } else if (filePath.startsWith('/music/')) {
            const musicPath = process.env.MUSIC_PATH;
            if (!musicPath) {
              throw new Error('MUSIC_PATH environment variable not set. Add MUSIC_PATH to your .env file.');
            }
            filePath = filePath.replace('/music/', musicPath + path.sep);
          } else if (filePath.startsWith('/pop_music/')) {
            const popMusicPath = process.env.POP_MUSIC_PATH;
            if (!popMusicPath) {
              throw new Error('POP_MUSIC_PATH environment variable not set. Add POP_MUSIC_PATH to your .env file.');
            }
            filePath = filePath.replace('/pop_music/', popMusicPath + path.sep);
          } else if (filePath.includes('/mnt/user/Media/Music/')) {
            const musicPath = process.env.MUSIC_PATH;
            if (!musicPath) {
              throw new Error('MUSIC_PATH environment variable not set. Add MUSIC_PATH to your .env file.');
            }
            filePath = filePath.replace('/mnt/user/Media/Music/', musicPath + path.sep);
          } else if (filePath.includes('/mnt/user/Media/Classical/')) {
            const classicalPath = process.env.CLASSICAL_PATH;
            if (!classicalPath) {
              throw new Error('CLASSICAL_PATH environment variable not set. Add CLASSICAL_PATH to your .env file.');
            }
            filePath = filePath.replace('/mnt/user/Media/Classical/', classicalPath + path.sep);
          } else if (filePath.includes('/mnt/user/Media/PopMusic/')) {
            const popMusicPath = process.env.POP_MUSIC_PATH;
            if (!popMusicPath) {
              throw new Error('POP_MUSIC_PATH environment variable not set. Add POP_MUSIC_PATH to your .env file.');
            }
            filePath = filePath.replace('/mnt/user/Media/PopMusic/', popMusicPath + path.sep);
          } else {
            console.warn(`Unknown development path pattern for file: ${mediaPart.file}`);
            throw new Error(`Development path mapping not configured for: ${mediaPart.file}. Check your .env file for required PATH variables.`);
          }
        }
        
        console.log(`Processing track: ${track.title}, mapped path: ${filePath}`);
        
        // Extract metadata using music-metadata library
        const metadata = await mm.parseFile(filePath);
        
        extractedMetadata.push({
          ratingKey: track.ratingKey,
          title: track.title,
          filePath: filePath,
          plexPath: originalPath,
          fileSize: mediaPart.size || null,
          common: {
            title: metadata.common.title,
            artist: metadata.common.artist,
            album: metadata.common.album,
            year: metadata.common.year,
            track: metadata.common.track,
            genre: metadata.common.genre,
            picture: metadata.common.picture?.length > 0 ? `${metadata.common.picture.length} embedded images` : null
          },
          format: {
            duration: metadata.format.duration,
            bitrate: metadata.format.bitrate,
            sampleRate: metadata.format.sampleRate,
            numberOfChannels: metadata.format.numberOfChannels,
            codec: metadata.format.codec,
            container: metadata.format.container,
            tool: metadata.format.tool,
            tagTypes: metadata.format.tagTypes
          }
        });
        
        successCount++;
        
      } catch (error) {
        console.error(`Error extracting metadata for track ${track.ratingKey} (${track.title}):`, error.message);
        
        extractedMetadata.push({
          ratingKey: track.ratingKey,
          title: track.title,
          error: error.message,
          plexPath: 'Unknown'
        });
        
        errorCount++;
      }
    }

    const result = {
      albumTitle: album.title,
      albumRatingKey: ratingKey,
      tracksProcessed: tracks.length,
      successCount,
      errorCount,
      extractedMetadata
    };

    console.log(`Metadata extraction completed for album ${ratingKey}: ${successCount} successful, ${errorCount} errors`);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error extracting album metadata:', error);
    res.status(500).json({ error: 'Failed to extract album metadata' });
  }
});

// Tracks endpoints
app.get('/api/music/tracks', async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let tracks;
    let total;

    if (search) {
      tracks = await plexDb.searchTracks(search, limitNum, offset);
      total = await plexDb.getTracksCount(); // For simplicity, using total count
    } else {
      tracks = await plexDb.getAllTracks(limitNum, offset);
      total = await plexDb.getTracksCount();
    }

    const hasMore = offset + tracks.length < total;

    res.json({
      tracks,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching all tracks:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.get('/api/music/tracks/section/:sectionKey', async (req, res) => {
  try {
    const { sectionKey } = req.params;
    const { search, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    let tracks;
    let total;

    if (search) {
      tracks = await plexDb.searchTracksBySection(search, sectionKey, limitNum, offset);
      total = await plexDb.getTracksBySectionCount(sectionKey); // For simplicity
    } else {
      tracks = await plexDb.getTracksBySection(sectionKey, limitNum, offset);
      total = await plexDb.getTracksBySectionCount(sectionKey);
    }

    const hasMore = offset + tracks.length < total;

    res.json({
      tracks,
      page: pageNum,
      limit: limitNum,
      total,
      hasMore
    });
  } catch (error) {
    console.error('Error fetching tracks by section:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.get('/api/music/tracks/album/:albumRatingKey', async (req, res) => {
  try {
    const { albumRatingKey } = req.params;
    const tracks = await plexDb.getTracksByAlbum(albumRatingKey);
    res.json(tracks);
  } catch (error) {
    console.error('Error fetching tracks by album:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.get('/api/music/tracks/artist/:artistRatingKey', async (req, res) => {
  try {
    const { artistRatingKey } = req.params;
    const tracks = await plexDb.getTracksByArtist(artistRatingKey);
    res.json(tracks);
  } catch (error) {
    console.error('Error fetching tracks by artist:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

// Music streaming endpoint - Stream audio track from Plex
app.get('/api/music/stream/:ratingKey', async (req, res) => {
  try {
    const { ratingKey } = req.params;
    const settings = await prisma.settings.findFirst();
    
    if (!settings || !settings.plexUrl || !settings.plexToken) {
      return res.status(500).json({ error: 'Plex configuration not found' });
    }

    // Get track details to verify it exists
    const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
    const trackResponse = await fetch(trackUrl, {
      headers: {
        'X-Plex-Token': settings.plexToken,
        'Accept': 'application/json'
      }
    });

    if (!trackResponse.ok) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const trackData = await trackResponse.json();
    const track = trackData.MediaContainer?.Metadata?.[0];
    
    if (!track) {
      return res.status(404).json({ error: 'Track metadata not found' });
    }

    // Get the media part for streaming
    const mediaPart = track.Media?.[0]?.Part?.[0];
    if (!mediaPart) {
      return res.status(404).json({ error: 'No media part found for track' });
    }

    // Construct Plex stream URL
    const streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
    
    console.log(`🎵 Streaming track: ${track.title} by ${track.originalTitle || track.grandparentTitle}`);
    console.log(`🔗 Stream URL: ${streamUrl}`);

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');

    // Stream the audio from Plex
    const streamResponse = await fetch(streamUrl, {
      headers: {
        'Range': req.headers.range || 'bytes=0-',
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });

    if (!streamResponse.ok) {
      console.error(`❌ Failed to get stream from Plex: ${streamResponse.status} ${streamResponse.statusText}`);
      console.error(`   Stream URL: ${streamUrl}`);
      return res.status(streamResponse.status).json({ error: `Failed to stream from Plex: ${streamResponse.statusText}` });
    }

    console.log(`✅ Successfully got stream from Plex: ${streamResponse.status}`);

    // Copy relevant headers from Plex response
    const contentType = streamResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    if (streamResponse.headers.get('content-length')) {
      res.setHeader('Content-Length', streamResponse.headers.get('content-length'));
    }
    if (streamResponse.headers.get('content-range')) {
      res.setHeader('Content-Range', streamResponse.headers.get('content-range'));
    }
    if (streamResponse.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', streamResponse.headers.get('accept-ranges'));
    }

    // Set status code for range requests
    if (req.headers.range && streamResponse.status === 206) {
      res.status(206);
    }

    // Handle stream errors
    streamResponse.body.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error occurred' });
      }
    });

    // Pipe the stream
    streamResponse.body.pipe(res);
    
  } catch (error) {
    console.error('Error streaming music track:', error);
    res.status(500).json({ error: 'Failed to stream track' });
  }
});

// Music streaming debug endpoint
app.get('/api/music/debug/:ratingKey', async (req, res) => {
  try {
    const { ratingKey } = req.params;
    const settings = await prisma.settings.findFirst();
    
    if (!settings || !settings.plexUrl || !settings.plexToken) {
      return res.json({ 
        error: 'Plex configuration not found',
        hasSettings: !!settings,
        hasPlexUrl: !!(settings && settings.plexUrl),
        hasPlexToken: !!(settings && settings.plexToken)
      });
    }

    // Get track details
    const trackUrl = `${settings.plexUrl}/library/metadata/${ratingKey}`;
    const trackResponse = await fetch(trackUrl, {
      headers: {
        'X-Plex-Token': settings.plexToken,
        'Accept': 'application/json'
      }
    });

    const trackData = await trackResponse.json();
    const track = trackData.MediaContainer?.Metadata?.[0];
    const mediaPart = track?.Media?.[0]?.Part?.[0];
    
    res.json({
      success: true,
      track: {
        title: track?.title,
        artist: track?.originalTitle || track?.grandparentTitle,
        album: track?.parentTitle,
        ratingKey: track?.ratingKey,
        duration: track?.duration
      },
      media: {
        hasMedia: !!track?.Media,
        hasPart: !!mediaPart,
        partKey: mediaPart?.key,
        container: mediaPart?.container,
        size: mediaPart?.size
      },
      streamUrl: mediaPart ? `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}` : null,
      plexUrl: settings.plexUrl
    });
  } catch (error) {
    console.error('Music debug error:', error);
    res.json({ error: error.message, stack: error.stack });
  }
});

// Android companion app API endpoints (must be before catch-all route)

// Helper function to get base URL for Android API
const getAndroidApiBaseUrl = () => {
  const externalIp = process.env.EXTERNAL_IP;
  return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
};

// Android companion app endpoint - Get Up Next
app.get('/api/android/up-next', async (req, res) => {
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
    
    // Helper function to generate artwork URL like web app does
    const getAndroidArtworkUrl = (media) => {
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
      
      // For comics, fallback to ComicVine artwork if no cached artwork
      if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
        console.log('📱 Using ComicVine artwork (fallback):', media.comicDetails.coverUrl);
        return `${baseUrl}/api/comicvine-artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
      }
      
      // For books, use OpenLibrary artwork
      if (media?.type === 'book' && media?.bookCoverUrl) {
        console.log('📱 Using OpenLibrary artwork:', media.bookCoverUrl);
        return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
      }
      
      // For short stories, use story cover or fallback to containing book's cover
      if (media?.type === 'shortstory') {
        if (media?.storyCoverUrl) {
          console.log('📱 Using short story cover artwork:', media.storyCoverUrl);
          return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
        } else if (media?.containedInBookDetails?.coverUrl) {
          console.log('📱 Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
          return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
        }
      }
      
      // Prioritize TVDB artwork if available for TV content
      if (media?.tvdbArtwork?.url) {
        console.log('📱 Using TVDB artwork:', media.tvdbArtwork.url);
        return `${baseUrl}/api/tvdb-artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
      }
      
      // Fall back to Plex artwork
      const thumb = media?.thumb || media?.art;
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
    
    // Determine content type and build appropriate response
    let androidResponse;
    
    if (upNextData.orderType === 'MOVIES_GENERAL') {
      // Movie response - use proper artwork URL generation
      const artworkUrl = getAndroidArtworkUrl(upNextData);
      androidResponse = {
        type: 'PLAY_MOVIE',
        data: {
          ratingKey: upNextData.ratingKey,
          plexId: upNextData.ratingKey, // Add plexId field for direct media access
          title: upNextData.title,
          year: upNextData.year,
          duration: upNextData.duration || 0,
          summary: upNextData.summary || '',
          studio: upNextData.studio || 'Unknown Studio',
          rating: upNextData.rating || 0,
          thumb: upNextData.thumb || '',
          art: upNextData.art || '',
          artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
          streamUrl: upNextData.streamUrl || '',
          otherCollections: upNextData.otherCollections || []
        }
      };
    } else if (upNextData.orderType === 'CUSTOM_ORDER') {
      // Custom order response - use proper artwork URL generation
      const artworkUrl = getAndroidArtworkUrl(upNextData);
      
      // For episodes in custom orders, make sure we use the episode rating key
      let episodeRatingKey = upNextData.ratingKey;
      if (upNextData.type === 'episode' && upNextData.episodeRatingKey) {
        episodeRatingKey = upNextData.episodeRatingKey;
        console.log('📱 Using episode-specific rating key for Android:', episodeRatingKey);
      }
      
      androidResponse = {
        type: 'PLAY_CUSTOM_ORDER_ITEM',
        data: {
          id: upNextData.id,
          title: upNextData.title,
          type: upNextData.type,
          orderName: upNextData.customOrderName || 'Custom Order', // Use the actual custom order name
          summary: upNextData.summary || '',
          duration: upNextData.duration || 0,
          localArtworkPath: upNextData.localArtworkPath || '',
          artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
          streamUrl: upNextData.streamUrl || '',
          ratingKey: episodeRatingKey || null,
          plexId: episodeRatingKey || null, // Add plexId field for Plex content
          webUrl: upNextData.webUrl || null, // Add webUrl field for web video content
          customOrderId: upNextData.customOrderId || null,
          // Episode-specific fields for custom orders
          ...(upNextData.type === 'episode' && {
            seasonNumber: upNextData.seasonNumber || upNextData.currentSeason || null,
            episodeNumber: upNextData.episodeNumber || upNextData.currentEpisode || null,
            episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
            seriesTitle: upNextData.seriesTitle || upNextData.grandparentTitle || null
          })
        }
      };
    } else {
      // TV Show response (default) - use proper artwork URL generation
      const artworkUrl = getAndroidArtworkUrl(upNextData);
      
      // For TV episodes from Plex, make sure we use the episode rating key
      let episodeRatingKey = upNextData.ratingKey; // Default to series rating key
      let seriesRatingKey = upNextData.ratingKey; // Keep series rating key for reference
      
      // Priority order for finding episode-specific rating key
      if (upNextData.episodeRatingKey) {
        episodeRatingKey = upNextData.episodeRatingKey;
        console.log('📱 Using episodeRatingKey for Android:', episodeRatingKey);
      } else if (upNextData.currentEpisodeRatingKey) {
        episodeRatingKey = upNextData.currentEpisodeRatingKey;
        console.log('📱 Using currentEpisodeRatingKey for Android:', episodeRatingKey);
      } else if (upNextData.nextEpisodeRatingKey) {
        episodeRatingKey = upNextData.nextEpisodeRatingKey;
        console.log('📱 Using nextEpisodeRatingKey for Android:', episodeRatingKey);
      } else {
        console.log('📱 No episode-specific rating key found, using series rating key:', episodeRatingKey);
      }
      
      androidResponse = {
        type: 'PLAY_TV_EPISODE',
        data: {
          ratingKey: episodeRatingKey, // This should be the episode rating key, not series
          episodeRatingKey: episodeRatingKey, // Explicit episode rating key field
          seriesRatingKey: seriesRatingKey, // Series rating key for reference
          plexId: episodeRatingKey, // Add plexId field for direct media access (episode-specific)
          title: upNextData.title,
          episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null, // Add episode title
          summary: upNextData.summary || '',
          episodeSummary: upNextData.episodeSummary || null, // Add episode-specific summary
          leafCount: upNextData.leafCount || 0,
          viewedLeafCount: upNextData.viewedLeafCount || 0,
          // Season and episode information for TV shows
          seasonNumber: upNextData.currentSeason || upNextData.seasonNumber || null,
          episodeNumber: upNextData.currentEpisode || upNextData.episodeNumber || null,
          isFinalSeason: upNextData.isCurrentSeasonFinal || false, // Add final season flag
          // Artwork URLs
          thumb: upNextData.thumb || '',
          art: upNextData.art || '',
          artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
          streamUrl: upNextData.streamUrl || '',
          otherCollections: upNextData.otherCollections || []
        }
      };
    }
    
    console.log('📱 Sending Android companion up next response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android up next endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Random Stash Images
app.get('/api/android/stash/images', async (req, res) => {
  console.log('📱 Android app requesting random Stash images...');
  
  try {
    // Get count parameter, default to 1, max 50
    const count = Math.min(Math.max(parseInt(req.query.count) || 1, 1), 50);
    
    // Get random images from both galleries and standalone
    const conditions = [
      { galleryId: { not: null } }, // Gallery images
      { galleryId: null }           // Standalone images
    ];
    
    const totalImages = await prisma.stashImage.count({
      where: {
        OR: conditions
      }
    });
    
    if (totalImages === 0) {
      return res.json({
        type: 'NO_IMAGES',
        data: {
          message: 'No images found in Stash library',
          images: []
        }
      });
    }
    
    // Get random images using skip with random offsets
    const randomImages = [];
    const maxAttempts = Math.min(count * 10, 500); // Limit attempts to avoid infinite loops
    const usedIds = new Set();
    
    for (let i = 0; i < count && randomImages.length < count && i < maxAttempts; i++) {
      try {
        // Generate random skip value
        const randomSkip = Math.floor(Math.random() * totalImages);
        
        // Get one random image with random skip
        const randomImage = await prisma.stashImage.findFirst({
          where: {
            OR: conditions
          },
          include: {
            gallery: {
              select: {
                title: true,
                photographer: true
              }
            },
            performers: {
              include: {
                performer: {
                  select: {
                    name: true,
                    image: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                name: true,
                image: true
              }
            }
          },
          skip: randomSkip
        });
        
        // Only add if we haven't seen this ID before
        if (randomImage && !usedIds.has(randomImage.id)) {
          randomImages.push(randomImage);
          usedIds.add(randomImage.id);
        }
      } catch (error) {
        console.warn('Error fetching random image, continuing...', error.message);
      }
    }
    
    // If we didn't get enough unique images, fill with additional attempts
    if (randomImages.length < count) {
      console.log(`Only found ${randomImages.length} unique images out of ${count} requested`);
    }
    
    const formattedImages = randomImages.map(image => ({
      id: image.id,
      title: image.title || image.gallery?.title || 'Untitled',
      path: image.path,
      url: `${getAndroidApiBaseUrl()}/api/stash-image-proxy/${encodeURIComponent(image.path)}`,
      photographer: image.photographer || image.gallery?.photographer,
      performers: image.performers.map(p => ({
        name: p.performer.name,
        image: p.performer.image
      })),
      studio: image.studioObject ? {
        name: image.studioObject.name,
        image: image.studioObject.image
      } : null,
      gallery: image.gallery ? {
        title: image.gallery.title
      } : null,
      rating: image.rating,
      organized: image.organized
    }));
    
    console.log(`📱 Returning ${formattedImages.length} random image(s) to Android app`);
    
    res.json({
      type: 'RANDOM_IMAGES',
      data: {
        images: formattedImages,
        count: formattedImages.length,
        totalAvailable: totalImages
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting random images for Android app:', error);
    res.status(500).json({
      type: 'ERROR',
      data: {
        error: 'Failed to get random images',
        details: error.message
      }
    });
  }
});

// Android companion app endpoint - Next Stash
app.get('/api/android/stash/next', async (req, res) => {
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
    console.log('📱 Next clip data received:', JSON.stringify(nextClipData, null, 2));
    
    if (!nextClipData.clip) {
      return res.status(404).json({ 
        error: 'No clips available',
        message: 'No unwatched clips found. Try generating more clips first.' 
      });
    }
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'PLAY_CLIP',
      data: {
        url: nextClipData.clip.paths?.stream || nextClipData.playbackInfo?.streamUrl || '',
        title: nextClipData.scene?.title || 'Unknown Scene',
        performers: nextClipData.scene?.performers?.map(p => p.name).join(', ') || 'Unknown',
        studio: nextClipData.scene?.studio?.name || 'Unknown Studio',
        duration: nextClipData.clip.duration || 60,
        startTime: nextClipData.clip.startTime || 0,
        endTime: nextClipData.clip.endTime || 60,
        clipId: nextClipData.clip.id,
        sceneId: nextClipData.scene?.id,
        clipIndex: nextClipData.clip.clipIndex || 0
      }
    };
    
    console.log('📱 Sending Android companion response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android next Stash endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Next Stash Scene
app.get('/api/android/stash/scene/next', async (req, res) => {
  console.log('📱 Android app requesting next Stash scene...');
  
  try {
    // Get next scene using existing logic
    const baseUrl = getAndroidApiBaseUrl();
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
    console.log('📱 Next scene data received:', JSON.stringify(nextSceneData, null, 2));
    
    if (!nextSceneData.success || !nextSceneData.scene) {
      return res.status(404).json({ 
        error: 'No scenes available',
        message: nextSceneData.message || 'No unwatched scenes found.' 
      });
    }
    
    const scene = nextSceneData.scene;
    
    // Get Stash artwork from direct GraphQL call
    let sceneArtwork = null;
    try {
      const settings = await prisma.settings.findFirst();
      if (settings?.stashUrl) {
        const stashQuery = `
          query FindScene($id: ID!) {
            findScene(id: $id) {
              id
              paths {
                screenshot
                preview
                stream
                webp
              }
            }
          }
        `;
        
        const stashResponse = await fetch(`${settings.stashUrl}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ApiKey': settings.stashApiKey || ''
          },
          body: JSON.stringify({
            query: stashQuery,
            variables: { id: scene.id }
          })
        });
        
        if (stashResponse.ok) {
          const stashData = await stashResponse.json();
          if (stashData.data?.findScene?.paths) {
            sceneArtwork = stashData.data.findScene.paths;
          }
        }
      }
    } catch (artworkError) {
      console.warn('⚠️ Failed to fetch scene artwork from Stash:', artworkError.message);
    }
    
    // Use filename without extension as fallback if title is empty
    let displayTitle = scene.title;
    if (!displayTitle || displayTitle.trim() === '') {
      if (scene.path) {
        const filename = path.basename(scene.path);
        displayTitle = path.parse(filename).name; // Gets filename without extension
      } else {
        displayTitle = 'Unknown Scene';
      }
    }
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'PLAY_SCENE',
      data: {
        url: scene.paths?.stream || '',
        title: displayTitle,
        performers: scene.performers?.map(p => p.performer.name).join(', ') || 'Unknown',
        studio: scene.studioObject?.name || 'Unknown Studio',
        duration: scene.duration || 0,
        sceneId: scene.id,
        rating: scene.rating || 0,
        totalUnwatched: nextSceneData.totalUnwatched || 0,
        artwork: sceneArtwork || null
      }
    };
    
    console.log('📱 Sending Android companion scene response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android next Stash scene endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Mark Stash scene as watched
app.post('/api/android/stash/scene/:id/watched', async (req, res) => {
  console.log('📱 Android app marking scene as watched...');
  
  try {
    const sceneId = req.params.id;
    
    if (!sceneId) {
      return res.status(400).json({ 
        error: 'Invalid scene ID',
        message: 'Scene ID is required' 
      });
    }

    // Call the existing watched endpoint internally
    const baseUrl = getAndroidApiBaseUrl();
    const watchedResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}/watched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!watchedResponse.ok) {
      const errorData = await watchedResponse.json();
      console.error('Failed to mark scene as watched:', errorData);
      return res.status(watchedResponse.status).json({ 
        error: 'Failed to mark scene as watched',
        details: errorData 
      });
    }
    
    const watchedData = await watchedResponse.json();
    console.log('📱 Scene marked as watched successfully:', JSON.stringify(watchedData, null, 2));
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'SCENE_MARKED_WATCHED',
      data: {
        success: true,
        sceneId: sceneId,
        playCount: watchedData.scene?.playCount || 0,
        lastPlayedAt: watchedData.scene?.lastPlayedAt || null,
        stashUpdated: watchedData.stashUpdate?.success || false,
        message: 'Scene marked as watched successfully'
      }
    };
    
    console.log('📱 Sending Android companion watched response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android mark scene as watched endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Delete Stash scene
app.delete('/api/android/stash/scene/:id', async (req, res) => {
  console.log('📱 Android app requesting scene deletion...');
  
  try {
    const sceneId = req.params.id;
    const { deleteFile = false } = req.query; // Optional query parameter to delete file
    
    if (!sceneId) {
      return res.status(400).json({ 
        error: 'Invalid scene ID',
        message: 'Scene ID is required' 
      });
    }

    // Call the existing delete endpoint internally
    const baseUrl = getAndroidApiBaseUrl();
    const deleteUrl = `${baseUrl}/api/stash/scenes/${sceneId}${deleteFile ? '?deleteFile=true' : ''}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      console.error('Failed to delete scene:', errorData);
      return res.status(deleteResponse.status).json({ 
        error: 'Failed to delete scene',
        details: errorData 
      });
    }
    
    const deleteData = await deleteResponse.json();
    console.log('📱 Scene deleted successfully:', JSON.stringify(deleteData, null, 2));
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'SCENE_DELETED',
      data: {
        success: true,
        sceneId: sceneId,
        localDeleted: deleteData.localDeleted || false,
        clipsDeleted: deleteData.clipsDeleted || 0,
        stashDeleted: deleteData.stashDeleted || false,
        fileDeleted: deleteFile === 'true',
        message: 'Scene deleted successfully'
      }
    };
    
    console.log('📱 Sending Android companion delete response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android delete scene endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Play Plex Media
app.post('/api/android/play-plex', async (req, res) => {
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
        errorMessage = 'No Plex player selected. Please configure a player in Settings.';
      } else if (errorMessage.includes('not currently available')) {
        errorMessage = 'Selected Plex player is not currently available. Try selecting a different player.';
      }
      
      const androidErrorResponse = {
        type: 'PLAY_ERROR',
        data: {
          success: false,
          ratingKey: ratingKey,
          title: title,
          mediaType: mediaType,
          error: errorMessage,
          details: playData.details || 'Check Plex server connection and player availability',
          timestamp: new Date().toISOString()
        }
      };
      
      console.error('❌ Playback failed:', JSON.stringify(androidErrorResponse, null, 2));
      res.status(playResponse.status).json(androidErrorResponse);
    }
    
  } catch (error) {
    console.error('❌ Error in Android play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAY_ERROR',
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

// Android companion app endpoint - Play Custom Order Episode or Movie
app.post('/api/android/play-episode', async (req, res) => {
  console.log('📱 Android app requesting custom order episode/movie playback...');
  
  try {
    const { 
      seriesTitle, 
      seasonNumber, 
      episodeNumber, 
      movieTitle, // Support direct movie title for movie playback
      customOrderItemId, 
      title = 'Unknown Media' 
    } = req.body;
    
    // Determine if this is an episode or movie request
    const isEpisodeRequest = seriesTitle && seasonNumber !== undefined && episodeNumber !== undefined;
    const isMovieRequest = movieTitle || (!isEpisodeRequest && title);
    
    if (!isEpisodeRequest && !isMovieRequest) {
      return res.status(400).json({ 
        type: 'PLAY_ERROR',
        data: {
          error: 'Missing media identification',
          message: 'Either provide (seriesTitle, seasonNumber, episodeNumber) for episodes or movieTitle for movies',
          received: { seriesTitle, seasonNumber, episodeNumber, movieTitle, title }
        }
      });
    }
    
    const mediaTitle = isEpisodeRequest ? seriesTitle : (movieTitle || title);
    const mediaType = isEpisodeRequest ? 'episode' : 'movie';
    
    console.log(`📱 Android ${mediaType} request - ${mediaTitle}${isEpisodeRequest ? ` S${seasonNumber}E${episodeNumber}` : ''} (customOrderItemId: ${customOrderItemId})`);
    
    // Try to find the media's rating key by searching Plex
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
      // Helper function to get proper artwork URL (matching up-next endpoint logic)
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
        // Episode response format (matching up-next endpoint)
        androidResponse = {
          type: customOrderItemId ? 'PLAY_CUSTOM_ORDER_ITEM' : 'PLAY_TV_EPISODE',
          data: {
            success: true,
            ratingKey: ratingKeyToUse,
            episodeRatingKey: episodeRatingKey,
            seriesRatingKey: foundMediaMetadata.seriesRatingKey,
            plexId: episodeRatingKey,
            title: foundMediaMetadata.seriesTitle,
            episodeTitle: foundMediaMetadata.title,
            summary: foundMediaMetadata.summary,
            seasonNumber: foundMediaMetadata.seasonNumber,
            episodeNumber: foundMediaMetadata.episodeNumber,
            duration: foundMediaMetadata.duration,
            thumb: foundMediaMetadata.thumb,
            art: foundMediaMetadata.art,
            artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
            mediaType: 'episode',
            customOrderItemId: customOrderItemId || null,
            player: playData.player || 'Unknown Player',
            message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
            timestamp: new Date().toISOString()
          }
        };
      } else if (foundMediaMetadata?.type === 'movie') {
        // Movie response format (matching up-next endpoint)
        androidResponse = {
          type: customOrderItemId ? 'PLAY_CUSTOM_ORDER_ITEM' : 'PLAY_MOVIE',
          data: {
            success: true,
            ratingKey: ratingKeyToUse,
            plexId: ratingKeyToUse,
            title: foundMediaMetadata.title,
            year: foundMediaMetadata.year,
            duration: foundMediaMetadata.duration,
            summary: foundMediaMetadata.summary,
            studio: foundMediaMetadata.studio,
            rating: foundMediaMetadata.rating,
            thumb: foundMediaMetadata.thumb,
            art: foundMediaMetadata.art,
            artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
            mediaType: 'movie',
            customOrderItemId: customOrderItemId || null,
            ...(customOrderItemId && {
              type: 'movie',
              orderName: 'Custom Order' // Could be enhanced to get actual order name
            }),
            player: playData.player || 'Unknown Player',
            message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // Fallback response format
        androidResponse = {
          type: 'PLAY_SUCCESS',
          data: {
            success: true,
            ratingKey: ratingKeyToUse,
            episodeRatingKey: episodeRatingKey,
            movieRatingKey: movieRatingKey,
            title: title,
            mediaTitle: mediaTitle,
            mediaType: mediaType,
            ...(isEpisodeRequest && {
              seriesTitle,
              seasonNumber,
              episodeNumber
            }),
            customOrderItemId,
            player: playData.player || 'Unknown Player',
            message: `Playing "${mediaTitle}" on ${playData.player || 'Plex'}`,
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
          error: playData.error || 'Playback failed',
          details: playData.details || 'Check Plex server connection and player availability',
          timestamp: new Date().toISOString()
        }
      };
      
      console.error('❌ Media playback failed:', JSON.stringify(androidErrorResponse, null, 2));
      res.status(playResponse.status).json(androidErrorResponse);
    }
    
  } catch (error) {
    console.error('❌ Error in Android media play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAY_ERROR',
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

// Android companion app endpoint - Mark Item as Read/Watched
app.post('/api/android/mark-watched', async (req, res) => {
  console.log('📱 Android app requesting to mark item as read/watched...');
  
  try {
    const { itemId, mediaType, title = 'Unknown Item' } = req.body;
    
    if (!itemId) {
      return res.status(400).json({
        type: 'MARK_WATCHED_ERROR',
        data: {
          error: 'Item ID is required',
          message: 'Unable to mark as watched: missing item identifier'
        }
      });
    }
    
    console.log(`📱 Mark watched request - itemId: ${itemId}, mediaType: ${mediaType}, title: ${title}`);
    
    // Use existing mark custom order item as watched endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const watchedResponse = await fetch(`${baseUrl}/api/mark-custom-order-item-watched/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!watchedResponse.ok) {
      const errorData = await watchedResponse.json();
      console.error('Failed to mark item as watched:', errorData);
      
      const androidErrorResponse = {
        type: 'MARK_WATCHED_ERROR',
        data: {
          success: false,
          itemId: itemId,
          title: title,
          mediaType: mediaType,
          error: errorData.error || 'Failed to mark as watched',
          details: errorData.details || 'Check item exists and is not already watched',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(watchedResponse.status).json(androidErrorResponse);
    }
    
    const watchedData = await watchedResponse.json();
    console.log('✅ Item marked as watched successfully:', JSON.stringify(watchedData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'MARK_WATCHED_SUCCESS',
      data: {
        success: true,
        itemId: itemId,
        title: title,
        mediaType: mediaType,
        message: `Successfully marked "${title}" as read/watched`,
        watchLogCreated: watchedData.watchLogCreated || false,
        plexUpdated: watchedData.plexUpdated || false,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Mark watched successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android mark watched endpoint:', error);
    
    const androidErrorResponse = {
      type: 'MARK_WATCHED_ERROR',
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

// Android companion app endpoint - Start Reading Session
app.post('/api/android/reading/start', async (req, res) => {
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
          message: 'Reading sessions are only supported for books, comics, and stories'
        }
      });
    }
    
    console.log(`📱 Start reading session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);
    
    // Use existing reading session start endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const sessionResponse = await fetch(`${baseUrl}/api/reading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mediaType,
        title,
        seriesTitle,
        customOrderItemId
      })
    });
    
    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      console.error('Failed to start reading session:', sessionData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          mediaType: mediaType,
          title: title,
          error: sessionData.error || 'Failed to start reading session',
          details: sessionData.details || 'Check server logs for more information',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(sessionResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session started successfully:', JSON.stringify(sessionData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: sessionData.id,
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle,
        customOrderItemId: customOrderItemId,
        startedAt: sessionData.startedAt,
        isPaused: sessionData.isPaused || false,
        message: `Started reading session for "${title}"`,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Reading session start successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
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

// Android companion app endpoint - Pause/Resume Reading Session
app.post('/api/android/reading/pause', async (req, res) => {
  console.log('📱 Android app requesting to pause/resume reading session...');
  
  try {
    // Use existing reading session pause endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const pauseResponse = await fetch(`${baseUrl}/api/reading/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const pauseData = await pauseResponse.json();
    
    if (!pauseResponse.ok) {
      console.error('Failed to pause/resume reading session:', pauseData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: pauseData.error || 'Failed to pause/resume reading session',
          details: pauseData.details || 'No active reading session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(pauseResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: pauseData.isPaused ? 'READING_SESSION_PAUSED' : 'READING_SESSION_RESUMED',
      data: {
        success: true,
        sessionId: pauseData.id,
        isPaused: pauseData.isPaused,
        title: pauseData.title,
        mediaType: pauseData.mediaType,
        message: pauseData.isPaused ? 
          `Paused reading session for "${pauseData.title}"` : 
          `Resumed reading session for "${pauseData.title}"`,
        pausedAt: pauseData.pausedAt,
        totalActiveTime: pauseData.totalActiveTime,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Reading session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
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

// Android companion app endpoint - Stop Reading Session
app.post('/api/android/reading/stop', async (req, res) => {
  console.log('📱 Android app requesting to stop reading session...');
  
  try {
    const { progress } = req.body;
    
    // Use existing reading session stop endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const stopResponse = await fetch(`${baseUrl}/api/reading/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress })
    });
    
    const stopData = await stopResponse.json();
    
    if (!stopResponse.ok) {
      console.error('Failed to stop reading session:', stopData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: stopData.error || 'Failed to stop reading session',
          details: stopData.details || 'No active reading session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(stopResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session stopped successfully:', JSON.stringify(stopData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: stopData.id,
        title: stopData.title,
        mediaType: stopData.mediaType,
        duration: stopData.duration,
        totalActiveTime: stopData.totalActiveTime,
        progressUpdated: progress ? true : false,
        progress: progress || null,
        message: `Stopped reading session for "${stopData.title}"`,
        completedAt: stopData.completedAt,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Reading session stop successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
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

// Android companion app endpoint - Start Viewing Session
app.post('/api/android/viewing/start', async (req, res) => {
  console.log('📱 Android app requesting to start viewing session...');
  
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    if (!mediaType || !title) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          error: 'Missing required fields',
          message: 'mediaType and title are required'
        }
      });
    }
    
    if (!['webvideo'].includes(mediaType)) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          error: 'Invalid media type',
          message: 'Viewing sessions are only supported for web videos'
        }
      });
    }
    
    console.log(`📱 Start viewing session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);
    
    // Use existing viewing session start endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const sessionResponse = await fetch(`${baseUrl}/api/viewing/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mediaType,
        title,
        seriesTitle,
        customOrderItemId
      })
    });
    
    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      console.error('Failed to start viewing session:', sessionData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          mediaType: mediaType,
          title: title,
          error: sessionData.error || 'Failed to start viewing session',
          details: sessionData.details || 'Check server logs for more information',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(sessionResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session started successfully:', JSON.stringify(sessionData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'VIEWING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: sessionData.id,
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle,
        customOrderItemId: customOrderItemId,
        startedAt: sessionData.startedAt,
        isPaused: sessionData.isPaused || false,
        message: `Started viewing session for "${title}"`,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session start successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
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

// Android companion app endpoint - Pause/Resume Viewing Session
app.post('/api/android/viewing/pause', async (req, res) => {
  console.log('📱 Android app requesting to pause/resume viewing session...');
  
  try {
    // Use existing viewing session pause endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const pauseResponse = await fetch(`${baseUrl}/api/viewing/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const pauseData = await pauseResponse.json();
    
    if (!pauseResponse.ok) {
      console.error('Failed to pause/resume viewing session:', pauseData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: pauseData.error || 'Failed to pause/resume viewing session',
          details: pauseData.details || 'No active viewing session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(pauseResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: pauseData.isPaused ? 'VIEWING_SESSION_PAUSED' : 'VIEWING_SESSION_RESUMED',
      data: {
        success: true,
        sessionId: pauseData.id,
        isPaused: pauseData.isPaused,
        title: pauseData.title,
        mediaType: pauseData.mediaType,
        message: pauseData.isPaused ? 
          `Paused viewing session for "${pauseData.title}"` : 
          `Resumed viewing session for "${pauseData.title}"`,
        pausedAt: pauseData.pausedAt,
        totalActiveTime: pauseData.totalActiveTime,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
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

// Android companion app endpoint - Stop Viewing Session
app.post('/api/android/viewing/stop', async (req, res) => {
  console.log('📱 Android app requesting to stop viewing session...');
  
  try {
    const { progress } = req.body;
    
    // Use existing viewing session stop endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const stopResponse = await fetch(`${baseUrl}/api/viewing/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress })
    });
    
    const stopData = await stopResponse.json();
    
    if (!stopResponse.ok) {
      console.error('Failed to stop viewing session:', stopData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: stopData.error || 'Failed to stop viewing session',
          details: stopData.details || 'No active viewing session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(stopResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session stopped successfully:', JSON.stringify(stopData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'VIEWING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: stopData.id,
        title: stopData.title,
        mediaType: stopData.mediaType,
        duration: stopData.duration,
        totalActiveTime: stopData.totalActiveTime,
        progressUpdated: progress ? true : false,
        progress: progress || null,
        message: `Stopped viewing session for "${stopData.title}"`,
        completedAt: stopData.completedAt,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session stop successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
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

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down server...');
  
  // Stop background sync service
  await backgroundSync.stop();
  
  await prisma.$disconnect();
  console.log('Prisma client disconnected.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to WebSocket');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at http://192.168.1.252:${PORT}`);
  console.log(`WebSocket server ready for real-time notifications`);
  
  // Start background sync service
  try {
    await backgroundSync.start();
  } catch (error) {
    console.error('Failed to start background sync service:', error);
  }
  
  // Start Stash background sync service
  try {
    await stashBackgroundSync.start();
  } catch (error) {
    console.error('Failed to start Stash background sync service:', error);
  }
  
  // Initialize Stash service
  try {
    await initializeStashService();
    console.log('✅ Stash service initialization completed');
  } catch (error) {
    console.error('❌ Failed to initialize Stash service:', error);
  }
  
  // Initialize Stash sync service
  try {
    await initializeStashSyncService();
    console.log('✅ Stash sync service initialization completed');
  } catch (error) {
    console.error('❌ Failed to initialize Stash sync service:', error);
  }
});





