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
const settingsRoutes = require('./routes/settings');
const artworkRoutes = require('./routes/artwork');
const weatherRoutes = require('./routes/weather');
const healthRoutes = require('./routes/health');
const androidRoutes = require('./routes/android');
const plexRoutes = require('./routes/plex');
const stashRoutesFactory = require('./routes/stash');
const comicvineRoutes = require('./routes/comicvine');
const komgaRoutes = require('./routes/komga');
const openlibraryRoutes = require('./routes/openlibrary');
const tvdbRoutes = require('./routes/tvdb');
const ordersRoutes = require('./routes/orders');
const webhookRoutes = require('./routes/webhooks');

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
const PlexSyncService = require('./plexSyncService'); // Added import
const BackgroundSyncService = require('./backgroundSyncService'); // Added import
const StashBackgroundSyncService = require('./stashBackgroundSyncService'); // Added import
const ArtworkCacheService = require('./artworkCacheService'); // Added import
const subOrderService = require('./subOrderService'); // Added import
const WatchLogService = require('./watchLogService'); // Added import
const mm = require('music-metadata');
const comicSearchService = require('./comicSearchService'); // Added import
const { getTimezoneAwarePeriodBounds, getTimezoneAwareDateGrouping, formatDateInTimezone } = require('./utils/timezoneUtils');
const StatisticsService = require('./services/statisticsService');
const WatchStatsRoutes = require('./routes/watchStatsRoutes');

// Initialize services
const plexDb = new PlexDatabaseService();
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

// Helper function to determine upload directory based on environment
function getUploadDirectory(subDir = '') {
  if (process.env.NODE_ENV === 'production') {
    // In production/Docker, use persistent data directory
    const dataDir = process.env.DATA_PATH || '/app/data';
    return path.join(dataDir, 'uploads', subDir);
  } else {
    // In development, use local uploads directory
    return path.join(__dirname, 'uploads', subDir);
  }
}

// Set up multer for handling multipart form data (Plex webhooks)
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Comprehensive request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const origin = req.get('Origin') || 'No Origin';
  const referer = req.get('Referer') || 'No Referer';
  
  console.log(`🌐 [${timestamp}] ${method} ${url}`);
  console.log(`🌐 [REQUEST] User-Agent: ${userAgent.substring(0, 100)}`);
  console.log(`🌐 [REQUEST] Origin: ${origin}`);
  console.log(`🌐 [REQUEST] Referer: ${referer}`);
  
  // Log specifically for background API calls
  if (url.includes('/api/background')) {
    console.log(`📸🖼️  [BACKGROUND API] === INCOMING REQUEST ===`);
    console.log(`📸🖼️  [BACKGROUND API] Method: ${method}`);
    console.log(`📸🖼️  [BACKGROUND API] URL: ${url}`);
    console.log(`📸🖼️  [BACKGROUND API] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📸🖼️  [BACKGROUND API] Query:`, JSON.stringify(req.query, null, 2));
    console.log(`📸🖼️  [BACKGROUND API] Body:`, JSON.stringify(req.body, null, 2));
  }
  
  // Override res.send to log responses
  const originalSend = res.send;
  res.send = function(data) {
    if (url.includes('/api/background')) {
      console.log(`📸🖼️  [BACKGROUND API] === OUTGOING RESPONSE ===`);
      console.log(`📸🖼️  [BACKGROUND API] Status: ${res.statusCode}`);
      console.log(`📸🖼️  [BACKGROUND API] Content-Type: ${res.get('Content-Type')}`);
      console.log(`📸🖼️  [BACKGROUND API] Response Length: ${data ? data.length : 0}`);
      if (res.statusCode >= 400) {
        console.log(`📸🖼️  [BACKGROUND API] Error Response:`, data.substring(0, 500));
      }
    }
    return originalSend.call(this, data);
  };
  
  next();
});

// Serve static files from client build in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  console.log('Serving static files from:', clientBuildPath);
}

// Serve uploaded files (backgrounds, etc.) from appropriate directory
const uploadsPath = getUploadDirectory();
app.use('/uploads', express.static(uploadsPath));
console.log('Serving uploads from:', uploadsPath);

// Dating API routes
app.use('/api/dating', datingRoutes);

// Notes API routes
app.use('/api/notes', notesRoutes);

// Settings API routes
app.use('/api/settings', settingsRoutes);

// Artwork API routes
app.use('/api/artwork', artworkRoutes);

// Weather API routes
app.use('/api/weather', weatherRoutes);

// Health & Monitoring API routes
app.use('/api/health', healthRoutes);

// Android Companion App API routes
app.use('/api/android', androidRoutes);

// Plex Integration API routes
app.use('/api/plex', plexRoutes);

// Stash Integration API routes
const stashRoutes = stashRoutesFactory(io);
app.use('/api/stash', stashRoutes);

// Custom Orders API routes
const customOrdersRoutes = require('./routes/customOrders');
app.use('/api/custom-orders', customOrdersRoutes);

// Orders API routes
app.use('/api/orders', ordersRoutes);

// Webhook routes
app.use('/webhook', webhookRoutes); // Main webhook at /webhook
app.use('/api/webhook', webhookRoutes); // API webhook at /api/webhook/*

// Custom Order Items API routes
const customOrderItemsRoutes = require('./routes/customOrderItems');
app.use('/api/custom-orders', customOrderItemsRoutes);

// Playlists API routes
const playlistsRoutes = require('./routes/playlists');
app.use('/api/playlists', playlistsRoutes);

// Books API routes
const booksRoutes = require('./routes/books');
app.use('/api/books', booksRoutes);

// Music API routes
const musicRoutes = require('./routes/music');
app.use('/api/music', musicRoutes);

// ComicVine Integration API routes
app.use('/api/comicvine', comicvineRoutes);

// Komga Integration API routes
app.use('/api/komga', komgaRoutes);

// OpenLibrary Integration API routes
app.use('/api/openlibrary', openlibraryRoutes);

// TVDB Integration API routes
app.use('/api/tvdb', tvdbRoutes);

// Legacy route redirects for backward compatibility
app.get('/api/up_next', (req, res) => res.redirect('/api/plex/up-next'));
app.get('/api/start-new-series', (req, res) => res.redirect('/api/plex/start-new-series'));
app.get('/api/plex-media/:plexKey', (req, res) => res.redirect(`/api/plex/media/${req.params.plexKey}`));

// Legacy Stash route redirects for backward compatibility
app.get('/api/stash-image-proxy/*', (req, res) => res.redirect(`/api/stash/image-proxy/${req.params[0]}`));

// Legacy ComicVine route redirects for backward compatibility
app.get('/api/comicvine-artwork', (req, res) => res.redirect(`/api/comicvine/artwork?${new URLSearchParams(req.query)}`));
app.get('/api/comicvine-cover', (req, res) => res.redirect(`/api/comicvine/cover?${new URLSearchParams(req.query)}`));

// Legacy Komga route redirects for backward compatibility
app.get('/api/komga-test', (req, res) => res.redirect('/api/komga/test'));
app.get('/api/komga-search', (req, res) => res.redirect(`/api/komga/search?${new URLSearchParams(req.query)}`));
app.get('/api/komga-search-comic', (req, res) => res.redirect(`/api/komga/search-comic?${new URLSearchParams(req.query)}`));

// Legacy OpenLibrary route redirects for backward compatibility
app.get('/api/openlibrary-artwork', (req, res) => res.redirect(`/api/openlibrary/artwork?${new URLSearchParams(req.query)}`));

// Legacy TVDB route redirects for backward compatibility
app.get('/api/tvdb-artwork', (req, res) => res.redirect(`/api/tvdb/artwork?${new URLSearchParams(req.query)}`));

// Helper function for generating a simple hash (used for web video uniqueness)
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Ensure positive integer
}

// API Routes
// Redirect eddie-settings to the new settings route structure
app.get('/api/eddie-settings', (req, res) => {
  res.redirect('/api/settings/eddie');
});

app.put('/api/eddie-settings', (req, res) => {
  res.redirect(307, '/api/settings/eddie'); // 307 preserves the PUT method
});

// Redirect legacy Android weather endpoint to new modular route
app.get('/api/android/weather', (req, res) => {
  res.redirect('/api/weather/android');
});











// Get all clips with pagination and filtering



// Play a specific clip by ID


// Get clips for a specific scene
// Reset all clips watched status (for testing)

// Stash clip-play route now handled by modular router

// Stash sync endpoints

// Settings endpoints

// Stash sync endpoints


// Sync configuration and performance endpoint


// Performance testing endpoint  














// Get Stash sync status

// Plex webhook endpoint (moved to modular routes)


// Plex sync endpoints (moved to modular routes)





// Stash Background Sync Endpoints
















// Start playback on selected player endpoint






// Webhook notification endpoint (moved to modular routes)

app.get('/api/test', async (req, res) => {
  try {
    const data = await callPlex(); // Call the imported function
    res.json(data);
  } catch (error) {
    console.error('Failed to fetch data:', error.message);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Order routes (moved to modular routes)
// Legacy redirect for get-next-custom-order
app.get('/api/get-next-custom-order', (req, res) => {
  res.redirect('/api/orders/custom/next');
});

// Get a single custom order item by ID
// *** MOVED TO /server/routes/customOrders.js ***

// Custom Order Management Endpoints
// *** ALL ROUTES MOVED TO /server/routes/customOrders.js ***

// Add item to custom order
// *** DUPLICATE ROUTE - MOVED TO /server/routes/customOrders.js ***

// Custom Order Items POST route (moved to modular routes)
// All custom order item CRUD operations moved to server/routes/customOrderItems.js

