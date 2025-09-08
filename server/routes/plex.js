const express = require('express');
const router = express.Router();

// Import required services
const getNextEpisode = require('../getNextEpisode');
const getNextMovie = require('../getNextMovie');
const getNextCustomOrder = require('../getNextCustomOrder');

// Import Plex-specific services
const prisma = require('../prismaClient');
const PlexSyncService = require('../plexSyncService');
const PlexPlayerService = require('../plexPlayerService');
const BackgroundSyncService = require('../backgroundSyncService');

// Initialize services
let plexSyncService = null;
let plexPlayerService = null;
const backgroundSyncService = new BackgroundSyncService();

// Initialize Plex services
async function initializePlexServices() {
  try {
    plexSyncService = new PlexSyncService();
    plexPlayerService = new PlexPlayerService();
    console.log('✅ Plex services initialized in modular routes');
  } catch (error) {
    console.error('❌ Error initializing Plex services:', error.message);
    plexSyncService = null;
    plexPlayerService = null;
  }
}

// ===== SYNC OPERATIONS =====

// POST /api/plex/sync - Manual Plex sync
router.post('/sync', async (req, res) => {
  try {
    if (!plexSyncService) {
      await initializePlexServices();
    }
    
    if (!plexSyncService) {
      return res.status(400).json({ 
        error: 'Plex sync service not configured',
        message: 'Please configure Plex URL and token in settings'
      });
    }
    
    console.log('Starting manual Plex sync...');
    const startTime = Date.now();
    
    const results = await plexSyncService.fullSync();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Manual Plex sync completed in ${duration}s`);
    
    res.json({
      success: true,
      message: `Plex sync completed successfully in ${duration}s`,
      duration: duration,
      results: results
    });
  } catch (error) {
    console.error('Error during manual Plex sync:', error);
    res.status(500).json({ 
      error: 'Plex sync failed',
      message: error.message
    });
  }
});

// GET /api/plex/sync-status - Get Plex sync status
router.get('/sync-status', async (req, res) => {
  try {
    const backgroundSyncStatus = backgroundSyncService ? backgroundSyncService.getSyncStatus() : null;
    
    res.json({
      backgroundSync: backgroundSyncStatus,
      serviceInitialized: !!plexSyncService,
      configuration: {
        plexUrlConfigured: !!(await prisma.settings.findFirst())?.plexUrl,
        plexTokenConfigured: !!(await prisma.settings.findFirst())?.plexToken
      }
    });
  } catch (error) {
    console.error('Error getting Plex sync status:', error);
    res.status(500).json({
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

// GET /api/plex/background-sync-status - Get background sync status
router.get('/background-sync-status', async (req, res) => {
  try {
    const status = backgroundSyncService.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Failed to get Plex background sync status:', error);
    res.status(500).json({ 
      error: 'Failed to get Plex background sync status',
      details: error.message 
    });
  }
});

// POST /api/plex/background-sync/start - Start background sync
router.post('/background-sync/start', async (req, res) => {
  try {
    await backgroundSyncService.start();
    res.json({ message: 'Plex background sync service started successfully' });
  } catch (error) {
    console.error('Failed to start Plex background sync:', error);
    res.status(500).json({ 
      error: 'Failed to start Plex background sync',
      details: error.message 
    });
  }
});

// POST /api/plex/background-sync/stop - Stop background sync
router.post('/background-sync/stop', async (req, res) => {
  try {
    await backgroundSyncService.stop();
    res.json({ message: 'Plex background sync service stopped successfully' });
  } catch (error) {
    console.error('Failed to stop Plex background sync:', error);
    res.status(500).json({ 
      error: 'Failed to stop Plex background sync',
      details: error.message 
    });
  }
});

// POST /api/plex/background-sync/force-now - Force background sync now
router.post('/background-sync/force-now', async (req, res) => {
  try {
    const result = await backgroundSyncService.forceSyncNow();
    res.json({ message: 'Plex background sync completed', result });
  } catch (error) {
    console.error('Failed to force Plex background sync:', error);
    res.status(500).json({ 
      error: 'Failed to force Plex background sync',
      details: error.message 
    });
  }
});

// ===== CONTENT MANAGEMENT =====

// GET /api/plex/collections - Get Plex collections
router.get('/collections', async (req, res) => {
  try {
    // Get all collections from both TV shows and movies using plexDb
    const PlexDatabaseService = require('../plexDatabaseService');
    const plexDb = new PlexDatabaseService();
    
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
    });
  }
});

// GET /api/plex/players - Get Plex players
router.get('/players', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const players = await plexPlayerService.getPlayers();
    
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
    console.error('Error fetching Plex players:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Plex players',
      message: error.message 
    });
  }
});

// GET /api/plex/selected-player - Get selected Plex player
router.get('/selected-player', async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.selectedPlexPlayer) {
      return res.json({ selectedPlayer: null });
    }
    
    res.json({ 
      selectedPlayer: settings.selectedPlexPlayer,
      playerName: settings.selectedPlexPlayerName 
    });
  } catch (error) {
    console.error('Error fetching selected Plex player:', error);
    res.status(500).json({ 
      error: 'Failed to fetch selected Plex player',
      message: error.message 
    });
  }
});

// GET /api/plex/users - Get Plex users
router.get('/users', async (req, res) => {
  try {
    const { getSettings } = require('../databaseUtils');
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

// ===== PLAYBACK CONTROL =====

// POST /api/plex/play - Play Plex content
router.post('/play', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { ratingKey, mediaType } = req.body;
    if (!ratingKey) {
      return res.status(400).json({ error: 'Missing ratingKey parameter' });
    }
    
    const result = await plexPlayerService.playMedia(ratingKey, mediaType);
    res.json(result);
  } catch (error) {
    console.error('Error playing Plex content:', error);
    res.status(500).json({ 
      error: 'Failed to play Plex content',
      message: error.message 
    });
  }
});

// POST /api/plex/play-with-retry - Play with retry logic
router.post('/play-with-retry', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { ratingKey, mediaType, retryCount = 3 } = req.body;
    if (!ratingKey) {
      return res.status(400).json({ error: 'Missing ratingKey parameter' });
    }
    
    const result = await plexPlayerService.playMediaWithRetry(ratingKey, mediaType, retryCount);
    res.json(result);
  } catch (error) {
    console.error('Error playing Plex content with retry:', error);
    res.status(500).json({ 
      error: 'Failed to play Plex content with retry',
      message: error.message 
    });
  }
});

// POST /api/plex/play-via-plex-tv - Play via Plex.tv
router.post('/play-via-plex-tv', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { ratingKey, machineIdentifier } = req.body;
    if (!ratingKey) {
      return res.status(400).json({ error: 'Missing ratingKey parameter' });
    }
    
    const result = await plexPlayerService.playViaPlexTv(ratingKey, machineIdentifier);
    res.json(result);
  } catch (error) {
    console.error('Error playing via Plex.tv:', error);
    res.status(500).json({ 
      error: 'Failed to play via Plex.tv',
      message: error.message 
    });
  }
});

// POST /api/plex/control/:action - Control playback (pause, resume, stop, etc.)
router.post('/control/:action', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { action } = req.params;
    const validActions = ['play', 'pause', 'stop', 'skipNext', 'skipPrevious', 'seekTo'];
    
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid action',
        validActions: validActions 
      });
    }
    
    const result = await plexPlayerService.controlPlayback(action, req.body);
    res.json(result);
  } catch (error) {
    console.error(`Error controlling playback (${req.params.action}):`, error);
    res.status(500).json({ 
      error: `Failed to control playback`,
      action: req.params.action,
      message: error.message 
    });
  }
});

// GET /api/plex/test-connection - Test Plex connection
router.get('/test-connection', async (req, res) => {
  try {
    if (!plexSyncService) {
      await initializePlexServices();
    }
    
    if (!plexSyncService) {
      return res.status(400).json({ 
        error: 'Plex service not configured',
        message: 'Please configure Plex URL and token in settings'
      });
    }
    
    const result = await plexSyncService.testConnection();
    res.json({
      success: true,
      message: 'Plex connection successful',
      ...result
    });
  } catch (error) {
    console.error('Error testing Plex connection:', error);
    res.status(500).json({ 
      success: false,
      error: 'Plex connection failed',
      message: error.message 
    });
  }
});

// GET /api/plex/device-status/:machineIdentifier - Get device status
router.get('/device-status/:machineIdentifier', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { machineIdentifier } = req.params;
    const status = await plexPlayerService.getDeviceStatus(machineIdentifier);
    res.json(status);
  } catch (error) {
    console.error('Error getting device status:', error);
    res.status(500).json({ 
      error: 'Failed to get device status',
      message: error.message 
    });
  }
});

// ===== CONTENT MANAGEMENT =====

// Up Next endpoint - main entry point for getting next item to watch
router.get('/up-next', async (req, res) => {
  try {
    const data = await getNextEpisode(); // This handles order type selection internally
    
    // If movies were selected, use the new getNextMovie function
    if (data.orderType === 'MOVIES_GENERAL') {
      console.log('Movie order type selected, using getNextMovie function');
      const movieData = await getNextMovie();
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
router.get('/start-new-series', async (req, res) => {
  try {
    const startNewSeriesService = require('../startNewSeriesService');
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

// Get full Plex media data by plexKey (for custom order navigation)
router.get('/media/:plexKey', async (req, res) => {
  try {
    const { plexKey } = req.params;
    
    if (!plexKey) {
      return res.status(400).json({ error: 'Missing plexKey parameter' });
    }
    
    console.log(`📺 Fetching full Plex data for plexKey: ${plexKey}`);
    
    const plexDatabaseService = require('../plexDatabaseService');
    const plexDb = new plexDatabaseService();
    
    // Try to get item metadata (works for episodes, movies, shows)
    const itemData = await plexDb.getItemMetadata(plexKey);
    if (itemData && itemData.type === 'episode') {
      console.log(`📺 Found episode: ${itemData.grandparentTitle} - S${itemData.parentIndex}E${itemData.index} - ${itemData.title}`);
      
      // Get TVDB artwork for the episode
      const tvdbService = require('../tvdbCachedService');
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

// ===== DEBUG ENDPOINTS =====

// GET /api/plex/debug-raw - Raw Plex API debug endpoint
router.get('/debug-raw', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const timestamp = new Date().toISOString();
    
    // Test connection first
    const connectionTest = await plexPlayerService.testConnection();
    
    // Get raw responses from multiple endpoints
    const rawResponses = {};
    
    try {
      console.log('Fetching raw /clients response...');
      rawResponses.clients = await plexPlayerService.client.query('/clients');
    } catch (error) {
      rawResponses.clients = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /status/sessions response...');
      rawResponses.sessions = await plexPlayerService.client.query('/status/sessions');
    } catch (error) {
      rawResponses.sessions = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /devices response...');
      rawResponses.devices = await plexPlayerService.client.query('/devices');
    } catch (error) {
      rawResponses.devices = { error: error.message };
    }
    
    try {
      console.log('Fetching raw /myplex/resources response...');
      rawResponses.resources = await plexPlayerService.client.query('/myplex/resources');
    } catch (error) {
      rawResponses.resources = { error: error.message };
    }
    
    // Get processed players for comparison
    const processedPlayers = await plexPlayerService.getPlayers().catch(error => ({ error: error.message }));
    const alternativePlayers = await plexPlayerService.getPlayersAlternative().catch(error => ({ error: error.message }));
    
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

// GET /api/plex/test-androidtv-notification - Test AndroidTV notification
router.post('/test-androidtv-notification', async (req, res) => {
  try {
    if (!plexPlayerService) {
      await initializePlexServices();
    }
    
    if (!plexPlayerService) {
      return res.status(400).json({ 
        error: 'Plex player service not configured'
      });
    }
    
    const { ratingKey, offset = 0, playerId } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ error: 'ratingKey is required' });
    }
    
    let targetPlayerId = playerId;
    
    // If no specific player provided, use the selected player from settings
    if (!targetPlayerId) {
      const settings = await prisma.settings.findFirst();
      
      if (!settings || !settings.selectedPlexPlayer) {
        return res.status(400).json({ 
          error: 'No player specified and no default player selected in settings' 
        });
      }
      
      targetPlayerId = settings.selectedPlexPlayer;
    }

    console.log('Testing AndroidTV notification approach for device:', targetPlayerId);
    
    // Get media details
    const mediaResponse = await plexPlayerService.client.query(`/library/metadata/${ratingKey}`);
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
      
      const timelineResponse = await plexPlayerService.client.query('/:/timeline', 'POST', timelineParams);
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
      
      const notifyResponse = await plexPlayerService.client.query('/:/notify', 'POST', notifyParams);
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
      
      const queueResponse = await plexPlayerService.client.query('/playQueues', 'POST', queueParams);
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
});

module.exports = router;
