const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance
const { asyncHandler } = require('../utils/responses');

// Test TVDB bearer token endpoint
router.get('/test-token', asyncHandler(async (req, res) => {
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
}));

// Clear TVDB cache endpoint
router.post('/clear-cache', asyncHandler(async (req, res) => {
  console.log('Starting TVDB cache clear...');
  const TvdbDatabaseService = require('../tvdbDatabaseService');
  const tvdbDb = new TvdbDatabaseService();
  await tvdbDb.cleanupOldCache(0); // Pass 0 hours to clear all cache
  console.log('TVDB cache cleared successfully');
  res.json({ 
    success: true, 
    message: 'TVDB cache cleared successfully' 
  });
}));

// TVDB artwork proxy endpoint
router.get('/artwork', asyncHandler(async (req, res) => {
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
}));

module.exports = router;
