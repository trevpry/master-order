const express = require('express');
const router = express.Router();
const comicVineService = require('../comicVineService');
const axios = require('axios');

// ComicVine search endpoint
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const results = await comicVineService.searchSeries(query);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching ComicVine:', error);
    res.status(500).json({ error: 'Failed to search ComicVine' });
  }
});

// ComicVine search with issue filtering and cover art
router.get('/search-with-issues', async (req, res) => {
  try {
    const { query, issueNumber, issueTitle } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }
    if (!issueNumber) {
      return res.status(400).json({ error: 'Missing issue number' });
    }

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
              image: series.image,
              publisher: series.publisher,
              start_year: series.start_year,
              resource_type: series.resource_type
            },
            // Issue information
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
              resource_type: issue.resource_type
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
  } catch (error) {
    console.error('Error searching ComicVine with issue filtering:', error);
    res.status(500).json({ error: 'Failed to search ComicVine with issue filtering' });
  }
});

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

module.exports = router;
