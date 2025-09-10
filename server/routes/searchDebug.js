const express = require('express');
const router = express.Router();
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

// Import required services
let plexDb = null;
try {
  const PlexDatabaseService = require('../plexDatabaseService');
  plexDb = new PlexDatabaseService();
} catch (error) {
  console.warn('PlexDatabaseService not available in search/debug routes:', error.message);
}

// Search Plex media endpoint
router.get('/search', asyncHandler(async (req, res) => {
  const { query, type, year } = req.query;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  // Parse year filter if provided
  let yearFilter = null;
  if (year) {
    const parsedYear = parseInt(year);
    if (!isNaN(parsedYear) && parsedYear > 1800 && parsedYear <= new Date().getFullYear() + 10) {
      yearFilter = parsedYear;
    }
  }

  if (!plexDb) {
    return sendServerError(res, 'Plex database service not available');
  }

  if (type === 'tv' || type === 'television') {
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
    }
  } else {
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
}));

// Debug endpoint to check Plex library sections
router.get('/debug/sections', asyncHandler(async (req, res) => {
  if (!plexDb) {
    return res.status(500).json({ error: 'Plex database service not available' });
  }

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
}));

// Test endpoint for basic connectivity
router.get('/test', asyncHandler(async (req, res) => {
  // Simple test endpoint that returns server status and basic info
  const serverInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'Eddie Life Management',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };

  // Add Plex database status if available
  if (plexDb) {
    try {
      const sections = await plexDb.getLibrarySections();
      serverInfo.plexDatabase = {
        status: 'connected',
        sectionsCount: sections.length
      };
    } catch (plexError) {
      serverInfo.plexDatabase = {
        status: 'error',
        message: plexError.message
      };
    }
  } else {
    serverInfo.plexDatabase = {
      status: 'unavailable',
      message: 'Plex database service not loaded'
    };
  }

  res.json(serverInfo);
}));

module.exports = router;
