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
// *** DUPLICATE ROUTE - MOVED TO /server/routes/customOrders.js ***
// *** TODO: Remove this duplicate route after testing modular routes ***
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

// Mark custom order item as watched from home page
// *** MOVED TO /server/routes/customOrders.js (item management) ***
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
        return `${baseUrl}/api/comicvine/artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
      }
      
      // For books, use OpenLibrary artwork
      if (media?.type === 'book' && media?.bookCoverUrl) {
        console.log('📱 Using OpenLibrary artwork:', media.bookCoverUrl);
        return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
      }
      
      // For short stories, use story cover or fallback to containing book's cover
      if (media?.type === 'shortstory') {
        if (media?.storyCoverUrl) {
          console.log('📱 Using short story cover artwork:', media.storyCoverUrl);
          return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
        } else if (media?.containedInBookDetails?.coverUrl) {
          console.log('📱 Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
          return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
        }
      }
      
      // Prioritize TVDB artwork if available for TV content
      if (media?.tvdbArtwork?.url) {
        console.log('📱 Using TVDB artwork:', media.tvdbArtwork.url);
        return `${baseUrl}/api/tvdb/artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
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

      // Fetch additional custom order details including playlist and background gallery
      let customOrderDetails = null;
      if (upNextData.customOrderId) {
        try {
          customOrderDetails = await prisma.customOrder.findUnique({
            where: { id: upNextData.customOrderId },
            include: {
              plexPlaylist: true,
              customPlaylist: true,
              backgroundGallery: true
            }
          });
          console.log('📱 Fetched custom order details for Android:', {
            id: customOrderDetails?.id,
            plexPlaylist: customOrderDetails?.plexPlaylist?.title,
            customPlaylist: customOrderDetails?.customPlaylist?.title,
            backgroundGallery: customOrderDetails?.backgroundGallery?.name
          });
        } catch (error) {
          console.error('📱 Error fetching custom order details:', error);
        }
      }
      
      androidResponse = {
        type: 'PLAY_CUSTOM_ORDER_ITEM',
        data: {
          id: upNextData.id,
          title: upNextData.title,
          type: upNextData.type,
          orderName: upNextData.customOrderName || customOrderDetails?.name || 'Custom Order', // Use the actual custom order name
          summary: upNextData.summary || '',
          duration: upNextData.duration || 0,
          localArtworkPath: upNextData.localArtworkPath || '',
          artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
          streamUrl: upNextData.streamUrl || '',
          ratingKey: episodeRatingKey || null,
          plexId: episodeRatingKey || null, // Add plexId field for Plex content
          webUrl: upNextData.webUrl || null, // Add webUrl field for web video content
          customOrderId: upNextData.customOrderId || null,
          customOrderItemId: upNextData.customOrderItemId || null,
          // Playlist information
          playlistName: customOrderDetails?.plexPlaylist?.title || customOrderDetails?.customPlaylist?.title || null,
          playlistType: customOrderDetails?.plexPlaylist ? 'plex' : customOrderDetails?.customPlaylist ? 'custom' : null,
          // Background gallery information
          backgroundGalleryName: customOrderDetails?.backgroundGallery?.name || null,
          backgroundGalleryId: customOrderDetails?.backgroundGallery?.id || null,
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

// Android companion app endpoint - Play Custom Order Episode, Movie, or Web Video
app.post('/api/android/play-episode', async (req, res) => {
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
            type: 'PLAY_CUSTOM_ORDER_ITEM',
            data: {
              success: true,
              id: customOrderItemId,
              title: mediaTitle,
              type: 'webvideo',
              orderName: 'Custom Order', // Could be enhanced to get actual order name
              summary: '',
              duration: 0,
              artworkUrl: null,
              webUrl: webUrl,
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
        type: 'PLAY_CUSTOM_ORDER_ITEM',
        data: {
          success: true,
          id: customOrderItemId,
          title: mediaTitle,
          type: 'webvideo',
          orderName: 'Custom Order',
          summary: '',
          duration: 0,
          artworkUrl: null,
          webUrl: webUrl,
          customOrderItemId: customOrderItemId,
          message: `Playing web video "${mediaTitle}"`,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('✅ Web video playback successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      return;
    }
    
    // Try to find the media's rating key by searching Plex (for episodes/movies)
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
    
    // Check if this will result in 100% completion for better response handling
    const willMarkAsRead = progress?.readPercentage === 100;
    
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
        markedAsRead: willMarkAsRead, // Indicate if item was marked as read due to 100% completion
        message: willMarkAsRead 
          ? `Completed reading "${stopData.title}" and marked as read`
          : `Stopped reading session for "${stopData.title}"`,
        completedAt: stopData.completedAt,
        timestamp: new Date().toISOString()
      }
    };
    
    if (willMarkAsRead) {
      console.log(`📖 Comic/book marked as read due to 100% completion: ${stopData.title}`);
    }
    
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

// Android companion app endpoint - Random Gallery Image
app.get('/api/android/gallery/:galleryName/random-image', async (req, res) => {
  console.log('📱 Android app requesting random image from gallery...');
  
  try {
    const { galleryName } = req.params;
    
    if (!galleryName) {
      return res.status(400).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Missing gallery name',
          message: 'Gallery name is required in the URL path',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Find the gallery by name (exact match only)
    const gallery = await prisma.BackgroundGallery.findFirst({
      where: {
        name: galleryName
      },
      include: {
        backgrounds: true
      }
    });
    
    if (!gallery) {
      return res.status(404).json({
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
      return res.status(404).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'No images in gallery',
          message: `Gallery "${galleryName}" contains no images`,
          galleryName: galleryName,
          galleryId: gallery.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random image from gallery
    const randomIndex = Math.floor(Math.random() * gallery.backgrounds.length);
    const randomImage = gallery.backgrounds[randomIndex];
    
    // Generate image URL based on available data
    let imageUrl = null;
    const baseUrl = getAndroidApiBaseUrl();
    
    if (randomImage.url) {
      // Direct URL available
      imageUrl = randomImage.url;
    } else if (randomImage.path) {
      // Use path to construct URL (assuming it's relative to uploads/backgrounds)
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename || path.basename(randomImage.path)}`;
    } else if (randomImage.filename) {
      // Use filename to construct URL
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename}`;
    }
    
    const androidResponse = {
      type: 'RANDOM_IMAGE_SUCCESS',
      data: {
        success: true,
        galleryName: gallery.name,
        galleryId: gallery.id,
        galleryDescription: gallery.description,
        image: {
          id: randomImage.id,
          filename: randomImage.filename,
          originalName: randomImage.originalName,
          url: imageUrl,
          width: randomImage.width,
          height: randomImage.height,
          size: randomImage.size,
          mimetype: randomImage.mimetype
        },
        totalImages: gallery.backgrounds.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random gallery image response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android random gallery image endpoint:', error);
    
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

// Android companion app endpoint - Random Playlist Track
app.get('/api/android/playlist/:playlistName/random-track', async (req, res) => {
  console.log('📱 Android app requesting random track from playlist...');
  
  try {
    const { playlistName } = req.params;
    
    if (!playlistName) {
      return res.status(400).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Missing playlist name',
          message: 'Playlist name is required in the URL path',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Search for playlist in both Plex and Custom playlists
    let playlist = null;
    let playlistType = null;
    let tracks = [];
    
    // Try Plex playlists first (exact match only)
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
      tracks = plexPlaylist.items || [];
    } else {
      // Try Custom playlists (exact match only)
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
        tracks = customPlaylist.tracks || [];
      }
    }
    
    if (!playlist) {
      return res.status(404).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Playlist not found',
          message: `Playlist "${playlistName}" does not exist in Plex or Custom playlists`,
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!tracks || tracks.length === 0) {
      return res.status(404).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'No tracks in playlist',
          message: `Playlist "${playlistName}" contains no tracks`,
          playlistName: playlistName,
          playlistType: playlistType,
          playlistId: playlist.id || playlist.ratingKey,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random track from playlist
    const randomIndex = Math.floor(Math.random() * tracks.length);
    const randomTrack = tracks[randomIndex];
    
    // Get full track metadata from Plex for streaming and artwork information
    const settings = await prisma.settings.findFirst();
    let plexTrackMetadata = null;
    let streamUrl = null;
    let artworkUrl = null;
    
    if (settings && settings.plexUrl && settings.plexToken && randomTrack.ratingKey) {
      try {
        console.log(`📱 Fetching Plex metadata for track ${randomTrack.ratingKey}...`);
        const trackResponse = await fetch(`${settings.plexUrl}/library/metadata/${randomTrack.ratingKey}?X-Plex-Token=${settings.plexToken}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (trackResponse.ok) {
          const trackData = await trackResponse.json();
          plexTrackMetadata = trackData.MediaContainer?.Metadata?.[0];
          
          // Get streaming URL
          const mediaPart = plexTrackMetadata?.Media?.[0]?.Part?.[0];
          if (mediaPart && mediaPart.key) {
            streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
          }
          
          // Get artwork URL
          if (plexTrackMetadata?.thumb) {
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.thumb}?X-Plex-Token=${settings.plexToken}`;
          } else if (plexTrackMetadata?.parentThumb) {
            // Use album artwork if track artwork not available
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.parentThumb}?X-Plex-Token=${settings.plexToken}`;
          } else if (plexTrackMetadata?.grandparentThumb) {
            // Use artist artwork as fallback
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.grandparentThumb}?X-Plex-Token=${settings.plexToken}`;
          }
          
          console.log(`📱 Plex metadata loaded:`, {
            title: plexTrackMetadata?.title,
            hasStreamUrl: !!streamUrl,
            hasArtwork: !!artworkUrl
          });
        } else {
          console.warn(`⚠️ Failed to fetch Plex metadata for track ${randomTrack.ratingKey}:`, trackResponse.status);
        }
      } catch (error) {
        console.error(`❌ Error fetching Plex metadata for track ${randomTrack.ratingKey}:`, error);
      }
    }
    
    // Format track data based on playlist type
    let trackData = {};
    if (playlistType === 'plex') {
      trackData = {
        ratingKey: randomTrack.ratingKey,
        title: plexTrackMetadata?.title || randomTrack.title,
        artist: plexTrackMetadata?.originalTitle || plexTrackMetadata?.grandparentTitle || null,
        album: plexTrackMetadata?.parentTitle || null,
        duration: plexTrackMetadata?.duration || randomTrack.duration,
        type: randomTrack.type || 'track',
        addedAt: randomTrack.addedAt,
        // Android-specific fields
        streamUrl: streamUrl,
        artworkUrl: artworkUrl,
        plexUrl: settings?.plexUrl,
        // Additional metadata from Plex
        year: plexTrackMetadata?.year,
        index: plexTrackMetadata?.index, // Track number
        parentIndex: plexTrackMetadata?.parentIndex, // Disc number
        rating: plexTrackMetadata?.rating
      };
    } else {
      trackData = {
        ratingKey: randomTrack.ratingKey,
        title: plexTrackMetadata?.title || randomTrack.title,
        artist: plexTrackMetadata?.originalTitle || plexTrackMetadata?.grandparentTitle || randomTrack.artist,
        album: plexTrackMetadata?.parentTitle || randomTrack.album,
        duration: plexTrackMetadata?.duration || randomTrack.duration,
        sortOrder: randomTrack.sortOrder,
        addedAt: randomTrack.addedAt,
        // Android-specific fields
        streamUrl: streamUrl,
        artworkUrl: artworkUrl,
        plexUrl: settings?.plexUrl,
        // Additional metadata from Plex
        year: plexTrackMetadata?.year,
        index: plexTrackMetadata?.index, // Track number
        parentIndex: plexTrackMetadata?.parentIndex, // Disc number
        rating: plexTrackMetadata?.rating
      };
    }
    
    const androidResponse = {
      type: 'RANDOM_TRACK_SUCCESS',
      data: {
        success: true,
        playlistName: playlist.title,
        playlistType: playlistType,
        playlistId: playlist.id || playlist.ratingKey,
        playlistDescription: playlist.description || playlist.summary,
        track: trackData,
        totalTracks: tracks.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random playlist track response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android random playlist track endpoint:', error);
    
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

// ==========================================
// BACKGROUND IMAGES API ENDPOINTS
// ==========================================

// Configure multer for file uploads
const backgroundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = getUploadDirectory('backgrounds');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'bg-' + uniqueSuffix + ext);
  }
});

const backgroundUpload = multer({
  storage: backgroundStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get all backgrounds
app.get('/api/backgrounds', async (req, res) => {
  console.log('📸 [BACKGROUNDS] API endpoint called');
  console.log('📸 [BACKGROUNDS] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('📸 [BACKGROUNDS] DATABASE_URL:', process.env.DATABASE_URL);
  console.log('📸 [BACKGROUNDS] NODE_ENV:', process.env.NODE_ENV);
  
  try {
    console.log('📸 [BACKGROUNDS] Attempting to connect to database...');
    
    // Test database connection first
    await prisma.$connect();
    console.log('📸 [BACKGROUNDS] Database connection successful');
    
    // Check if BackgroundImage table exists (database-agnostic)
    console.log('📸 [BACKGROUNDS] Checking if BackgroundImage table exists...');
    const isPostgres = process.env.DATABASE_URL?.includes('postgresql://');
    let tableExists;
    
    if (isPostgres) {
      tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'BackgroundImage'
        );
      `;
      console.log('📸 [BACKGROUNDS] BackgroundImage table exists (PostgreSQL):', tableExists[0]?.exists || false);
    } else {
      tableExists = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='table' AND name='BackgroundImage';
      `;
      console.log('📸 [BACKGROUNDS] BackgroundImage table exists (SQLite):', tableExists.length > 0);
    }
    
    console.log('📸 [BACKGROUNDS] Attempting to query BackgroundImage table...');
    const backgrounds = await prisma.BackgroundImage.findMany({
      include: {
        gallery: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📸 [BACKGROUNDS] Query successful, found', backgrounds.length, 'backgrounds');
    console.log('📸 [BACKGROUNDS] Sample background:', backgrounds[0] ? JSON.stringify(backgrounds[0], null, 2) : 'None');
    
    res.json(backgrounds);
  } catch (error) {
    console.error('❌ [BACKGROUNDS] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      meta: error.meta
    });
    res.status(500).json({ 
      error: 'Failed to fetch backgrounds',
      details: error.message,
      code: error.code 
    });
  }
});

// Upload backgrounds
app.post('/api/backgrounds/upload', backgroundUpload.array('backgrounds'), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploaded = [];
    const errors = [];

    for (const file of files) {
      try {
        // Get image dimensions
        const sharp = require('sharp');
        const metadata = await sharp(file.path).metadata();

        const background = await prisma.BackgroundImage.create({
          data: {
            filename: file.filename, // Use the stored filename
            originalName: file.originalname, // Use originalName field
            path: file.path, // Use path field
            mimetype: file.mimetype, // Use mimetype field (lowercase)
            size: file.size, // Use size field
            width: metadata.width,
            height: metadata.height
          }
        });

        uploaded.push(background);
      } catch (error) {
        console.error('Error processing file:', file.originalname, error);
        errors.push(`Failed to process ${file.originalname}: ${error.message}`);
        
        // Clean up failed file
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkError) {
          console.error('Error cleaning up file:', unlinkError);
        }
      }
    }

    res.json({ uploaded, errors });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload backgrounds' });
  }
});

// Get background image file
app.get('/api/backgrounds/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const background = await prisma.BackgroundImage.findUnique({
      where: { id: parseInt(id) }
    });

    if (!background) {
      return res.status(404).json({ error: 'Background not found' });
    }

    if (!fs.existsSync(background.path)) {
      return res.status(404).json({ error: 'Background file not found on disk' });
    }

    res.setHeader('Content-Type', background.mimetype);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.sendFile(path.resolve(background.path));
  } catch (error) {
    console.error('Error serving background image:', error);
    res.status(500).json({ error: 'Failed to serve background image' });
  }
});

// Delete background
app.delete('/api/backgrounds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const background = await prisma.BackgroundImage.findUnique({
      where: { id: parseInt(id) }
    });

    if (!background) {
      return res.status(404).json({ error: 'Background not found' });
    }

    // Delete from database (the gallery relationship will be handled by onDelete: SetNull)
    await prisma.BackgroundImage.delete({
      where: { id: parseInt(id) }
    });

    // Delete file from disk
    try {
      if (fs.existsSync(background.path)) {
        fs.unlinkSync(background.path);
      }
    } catch (fileError) {
      console.error('Error deleting background file:', fileError);
      // Continue - file might already be deleted
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting background:', error);
    res.status(500).json({ error: 'Failed to delete background' });
  }
});

// Download background image from URL
app.post('/api/backgrounds/download', async (req, res) => {
  console.log('📥 [BACKGROUND DOWNLOAD] Single image download requested');
  
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('📥 [BACKGROUND DOWNLOAD] URL:', url);

    // First, detect if this is a gallery (e.g., imgur album)
    if (url.includes('imgur.com/a/') || url.includes('imgur.com/gallery/')) {
      console.log('📥 [BACKGROUND DOWNLOAD] Gallery detected, extracting images...');
      
      try {
        let galleryId;
        let images = [];
        let galleryTitle = '';
        let galleryDescription = '';
        
        if (url.includes('imgur.com/a/')) {
          // Direct album URL - extract ID and use API
          const galleryMatch = url.match(/imgur\.com\/a\/([a-zA-Z0-9]+)/);
          galleryId = galleryMatch ? galleryMatch[1] : null;
          
          if (!galleryId) {
            throw new Error('Invalid album URL format');
          }
          
          console.log('📥 [BACKGROUND DOWNLOAD] Using album API for ID:', galleryId);
          
          const imgurResponse = await fetch(`https://api.imgur.com/3/album/${galleryId}`, {
            headers: {
              'Authorization': 'Client-ID 546c25a59c58ad7'
            }
          });
          
          if (!imgurResponse.ok) {
            throw new Error(`Imgur API error: ${imgurResponse.status}`);
          }
          
          const imgurData = await imgurResponse.json();
          images = imgurData.data.images || [];
          galleryTitle = imgurData.data.title || 'Untitled Album';
          galleryDescription = imgurData.data.description || '';
          
        } else if (url.includes('imgur.com/gallery/')) {
          // Gallery URL - extract ID from URL directly
          console.log('📥 [BACKGROUND DOWNLOAD] Extracting gallery ID from URL...');
          
          // Extract gallery ID from URL pattern like /gallery/star-wars-wallpapers-W4lOh
          // The actual gallery ID is typically the part after the last dash
          const urlPath = url.split('/gallery/')[1];
          if (!urlPath) {
            throw new Error('Invalid imgur gallery URL format');
          }
          
          // For URLs like "star-wars-wallpapers-W4lOh", the ID is "W4lOh"
          const parts = urlPath.split('-');
          galleryId = parts[parts.length - 1];
          
          console.log('📥 [BACKGROUND DOWNLOAD] Extracted gallery ID:', galleryId);
          
          // Try as album first (most common for galleries)
          const imgurResponse = await fetch(`https://api.imgur.com/3/album/${galleryId}`, {
            headers: {
              'Authorization': 'Client-ID 546c25a59c58ad7'
            }
          });
          
          if (!imgurResponse.ok) {
            throw new Error(`Imgur API error: ${imgurResponse.status}`);
          }
          
          const imgurData = await imgurResponse.json();
          images = imgurData.data.images || [];
          galleryTitle = imgurData.data.title || 'Untitled Gallery';
          galleryDescription = imgurData.data.description || '';
        }
        
        console.log('📥 [BACKGROUND DOWNLOAD] Found', images.length, 'images in gallery');
        
        return res.json({
          isGallery: true,
          galleryUrl: url,
          galleryTitle: galleryTitle,
          galleryDescription: galleryDescription,
          images: images.map((img, index) => ({
            id: img.id,
            url: img.link,
            title: img.title || `Image ${index + 1}`,
            description: img.description || '',
            width: img.width,
            height: img.height,
            size: img.size,
            type: img.type
          }))
        });
        
      } catch (error) {
        console.error('📥 [BACKGROUND DOWNLOAD] Gallery fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch gallery data' });
      }
    }
    
    // Single image download
    console.log('📥 [BACKGROUND DOWNLOAD] Downloading single image...');
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      throw new Error('URL does not point to an image');
    }
    
    const buffer = await response.arrayBuffer();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = contentType.split('/')[1] || 'jpg';
    const filename = `bg-${timestamp}-${randomString}.${extension}`;
    
    const uploadDir = getUploadDirectory('backgrounds');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, Buffer.from(buffer));
    
    // Save to database
    const background = await prisma.BackgroundImage.create({
      data: {
        filename,
        originalName: path.basename(url),
        path: filepath,
        mimetype: contentType,
        size: buffer.byteLength,
        url: url
      }
    });
    
    console.log('📥 [BACKGROUND DOWNLOAD] Successfully downloaded and saved:', filename);
    
    res.json({
      success: true,
      background: {
        id: background.id,
        filename: background.filename,
        originalName: background.originalName,
        url: background.url,
        size: background.size,
        mimetype: background.mimetype
      }
    });
    
  } catch (error) {
    console.error('📥 [BACKGROUND DOWNLOAD] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to download image' });
  }
});

// Bulk download from gallery
app.post('/api/backgrounds/download-gallery-bulk', async (req, res) => {
  console.log('📥 [BULK DOWNLOAD] Gallery bulk download requested');
  
  try {
    const { url, galleryId, selectedImages } = req.body;
    
    if (!url || !selectedImages || !Array.isArray(selectedImages)) {
      return res.status(400).json({ error: 'URL and selectedImages array are required' });
    }
    
    console.log('📥 [BULK DOWNLOAD] Gallery URL:', url);
    console.log('📥 [BULK DOWNLOAD] Selected images:', selectedImages.length);
    
    // Extract gallery ID from URL - handle various imgur URL formats
    let imgurGalleryId;
    if (url.includes('imgur.com/a/')) {
      const galleryMatch = url.match(/imgur\.com\/a\/([a-zA-Z0-9\-_]+)/);
      imgurGalleryId = galleryMatch ? galleryMatch[1] : null;
    } else if (url.includes('imgur.com/gallery/')) {
      // Gallery URL - extract ID from URL directly
      console.log('📥 [BULK DOWNLOAD] Extracting gallery ID from URL...');
      
      // Extract gallery ID from URL pattern like /gallery/star-wars-wallpapers-W4lOh
      // The actual gallery ID is typically the part after the last dash
      const urlPath = url.split('/gallery/')[1];
      if (!urlPath) {
        console.log('📥 [BULK DOWNLOAD] Failed to extract gallery path from URL:', url);
        return res.status(400).json({ error: 'Invalid imgur gallery URL format' });
      }
      
      // For URLs like "star-wars-wallpapers-W4lOh", the ID is "W4lOh"
      const parts = urlPath.split('-');
      imgurGalleryId = parts[parts.length - 1];
    }
    
    if (!imgurGalleryId) {
      console.log('📥 [BULK DOWNLOAD] Failed to extract gallery ID from URL:', url);
      return res.status(400).json({ error: 'Invalid gallery URL format' });
    }
    
    console.log('📥 [BULK DOWNLOAD] Extracted gallery ID:', imgurGalleryId);
    
    // Fetch gallery data
    const imgurResponse = await fetch(`https://api.imgur.com/3/album/${imgurGalleryId}`, {
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7'
      }
    });
    
    if (!imgurResponse.ok) {
      throw new Error('Failed to fetch gallery data');
    }
    
    const imgurData = await imgurResponse.json();
    const images = imgurData.data.images || [];
    
    let successCount = 0;
    let failedCount = 0;
    const results = [];
    
    // Create gallery if galleryId is provided
    let gallery = null;
    if (galleryId) {
      gallery = await prisma.BackgroundGallery.findUnique({
        where: { id: parseInt(galleryId, 10) }
      });
    }
    
    // Download selected images
    for (const imageIndex of selectedImages) {
      if (imageIndex >= 0 && imageIndex < images.length) {
        const image = images[imageIndex];
        
        try {
          console.log('📥 [BULK DOWNLOAD] Downloading image:', image.link);
          
          // Add delay between requests to avoid rate limiting
          if (imageIndex > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
          }
          
          // Make request with proper browser-like headers
          const response = await fetch(image.link, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Referer': url, // Use the gallery URL as referer
              'Sec-Fetch-Dest': 'image',
              'Sec-Fetch-Mode': 'no-cors',
              'Sec-Fetch-Site': 'same-site'
            }
          });
          
          if (!response.ok) {
            if (response.status === 429) {
              console.log('📥 [BULK DOWNLOAD] Rate limited, waiting 10 seconds and retrying...');
              await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
              
              // Retry once with longer delay
              const retryResponse = await fetch(image.link, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'Referer': url,
                  'Sec-Fetch-Dest': 'image',
                  'Sec-Fetch-Mode': 'no-cors',
                  'Sec-Fetch-Site': 'same-site'
                }
              });
              
              if (!retryResponse.ok) {
                throw new Error(`HTTP ${retryResponse.status} (after retry)`);
              }
              
              // Use retry response for processing
              const buffer = await retryResponse.arrayBuffer();
              const timestamp = Date.now();
              const randomString = Math.random().toString(36).substring(2, 15);
              const extension = image.type?.split('/')[1] || 'jpg';
              const filename = `bg-${timestamp}-${randomString}.${extension}`;
              
              const uploadDir = getUploadDirectory('backgrounds');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              
              const filepath = path.join(uploadDir, filename);
              fs.writeFileSync(filepath, Buffer.from(buffer));
              
              // Save to database
              const background = await prisma.BackgroundImage.create({
                data: {
                  filename,
                  originalName: image.title || `Image ${imageIndex + 1}`,
                  path: filepath,
                  mimetype: image.type,
                  size: buffer.byteLength,
                  url: image.link,
                  width: image.width,
                  height: image.height,
                  galleryId: gallery?.id || null
                }
              });
              
              results.push({
                success: true,
                imageIndex,
                backgroundId: background.id,
                filename: background.filename
              });
              
              successCount++;
              console.log('📥 [BULK DOWNLOAD] Successfully downloaded after retry:', filename);
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } else {
            // Normal successful response
            const buffer = await response.arrayBuffer();
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 15);
            const extension = image.type?.split('/')[1] || 'jpg';
            const filename = `bg-${timestamp}-${randomString}.${extension}`;
            
            const uploadDir = getUploadDirectory('backgrounds');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, Buffer.from(buffer));
            
            // Save to database
            const background = await prisma.BackgroundImage.create({
              data: {
                filename,
                originalName: image.title || `Image ${imageIndex + 1}`,
                path: filepath,
                mimetype: image.type,
                size: buffer.byteLength,
                url: image.link,
                width: image.width,
                height: image.height,
                galleryId: gallery?.id || null
              }
            });
            
            results.push({
              success: true,
              imageIndex,
              backgroundId: background.id,
              filename: background.filename
            });
            
            successCount++;
            console.log('📥 [BULK DOWNLOAD] Successfully downloaded:', filename);
          }
          
        } catch (error) {
          console.error('📥 [BULK DOWNLOAD] Failed to download image:', error);
          results.push({
            success: false,
            imageIndex,
            error: error.message
          });
          failedCount++;
        }
      }
    }
    
    console.log('📥 [BULK DOWNLOAD] Completed - Success:', successCount, 'Failed:', failedCount);
    
    res.json({
      success: true,
      successCount,
      failedCount,
      totalRequested: selectedImages.length,
      results
    });
    
  } catch (error) {
    console.error('📥 [BULK DOWNLOAD] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk download images' });
  }
});

// Get all galleries
app.get('/api/background-galleries', async (req, res) => {
  console.log('🖼️  [GALLERIES] API endpoint called');
  console.log('🖼️  [GALLERIES] Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🖼️  [GALLERIES] DATABASE_URL:', process.env.DATABASE_URL);
  console.log('🖼️  [GALLERIES] NODE_ENV:', process.env.NODE_ENV);
  
  try {
    console.log('🖼️  [GALLERIES] Attempting to connect to database...');
    
    // Test database connection first
    await prisma.$connect();
    console.log('🖼️  [GALLERIES] Database connection successful');
    
    // Check if BackgroundGallery table exists (database-agnostic)
    console.log('🖼️  [GALLERIES] Checking if BackgroundGallery table exists...');
    const isPostgres = process.env.DATABASE_URL?.includes('postgresql://');
    let tableExists;
    
    if (isPostgres) {
      tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'BackgroundGallery'
        );
      `;
      console.log('🖼️  [GALLERIES] BackgroundGallery table exists (PostgreSQL):', tableExists[0]?.exists || false);
    } else {
      tableExists = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='table' AND name='BackgroundGallery';
      `;
      console.log('🖼️  [GALLERIES] BackgroundGallery table exists (SQLite):', tableExists.length > 0);
    }
    
    console.log('🖼️  [GALLERIES] Attempting to query BackgroundGallery table...');
    const galleries = await prisma.BackgroundGallery.findMany({
      include: {
        _count: {
          select: { backgrounds: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🖼️  [GALLERIES] Query successful, found', galleries.length, 'galleries');
    console.log('🖼️  [GALLERIES] Sample gallery:', galleries[0] ? JSON.stringify(galleries[0], null, 2) : 'None');

    const galleriesWithCount = galleries.map(gallery => ({
      ...gallery,
      backgroundCount: gallery._count.backgrounds
    }));

    console.log('🖼️  [GALLERIES] Returning', galleriesWithCount.length, 'galleries with counts');
    res.json(galleriesWithCount);
  } catch (error) {
    console.error('❌ [GALLERIES] Error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
      meta: error.meta
    });
    res.status(500).json({ 
      error: 'Failed to fetch galleries',
      details: error.message,
      code: error.code 
    });
  }
});

// Create gallery
app.post('/api/background-galleries', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Gallery name is required' });
    }

    const gallery = await prisma.BackgroundGallery.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    res.json(gallery);
  } catch (error) {
    console.error('Error creating gallery:', error);
    res.status(500).json({ error: 'Failed to create gallery' });
  }
});

// Get gallery with backgrounds
app.get('/api/background-galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const gallery = await prisma.BackgroundGallery.findUnique({
      where: { id: parseInt(id) },
      include: {
        backgrounds: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    res.json(gallery);
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

// Update gallery
app.put('/api/background-galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Gallery name is required' });
    }

    const gallery = await prisma.BackgroundGallery.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });

    res.json(gallery);
  } catch (error) {
    console.error('Error updating gallery:', error);
    res.status(500).json({ error: 'Failed to update gallery' });
  }
});

// Get backgrounds for a specific gallery
app.get('/api/background-galleries/:id/backgrounds', async (req, res) => {
  try {
    const { id } = req.params;
    const gallery = await prisma.BackgroundGallery.findUnique({
      where: { id: parseInt(id) },
      include: {
        backgrounds: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    res.json(gallery.backgrounds);
  } catch (error) {
    console.error('Error fetching gallery backgrounds:', error);
    res.status(500).json({ error: 'Failed to fetch gallery backgrounds' });
  }
});

// Add backgrounds to gallery
app.post('/api/background-galleries/:id/add-backgrounds', async (req, res) => {
  try {
    const { id } = req.params;
    const { backgroundIds } = req.body;

    if (!Array.isArray(backgroundIds) || backgroundIds.length === 0) {
      return res.status(400).json({ error: 'Background IDs array is required' });
    }

    const gallery = await prisma.BackgroundGallery.findUnique({
      where: { id: parseInt(id) }
    });

    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    // Update background images to belong to this gallery
    const updatedCount = await prisma.BackgroundImage.updateMany({
      where: {
        id: { in: backgroundIds.map(id => parseInt(id)) },
        galleryId: null // Only update backgrounds not already in a gallery
      },
      data: {
        galleryId: parseInt(id)
      }
    });

    res.json({ success: true, addedCount: updatedCount.count });
  } catch (error) {
    console.error('Error adding backgrounds to gallery:', error);
    res.status(500).json({ error: 'Failed to add backgrounds to gallery' });
  }
});

// Remove backgrounds from gallery
app.post('/api/background-galleries/:id/remove-backgrounds', async (req, res) => {
  try {
    const { id } = req.params;
    const { backgroundIds } = req.body;

    if (!Array.isArray(backgroundIds) || backgroundIds.length === 0) {
      return res.status(400).json({ error: 'Background IDs array is required' });
    }

    // Remove backgrounds from gallery by setting galleryId to null
    const updatedCount = await prisma.BackgroundImage.updateMany({
      where: {
        id: { in: backgroundIds.map(id => parseInt(id)) },
        galleryId: parseInt(id)
      },
      data: {
        galleryId: null
      }
    });

    res.json({ success: true, removedCount: updatedCount.count });
  } catch (error) {
    console.error('Error removing backgrounds from gallery:', error);
    res.status(500).json({ error: 'Failed to remove backgrounds from gallery' });
  }
});

// Delete gallery
app.delete('/api/background-galleries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // First remove all backgrounds from the gallery
    await prisma.BackgroundImage.updateMany({
      where: { galleryId: parseInt(id) },
      data: { galleryId: null }
    });

    // Then delete the gallery
    await prisma.BackgroundGallery.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting gallery:', error);
    res.status(500).json({ error: 'Failed to delete gallery' });
  }
});

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





