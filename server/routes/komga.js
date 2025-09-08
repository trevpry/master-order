const express = require('express');
const router = express.Router();

// Test connection to Komga
router.get('/test', async (req, res) => {
  try {
    const komgaService = require('../komgaService');
    const result = await komgaService.testConnection();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Komga connection successful',
        configured: true
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.message,
        configured: false
      });
    }
  } catch (error) {
    console.error('Error testing Komga connection:', error);
    res.status(500).json({ 
      error: 'Failed to test Komga connection',
      message: error.message,
      configured: false
    });
  }
});

// Search for series in Komga
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    const komgaService = require('../komgaService');
    const results = await komgaService.searchSeries(query);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching Komga:', error);
    res.status(500).json({ error: 'Failed to search Komga', message: error.message });
  }
});

// Search for specific comic issue in Komga
router.get('/search-comic', async (req, res) => {
  try {
    const { series, issue, year } = req.query;
    
    if (!series || !issue) {
      return res.status(400).json({ error: 'series and issue parameters are required' });
    }
    
    const komgaService = require('../komgaService');
    const result = await komgaService.searchComic(series, issue, year ? parseInt(year) : null);
    
    if (result) {
      res.json({ found: true, data: result });
    } else {
      res.json({ found: false, data: null });
    }
  } catch (error) {
    console.error('Error searching Komga for comic:', error);
    res.status(500).json({ error: 'Failed to search Komga for comic', message: error.message });
  }
});

module.exports = router;
