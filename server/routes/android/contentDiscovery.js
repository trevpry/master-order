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

  // Android companion app endpoint - Get Up Next
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
        return res.status(404).json(createAndroidErrorResponse(
          'NO_CONTENT',
          'No content available',
          upNextData?.error || 'No content found for up next.'
        ));
      }
      
      // Determine content type and build appropriate response according to documentation
      let androidResponse;
      
      if (upNextData.orderType === 'MOVIES_GENERAL') {
        // Movie response - use PLAY_MOVIE type
        const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
        androidResponse = {
          type: 'PLAY_MOVIE',
          data: {
            ratingKey: upNextData.ratingKey,
            plexId: upNextData.ratingKey,
            title: upNextData.title,
            year: upNextData.year,
            duration: upNextData.duration || 0,
            summary: upNextData.summary || '',
            studio: upNextData.studio || 'Unknown Studio',
            rating: upNextData.rating || 0,
            thumb: upNextData.thumb || '',
            art: upNextData.art || '',
            artworkUrl: artworkUrl || '',
            streamUrl: upNextData.streamUrl || '',
            otherCollections: upNextData.otherCollections || []
          }
        };
      } else if (upNextData.orderType === 'CUSTOM_ORDER') {
        // Custom order response - use PLAY_CUSTOM_ORDER_ITEM type
        const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
        
        // For episodes in custom orders, make sure we use the episode rating key
        let episodeRatingKey = upNextData.ratingKey;
        if (upNextData.type === 'episode' && upNextData.episodeRatingKey) {
          episodeRatingKey = upNextData.episodeRatingKey;
          console.log('📱 Using episode-specific rating key for Android:', episodeRatingKey);
        }

        androidResponse = {
          type: 'PLAY_CUSTOM_ORDER_ITEM',
          data: {
            id: upNextData.id,
            title: upNextData.title,
            type: upNextData.type,
            orderName: upNextData.customOrderName || 'Custom Order',
            summary: upNextData.summary || '',
            duration: upNextData.duration || 0,
            localArtworkPath: upNextData.localArtworkPath || '',
            artworkUrl: artworkUrl || '',
            streamUrl: upNextData.streamUrl || '',
            ratingKey: episodeRatingKey || null,
            plexId: episodeRatingKey || null,
            webUrl: upNextData.webUrl || null,
            customOrderId: upNextData.customOrderId || null,
            customOrderItemId: upNextData.customOrderItemId || null,
            // Episode-specific fields for custom orders
            ...(upNextData.type === 'episode' && {
              seasonNumber: upNextData.seasonNumber || upNextData.currentSeason || null,
              episodeNumber: upNextData.episodeNumber || upNextData.currentEpisode || null,
              episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
              seriesTitle: upNextData.seriesTitle || upNextData.grandparentTitle || null
            })
          }
        };
      } else {
        // TV Show response (default) - use PLAY_TV_EPISODE type
        const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
        
        // For TV episodes from Plex, make sure we use the episode rating key
        let episodeRatingKey = upNextData.ratingKey; // Default to series rating key
        let seriesRatingKey = upNextData.ratingKey; // Keep series rating key for reference
        
        // Priority order for finding episode-specific rating key
        if (upNextData.episodeRatingKey) {
          episodeRatingKey = upNextData.episodeRatingKey;
          console.log('📱 Using episodeRatingKey for Android:', episodeRatingKey);
        } else if (upNextData.currentEpisodeRatingKey) {
          episodeRatingKey = upNextData.currentEpisodeRatingKey;
          console.log('📱 Using currentEpisodeRatingKey for Android:', episodeRatingKey);
        } else if (upNextData.nextEpisodeRatingKey) {
          episodeRatingKey = upNextData.nextEpisodeRatingKey;
          console.log('📱 Using nextEpisodeRatingKey for Android:', episodeRatingKey);
        } else {
          console.log('📱 No episode-specific rating key found, using series rating key:', episodeRatingKey);
        }
        
        androidResponse = {
          type: 'PLAY_TV_EPISODE',
          data: {
            ratingKey: episodeRatingKey,
            episodeRatingKey: episodeRatingKey,
            seriesRatingKey: seriesRatingKey,
            plexId: episodeRatingKey,
            title: upNextData.title,
            episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
            summary: upNextData.summary || '',
            episodeSummary: upNextData.episodeSummary || null,
            leafCount: upNextData.leafCount || 0,
            viewedLeafCount: upNextData.viewedLeafCount || 0,
            // Season and episode information for TV shows
            seasonNumber: upNextData.currentSeason || upNextData.seasonNumber || null,
            episodeNumber: upNextData.currentEpisode || upNextData.episodeNumber || null,
            isFinalSeason: upNextData.isCurrentSeasonFinal || false,
            // Artwork URLs
            thumb: upNextData.thumb || '',
            art: upNextData.art || '',
            artworkUrl: artworkUrl || '',
            streamUrl: upNextData.streamUrl || '',
            otherCollections: upNextData.otherCollections || []
          }
        };
      }
      
      console.log('📱 Sending Android companion up next response:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android up next endpoint:', error);
      res.status(500).json(createAndroidErrorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createContentDiscoveryRoutes;
