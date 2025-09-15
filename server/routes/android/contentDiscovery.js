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
      } else if (data.orderType === 'HISTORY_PLUS') {
        console.log('📱 History Plus order type selected, treating video as webvideo');
        
        // Transform History Plus video to webvideo format (same as custom order webvideos)
        if (data.type === 'video' && data.content) {
          const video = data.content;
          
          upNextData = {
            ratingKey: `history-plus-video-${video.id}`,
            title: data.title,
            type: 'webvideo',
            year: null,
            summary: data.description || '',
            thumb: data.thumbnail,
            art: null,
            webTitle: data.title,
            webUrl: video.url,
            webDescription: data.description || '',
            localArtworkPath: null,
            orderType: 'HISTORY_PLUS',
            customOrderMediaType: 'webvideo',
            // Include History Plus context
            eventId: data.eventId,
            eventTitle: data.eventTitle,
            eventDate: data.eventDate,
            channel: data.channel
          };
        } else {
          // Non-video History Plus content (books, chapters, sections)
          upNextData = data;
        }
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
            id: upNextData.customOrderItemId || upNextData.id,
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
            // Playlist information
            ...(upNextData.playlistName && {
              playlistName: upNextData.playlistName,
              playlistType: upNextData.playlistType
            }),
            // Background gallery information
            ...(upNextData.backgroundGalleryName && {
              backgroundGalleryName: upNextData.backgroundGalleryName,
              backgroundGalleryId: upNextData.backgroundGalleryId
            }),
            // Episode-specific fields for custom orders
            ...(upNextData.type === 'episode' && {
              seasonNumber: upNextData.seasonNumber || upNextData.currentSeason || null,
              episodeNumber: upNextData.episodeNumber || upNextData.currentEpisode || null,
              episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
              seriesTitle: upNextData.seriesTitle || upNextData.grandparentTitle || null
            })
          }
        };
      } else if (upNextData.orderType === 'HISTORY_PLUS') {
        // History Plus response - treat webvideos like custom order webvideos
        const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
        
        if (upNextData.type === 'webvideo') {
          // Handle History Plus webvideos exactly like custom order webvideos
          androidResponse = {
            type: 'PLAY_CUSTOM_ORDER_ITEM',
            data: {
              id: upNextData.ratingKey,
              title: upNextData.title,
              type: upNextData.type,
              orderName: `History Plus: ${upNextData.eventTitle}`,
              summary: upNextData.summary || '',
              duration: 0, // Webvideos don't have duration
              localArtworkPath: upNextData.localArtworkPath || '',
              artworkUrl: artworkUrl || '',
              streamUrl: '',
              ratingKey: null, // Webvideos don't have Plex rating keys
              plexId: null, // Webvideos don't have Plex IDs
              webUrl: upNextData.webUrl || null,
              webTitle: upNextData.webTitle,
              webDescription: upNextData.webDescription,
              customOrderId: null,
              customOrderItemId: null,
              // History Plus specific context
              eventId: upNextData.eventId,
              eventTitle: upNextData.eventTitle,
              eventDate: upNextData.eventDate,
              channel: upNextData.channel
            }
          };
        } else {
          // Non-webvideo History Plus content (books, chapters, sections)
          // Format book/chapter/section content for reading interface
          androidResponse = {
            type: 'HISTORY_PLUS_CONTENT',
            data: {
              orderType: upNextData.orderType,
              type: upNextData.type,
              content: upNextData.content,
              title: upNextData.title,
              description: upNextData.description || '',
              // Book information fields
              bookTitle: upNextData.bookTitle,
              bookAuthor: upNextData.bookAuthor,
              bookYear: upNextData.bookYear,
              bookIsbn: upNextData.bookIsbn,
              bookPublisher: upNextData.bookPublisher,
              bookPageCount: upNextData.bookPageCount,
              bookCoverUrl: upNextData.bookCoverUrl,
              bookDescription: upNextData.bookDescription,
              // Chapter information (for chapters and sections)
              ...(upNextData.chapterNumber && {
                chapterNumber: upNextData.chapterNumber,
                chapterTitle: upNextData.chapterTitle,
                chapterDescription: upNextData.chapterDescription
              }),
              // Section information (for sections only)
              ...(upNextData.sectionNumber && {
                sectionNumber: upNextData.sectionNumber,
                sectionTitle: upNextData.sectionTitle,
                sectionDescription: upNextData.sectionDescription
              }),
              // Page information
              ...(upNextData.pageStart && {
                pageStart: upNextData.pageStart,
                pageEnd: upNextData.pageEnd
              }),
              // History Plus specific context
              eventId: upNextData.eventId,
              eventTitle: upNextData.eventTitle,
              eventDate: upNextData.eventDate
            }
          };
        }
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
        
        // For TV episodes, construct episode-specific artwork paths
        let episodeThumb = upNextData.thumb || '';
        let episodeArt = upNextData.art || '';
        
        // If we have an episode rating key, construct episode-specific artwork paths
        if (episodeRatingKey && episodeRatingKey !== seriesRatingKey) {
          // Extract timestamp from existing thumb/art if available
          const thumbMatch = upNextData.thumb?.match(/\/(\d+)$/);
          const artMatch = upNextData.art?.match(/\/(\d+)$/);
          const thumbTimestamp = thumbMatch ? thumbMatch[1] : Date.now();
          const artTimestamp = artMatch ? artMatch[1] : Date.now();
          
          episodeThumb = `/library/metadata/${episodeRatingKey}/thumb/${thumbTimestamp}`;
          episodeArt = `/library/metadata/${episodeRatingKey}/art/${artTimestamp}`;
          console.log('📱 Using episode-specific artwork paths:', { episodeThumb, episodeArt });
        } else {
          console.log('📱 Using series artwork paths for episode');
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
            // Episode-specific artwork URLs
            thumb: episodeThumb,
            art: episodeArt,
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
