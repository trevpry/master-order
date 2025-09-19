const express = require('express');
const router = express.Router();
const RawgService = require('../services/rawgService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const rawgService = new RawgService();

/**
 * GET /api/rawg/search
 * Search for games using RAWG API
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;
  
  if (!query) {
    return sendBadRequest(res, 'Search query is required');
  }

  const games = await rawgService.searchGames(query, parseInt(limit));
  sendSuccess(res, games);
}));

/**
 * GET /api/rawg/game/:rawgId
 * Get detailed game information from RAWG API
 */
router.get('/game/:rawgId', asyncHandler(async (req, res) => {
  const { rawgId } = req.params;
  
  if (!rawgId || isNaN(rawgId)) {
    return sendBadRequest(res, 'Valid RAWG game ID is required');
  }

  const gameDetails = await rawgService.getGameDetails(parseInt(rawgId));
  sendSuccess(res, gameDetails);
}));

/**
 * POST /api/rawg/import/:rawgId
 * Import a game from RAWG into unified VideoGame library
 */
router.post('/import/:rawgId', asyncHandler(async (req, res) => {
  const { rawgId } = req.params;
  const { webvideoUrl } = req.body;
  
  if (!rawgId || isNaN(rawgId)) {
    return sendBadRequest(res, 'Valid RAWG game ID is required');
  }

  const game = await rawgService.importGameFromRawg(parseInt(rawgId), { webvideoUrl });
  sendSuccess(res, game, 'Game imported successfully');
}));

/**
 * GET /api/rawg/library
 * Get games from unified VideoGame library
 */
router.get('/library', asyncHandler(async (req, res) => {
  const { limit, offset, search, platform, genre } = req.query;
  
  const options = {
    limit: limit ? parseInt(limit) : undefined,
    offset: offset ? parseInt(offset) : undefined,
    search,
    platform,
    genre
  };

  const games = await rawgService.getGames(options);
  sendSuccess(res, games);
}));

/**
 * GET /api/rawg/library/:id
 * Get specific game from unified VideoGame library
 */
router.get('/library/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return sendBadRequest(res, 'Valid game ID is required');
  }

  const game = await rawgService.getGameById(parseInt(id));
  
  if (!game) {
    return sendBadRequest(res, 'Game not found');
  }

  sendSuccess(res, game);
}));

/**
 * POST /api/rawg/library
 * Create a new game in unified VideoGame library (manual entry)
 */
router.post('/library', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['title']);
  
  const {
    title,
    developer,
    publisher,
    releaseDate,
    description,
    platforms,
    genres,
    rating,
    metacriticRating,
    coverUrl,
    esrbRating,
    playtimeHours,
    website,
    webvideoUrl
  } = req.body;

  const gameData = {
    title,
    developer,
    publisher,
    releaseDate: releaseDate ? new Date(releaseDate) : null,
    description,
    platforms: platforms ? JSON.stringify(platforms) : null,
    genres: genres ? JSON.stringify(genres) : null,
    rating: rating ? parseFloat(rating) : null,
    metacriticRating: metacriticRating ? parseInt(metacriticRating) : null,
    coverUrl,
    originalArtworkUrl: coverUrl,
    esrbRating,
    playtimeHours: playtimeHours ? parseInt(playtimeHours) : null,
    website,
    webvideoUrl
  };

  const game = await rawgService.createGame(gameData);
  sendSuccess(res, game, 'Game created successfully');
}));

/**
 * PUT /api/rawg/library/:id
 * Update a game in unified VideoGame library
 */
router.put('/library/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return sendBadRequest(res, 'Valid game ID is required');
  }

  const existingGame = await rawgService.getGameById(parseInt(id));
  if (!existingGame) {
    return sendBadRequest(res, 'Game not found');
  }

  const updateData = {
    ...req.body,
    updatedAt: new Date()
  };

  // Handle date fields
  if (updateData.releaseDate) {
    updateData.releaseDate = new Date(updateData.releaseDate);
  }

  // Handle JSON fields
  if (updateData.platforms && Array.isArray(updateData.platforms)) {
    updateData.platforms = JSON.stringify(updateData.platforms);
  }
  if (updateData.genres && Array.isArray(updateData.genres)) {
    updateData.genres = JSON.stringify(updateData.genres);
  }

  // Handle numeric fields
  if (updateData.rating) {
    updateData.rating = parseFloat(updateData.rating);
  }
  if (updateData.metacriticRating) {
    updateData.metacriticRating = parseInt(updateData.metacriticRating);
  }
  if (updateData.playtimeHours) {
    updateData.playtimeHours = parseInt(updateData.playtimeHours);
  }

  const updatedGame = await rawgService.prisma.videoGame.update({
    where: { id: parseInt(id) },
    data: updateData
  });

  sendSuccess(res, updatedGame, 'Game updated successfully');
}));

/**
 * DELETE /api/rawg/library/:id
 * Delete a game from unified VideoGame library
 */
router.delete('/library/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(id)) {
    return sendBadRequest(res, 'Valid game ID is required');
  }

  const existingGame = await rawgService.getGameById(parseInt(id));
  if (!existingGame) {
    return sendBadRequest(res, 'Game not found');
  }

  await rawgService.prisma.videoGame.delete({
    where: { id: parseInt(id) }
  });

  sendSuccess(res, null, 'Game deleted successfully');
}));

/**
 * POST /api/rawg/library/:id/completion
 * Update game completion status
 */
router.post('/library/:id/completion', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId = null, isCompleted, hoursPlayed, percentComplete } = req.body;
  
  if (!id || isNaN(id)) {
    return sendBadRequest(res, 'Valid game ID is required');
  }

  const existingGame = await rawgService.getGameById(parseInt(id));
  if (!existingGame) {
    return sendBadRequest(res, 'Game not found');
  }

  const completion = await rawgService.updateGameCompletion(parseInt(id), {
    userId,
    isCompleted,
    hoursPlayed: hoursPlayed ? parseFloat(hoursPlayed) : null,
    percentComplete: percentComplete ? parseFloat(percentComplete) : null
  });

  sendSuccess(res, completion, 'Game completion updated successfully');
}));

/**
 * GET /api/rawg/library/:id/completion
 * Get game completion status
 */
router.get('/library/:id/completion', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId = null } = req.query;
  
  if (!id || isNaN(id)) {
    return sendBadRequest(res, 'Valid game ID is required');
  }

  const completion = await rawgService.prisma.gameCompletion.findUnique({
    where: {
      gameId_userId: {
        gameId: parseInt(id),
        userId
      }
    }
  });

  sendSuccess(res, completion || { isCompleted: false, hoursPlayed: 0, percentComplete: 0 });
}));

/**
 * GET /api/rawg/artwork
 * Proxy RAWG artwork/images
 */
router.get('/artwork', async (req, res) => {
  try {
    const artworkUrl = req.query.url;
    if (!artworkUrl) {
      return res.status(400).send('Missing artwork URL');
    }
    
    // Use longer timeout for mobile devices and better User-Agent
    const timeout = req.get('User-Agent')?.includes('Mobile') ? 20000 : 10000;
    const userAgent = req.get('User-Agent') || 'MasterOrder/1.0';
    
    console.log(`Loading RAWG artwork: ${artworkUrl} (timeout: ${timeout}ms, UA: ${userAgent})`);
    
    const response = await fetch(artworkUrl, {
      timeout: timeout,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'image/webp,image/avif,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Set appropriate headers
    res.set({
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*' // Allow cross-origin access
    });
    
    // Pipe the image data
    const readable = response.body;
    readable.pipe(res);
  } catch (error) {
    console.error('Error proxying RAWG artwork:', error.message);
    if (error.code === 'ECONNABORTED' || error.name === 'TimeoutError') {
      console.error('RAWG artwork request timed out');
      res.status(408).send('RAWG artwork request timed out');
    } else {
      console.error('RAWG artwork proxy error:', error);
      res.status(500).send('Failed to load RAWG artwork');
    }
  }
});

module.exports = router;