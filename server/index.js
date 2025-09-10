const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const getNextEpisode = require('./getNextEpisode');
const getNextMovie = require('./getNextMovie');
const { getNextCustomOrder, markCustomOrderItemAsWatched } = require('./getNextCustomOrder');
// Import modular route files
const datingRoutes = require('./routes/dating');
const notesRoutes = require('./routes/notes');
const settingsRoutes = require('./routes/settings');
const artworkRoutes = require('./routes/artwork');
const weatherRoutes = require('./routes/weather');
const healthRoutes = require('./routes/health');
const plexRoutes = require('./routes/plex');
const createStashRouter = require('./routes/stash');
const comicvineRoutes = require('./routes/comicvine');
const komgaRoutes = require('./routes/komga');
const openlibraryRoutes = require('./routes/openlibrary');
const tvdbRoutes = require('./routes/tvdb');
const ordersRoutes = require('./routes/orders');
const webhookRoutes = require('./routes/webhooks');
const backgroundsRoutes = require('./routes/backgrounds');
const backgroundGalleriesRoutes = require('./routes/backgroundGalleries');
const legacyRedirectsRoutes = require('./routes/legacyRedirects');
const searchDebugRoutes = require('./routes/searchDebug');
const settingsLegacyRedirectsRoutes = require('./routes/settingsLegacyRedirects');

// Import utility functions
const { generateOptimizedClips, simpleHash, getUploadDirectory } = require('./utils/utilities');

// ========================================
// UTILITY FUNCTIONS EXTRACTED
// ========================================
// All utility functions have been moved to:
// - server/utils/utilities.js (generateOptimizedClips, simpleHash, getUploadDirectory)

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

// ========================================
// UTILITY FUNCTIONS EXTRACTED
// ========================================
// getUploadDirectory function moved to server/utils/utilities.js

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

// Core Application API routes (Phase 4 Modularization)
const createCoreRouter = require('./routes/core');
app.use('/api', createCoreRouter());

// Plex Integration API routes
app.use('/api/plex', plexRoutes);

// Stash Integration API routes
const stashRoutes = createStashRouter({ 
  io: io, 
  stashBackgroundSync: stashBackgroundSync 
});
app.use('/api/stash', stashRoutes);

// Stash Image Proxy route (separate mounting for frontend compatibility)
const stashImageProxyRouter = express.Router();

stashImageProxyRouter.get('/*', async (req, res) => {
  try {
    const imagePath = req.params[0]; // Get everything after /api/stash-image-proxy/
    
    // Get settings using cached database utility
    const { getSettings } = require('./databaseUtils');
    const settings = await getSettings();
    
    if (!settings || !settings.stashUrl) {
      return res.status(500).send('Stash settings not configured');
    }
    
    // Import Prisma here to avoid circular dependencies
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    let imageUrl;
    
    // If the path is already a full HTTP URL, use it directly
    if (imagePath.startsWith('http')) {
      imageUrl = imagePath;
    } else {
      // For file paths, we need to find the image by path and get its ID from Stash
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
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/image/${image.id}/image`;
      } else {
        // Fallback: try to use the path directly
        console.warn(`Could not find image ID for path: ${imagePath}, trying direct path`);
        const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
        const baseUrl = settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl;
        imageUrl = `${baseUrl}/${cleanPath}`;
      }
    }
    
    console.log(`Proxying Stash image: ${imageUrl}`);
    
    // Forward the request to Stash
    const axios = require('axios');
    const proxyResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Eddie-Life-Management/1.0'
      }
    });
    
    // Set content type based on response
    const contentType = proxyResponse.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    
    // Add cache headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Pipe the image data to the response
    proxyResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error proxying Stash image:', error.message);
    res.status(500).send('Failed to proxy image from Stash');
  }
});

app.use('/api/stash-image-proxy', stashImageProxyRouter);

// Custom Orders API routes
const createCustomOrdersRouter = require('./routes/customOrders');
app.use('/api/custom-orders', createCustomOrdersRouter());

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

// Watch Tracking API routes
const watchTrackingRoutesFactory = require('./routes/watchTracking');
const watchTrackingRoutes = watchTrackingRoutesFactory(io);
app.use('/api', watchTrackingRoutes);

// Background Management API routes
app.use('/api/backgrounds', backgroundsRoutes);

// Background Galleries API routes
app.use('/api/background-galleries', backgroundGalleriesRoutes);

// Legacy Redirects API routes
app.use('/api', legacyRedirectsRoutes);

// Search & Debug API routes
app.use('/api', searchDebugRoutes);

// Settings Legacy Redirects API routes
app.use('/api', settingsLegacyRedirectsRoutes);

// ========================================
// SETTINGS LEGACY REDIRECTS EXTRACTED
// ========================================
// All settings legacy redirect routes have been moved to:
// - server/routes/settingsLegacyRedirects.js (eddie-settings, android/weather redirects)
// Routes are mounted at:
// - /api/eddie-settings -> settingsLegacyRedirectsRoutes (redirects to /api/settings/eddie)
// - /api/android/weather -> settingsLegacyRedirectsRoutes (redirects to /api/weather/android)

// ========================================
// SEARCH & DEBUG API EXTRACTED
// ========================================
// All search and debug routes have been moved to:
// - server/routes/searchDebug.js (search, debug, test endpoints)
// Routes are mounted at:
// - /api/search -> searchDebugRoutes
// - /api/debug/* -> searchDebugRoutes
// - /api/test -> searchDebugRoutes

// ========================================
// LEGACY REDIRECTS EXTRACTED
// ========================================
// All legacy redirect routes (11 endpoints) have been moved to:
// - server/routes/legacyRedirects.js (backward compatibility redirects)
// Routes are mounted at:
// - /api/* -> legacyRedirectsRoutes (for various legacy endpoints)

// ========================================
// UTILITY FUNCTIONS EXTRACTED
// ========================================
// simpleHash function moved to server/utils/utilities.js

// ========================================
// SETTINGS LEGACY REDIRECTS EXTRACTED
// ========================================
// All settings redirect routes have been moved to:
// - server/routes/settingsLegacyRedirects.js (eddie-settings, android/weather)

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

// ========================================
// SEARCH & DEBUG API ROUTES EXTRACTED
// ========================================
// Test endpoint has been moved to:
// - server/routes/searchDebug.js (/api/test)

// ========================================
// MODULARIZATION COMPLETE
// ========================================
// All API routes have been successfully extracted to dedicated modular files:
//
// Core Service Routes:
// - server/routes/plex.js (Plex integration)
// - server/routes/stash.js (Stash integration) 
// - server/routes/komga.js (Komga comics)
// - server/routes/comicvine.js (ComicVine API)
// - server/routes/openlibrary.js (OpenLibrary books)
// - server/routes/tvdb.js (TVDB metadata)
//
// Content Management:
// - server/routes/orders.js (custom orders)
// - server/routes/customOrderItems.js (order items)
// - server/routes/backgrounds.js (background images)
// - server/routes/backgroundGalleries.js (image galleries)
// - server/routes/music.js (music playlists)
// - server/routes/notes.js (notes system)
//
// Utility Routes:
// - server/routes/artwork.js (artwork proxy/caching)
// - server/routes/settings.js (configuration)
// - server/routes/weather.js (weather API)
// - server/routes/health.js (health checks)
// - server/routes/webhooks.js (webhook endpoints)
// - server/routes/watchTracking.js (viewing sessions)
// - server/routes/searchDebug.js (search & debug)
// - server/routes/legacyRedirects.js (backward compatibility)
//
// Specialized Routes:
// - android_companion_routes_complete_fixed.js (18 Android endpoints)
//
// All routes follow the modular dependency injection pattern and are properly
// mounted with their respective prefixes for clean separation of concerns.
// - /api/backgrounds/* -> backgroundsRoutes
// - /api/background-galleries/* -> backgroundGalleriesRoutes

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    console.log(`⚠️  [FALLBACK] Request fell through to React app catch-all: ${req.method} ${req.url}`);
    console.log(`⚠️  [FALLBACK] This means the API route was not matched!`);
    console.log(`⚠️  [FALLBACK] User-Agent: ${req.get('User-Agent')}`);
    console.log(`⚠️  [FALLBACK] Accept: ${req.get('Accept')}`);
    
    if (req.url.includes('/api/')) {
      console.log(`❌ [FALLBACK] ERROR: API route ${req.url} not found - serving HTML instead!`);
      console.log(`❌ [FALLBACK] This is why you're getting HTML instead of JSON!`);
    }
    
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

// Global error handlers for unhandled rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Promise Rejection:', reason);
  console.error('🚨 Promise:', promise);
  // Don't exit in production to maintain uptime
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  // Always exit on uncaught exceptions
  shutdown();
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to WebSocket');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Add error handling middleware (must be last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString()
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', async () => {
  console.log('🚀 =================================');
  console.log('🚀 MASTER ORDER SERVER STARTING');
  console.log('🚀 =================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Server accessible at http://192.168.1.252:${PORT}`);
  console.log(`🚀 WebSocket server ready for real-time notifications`);
  console.log('🚀 Environment Variables:');
  console.log(`🚀   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🚀   DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.log(`🚀   PORT: ${PORT}`);
  
  // Test database connection immediately
  console.log('🚀 Testing database connection...');
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Check critical tables
    console.log('🚀 Checking critical tables...');
    try {
      // Use a simple query to check if tables exist instead of database-specific syntax
      const backgroundImageCount = await prisma.backgroundImage.count();
      console.log('✅ BackgroundImage table exists, rows:', backgroundImageCount);
    } catch (error) {
      console.log('⚠️ BackgroundImage table may not exist or be accessible:', error.message);
    }
    
    try {
      const backgroundGalleryCount = await prisma.backgroundGallery.count();
      console.log('✅ BackgroundGallery table exists, rows:', backgroundGalleryCount);
    } catch (error) {
      console.log('⚠️ BackgroundGallery table may not exist or be accessible:', error.message);
    }
    
  } catch (dbError) {
    console.error('❌ Database connection failed:', dbError);
  }
  
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

// Load Android Companion App API routes (consolidated from modularization)
const setupAndroidRoutes = require('./android_companion_routes_complete_fixed');
setupAndroidRoutes(app, io, getNextEpisode, getNextMovie, getNextCustomOrder, watchLogService, prisma);





