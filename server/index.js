const express = require('express');
const cors = require('cors');
const getNextEpisode = require('./getNextEpisode');
const getNextMovie = require('./getNextMovie');
const { getNextCustomOrder } = require('./getNextCustomOrder');
const prisma = require('./prismaClient'); // Import the shared client
const PlexDatabaseService = require('./plexDatabaseService');
const TvdbDatabaseService = require('./tvdbDatabaseService'); // Added import
const PlexSyncService = require('./plexSyncService'); // Added import
const BackgroundSyncService = require('./backgroundSyncService'); // Added import

// Initialize services
const plexDb = new PlexDatabaseService();
const tvdbDb = new TvdbDatabaseService();
const plexSync = new PlexSyncService(); // Initialize the sync service
const backgroundSync = new BackgroundSyncService(); // Initialize background sync service

// Initialize the app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/up_next', async (req, res) => {
  try {
    const data = await getNextEpisode(); // This handles order type selection internally
    
    // If movies were selected, use the new getNextMovie function
    if (data.orderType === 'MOVIES_GENERAL') {
      console.log('Movie order type selected, using getNextMovie function');    const movieData = await getNextMovie();
      res.json(movieData);
    } else if (data.orderType === 'CUSTOM_ORDER') {
      console.log('Custom order type selected, using getNextCustomOrder function');
      const customOrderData = await getNextCustomOrder();
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

// Proxy endpoint for Plex artwork
app.get('/api/artwork/*', async (req, res) => {
  try {
    const artworkPath = req.params[0]; // Get everything after /api/artwork/
    
    // Get settings directly from database to avoid circular dependency issues
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
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
    console.error('Error proxying ComicVine artwork:', error);
    res.status(500).send('Error loading ComicVine artwork');
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
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying OpenLibrary artwork:', error);
    res.status(500).send('Error loading OpenLibrary artwork');
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });

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
    res.status(500).json({ error: 'Something went wrong' });
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
      plexToken,
      plexUrl,
      tvdbApiKey,
      tvdbBearerToken,
      ignoredMovieCollections,
      ignoredTVCollections
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

    // Validate that percentages add up to 100% if all three are provided
    if (tvGeneralPercent !== undefined && moviesGeneralPercent !== undefined && customOrderPercent !== undefined) {
      const total = tvGeneralPercent + moviesGeneralPercent + customOrderPercent;
      if (total !== 100) {
        return res.status(400).json({ 
          error: `Order type percentages must add up to exactly 100%. Current total: ${total}%` 
        });
      }
    }

    // Prepare update data - only include defined fields
    const updateData = {};
    if (collectionName !== undefined) updateData.collectionName = collectionName;
    if (tvGeneralPercent !== undefined) updateData.tvGeneralPercent = tvGeneralPercent;
    if (moviesGeneralPercent !== undefined) updateData.moviesGeneralPercent = moviesGeneralPercent;
    if (customOrderPercent !== undefined) updateData.customOrderPercent = customOrderPercent;
    if (partiallyWatchedCollectionPercent !== undefined) updateData.partiallyWatchedCollectionPercent = partiallyWatchedCollectionPercent;
    if (comicVineApiKey !== undefined) updateData.comicVineApiKey = comicVineApiKey.trim() || null;
    if (plexSyncInterval !== undefined) updateData.plexSyncInterval = plexSyncInterval;
    if (plexToken !== undefined) updateData.plexToken = plexToken.trim() || null;
    if (plexUrl !== undefined) updateData.plexUrl = plexUrl.trim() || null;
    if (tvdbApiKey !== undefined) updateData.tvdbApiKey = tvdbApiKey.trim() || null;
    if (tvdbBearerToken !== undefined) updateData.tvdbBearerToken = tvdbBearerToken.trim() || null;
    if (ignoredMovieCollections !== undefined) updateData.ignoredMovieCollections = Array.isArray(ignoredMovieCollections) ? JSON.stringify(ignoredMovieCollections) : ignoredMovieCollections;
    if (ignoredTVCollections !== undefined) updateData.ignoredTVCollections = Array.isArray(ignoredTVCollections) ? JSON.stringify(ignoredTVCollections) : ignoredTVCollections;

    // Upsert settings (create if doesn't exist, update if it does)
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: updateData,
      create: { 
        id: 1, 
        collectionName, 
        tvGeneralPercent: tvGeneralPercent ?? 50, 
        moviesGeneralPercent: moviesGeneralPercent ?? 50,
        customOrderPercent: customOrderPercent ?? 0,
        partiallyWatchedCollectionPercent: partiallyWatchedCollectionPercent ?? 75,
        comicVineApiKey: comicVineApiKey?.trim() || null,
        plexSyncInterval: plexSyncInterval ?? 12,
        plexToken: plexToken?.trim() || null,
        plexUrl: plexUrl?.trim() || null,
        tvdbApiKey: tvdbApiKey?.trim() || null,
        tvdbBearerToken: tvdbBearerToken?.trim() || null,
        ignoredMovieCollections: Array.isArray(ignoredMovieCollections) ? JSON.stringify(ignoredMovieCollections) : ignoredMovieCollections || null,
        ignoredTVCollections: Array.isArray(ignoredTVCollections) ? JSON.stringify(ignoredTVCollections) : ignoredTVCollections || null
      }
    });

    // Update background sync interval if it was changed
    if (plexSyncInterval !== undefined) {
      try {
        await backgroundSync.updateSyncInterval();
        console.log('Background sync interval updated');
      } catch (error) {
        console.error('Failed to update background sync interval:', error);
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
    const customOrderData = await getNextCustomOrder();
    res.json(customOrderData);
  } catch (error) {
    console.error('Failed to get next custom order item:', error.message);
    res.status(500).json({ 
      error: 'Failed to get next custom order item',
      details: error.message 
    });
  }
});

// Custom Order Management Endpoints

// Get all custom orders
app.get('/api/custom-orders', async (req, res) => {
  try {
    const customOrders = await prisma.customOrder.findMany({
      include: {
        items: {
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(customOrders);  } catch (error) {
    console.error('Error fetching custom orders:', error);
    res.status(500).json({ error: 'Failed to fetch custom orders' });  }
});

// Create a new custom order
app.post('/api/custom-orders', async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Custom order name is required' });
    }
    
    const customOrder = await prisma.customOrder.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null
      }
    });
    
    res.status(201).json(customOrder);
  } catch (error) {
    console.error('Error creating custom order:', error);
    res.status(500).json({ error: 'Failed to create custom order' });
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

// Get a specific custom order
app.get('/api/custom-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customOrder = await prisma.customOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (!customOrder) {
      return res.status(404).json({ error: 'Custom order not found' });
    }
    
    res.json(customOrder);
  } catch (error) {
    console.error('Error fetching custom order:', error);
    res.status(500).json({ error: 'Failed to fetch custom order' });
  }
});

// Update a custom order
app.put('/api/custom-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, icon } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (icon !== undefined) updateData.icon = icon?.trim() || null;
    
    const customOrder = await prisma.customOrder.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
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
    const { id } = req.params;
      const { 
      mediaType, 
      plexKey, 
      title, 
      seasonNumber, 
      episodeNumber, 
      seriesTitle, 
      comicSeries, 
      comicYear, 
      comicIssue, 
      comicVolume,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      storyTitle,
      storyAuthor,
      storyYear,
      storyUrl,
      storyContainedInBookId,
      storyCoverUrl
    } = req.body;
    
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
      if (!storyTitle) {
        return res.status(400).json({ error: 'For short stories: storyTitle is required' });
      }
    } else {
      // For non-comic/book/shortstory media, plexKey is required
      if (!plexKey) {
        return res.status(400).json({ error: 'plexKey is required for non-comic/book/shortstory media' });
      }
    }
      // Check for duplicate items
    let existingItem;
    if (mediaType === 'comic') {
      // For comics, check for duplicates by series, year, and issue
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'comic',
          comicSeries: comicSeries,
          comicYear: comicYear,
          comicIssue: String(comicIssue)
        }
      });
    } else if (mediaType === 'book') {
      // For books, check for duplicates by title and author
      existingItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parseInt(id),
          mediaType: 'book',
          bookTitle: bookTitle,
          bookAuthor: bookAuthor,
          bookYear: bookYear || null        }
      });    } else if (mediaType === 'shortstory') {
      // For short stories, check for duplicates by title, author (if provided), and year
      const whereCondition = {
        customOrderId: parseInt(id),
        mediaType: 'shortstory',
        storyTitle: storyTitle,
        storyYear: storyYear || null
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
    } else {
      // For other media, check by plexKey
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
    
    const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;      // Generate a unique plexKey for comics and books (since it's required by schema)
    let finalPlexKey;
    if (mediaType === 'comic') {
      finalPlexKey = `comic-${comicSeries}-${comicYear}-${comicIssue}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else if (mediaType === 'book') {
      finalPlexKey = `book-${bookTitle}-${bookAuthor}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();    } else if (mediaType === 'shortstory') {
      const authorPart = storyAuthor ? `-${storyAuthor}` : '';
      finalPlexKey = `shortstory-${storyTitle}${authorPart}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    } else {
      finalPlexKey = plexKey;
    }    const item = await prisma.customOrderItem.create({
      data: {
        customOrderId: parseInt(id),
        mediaType,
        plexKey: finalPlexKey,
        title,
        seasonNumber,
        episodeNumber,
        seriesTitle,
        comicSeries,
        comicYear,
        comicIssue: mediaType === 'comic' ? String(comicIssue) : null,
        comicVolume,
        bookTitle,
        bookAuthor,
        bookYear,
        bookIsbn,
        bookPublisher,
        bookOpenLibraryId,
        bookCoverUrl,
        storyTitle,
        storyAuthor,
        storyYear,
        storyUrl,
        storyContainedInBookId,
        storyCoverUrl,
        sortOrder: nextSortOrder
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    console.error('Error adding item to custom order:', error);
    res.status(500).json({ error: 'Failed to add item to custom order' });
  }
});

// Remove item from custom order
app.delete('/api/custom-orders/:id/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
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
    const { itemId } = req.params;    const { 
      sortOrder, 
      isWatched, 
      title,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      storyTitle,
      storyAuthor,
      storyYear,
      storyUrl,
      storyContainedInBookId,
      storyCoverUrl
    } = req.body;
      const updateData = {};
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isWatched !== undefined) updateData.isWatched = isWatched;
    
    // Handle book data updates for re-select functionality
    if (title !== undefined) updateData.title = title;
    if (bookTitle !== undefined) updateData.bookTitle = bookTitle;
    if (bookAuthor !== undefined) updateData.bookAuthor = bookAuthor;
    if (bookYear !== undefined) updateData.bookYear = bookYear;
    if (bookIsbn !== undefined) updateData.bookIsbn = bookIsbn;
    if (bookPublisher !== undefined) updateData.bookPublisher = bookPublisher;
    if (bookOpenLibraryId !== undefined) updateData.bookOpenLibraryId = bookOpenLibraryId;
    if (bookCoverUrl !== undefined) updateData.bookCoverUrl = bookCoverUrl;
    
    // Handle short story data updates
    if (storyTitle !== undefined) updateData.storyTitle = storyTitle;
    if (storyAuthor !== undefined) updateData.storyAuthor = storyAuthor;
    if (storyYear !== undefined) updateData.storyYear = storyYear;
    if (storyUrl !== undefined) updateData.storyUrl = storyUrl;
    if (storyContainedInBookId !== undefined) updateData.storyContainedInBookId = storyContainedInBookId;
    if (storyCoverUrl !== undefined) updateData.storyCoverUrl = storyCoverUrl;
    
    const item = await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: updateData
    });
    
    res.json(item);
  } catch (error) {
    console.error('Error updating custom order item:', error);
    res.status(500).json({ error: 'Failed to update custom order item' });
  }
});

// Search Plex media endpoint
app.get('/api/search', async (req, res) => {
  try {
    const { query, type } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Search query is required' });
        }

    if (type === 'tv' || type === 'television') {
      // Search for TV shows and their episodes in the database
      try {
        const tvShows = await plexDb.searchTVShows(query);
        console.log(`TV Search Debug: Found ${tvShows.length} shows for query: "${query}"`);
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
      }
    } else {
      // Search across all media types in the database
      try {
        const [movies, episodes] = await Promise.all([
          plexDb.searchMovies(query),
          plexDb.searchEpisodes(query)
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
          index: episode.index,
          grandparentTitle: episode.grandparentTitle,
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

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start background sync service
  try {
    await backgroundSync.start();
  } catch (error) {
    console.error('Failed to start background sync service:', error);
  }
});





