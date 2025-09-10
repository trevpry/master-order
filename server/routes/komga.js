const express = require('express');
const router = express.Router();
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

// Test connection to Komga
router.get('/test', asyncHandler(async (req, res) => {
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
}));

// Search for series in Komga
router.get('/search', validateRequiredFields('query', 'Query parameter is required'), asyncHandler(async (req, res) => {
  const { query } = req.query;
  
  const komgaService = require('../komgaService');
  const results = await komgaService.searchSeries(query);
  
  res.json(results);
}));

// Search for specific comic issue in Komga
router.get('/search-comic', asyncHandler(async (req, res) => {
  const { series, issue, year } = req.query;
  
  if (!series || !issue) {
    return sendBadRequest(res, 'series and issue parameters are required');
  }
  
  const komgaService = require('../komgaService');
  const result = await komgaService.searchComic(series, issue, year ? parseInt(year) : null);
  
  if (result) {
    res.json({ found: true, data: result });
  } else {
    res.json({ found: false, data: null });
  }
}));

module.exports = router;