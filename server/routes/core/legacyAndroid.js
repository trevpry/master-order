/**
 * Core Legacy Android Routes
 * Contains Android companion app endpoints for backward compatibility and deprecation
 * These routes will be gradually deprecated as Android app updates are released
 */

const express = require('express');
const path = require('path');

/**
 * Create legacy Android routes
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createLegacyAndroidRoutes(prisma) {
  const router = express.Router();
  const { resolveUpNext } = require('../../services/upNextService');

  // Helper function to get base URL for Android API
  const getAndroidApiBaseUrl = () => {
    const externalIp = process.env.EXTERNAL_IP;
    const PORT = process.env.PORT || 3005;
    return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
  };

  // Legacy Android companion app endpoint - Get Up Next
  // Uses the shared resolveUpNext service for identical behavior to web and modern Android endpoints
  router.get('/up-next', async (req, res) => {
    console.log('📱 [LEGACY] Android app requesting up next content...');
    
    try {
      const upNextData = await resolveUpNext(req);
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

        // Fetch additional custom order details including playlist and background gallery
        let customOrderDetails = null;
        if (upNextData.customOrderId) {
          try {
            customOrderDetails = await prisma.customOrder.findUnique({
              where: { id: upNextData.customOrderId },
              include: {
                plexPlaylist: true,
                customPlaylist: true,
                backgroundGallery: true
              }
            });
            console.log('📱 Fetched custom order details for Android:', {
              id: customOrderDetails?.id,
              plexPlaylist: customOrderDetails?.plexPlaylist?.title,
              customPlaylist: customOrderDetails?.customPlaylist?.title,
              backgroundGallery: customOrderDetails?.backgroundGallery?.name
            });
          } catch (error) {
            console.error('📱 Error fetching custom order details:', error);
          }
        }
        
        androidResponse = {
          type: 'PLAY_CUSTOM_ORDER_ITEM',
          data: {
            id: upNextData.id,
            title: upNextData.title,
            type: upNextData.type,
            orderName: upNextData.customOrderName || customOrderDetails?.name || 'Custom Order', // Use the actual custom order name
            summary: upNextData.summary || '',
            duration: upNextData.duration || 0,
            localArtworkPath: upNextData.localArtworkPath || '',
            artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
            streamUrl: upNextData.streamUrl || '',
            ratingKey: episodeRatingKey || null,
            plexId: episodeRatingKey || null, // Add plexId field for Plex content
            webUrl: upNextData.webUrl || null, // Add webUrl field for web video content
            customOrderId: upNextData.customOrderId || null,
            customOrderItemId: upNextData.customOrderItemId || null,
            // Playlist information
            playlistName: customOrderDetails?.plexPlaylist?.title || customOrderDetails?.customPlaylist?.title || null,
            playlistType: customOrderDetails?.plexPlaylist ? 'plex' : customOrderDetails?.customPlaylist ? 'custom' : null,
            // Background gallery information
            backgroundGalleryName: customOrderDetails?.backgroundGallery?.name || null,
            backgroundGalleryId: customOrderDetails?.backgroundGallery?.id || null,
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
        // TV Show response (default) - use proper artwork URL generation
        const artworkUrl = getAndroidArtworkUrl(upNextData);
        
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
            ratingKey: episodeRatingKey, // This should be the episode rating key, not series
            episodeRatingKey: episodeRatingKey, // Explicit episode rating key field
            seriesRatingKey: seriesRatingKey, // Series rating key for reference
            plexId: episodeRatingKey, // Add plexId field for direct media access (episode-specific)
            title: upNextData.title,
            episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null, // Add episode title
            summary: upNextData.summary || '',
            episodeSummary: upNextData.episodeSummary || null, // Add episode-specific summary
            leafCount: upNextData.leafCount || 0,
            viewedLeafCount: upNextData.viewedLeafCount || 0,
            // Season and episode information for TV shows
            seasonNumber: upNextData.currentSeason || upNextData.seasonNumber || null,
            episodeNumber: upNextData.currentEpisode || upNextData.episodeNumber || null,
            isFinalSeason: upNextData.isCurrentSeasonFinal || false, // Add final season flag
            // Artwork URLs
            thumb: upNextData.thumb || '',
            art: upNextData.art || '',
            artworkUrl: artworkUrl || '', // Use proper artwork URL matching web app display
            streamUrl: upNextData.streamUrl || '',
            otherCollections: upNextData.otherCollections || []
          }
        };
      }
      
      console.log('📱 Sending Android companion up next response:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android up next endpoint:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  });

  // Android companion app endpoint - Random Stash Images
  router.get('/stash/images', async (req, res) => {
    console.log('📱 Android app requesting random Stash images...');
    
    try {
      // Get count parameter, default to 1, max 50
      const count = Math.min(Math.max(parseInt(req.query.count) || 1, 1), 50);
      
      // Get random images from both galleries and standalone
      const conditions = [
        { galleryId: { not: null } }, // Gallery images
        { galleryId: null }           // Standalone images
      ];
      
      const totalImages = await prisma.stashImage.count({
        where: {
          OR: conditions
        }
      });
      
      if (totalImages === 0) {
        return res.json({
          type: 'NO_IMAGES',
          data: {
            message: 'No images found in Stash library',
            images: []
          }
        });
      }
      
      // Get random images using skip with random offsets
      const randomImages = [];
      const maxAttempts = Math.min(count * 10, 500); // Limit attempts to avoid infinite loops
      const usedIds = new Set();
      
      for (let i = 0; i < count && randomImages.length < count && i < maxAttempts; i++) {
        try {
          // Generate random skip value
          const randomSkip = Math.floor(Math.random() * totalImages);
          
          // Get one random image with random skip
          const randomImage = await prisma.stashImage.findFirst({
            where: {
              OR: conditions
            },
            include: {
              gallery: {
                select: {
                  title: true,
                  photographer: true
                }
              },
              performers: {
                include: {
                  performer: {
                    select: {
                      name: true,
                      image: true
                    }
                  }
                }
              },
              studioObject: {
                select: {
                  name: true,
                  image: true
                }
              }
            },
            skip: randomSkip
          });
          
          // Only add if we haven't seen this ID before
          if (randomImage && !usedIds.has(randomImage.id)) {
            randomImages.push(randomImage);
            usedIds.add(randomImage.id);
          }
        } catch (error) {
          console.warn('Error fetching random image, continuing...', error.message);
        }
      }
      
      // If we didn't get enough unique images, fill with additional attempts
      if (randomImages.length < count) {
        console.log(`Only found ${randomImages.length} unique images out of ${count} requested`);
      }
      
      const formattedImages = randomImages.map(image => ({
        id: image.id,
        title: image.title || image.gallery?.title || 'Untitled',
        path: image.path,
        url: `${getAndroidApiBaseUrl()}/api/stash-image-proxy/${encodeURIComponent(image.path)}`,
        photographer: image.photographer || image.gallery?.photographer,
        performers: image.performers.map(p => ({
          name: p.performer.name,
          image: p.performer.image
        })),
        studio: image.studioObject ? {
          name: image.studioObject.name,
          image: image.studioObject.image
        } : null,
        gallery: image.gallery ? {
          title: image.gallery.title
        } : null,
        rating: image.rating,
        organized: image.organized
      }));
      
      console.log(`📱 Returning ${formattedImages.length} random image(s) to Android app`);
      
      res.json({
        type: 'RANDOM_IMAGES',
        data: {
          images: formattedImages,
          count: formattedImages.length,
          totalAvailable: totalImages
        }
      });
      
    } catch (error) {
      console.error('❌ Error getting random images for Android app:', error);
      res.status(500).json({
        type: 'ERROR',
        data: {
          error: 'Failed to get random images',
          details: error.message
        }
      });
    }
  });

  // Android companion app endpoint - Next Stash
  router.get('/stash/next', async (req, res) => {
    console.log('📱 Android app requesting next Stash content...');
    
    try {
      const baseUrl = getAndroidApiBaseUrl();
      
      // Get next clip using existing logic
      const nextClipResponse = await fetch(`${baseUrl}/api/stash/clips/next`);
      
      if (!nextClipResponse.ok) {
        const errorText = await nextClipResponse.text();
        console.error('Failed to get next clip:', errorText);
        return res.status(500).json({ 
          error: 'Failed to get next clip',
          details: errorText 
        });
      }
      
      const nextClipData = await nextClipResponse.json();
      console.log('📱 Next clip data received:', JSON.stringify(nextClipData, null, 2));
      
      if (!nextClipData.clip) {
        return res.status(404).json({ 
          error: 'No clips available',
          message: 'No unwatched clips found. Try generating more clips first.' 
        });
      }
      
      // Build response in Android companion format
      const androidResponse = {
        type: 'PLAY_CLIP',
        data: {
          url: nextClipData.clip.paths?.stream || nextClipData.playbackInfo?.streamUrl || '',
          title: nextClipData.scene?.title || 'Unknown Scene',
          performers: nextClipData.scene?.performers?.map(p => p.name).join(', ') || 'Unknown',
          studio: nextClipData.scene?.studio?.name || 'Unknown Studio',
          duration: nextClipData.clip.duration || 60,
          startTime: nextClipData.clip.startTime || 0,
          endTime: nextClipData.clip.endTime || 60,
          clipId: nextClipData.clip.id,
          sceneId: nextClipData.scene?.id,
          clipIndex: nextClipData.clip.clipIndex || 0
        }
      };
      
      console.log('📱 Sending Android companion response:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android next Stash endpoint:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  });

  // Additional legacy Android routes would be added here for gradual deprecation...

  console.log('Legacy Android routes module loaded');
  
  return router;
}

module.exports = createLegacyAndroidRoutes;
