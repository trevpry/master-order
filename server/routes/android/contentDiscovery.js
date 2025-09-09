/**
 * Android Content Discovery Routes
 * Handles up next content retrieval and formatting for Android app
 */

const express = require('express');
const { getAndroidApiBaseUrl, getAndroidArtworkUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create content discovery routes for Android app
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createContentDiscoveryRoutes(services) {
  const router = express.Router();
  const { getNextEpisode, getNextMovie, getNextCustomOrder } = services;

  // Get up next content for Android app
  router.get('/up-next', async (req, res) => {
    console.log('📱 Android app requesting up next content...');
    
    try {
      // Call the internal getNextEpisode function directly to ensure consistent data
      console.log('📱 Calling getNextEpisode() directly...');
      const data = await getNextEpisode(); // This handles order type selection internally
      
      console.log('📱 getNextEpisode() returned:', {
        orderType: data?.orderType,
        title: data?.title,
        ratingKey: data?.ratingKey,
        episodeRatingKey: data?.episodeRatingKey
      });
      
      let upNextData;
      // If movies were selected, use the new getNextMovie function
      if (data.orderType === 'MOVIES_GENERAL') {
        console.log('📱 Movie order type selected, using getNextMovie function');
        upNextData = await getNextMovie();
      } else if (data.orderType === 'CUSTOM_ORDER') {
        console.log('📱 Custom order type selected, using getNextCustomOrder function');
        upNextData = await getNextCustomOrder(req);
      } else {
        // TV General selection
        upNextData = data;
      }
      
      // Get base URL for Android API (needed for artwork URLs)
      const baseUrl = getAndroidApiBaseUrl();
      console.log('📱 Using base URL for Android API:', baseUrl);
      console.log('📱 Up next data received:', JSON.stringify(upNextData, null, 2));
      
      if (!upNextData || upNextData.error) {
        return res.status(404).json({ 
          error: 'No content available',
          message: upNextData?.error || 'No content found for up next.' 
        });
      }
      
      // Add artwork URL to the response
      if (upNextData) {
        upNextData.artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
      }
      
      console.log('📱 Final up next response for Android:', JSON.stringify(upNextData, null, 2));
      res.json(upNextData);
      
    } catch (error) {
      console.error('❌ Error in Android up-next endpoint:', error);
      res.status(500).json({
        error: 'Failed to get up next content',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createContentDiscoveryRoutes;
