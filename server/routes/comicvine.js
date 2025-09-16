const express = require('express');
const router = express.Router();
const comicVineService = require('../comicVineService');
const axios = require('axios');
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

// ComicVine search endpoint
router.get('/search', validateRequiredFields('query', 'Missing search query'), asyncHandler(async (req, res) => {
  const { query } = req.query;
  const results = await comicVineService.searchSeries(query);
  res.json(results);
}));

// ComicVine search with issue filtering and cover art
router.get('/search-with-issues', asyncHandler(async (req, res) => {
  const { query, issueNumber, issueTitle } = req.query;
  if (!query) {
    return sendBadRequest(res, 'Missing search query');
  }
  if (!issueNumber) {
    return sendBadRequest(res, 'Missing issue number');
  }

  console.log(`🔍 ComicVine search-with-issues: "${query}" #${issueNumber}`);

  // First get all series matching the search (now uses caching)
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
              image: series.image,
              publisher: series.publisher,
              start_year: series.start_year,
              resource_type: series.resource_type
            },
            // Issue information (include ALL ComicVine data)
            issue: {
              id: issue.id,
              issue_number: issue.issue_number,
              name: issue.name,
              description: issue.description,
              cover_date: issue.cover_date,
              store_date: issue.store_date,
              image: issue.image,
              api_detail_url: issue.api_detail_url,
              site_detail_url: issue.site_detail_url,
              resource_type: issue.resource_type,
              // Include all the credit information
              character_credits: issue.character_credits,
              person_credits: issue.person_credits,
              story_arc_credits: issue.story_arc_credits,
              team_credits: issue.team_credits,
              concept_credits: issue.concept_credits,
              location_credits: issue.location_credits,
              object_credits: issue.object_credits,
              character_died_in: issue.character_died_in,
              first_appearance_characters: issue.first_appearance_characters,
              first_appearance_concepts: issue.first_appearance_concepts,
              first_appearance_locations: issue.first_appearance_locations,
              first_appearance_objects: issue.first_appearance_objects,
              first_appearance_storyarcs: issue.first_appearance_storyarcs,
              first_appearance_teams: issue.first_appearance_teams,
              deck: issue.deck,
              date_added: issue.date_added,
              date_last_updated: issue.date_last_updated,
              has_staff_review: issue.has_staff_review
            },
            // Cover art information
            coverUrl: coverUrl,
            // Search metadata
            searchQuery: query,
            searchIssueNumber: issueNumber,
            searchIssueTitle: issueTitle || null
          };
          
          filteredSeries.push(comprehensiveData);
        }
      } catch (issueError) {
        console.warn(`Could not check issue ${issueNumber} for series ${series.name}:`, issueError.message);
      // Continue to next series
    }
  }
  
  console.log(`ComicVine search: Found ${filteredSeries.length} series with issue #${issueNumber} for "${query}"`);
  
  res.json(filteredSeries);
}));

// ComicVine cover artwork endpoint
router.get('/cover', async (req, res) => {
  try {
    const { comic } = req.query;
    if (!comic) {
      return res.status(400).send('Missing comic parameter');
    }

    const comicDetails = await comicVineService.getComicCoverArt(comic);
    
    if (comicDetails && comicDetails.coverUrl) {
      // Return the cover image by proxying it
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
    console.error('Error getting ComicVine cover:', error);
    res.status(500).send('Error loading comic cover');
  }
});

// Proxy endpoint for ComicVine artwork
router.get('/artwork', async (req, res) => {
  try {
    const artworkUrl = req.query.url;
    if (!artworkUrl) {
      return res.status(400).send('Missing artwork URL');
    }
    
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

// Optimized bulk comic search endpoint - reduces API calls significantly
router.post('/bulk-search-with-issues', asyncHandler(async (req, res) => {
  const { comics } = req.body;
  
  if (!comics || !Array.isArray(comics)) {
    return sendBadRequest(res, 'Missing comics array in request body');
  }

  if (comics.length === 0) {
    return sendSuccess(res, []);
  }

  if (comics.length > 50) {
    return sendBadRequest(res, 'Maximum 50 comics per bulk request');
  }

  console.log(`🚀 Processing bulk ComicVine search for ${comics.length} comics`);
  const results = [];
  const seriesCache = new Map(); // Local cache for this request
  
  for (const comic of comics) {
    try {
      const { seriesName, issueNumber, issueTitle = '' } = comic;
      
      if (!seriesName || !issueNumber) {
        results.push({
          input: comic,
          success: false,
          error: 'Missing seriesName or issueNumber'
        });
        continue;
      }

      // Check if we already searched for this series in this batch
      let seriesResults = seriesCache.get(seriesName.toLowerCase());
      
      if (!seriesResults) {
        // Search for series (this will use the ComicVineService cache)
        seriesResults = await comicVineService.searchSeries(seriesName);
        seriesCache.set(seriesName.toLowerCase(), seriesResults);
        console.log(`📚 Searched series "${seriesName}" - found ${seriesResults.length} results`);
      } else {
        console.log(`🎯 Reusing series data for "${seriesName}" (batch cache hit)`);
      }

      // Filter series that have the requested issue
      const matchingResults = [];
      
      for (const series of seriesResults) {
        try {
          // Check if this series has the requested issue (uses ComicVineService cache)
          const issue = await comicVineService.getIssueByNumber(series.id, issueNumber);
          
          if (issue) {
            const coverUrl = issue.image?.original_url || issue.image?.screen_url || issue.image?.small_url;
            
            const comprehensiveData = {
              series: {
                id: series.id,
                name: series.name,
                aliases: series.aliases,
                api_detail_url: series.api_detail_url,
                count_of_issues: series.count_of_issues,
                description: series.description,
                first_issue: series.first_issue,
                last_issue: series.last_issue,
                image: series.image,
                publisher: series.publisher,
                start_year: series.start_year,
                resource_type: series.resource_type
              },
              issue: {
                id: issue.id,
                issue_number: issue.issue_number,
                name: issue.name,
                description: issue.description,
                cover_date: issue.cover_date,
                store_date: issue.store_date,
                image: issue.image,
                api_detail_url: issue.api_detail_url,
                site_detail_url: issue.site_detail_url,
                resource_type: issue.resource_type,
                character_credits: issue.character_credits,
                person_credits: issue.person_credits,
                story_arc_credits: issue.story_arc_credits,
                team_credits: issue.team_credits,
                concept_credits: issue.concept_credits,
                location_credits: issue.location_credits,
                object_credits: issue.object_credits,
                character_died_in: issue.character_died_in,
                first_appearance_characters: issue.first_appearance_characters,
                first_appearance_concepts: issue.first_appearance_concepts,
                first_appearance_locations: issue.first_appearance_locations,
                first_appearance_objects: issue.first_appearance_objects,
                first_appearance_storyarcs: issue.first_appearance_storyarcs,
                first_appearance_teams: issue.first_appearance_teams,
                deck: issue.deck,
                date_added: issue.date_added,
                date_last_updated: issue.date_last_updated,
                has_staff_review: issue.has_staff_review
              },
              coverUrl: coverUrl,
              searchQuery: seriesName,
              searchIssueNumber: issueNumber,
              searchIssueTitle: issueTitle
            };
            
            matchingResults.push(comprehensiveData);
          }
        } catch (issueError) {
          console.warn(`Could not check issue ${issueNumber} for series ${series.name}:`, issueError.message);
        }
      }

      results.push({
        input: comic,
        success: true,
        results: matchingResults,
        seriesSearched: seriesResults.length,
        matchingIssues: matchingResults.length
      });

    } catch (error) {
      console.error(`Error processing comic ${comic.seriesName || 'unknown'}:`, error.message);
      results.push({
        input: comic,
        success: false,
        error: error.message
      });
    }
  }

  // Log cache statistics for monitoring
  const cacheStats = comicVineService.getCacheStats();
  console.log(`📊 ComicVine cache stats:`, cacheStats);

  sendSuccess(res, {
    results: results,
    processed: comics.length,
    cacheStats: cacheStats,
    summary: {
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalMatches: results.reduce((sum, r) => sum + (r.matchingIssues || 0), 0)
    }
  });
}));

// ComicVine cache statistics endpoint
router.get('/cache-stats', asyncHandler(async (req, res) => {
  const stats = comicVineService.getCacheStats();
  sendSuccess(res, stats);
}));

// Clear ComicVine cache (for testing/troubleshooting)
router.post('/clear-cache', asyncHandler(async (req, res) => {
  comicVineService.clearCache();
  sendSuccess(res, { message: 'ComicVine cache cleared successfully' });
}));

module.exports = router;
