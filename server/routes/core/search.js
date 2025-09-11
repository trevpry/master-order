/**
 * Core Search Routes
 * Handles search functionality across all media types
 */

const express = require('express');

/**
 * Create search routes
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createSearchRoutes(prisma) {
  const router = express.Router();
  
  // Initialize dependencies
  const plexDb = require('../../plexDatabaseService');

  // Main search endpoint
  router.get('/api/search', async (req, res) => {
    try {
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

      if (type === 'tv' || type === 'television') {
        // Search for TV shows and their episodes in the database
        try {
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
    } catch (error) {
      console.error('Error searching Plex media:', error);
      res.status(500).json({ error: 'Failed to search Plex media' });
    }
  });

  return router;
}

module.exports = createSearchRoutes;
