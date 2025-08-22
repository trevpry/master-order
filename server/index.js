const express = require('express');
const cors = require('cors');
const multer = require('multer');
const http = require('http');
const https = require('https');
const socketIo = require('socket.io');
const path = require('path');
const getNextEpisode = require('./getNextEpisode');
const getNextMovie = require('./getNextMovie');
const { getNextCustomOrder, markCustomOrderItemAsWatched } = require('./getNextCustomOrder');
const prisma = require('./prismaClient'); // Import the shared client
const PlexDatabaseService = require('./plexDatabaseService');
const TvdbDatabaseService = require('./tvdbDatabaseService'); // Added import
const TVDBService = require('./tvdbService'); // Added import
const PlexSyncService = require('./plexSyncService'); // Added import
const BackgroundSyncService = require('./backgroundSyncService'); // Added import
const ArtworkCacheService = require('./artworkCacheService'); // Added import
const subOrderService = require('./subOrderService'); // Added import
const WatchLogService = require('./watchLogService'); // Added import
const openLibraryService = require('./openLibraryService'); // Added import

// Initialize services
const plexDb = new PlexDatabaseService();
const tvdbDb = new TvdbDatabaseService();
const plexSync = new PlexSyncService(); // Initialize the sync service
const backgroundSync = new BackgroundSyncService(); // Initialize background sync service
const artworkCache = new ArtworkCacheService(); // Initialize artwork cache service
const watchLogService = new WatchLogService(prisma); // Initialize watch log service
const PlexPlayerService = require('./plexPlayerService');
const plexPlayer = new PlexPlayerService(); // Initialize Plex player service

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
                if (watchLogData.mediaType === 'episode') {
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
      plexToken,
      plexUrl,
      tvdbApiKey,
      tvdbBearerToken,
      selectedPlayer,
      selectedPlexUser,
      ignoredMovieCollections,
      ignoredTVCollections,
      christmasFilterEnabled
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
    }    // Prepare update data - only include defined fields
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
    if (selectedPlayer !== undefined) updateData.selectedPlayer = selectedPlayer.trim() || null;
    if (selectedPlexUser !== undefined) updateData.selectedPlexUser = selectedPlexUser.trim() || null;
    if (ignoredMovieCollections !== undefined) updateData.ignoredMovieCollections = Array.isArray(ignoredMovieCollections) ? JSON.stringify(ignoredMovieCollections) : ignoredMovieCollections;
    if (ignoredTVCollections !== undefined) updateData.ignoredTVCollections = Array.isArray(ignoredTVCollections) ? JSON.stringify(ignoredTVCollections) : ignoredTVCollections;
    if (christmasFilterEnabled !== undefined) updateData.christmasFilterEnabled = christmasFilterEnabled;

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

    // Refresh Plex player client if Plex settings were changed
    if (plexToken !== undefined || plexUrl !== undefined) {
      try {
        await plexPlayer.refreshClient();
        console.log('Plex player client refreshed due to settings update');
      } catch (error) {
        console.error('Failed to refresh Plex player client:', error);
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

// Get a single custom order item by ID
app.get('/api/custom-orders/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const customOrderItem = await prisma.customOrderItem.findUnique({
      where: { id: parseInt(itemId) },
      include: {
        storyContainedInBook: true,
        containedStories: true,
        referencedCustomOrder: true
      }
    });
    
    if (!customOrderItem) {
      return res.status(404).json({ error: 'Custom order item not found' });
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
    const { name, description, icon, parentOrderId } = req.body;
    
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
    
    const customOrder = await prisma.customOrder.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        parentOrderId: parentOrderId ? parseInt(parentOrderId) : null
      },
      include: {
        parentOrder: true,
        subOrders: true
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
        }
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
    const { name, description, isActive, icon, parentOrderId } = req.body;
    
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
    
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (icon !== undefined) updateData.icon = icon?.trim() || null;
    if (parentOrderId !== undefined) updateData.parentOrderId = parentOrderId ? parseInt(parentOrderId) : null;

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
    
    // Handle ComicVine data extraction for comics
    let comicVineExtractedData = {};
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

    if (!customOrderItemId) {
      console.log('Missing customOrderItemId - using default value');
      // Use a default value or generate one if customOrderItemId is missing
      const defaultId = Date.now(); // Use timestamp as fallback
      console.log('Using fallback customOrderItemId:', defaultId);
    }

    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      console.log('Invalid media type:', mediaType);
      return res.status(400).json({ error: 'Invalid media type for reading' });
    }

    const finalCustomOrderItemId = customOrderItemId || Date.now();
    
    const readingSession = await watchLogService.startReading({
      mediaType,
      title,
      seriesTitle,
      customOrderItemId: finalCustomOrderItemId
    });

    console.log('Reading session started successfully:', readingSession.id);
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

// ==================== WATCH STATISTICS ENDPOINTS ====================

// Get watch statistics with flexible date filtering
app.get('/api/watch-stats', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = 'day',
      period = 'week' // 'today', 'week', 'month', 'year', 'all', or 'custom'
    } = req.query;

    let actualStartDate = null;
    let actualEndDate = null;

    // Handle predefined periods
    switch (period) {
      case 'today':
        actualStartDate = new Date();
        actualStartDate.setHours(0, 0, 0, 0);
        actualEndDate = new Date();
        actualEndDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        actualEndDate = new Date();
        actualStartDate = new Date();
        actualStartDate.setDate(actualStartDate.getDate() - 7);
        break;
      case 'month':
        actualEndDate = new Date();
        actualStartDate = new Date();
        actualStartDate.setMonth(actualStartDate.getMonth() - 1);
        break;
      case 'year':
        actualEndDate = new Date();
        actualStartDate = new Date();
        actualStartDate.setFullYear(actualStartDate.getFullYear() - 1);
        break;
      case 'custom':
        if (startDate) actualStartDate = new Date(startDate);
        if (endDate) actualEndDate = new Date(endDate);
        break;
      case 'all':
      default:
        // No date filtering
        break;
    }

    const stats = await watchLogService.getWatchStats({
      startDate: actualStartDate,
      endDate: actualEndDate,
      groupBy: groupBy
    });
    
    console.log('DEBUG: Overview stats result:', {
      totalWatchTime: stats?.totalStats?.totalWatchTime,
      totalLogs: stats?.totalStats?.totalLogs,
      recentCount: stats?.recentActivity?.length,
      firstFewRecent: stats?.recentActivity?.slice(0, 3).map(log => ({
        title: log.title,
        seriesTitle: log.seriesTitle,
        mediaType: log.mediaType,
        plexKey: log.plexKey
      }))
    });

    // Add formatted time strings
    stats.totalStats.totalWatchTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalWatchTime);
    stats.totalStats.totalTvWatchTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalTvWatchTime);
    stats.totalStats.totalMovieWatchTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalMovieWatchTime);
    stats.totalStats.totalReadTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalReadTime);
    stats.totalStats.totalBookReadTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalBookReadTime);
    stats.totalStats.totalComicReadTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalComicReadTime);
    stats.totalStats.totalShortStoryReadTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalShortStoryReadTime);
    stats.totalStats.totalActivityTimeFormatted = watchLogService.formatWatchTime(stats.totalStats.totalActivityTime);

    stats.groupedStats = stats.groupedStats.map(group => ({
      ...group,
      totalWatchTimeFormatted: watchLogService.formatWatchTime(group.totalWatchTime),
      tvWatchTimeFormatted: watchLogService.formatWatchTime(group.tvWatchTime),
      movieWatchTimeFormatted: watchLogService.formatWatchTime(group.movieWatchTime),
      totalReadTimeFormatted: watchLogService.formatWatchTime(group.totalReadTime || 0),
      bookReadTimeFormatted: watchLogService.formatWatchTime(group.bookReadTime || 0),
      comicReadTimeFormatted: watchLogService.formatWatchTime(group.comicReadTime || 0),
      shortStoryReadTimeFormatted: watchLogService.formatWatchTime(group.shortStoryReadTime || 0)
    }));

    res.json(stats);
  } catch (error) {
    console.error('Error getting watch statistics:', error);
    res.status(500).json({ error: 'Failed to get watch statistics' });
  }
});

// Get recent watch activity
app.get('/api/watch-stats/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const recentActivity = await watchLogService.getRecentActivity(parseInt(limit));
    
    // Add formatted times
    const formattedActivity = recentActivity.map(log => ({
      ...log,
      durationFormatted: watchLogService.formatWatchTime(log.duration),
      totalWatchTimeFormatted: watchLogService.formatWatchTime(log.totalWatchTime)
    }));

    res.json(formattedActivity);
  } catch (error) {
    console.error('Error getting recent watch activity:', error);
    res.status(500).json({ error: 'Failed to get recent watch activity' });
  }
});

// Get today's watch statistics
app.get('/api/watch-stats/today', async (req, res) => {
  try {
    const todayStats = await watchLogService.getTodayStats();
    
    // Add formatted time strings for watch activities
    todayStats.totalStats.totalWatchTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalWatchTime);
    todayStats.totalStats.totalTvWatchTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalTvWatchTime);
    todayStats.totalStats.totalMovieWatchTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalMovieWatchTime);
    
    // Add formatted time strings for reading activities
    todayStats.totalStats.totalReadTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalReadTime || 0);
    todayStats.totalStats.totalBookReadTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalBookReadTime || 0);
    todayStats.totalStats.totalComicReadTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalComicReadTime || 0);
    todayStats.totalStats.totalShortStoryReadTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalShortStoryReadTime || 0);
    todayStats.totalStats.totalActivityTimeFormatted = watchLogService.formatWatchTime(todayStats.totalStats.totalActivityTime || 0);

    res.json(todayStats);
  } catch (error) {
    console.error('Error getting today\'s watch statistics:', error);
    res.status(500).json({ error: 'Failed to get today\'s watch statistics' });
  }
});

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

// Get custom order statistics
app.get('/api/watch-stats/custom-orders', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const customOrderStats = await watchLogService.getCustomOrderStats(period);
    
    res.json(customOrderStats);
  } catch (error) {
    console.error('Error getting custom order statistics:', error);
    res.status(500).json({ error: 'Failed to get custom order statistics' });
  }
});

// Get media type specific statistics
app.get('/api/watch-stats/media-type/:mediaType', async (req, res) => {
  try {
    const { mediaType } = req.params;
    const { period = 'all', groupBy = 'day', actorSortBy, movieActorSortBy } = req.query;
    
    console.log(`DEBUG: Media type stats requested for: ${mediaType}, period: ${period}`);
    
    const validMediaTypes = ['tv', 'movie', 'book', 'comic', 'shortstory'];
    if (!validMediaTypes.includes(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type' });
    }
    
    const mediaTypeStats = await watchLogService.getMediaTypeStats(mediaType, period, groupBy, actorSortBy, movieActorSortBy);
    
    console.log(`DEBUG: ${mediaType} stats result:`, {
      totalCount: mediaTypeStats?.totalCount,
      logsLength: mediaTypeStats?.logs?.length,
      period: mediaTypeStats?.period,
      firstFewLogs: mediaTypeStats?.logs?.slice(0, 3).map(log => ({
        title: log.title,
        seriesTitle: log.seriesTitle,
        plexKey: log.plexKey,
        mediaType: log.mediaType
      }))
    });
    
    res.json(mediaTypeStats);
  } catch (error) {
    console.error(`Error getting ${req.params.mediaType} statistics:`, error);
    res.status(500).json({ error: `Failed to get ${req.params.mediaType} statistics` });
  }
});

// Get all activity across all media types
app.get('/api/watch-stats/all-activity', async (req, res) => {
  try {
    console.log('All activity endpoint called with query:', req.query);
    const { period = 'all', groupBy = 'day' } = req.query;
    
    console.log('Calling getAllActivityStats with period:', period, 'groupBy:', groupBy);
    const allActivityStats = await watchLogService.getAllActivityStats(period, groupBy);
    
    console.log('All activity stats result:', {
      totalCount: allActivityStats?.totalCount,
      logsLength: allActivityStats?.logs?.length,
      period: allActivityStats?.period
    });
    
    res.json(allActivityStats);
  } catch (error) {
    console.error('Error getting all activity statistics:', error);
    res.status(500).json({ error: 'Failed to get all activity statistics' });
  }
});

// ==================== END WATCH STATISTICS ENDPOINTS ====================

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
});





