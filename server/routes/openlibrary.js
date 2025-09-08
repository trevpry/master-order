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
    res.status(500).json({ error: 'Failed to search OpenLibrary' });
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
    res.status(500).json({ error: 'Failed to get book details' });
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
