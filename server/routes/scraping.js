const express = require('express');
const router = express.Router();
const VideoScraperService = require('../services/VideoScraperService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const scraperService = new VideoScraperService();

/**
 * POST /api/scraping/channel-videos
 * Scrape all videos from a YouTube channel
 */
router.post('/channel-videos', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['channelUrl']);
  
  const { channelUrl, channelId } = req.body;

  console.log(`Starting channel scraping for: ${channelUrl}`);
  
  const result = await scraperService.scrapeChannelVideos(channelUrl, channelId);
  
  sendSuccess(res, result, result.message);
}));

/**
 * POST /api/scraping/channel-info
 * Get channel information from URL
 */
router.post('/channel-info', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['channelUrl']);
  
  const { channelUrl } = req.body;
  
  const result = await scraperService.getChannelInfo(channelUrl);
  
  sendSuccess(res, result.channelInfo, 'Channel info retrieved successfully');
}));

/**
 * WebSocket endpoint for real-time scraping progress
 * This will be handled by the main server with Socket.IO
 */
router.post('/channel-videos-with-progress', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['channelUrl']);
  
  const { channelUrl, channelId } = req.body;
  const socketId = req.headers['x-socket-id'];

  console.log(`Starting channel scraping with progress for: ${channelUrl}`);
  
  // Get Socket.IO instance from app
  const io = req.app.get('socketio');
  
  // Progress callback to emit updates via WebSocket
  const progressCallback = (progressData) => {
    if (io && socketId) {
      io.to(socketId).emit('scraping-progress', {
        channelUrl,
        ...progressData
      });
    }
  };
  
  try {
    const result = await scraperService.scrapeChannelVideos(channelUrl, channelId, progressCallback);
    
    // Final progress update
    if (io && socketId) {
      io.to(socketId).emit('scraping-complete', {
        channelUrl,
        result
      });
    }
    
    sendSuccess(res, result, result.message);
  } catch (error) {
    // Error progress update
    if (io && socketId) {
      io.to(socketId).emit('scraping-error', {
        channelUrl,
        error: error.message
      });
    }
    throw error;
  }
}));

module.exports = router;