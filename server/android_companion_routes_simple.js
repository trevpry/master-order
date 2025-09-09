const express = require('express');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const path = require('path');

// Android companion app routes - simple module that receives app and dependencies
module.exports = function setupAndroidRoutes(app, io, getNextEpisode, getNextMovie, getNextCustomOrder, watchLogService, prisma) {
  const PORT = process.env.PORT || 3001;

  // Helper function to get base URL for Android API
  const getAndroidApiBaseUrl = () => {
    const externalIp = process.env.EXTERNAL_IP;
    return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
  };

  // Test route to verify Android routes are working
  app.get('/api/android/test', async (req, res) => {
    try {
      res.json({
        success: true,
        message: 'Android companion API is working',
        timestamp: new Date().toISOString(),
        baseUrl: getAndroidApiBaseUrl()
      });
    } catch (error) {
      console.error('Error in Android test endpoint:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  });

  // Android companion app endpoint - Get Up Next
  app.get('/api/android/up-next', async (req, res) => {
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
      
      if (!upNextData || upNextData.error) {
        return res.status(404).json({ 
          error: 'No content available',
          message: upNextData?.error || 'No content found for up next.' 
        });
      }
      
      // Helper function to generate artwork URL like web app does
      const getAndroidArtworkUrl = (media) => {
        // Web videos don't have artwork
        if (media?.type === 'webvideo') {
          return null;
        }
        
        // First priority: Check for cached artwork (works for all media types)
        if (media?.localArtworkPath) {
          const filename = media.localArtworkPath.includes('\\') || media.localArtworkPath.includes('/')
            ? media.localArtworkPath.split(/[\\\/]/).pop() 
            : media.localArtworkPath;
          console.log('📱 Using cached artwork:', filename);
          return `${baseUrl}/api/artwork/${filename}`;
        }
        
        // For comics, fallback to ComicVine artwork if no cached artwork
        if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
          console.log('📱 Using ComicVine artwork (fallback):', media.comicDetails.coverUrl);
          return `${baseUrl}/api/comicvine/artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
        }
        
        // For books, use OpenLibrary artwork
        if (media?.type === 'book' && media?.bookCoverUrl) {
          console.log('📱 Using OpenLibrary artwork:', media.bookCoverUrl);
          return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
        }
        
        // For short stories, use story cover or fallback to containing book's cover
        if (media?.type === 'shortstory') {
          if (media?.storyCoverUrl) {
            console.log('📱 Using short story cover artwork:', media.storyCoverUrl);
            return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
          } else if (media?.containedInBookDetails?.coverUrl) {
            console.log('📱 Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
            return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
          }
        }
        
        // Prioritize TVDB artwork if available for TV content
        if (media?.tvdbArtwork?.url) {
          console.log('📱 Using TVDB artwork:', media.tvdbArtwork.url);
          return `${baseUrl}/api/tvdb/artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
        }
        
        // Fall back to Plex artwork
        const thumb = media?.thumb || media?.art;
        if (!thumb) return null;
        
        // Check if thumb is already a full URL (starts with http)
        if (thumb.startsWith('http')) {
          console.log('📱 Using full artwork URL:', thumb);
          return thumb;
        }
        
        // Otherwise, it's a relative path, so add the base URL
        console.log('📱 Using Plex artwork:', thumb);
        return `${baseUrl}/api/artwork${thumb}`;
      };
      
      // Determine content type and build appropriate response
      let androidResponse;
      
      if (upNextData.orderType === 'MOVIES_GENERAL') {
        // Movie response - use proper artwork URL generation
        const artworkUrl = getAndroidArtworkUrl(upNextData);
        androidResponse = {
          type: 'PLAY_MOVIE',
          data: {
            ratingKey: upNextData.ratingKey,
            plexId: upNextData.ratingKey, // Add plexId field for direct media access
            title: upNextData.title,
            year: upNextData.year,
            duration: upNextData.duration || 0,
            summary: upNextData.summary || '',
            studio: upNextData.studio || 'Unknown Studio',
            rating: upNextData.rating || 0,
            thumb: upNextData.thumb || '',
            art: upNextData.art || '',
            artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
            streamUrl: upNextData.streamUrl || '',
            otherCollections: upNextData.otherCollections || []
          }
        };
      } else if (upNextData.orderType === 'CUSTOM_ORDER') {
        // Custom order response - use proper artwork URL generation
        const artworkUrl = getAndroidArtworkUrl(upNextData);
        
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
            customOrderItemId: upNextData.customOrderItemId || null
          }
        };
      } else {
        // TV Show response (default)
        const artworkUrl = getAndroidArtworkUrl(upNextData);
        
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
            seasonNumber: upNextData.currentSeason || upNextData.seasonNumber || null,
            episodeNumber: upNextData.currentEpisode || upNextData.episodeNumber || null,
            isFinalSeason: upNextData.isCurrentSeasonFinal || false,
            thumb: upNextData.thumb || '',
            art: upNextData.art || '',
            artworkUrl: artworkUrl || '',
            streamUrl: upNextData.streamUrl || '',
            otherCollections: upNextData.otherCollections || []
          }
        };
      }
      
      console.log('📱 Sending Android companion up next response');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android up next endpoint:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  });

  console.log('✅ Android companion routes loaded successfully');
};
