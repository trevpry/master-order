const express = require('express');
const router = express.Router();

// Search for books in OpenLibrary
router.get('/search', async (req, res) => {
  try {
    const { query, limit } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const openLibraryService = require('../openLibraryService');
    const results = await openLibraryService.searchBooks(query, parseInt(limit) || 20);
    
    res.json(results);
  } catch (error) {
    console.error('Error searching OpenLibrary:', error);
    
    // Handle specific error types
    if (error.message.includes('temporarily unavailable')) {
      return res.status(503).json({ 
        error: 'OpenLibrary service is temporarily unavailable',
        message: 'The OpenLibrary service is currently down. Please try again in a few minutes.',
        retry: true
      });
    } else if (error.message.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests to OpenLibrary. Please wait a moment and try again.',
        retry: true
      });
    } else if (error.message.includes('Unable to connect')) {
      return res.status(503).json({ 
        error: 'Connection failed',
        message: 'Unable to connect to OpenLibrary. Please check your internet connection.',
        retry: true
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to search OpenLibrary',
      message: 'An unexpected error occurred while searching for books. Please try again.',
      retry: true
    });
  }
});

// Get book details from OpenLibrary
router.get('/book/*', async (req, res) => {
  try {
    const bookKey = req.params[0]; // Use wildcard parameter
    if (!bookKey) {
      return res.status(400).json({ error: 'Missing book key' });
    }

    const openLibraryService = require('../openLibraryService');
    const bookDetails = await openLibraryService.getBookDetails(bookKey);
    
    if (!bookDetails) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    res.json(bookDetails);
  } catch (error) {
    console.error('Error getting book details:', error);
    
    // Handle specific error types
    if (error.message.includes('temporarily unavailable')) {
      return res.status(503).json({ 
        error: 'OpenLibrary service is temporarily unavailable',
        message: 'The OpenLibrary service is currently down. Please try again in a few minutes.',
        retry: true
      });
    } else if (error.message.includes('rate limit')) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests to OpenLibrary. Please wait a moment and try again.',
        retry: true
      });
    } else if (error.message.includes('Unable to connect')) {
      return res.status(503).json({ 
        error: 'Connection failed',
        message: 'Unable to connect to OpenLibrary. Please check your internet connection.',
        retry: true
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get book details',
      message: 'An unexpected error occurred while getting book details. Please try again.',
      retry: true
    });
  }
});

// OpenLibrary cover artwork proxy
router.get('/artwork', async (req, res) => {
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
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying OpenLibrary artwork:', error);
    res.status(500).send('Error loading OpenLibrary artwork');
  }
});

module.exports = router;
