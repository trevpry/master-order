const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance

// Test TVDB bearer token endpoint
router.get('/test-token', async (req, res) => {
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

// Clear TVDB cache endpoint
router.post('/clear-cache', async (req, res) => {
  try {
    console.log('Starting TVDB cache clear...');
    const TvdbDatabaseService = require('../tvdbDatabaseService');
    const tvdbDb = new TvdbDatabaseService();
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

// TVDB artwork proxy endpoint
router.get('/artwork', async (req, res) => {
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

module.exports = router;
