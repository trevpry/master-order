const express = require('express');
const router = express.Router();
const { validateRequiredFields } = require('../middleware/validation');
const { sendBadRequest, sendNotFound, sendSuccess, sendServerError, asyncHandler } = require('../utils/responses');

// Search for books in OpenLibrary
router.get('/search', validateRequiredFields('query', 'Missing search query'), asyncHandler(async (req, res) => {
  const { query, limit } = req.query;
  
  const openLibraryService = require('../openLibraryService');
  const results = await openLibraryService.searchBooks(query, parseInt(limit) || 20);
  
  res.json(results);
}));

// Get book details from OpenLibrary
router.get('/book/*', validateRequiredFields('0', 'Missing book key'), asyncHandler(async (req, res) => {
  const bookKey = req.params[0]; // Use wildcard parameter
  
  const openLibraryService = require('../openLibraryService');
  const bookDetails = await openLibraryService.getBookDetails(bookKey);
  
  if (!bookDetails) {
    return sendNotFound(res, 'Book not found');
  }
  
  res.json(bookDetails);
}));

// OpenLibrary cover artwork proxy
router.get('/artwork', validateRequiredFields('url', 'Missing artwork URL'), asyncHandler(async (req, res) => {
  const artworkUrl = req.query.url;
  
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
}));

module.exports = router;
