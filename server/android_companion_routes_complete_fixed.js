const express = require('express');
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const path = require('path');

// Complete Android companion app routes - ALL endpoints from original file
module.exports = function setupAndroidRoutes(app, io, getNextEpisode, getNextMovie, getNextCustomOrder, watchLogService, prisma) {
  const router = express.Router();

  // Helper function to get base URL for Android API
  const getAndroidApiBaseUrl = () => {
    const externalIp = process.env.EXTERNAL_IP;
    const PORT = process.env.PORT || 3001;
    return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
  };

  // Test route to verify Android routes are working
  router.get('/test', async (req, res) => {
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
    
    const clip = nextClipData.clip;
    const scene = clip.scene;
    
    // Get Stash URL for stream URL
    const settings = await prisma.settings.findFirst();
    let stashUrl = settings?.stashUrl || process.env.STASH_URL;
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    // Get scene details with performers and studio
    let performers = '';
    let studio = '';
    
    if (scene?.id) {
      const sceneDetails = await prisma.stashScene.findUnique({
        where: { id: scene.id },
        include: {
          performers: {
            include: {
              performer: {
                select: { name: true }
              }
            }
          },
          studioObject: {
            select: { name: true }
          }
        }
      });
      
      if (sceneDetails) {
        performers = sceneDetails.performers?.map(p => p.performer.name).join(', ') || '';
        studio = sceneDetails.studioObject?.name || '';
      }
    }
    
    // Build response in Android companion format (PLAY_CLIP type as per documentation)
    const androidResponse = {
      type: 'PLAY_CLIP',
      data: {
        url: stashUrl ? `${stashUrl}/scene/${scene.id}/stream` : '',
        title: scene?.title || 'Unknown Scene',
        performers: performers,
        studio: studio,
        duration: clip.duration || 60,
        startTime: clip.startTime || 0,
        endTime: clip.endTime || 60,
        clipId: clip.id,
        sceneId: scene?.id || '',
        clipIndex: clip.clipIndex || 0
      }
    };
    
    console.log('📱 Sending Android companion clip response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android next Stash endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Next Stash Scene
router.get('/stash/scene/next', async (req, res) => {
  console.log('📱 Android app requesting next Stash scene...');
  
  try {
    // Get next scene using existing logic
    const baseUrl = getAndroidApiBaseUrl();
    const nextSceneResponse = await fetch(`${baseUrl}/api/stash/scenes/next`);
    
    if (!nextSceneResponse.ok) {
      const errorText = await nextSceneResponse.text();
      console.error('Failed to get next scene:', errorText);
      return res.status(500).json({ 
        error: 'Failed to get next scene',
        details: errorText 
      });
    }
    
    const nextSceneData = await nextSceneResponse.json();
    console.log('📱 Next scene data received:', JSON.stringify(nextSceneData, null, 2));
    
    if (!nextSceneData.success || !nextSceneData.scene) {
      return res.status(404).json({ 
        error: 'No scenes available',
        message: nextSceneData.message || 'No unwatched scenes found.' 
      });
    }
    
    const scene = nextSceneData.scene;
    
    // Get Stash URL for stream URL  
    const settings = await prisma.settings.findFirst();
    let stashUrl = settings?.stashUrl || process.env.STASH_URL;
    if (stashUrl) {
      stashUrl = stashUrl.replace(/\/+$/, '');
    }
    
    // Get scene details with performers and studio
    const sceneDetails = await prisma.stashScene.findUnique({
      where: { id: scene.id },
      include: {
        performers: {
          include: {
            performer: {
              select: { name: true }
            }
          }
        },
        studioObject: {
          select: { name: true }
        }
      }
    });
    
    const performers = sceneDetails?.performers?.map(p => p.performer.name).join(', ') || '';
    const studio = sceneDetails?.studioObject?.name || '';
    
    // Extract title from path if no title exists
    let title = scene.title;
    if (!title || title.trim() === '') {
      title = scene.path ? scene.path.split('/').pop().replace(/\.[^/.]+$/, '') : 'Unknown Scene';
    }
    
    // Get Stash artwork (if available)
    let artwork = null;
    if (stashUrl && scene.id) {
      try {
        const stashQuery = `
          query FindScene($id: ID!) {
            findScene(id: $id) {
              id
              paths {
                screenshot
                preview  
                stream
                webp
              }
            }
          }
        `;
        
        const stashResponse = await fetch(`${stashUrl}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ApiKey': settings?.stashApiKey || ''
          },
          body: JSON.stringify({
            query: stashQuery,
            variables: { id: scene.id }
          })
        });
        
        if (stashResponse.ok) {
          const stashData = await stashResponse.json();
          artwork = stashData.data?.findScene?.paths || null;
        }
      } catch (error) {
        console.warn('Failed to get Stash artwork:', error.message);
      }
    }
    
    // Build response in Android companion format (PLAY_SCENE type as per documentation)
    const androidResponse = {
      type: 'PLAY_SCENE',
      data: {
        url: stashUrl ? `${stashUrl}/scene/${scene.id}/stream` : '',
        title: title,
        performers: performers,
        studio: studio,
        duration: scene.duration || 0,
        sceneId: scene.id,
        rating: scene.rating || 0,
        totalUnwatched: nextSceneData.totalUnwatched || 0,
        artwork: artwork
      }
    };
    
    console.log('📱 Sending Android companion scene response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android next Stash scene endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Mark Stash scene as watched
router.post('/stash/scene/:id/watched', async (req, res) => {
  console.log('📱 Android app marking scene as watched...');
  
  try {
    const sceneId = req.params.id;
    
    if (!sceneId) {
      return res.status(400).json({ 
        error: 'Invalid scene ID',
        message: 'Scene ID is required' 
      });
    }

    // Call the existing watched endpoint internally
    const baseUrl = getAndroidApiBaseUrl();
    const watchedResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}/watched`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!watchedResponse.ok) {
      const errorData = await watchedResponse.json();
      console.error('Failed to mark scene as watched:', errorData);
      return res.status(watchedResponse.status).json({ 
        error: 'Failed to mark scene as watched',
        details: errorData 
      });
    }
    
    const watchedData = await watchedResponse.json();
    console.log('📱 Scene marked as watched successfully:', JSON.stringify(watchedData, null, 2));
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'SCENE_MARKED_WATCHED',
      data: {
        success: true,
        sceneId: sceneId,
        playCount: watchedData.scene?.playCount || 0,
        lastPlayedAt: watchedData.scene?.lastPlayedAt || null,
        stashUpdated: watchedData.stashUpdate?.success || false,
        message: 'Scene marked as watched successfully'
      }
    };
    
    console.log('📱 Sending Android companion watched response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android mark scene as watched endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Delete Stash scene
router.delete('/stash/scene/:id', async (req, res) => {
  console.log('📱 Android app requesting scene deletion...');
  
  try {
    const sceneId = req.params.id;
    const { deleteFile = false } = req.query; // Optional query parameter to delete file
    
    if (!sceneId) {
      return res.status(400).json({ 
        error: 'Invalid scene ID',
        message: 'Scene ID is required' 
      });
    }

    // Call the existing delete endpoint internally
    const baseUrl = getAndroidApiBaseUrl();
    const deleteUrl = `${baseUrl}/api/stash/scenes/${sceneId}${deleteFile ? '?deleteFile=true' : ''}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      console.error('Failed to delete scene:', errorData);
      return res.status(deleteResponse.status).json({ 
        error: 'Failed to delete scene',
        details: errorData 
      });
    }
    
    const deleteData = await deleteResponse.json();
    console.log('📱 Scene deleted successfully:', JSON.stringify(deleteData, null, 2));
    
    // Build response in Android companion format
    const androidResponse = {
      type: 'SCENE_DELETED',
      data: {
        success: true,
        sceneId: sceneId,
        localDeleted: deleteData.localDeleted || false,
        clipsDeleted: deleteData.clipsDeleted || 0,
        stashDeleted: deleteData.stashDeleted || false,
        fileDeleted: deleteFile === 'true',
        message: 'Scene deleted successfully'
      }
    };
    
    console.log('📱 Sending Android companion delete response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android delete scene endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Android companion app endpoint - Play Plex Media
router.post('/play-plex', async (req, res) => {
  console.log('📱 Android app requesting Plex media playback...');
  
  try {
    const { ratingKey, mediaType = 'unknown', title = 'Unknown Media' } = req.body;
    
    if (!ratingKey) {
      return res.status(400).json({ 
        type: 'PLAY_ERROR',
        data: {
          error: 'Rating key is required',
          message: 'Unable to play: missing media identifier'
        }
      });
    }
    
    console.log(`📱 Android play request - ratingKey: ${ratingKey}, mediaType: ${mediaType}, title: ${title}`);
    
    // Send webhook notification (same as web interface)
    try {
      console.log('Sending webhook notification with ratingKey:', ratingKey);
      const baseUrl = getAndroidApiBaseUrl();
      const webhookResponse = await fetch(`${baseUrl}/api/webhook/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKey,
          action: 'play_on_plex',
          title: title,
          type: mediaType,
          timestamp: new Date().toISOString(),
          source: 'android_app'
        }),
      });
      
      if (webhookResponse.ok) {
        console.log('✅ Webhook notification sent successfully');
      } else {
        console.warn('⚠️ Webhook notification failed:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.warn('⚠️ Failed to send webhook notification:', webhookError);
      // Don't stop the Plex playback if webhook fails
    }
    
    // Use existing Plex play endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const playResponse = await fetch(`${baseUrl}/api/plex/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ratingKey: ratingKey
      }),
    });
    
    const playData = await playResponse.json();
    
    if (playResponse.ok) {
      // Success response in Android format
      const androidResponse = {
        type: 'PLAY_SUCCESS',
        data: {
          success: true,
          ratingKey: ratingKey,
          title: title,
          mediaType: mediaType,
          player: playData.player || 'Unknown Player',
          message: `Playing "${title}" on ${playData.player || 'Plex'}`,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('✅ Playback started successfully:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
    } else {
      // Error response in Android format
      let errorMessage = playData.error || 'Failed to start playback';
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('No player specified') || errorMessage.includes('not found')) {
        errorMessage = 'No Plex player selected. Please configure a player in Settings.';
      } else if (errorMessage.includes('not currently available')) {
        errorMessage = 'Selected Plex player is not currently available. Try selecting a different player.';
      }
      
      const androidErrorResponse = {
        type: 'PLAY_ERROR',
        data: {
          success: false,
          ratingKey: ratingKey,
          title: title,
          mediaType: mediaType,
          error: errorMessage,
          details: playData.details || 'Check Plex server connection and player availability',
          timestamp: new Date().toISOString()
        }
      };
      
      console.error('❌ Playback failed:', JSON.stringify(androidErrorResponse, null, 2));
      res.status(playResponse.status).json(androidErrorResponse);
    }
    
  } catch (error) {
    console.error('❌ Error in Android play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAY_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Play Custom Order Episode, Movie, or Web Video
router.post('/play-episode', async (req, res) => {
  console.log('📱 Android app requesting custom order media playback...');
  
  try {
    const { 
      seriesTitle, 
      seasonNumber, 
      episodeNumber, 
      movieTitle, // Support direct movie title for movie playback
      webUrl, // Support web video URL for web video playback
      mediaType: requestedMediaType, // Support explicit media type
      customOrderItemId, 
      title = 'Unknown Media' 
    } = req.body;
    
    // Determine media type and request type
    const isEpisodeRequest = seriesTitle && seasonNumber !== undefined && episodeNumber !== undefined;
    const isMovieRequest = movieTitle || (!isEpisodeRequest && !webUrl && title);
    const isWebVideoRequest = webUrl || requestedMediaType === 'webvideo';
    
    if (!isEpisodeRequest && !isMovieRequest && !isWebVideoRequest) {
      return res.status(400).json({ 
        type: 'PLAY_ERROR',
        data: {
          error: 'Missing media identification',
          message: 'Provide (seriesTitle, seasonNumber, episodeNumber) for episodes, movieTitle for movies, or webUrl/mediaType for web videos',
          received: { seriesTitle, seasonNumber, episodeNumber, movieTitle, webUrl, requestedMediaType, title }
        }
      });
    }
    
    const mediaTitle = isEpisodeRequest ? seriesTitle : (movieTitle || title);
    const mediaType = isEpisodeRequest ? 'episode' : isWebVideoRequest ? 'webvideo' : 'movie';
    
    console.log(`📱 Android ${mediaType} request - ${mediaTitle}${isEpisodeRequest ? ` S${seasonNumber}E${episodeNumber}` : isWebVideoRequest ? ` (webURL: ${webUrl})` : ''} (customOrderItemId: ${customOrderItemId})`);
    
    // Handle web video playback
    if (isWebVideoRequest) {
      console.log('📱 Processing web video playback request...');
      
      // For web videos, automatically start a viewing session
      try {
        const baseUrl = getAndroidApiBaseUrl();
        const viewingSessionResponse = await fetch(`${baseUrl}/api/android/viewing/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mediaType: 'webvideo',
            title: mediaTitle,
            seriesTitle: seriesTitle,
            customOrderItemId: customOrderItemId
          })
        });
        
        const viewingSessionData = await viewingSessionResponse.json();
        
        if (viewingSessionResponse.ok) {
          console.log('✅ Viewing session started for web video:', viewingSessionData);
          
          // Success response for web video with viewing session info
          const androidResponse = {
            type: 'PLAY_WEB_VIDEO_SUCCESS',
            data: {
              success: true,
              webUrl: webUrl,
              title: mediaTitle,
              customOrderItemId: customOrderItemId,
              viewingSession: {
                sessionId: viewingSessionData.data?.sessionId,
                startedAt: viewingSessionData.data?.startedAt,
                isPaused: false
              },
              message: `Started viewing session for "${mediaTitle}"`,
              timestamp: new Date().toISOString()
            }
          };
          
          console.log('✅ Web video playback successful with viewing session:', JSON.stringify(androidResponse, null, 2));
          res.json(androidResponse);
          return;
        } else {
          console.warn('⚠️ Failed to start viewing session, proceeding without it:', viewingSessionData);
          // Continue with regular web video response
        }
      } catch (viewingError) {
        console.warn('⚠️ Error starting viewing session, proceeding without it:', viewingError);
        // Continue with regular web video response
      }
      
      // Regular web video response (fallback if viewing session fails)
      const androidResponse = {
        type: 'PLAY_WEB_VIDEO_SUCCESS',
        data: {
          success: true,
          webUrl: webUrl,
          title: mediaTitle,
          customOrderItemId: customOrderItemId,
          message: `Playing web video "${mediaTitle}"`,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log('✅ Web video playback successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      return;
    }
    
    // Try to find the media's rating key by searching Plex (for episodes/movies)
    let episodeRatingKey = null;
    let movieRatingKey = null;
    let foundMediaMetadata = null;
    
    try {
      // Get Plex settings
      const settings = await prisma.settings.findFirst();
      if (!settings?.plexUrl || !settings?.plexToken) {
        return res.status(500).json({
          type: 'PLAY_ERROR',
          data: {
            error: 'Plex not configured',
            message: 'Plex server URL and token are required'
          }
        });
      }
      
      // Search for the media in Plex
      const searchUrl = `${settings.plexUrl}/search?query=${encodeURIComponent(mediaTitle)}&X-Plex-Token=${settings.plexToken}`;
      const searchResponse = await fetch(searchUrl);
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.text();
        const xml2js = require('xml2js');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(searchData);
        
        if (isEpisodeRequest) {
          // Look for TV series first for episode requests
          const tvResults = result?.MediaContainer?.Directory?.filter(item => 
            item.$.type === 'show' && 
            item.$.title.toLowerCase() === seriesTitle.toLowerCase()
          ) || [];
          
          if (tvResults.length > 0) {
            // Found TV series, now get episodes
            const seriesRatingKey = tvResults[0].$.ratingKey;
            const episodesUrl = `${settings.plexUrl}/library/metadata/${seriesRatingKey}/allLeaves?X-Plex-Token=${settings.plexToken}`;
            const episodesResponse = await fetch(episodesUrl);
            
            if (episodesResponse.ok) {
              const episodesData = await episodesResponse.text();
              const episodesResult = await parser.parseStringPromise(episodesData);
              
              // Find the specific episode
              const episodes = episodesResult?.MediaContainer?.Video || [];
              const targetEpisode = episodes.find(ep => 
                parseInt(ep.$.parentIndex) === seasonNumber && 
                parseInt(ep.$.index) === episodeNumber
              );
              
              if (targetEpisode) {
                episodeRatingKey = targetEpisode.$.ratingKey;
                foundMediaMetadata = {
                  type: 'episode',
                  ratingKey: targetEpisode.$.ratingKey,
                  title: targetEpisode.$.title,
                  seriesTitle: tvResults[0].$.title,
                  seasonNumber: parseInt(targetEpisode.$.parentIndex),
                  episodeNumber: parseInt(targetEpisode.$.index),
                  summary: targetEpisode.$.summary || '',
                  duration: parseInt(targetEpisode.$.duration) || 0,
                  thumb: targetEpisode.$.thumb || '',
                  art: targetEpisode.$.art || tvResults[0].$.art || '',
                  seriesRatingKey: seriesRatingKey
                };
                console.log(`✅ Found episode rating key: ${episodeRatingKey}`);
              }
            }
          }
        }
        
        // Look for movies (either for movie requests or as fallback for episode requests)
        if (!episodeRatingKey) {
          const movieResults = result?.MediaContainer?.Video?.filter(item => 
            item.$.type === 'movie' && 
            (item.$.title.toLowerCase() === mediaTitle.toLowerCase() ||
             item.$.title.toLowerCase().includes(mediaTitle.toLowerCase()))
          ) || [];
          
          if (movieResults.length > 0) {
            const movie = movieResults[0];
            movieRatingKey = movie.$.ratingKey;
            foundMediaMetadata = {
              type: 'movie',
              ratingKey: movie.$.ratingKey,
              title: movie.$.title,
              year: parseInt(movie.$.year) || null,
              duration: parseInt(movie.$.duration) || 0,
              summary: movie.$.summary || '',
              studio: movie.$.studio || '',
              rating: parseFloat(movie.$.rating) || 0,
              thumb: movie.$.thumb || '',
              art: movie.$.art || '',
              originallyAvailableAt: movie.$.originallyAvailableAt || null
            };
            console.log(`✅ Found movie rating key: ${movieRatingKey}`);
          }
        }
        
      }
    } catch (plexError) {
      console.warn('⚠️ Failed to search Plex for media:', plexError.message);
    }
    
    // Use the found rating key or return error
    const ratingKeyToUse = episodeRatingKey || movieRatingKey;
    
    if (!ratingKeyToUse) {
      return res.status(404).json({
        type: 'PLAY_ERROR',
        data: {
          error: 'Media not found',
          message: `Could not find ${mediaTitle}${isEpisodeRequest ? ` S${seasonNumber}E${episodeNumber}` : ''} in Plex library`,
          mediaTitle,
          mediaType,
          ...(isEpisodeRequest && { seasonNumber, episodeNumber })
        }
      });
    }
    
    // Send webhook notification
    try {
      console.log('Sending webhook notification for media:', title);
      const baseUrl = getAndroidApiBaseUrl();
      const webhookResponse = await fetch(`${baseUrl}/api/webhook/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: ratingKeyToUse,
          action: 'play_on_plex',
          title: foundMediaMetadata?.title || mediaTitle,
          type: mediaType,
          ...(isEpisodeRequest && { 
            seriesTitle,
            seasonNumber,
            episodeNumber 
          }),
          ...(isMovieRequest && {
            movieTitle: mediaTitle
          }),
          customOrderItemId,
          timestamp: new Date().toISOString(),
          source: 'android_app'
        }),
      });
      
      if (webhookResponse.ok) {
        console.log('✅ Webhook notification sent successfully');
      } else {
        console.warn('⚠️ Webhook notification failed:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.warn('⚠️ Failed to send webhook notification:', webhookError);
    }
    
    // Use existing Plex play endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const playResponse = await fetch(`${baseUrl}/api/plex/play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ratingKey: ratingKeyToUse
      }),
    });
    
    const playData = await playResponse.json();
    
    if (playResponse.ok) {
      // Helper function to get proper artwork URL (matching up-next endpoint logic)
      const getAndroidArtworkUrl = (metadata) => {
        if (!metadata) return null;
        
        const baseUrl = getAndroidApiBaseUrl();
        const thumb = metadata.thumb;
        
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
      
      // Success response in Android format based on media type
      let androidResponse;
      
      if (foundMediaMetadata?.type === 'episode') {
        // Episode response format
        androidResponse = {
          type: 'PLAY_EPISODE_SUCCESS',
          data: {
            success: true,
            ratingKey: ratingKeyToUse,
            episodeRatingKey: episodeRatingKey,
            seriesRatingKey: foundMediaMetadata.seriesRatingKey,
            title: foundMediaMetadata.seriesTitle,
            episodeTitle: foundMediaMetadata.title,
            seasonNumber: foundMediaMetadata.seasonNumber,
            episodeNumber: foundMediaMetadata.episodeNumber,
            duration: foundMediaMetadata.duration,
            summary: foundMediaMetadata.summary,
            artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
            customOrderItemId: customOrderItemId || null,
            player: playData.player || 'Unknown Player',
            message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
            timestamp: new Date().toISOString()
          }
        };
      } else if (foundMediaMetadata?.type === 'movie') {
        // Movie response format
        androidResponse = {
          type: 'PLAY_MOVIE_SUCCESS',
          data: {
            success: true,
            ratingKey: ratingKeyToUse,
            title: foundMediaMetadata.title,
            year: foundMediaMetadata.year,
            duration: foundMediaMetadata.duration,
            summary: foundMediaMetadata.summary,
            studio: foundMediaMetadata.studio,
            rating: foundMediaMetadata.rating,
            artworkUrl: getAndroidArtworkUrl(foundMediaMetadata),
            customOrderItemId: customOrderItemId || null,
            player: playData.player || 'Unknown Player',
            message: `Playing "${foundMediaMetadata.title}" on ${playData.player || 'Plex'}`,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // Fallback response format - should use PLAY_ERROR for unknown media
        androidResponse = {
          type: 'PLAY_ERROR',
          data: {
            success: false,
            error: 'Unknown media type',
            message: `Unable to determine media type for "${mediaTitle}"`,
            ratingKey: ratingKeyToUse,
            title: mediaTitle,
            customOrderItemId: customOrderItemId,
            timestamp: new Date().toISOString()
          }
        };
      }
      
      console.log('✅ Media playback successful:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
    } else {
      // Error response in Android format
      const androidErrorResponse = {
        type: 'PLAY_ERROR',
        data: {
          success: false,
          ratingKey: ratingKeyToUse,
          title: foundMediaMetadata?.title || mediaTitle,
          mediaType: mediaType,
          ...(isEpisodeRequest && {
            seriesTitle,
            seasonNumber,
            episodeNumber
          }),
          customOrderItemId,
          error: playData.error || 'Playback failed',
          details: playData.details || 'Check Plex server connection and player availability',
          timestamp: new Date().toISOString()
        }
      };
      
      console.error('❌ Media playback failed:', JSON.stringify(androidErrorResponse, null, 2));
      res.status(playResponse.status).json(androidErrorResponse);
    }
    
  } catch (error) {
    console.error('❌ Error in Android media play endpoint:', error);
    
    const androidErrorResponse = {
      type: 'PLAY_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Mark Item as Read/Watched
router.post('/mark-watched', async (req, res) => {
  console.log('📱 Android app requesting to mark item as read/watched...');
  
  try {
    const { itemId, mediaType, title = 'Unknown Item' } = req.body;
    
    if (!itemId) {
      return res.status(400).json({
        type: 'MARK_WATCHED_ERROR',
        data: {
          error: 'Item ID is required',
          message: 'Unable to mark as watched: missing item identifier'
        }
      });
    }
    
    console.log(`📱 Mark watched request - itemId: ${itemId}, mediaType: ${mediaType}, title: ${title}`);
    
    // Use existing mark custom order item as watched endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const watchedResponse = await fetch(`${baseUrl}/api/mark-custom-order-item-watched/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!watchedResponse.ok) {
      const errorData = await watchedResponse.json();
      console.error('Failed to mark item as watched:', errorData);
      
      const androidErrorResponse = {
        type: 'MARK_WATCHED_ERROR',
        data: {
          success: false,
          itemId: itemId,
          title: title,
          mediaType: mediaType,
          error: errorData.error || 'Failed to mark as watched',
          details: errorData.details || 'Check item exists and is not already watched',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(watchedResponse.status).json(androidErrorResponse);
    }
    
    const watchedData = await watchedResponse.json();
    console.log('✅ Item marked as watched successfully:', JSON.stringify(watchedData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'MARK_WATCHED_SUCCESS',
      data: {
        success: true,
        itemId: itemId,
        title: title,
        mediaType: mediaType,
        message: `Successfully marked "${title}" as read/watched`,
        watchLogCreated: watchedData.watchLogCreated || false,
        plexUpdated: watchedData.plexUpdated || false,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Mark watched successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android mark watched endpoint:', error);
    
    const androidErrorResponse = {
      type: 'MARK_WATCHED_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Start Reading Session
router.post('/reading/start', async (req, res) => {
  console.log('📱 Android app requesting to start reading session...');
  
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    if (!mediaType || !title) {
      return res.status(400).json({
        type: 'READING_SESSION_ERROR',
        data: {
          error: 'Missing required fields',
          message: 'mediaType and title are required'
        }
      });
    }
    
    if (!['book', 'comic', 'shortstory'].includes(mediaType)) {
      return res.status(400).json({
        type: 'READING_SESSION_ERROR', 
        data: {
          error: 'Invalid media type',
          message: 'Reading sessions are only supported for books, comics, and stories'
        }
      });
    }
    
    console.log(`📱 Start reading session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);
    
    // Prepare request body for reading session start
    const requestBody = {
      mediaType,
      title,
      seriesTitle,
      customOrderItemId
    };

    // For comics, parse title to extract comicSeries and comicIssue for validation
    if (mediaType === 'comic' && title) {
      // Try to parse format like "Series Name (Year) #Issue" or "Series Name #Issue"
      let comicMatch = title.match(/^(.+?)\s*(?:\(\d{4}\))?\s*#(\d+)$/);
      if (comicMatch) {
        requestBody.comicSeries = comicMatch[1].trim();
        requestBody.comicIssue = comicMatch[2];
      } else {
        // If we can't parse the format, use seriesTitle if available
        if (seriesTitle) {
          requestBody.comicSeries = seriesTitle;
          // Try to extract issue number from title
          const issueMatch = title.match(/#(\d+)/);
          if (issueMatch) {
            requestBody.comicIssue = issueMatch[1];
          }
        }
      }
    }
    
    // Use existing reading session start endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const sessionResponse = await fetch(`${baseUrl}/api/reading/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      console.error('Failed to start reading session:', sessionData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          mediaType: mediaType,
          title: title,
          error: sessionData.error || 'Failed to start reading session',
          details: sessionData.details || 'Check server logs for more information',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(sessionResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session started successfully:', JSON.stringify(sessionData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: sessionData.id,
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle,
        customOrderItemId: customOrderItemId,
        startedAt: sessionData.startedAt,
        isPaused: sessionData.isPaused || false,
        message: `Started reading session for "${title}"`,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Reading session start successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Pause/Resume Reading Session
router.post('/reading/pause', async (req, res) => {
  console.log('📱 Android app requesting to pause/resume reading session...');
  
  try {
    // Use existing reading session pause endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const pauseResponse = await fetch(`${baseUrl}/api/reading/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const pauseData = await pauseResponse.json();
    
    if (!pauseResponse.ok) {
      console.error('Failed to pause/resume reading session:', pauseData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: pauseData.error || 'Failed to pause/resume reading session',
          details: pauseData.details || 'No active reading session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(pauseResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: pauseData.isPaused ? 'READING_SESSION_PAUSED' : 'READING_SESSION_RESUMED',
      data: {
        success: true,
        sessionId: pauseData.id,
        isPaused: pauseData.isPaused,
        title: pauseData.title,
        mediaType: pauseData.mediaType,
        message: pauseData.isPaused ? 
          `Paused reading session for "${pauseData.title}"` : 
          `Resumed reading session for "${pauseData.title}"`,
        pausedAt: pauseData.pausedAt,
        totalActiveTime: pauseData.totalActiveTime,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Reading session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Stop Reading Session
router.post('/reading/stop', async (req, res) => {
  console.log('📱 Android app requesting to stop reading session...');
  
  try {
    const { progress } = req.body;
    
    // Check if this will result in 100% completion for better response handling
    const willMarkAsRead = progress?.readPercentage === 100;
    
    // Use existing reading session stop endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const stopResponse = await fetch(`${baseUrl}/api/reading/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress })
    });
    
    const stopData = await stopResponse.json();
    
    if (!stopResponse.ok) {
      console.error('Failed to stop reading session:', stopData);
      
      const androidErrorResponse = {
        type: 'READING_SESSION_ERROR',
        data: {
          success: false,
          error: stopData.error || 'Failed to stop reading session',
          details: stopData.details || 'No active reading session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(stopResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Reading session stopped successfully:', JSON.stringify(stopData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'READING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: stopData.id,
        title: stopData.title,
        mediaType: stopData.mediaType,
        duration: stopData.duration,
        totalActiveTime: stopData.totalActiveTime,
        progressUpdated: progress ? true : false,
        progress: progress || null,
        markedAsRead: willMarkAsRead, // Indicate if item was marked as read due to 100% completion
        message: willMarkAsRead 
          ? `Completed reading "${stopData.title}" and marked as read`
          : `Stopped reading session for "${stopData.title}"`,
        completedAt: stopData.completedAt,
        timestamp: new Date().toISOString()
      }
    };
    
    if (willMarkAsRead) {
      console.log(`📖 Comic/book marked as read due to 100% completion: ${stopData.title}`);
    }
    
    console.log('✅ Reading session stop successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android reading session stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'READING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Start Viewing Session
router.post('/viewing/start', async (req, res) => {
  console.log('📱 Android app requesting to start viewing session...');
  
  try {
    const { mediaType, title, seriesTitle, customOrderItemId } = req.body;
    
    if (!mediaType || !title) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          error: 'Missing required fields',
          message: 'mediaType and title are required'
        }
      });
    }
    
    if (!['webvideo'].includes(mediaType)) {
      return res.status(400).json({
        type: 'VIEWING_SESSION_ERROR',
        data: {
          error: 'Invalid media type',
          message: 'Viewing sessions are only supported for web videos'
        }
      });
    }
    
    console.log(`📱 Start viewing session - mediaType: ${mediaType}, title: ${title}, customOrderItemId: ${customOrderItemId}`);
    
    // Use existing viewing session start endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const sessionResponse = await fetch(`${baseUrl}/api/viewing/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mediaType,
        title,
        seriesTitle,
        customOrderItemId
      })
    });
    
    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      console.error('Failed to start viewing session:', sessionData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          mediaType: mediaType,
          title: title,
          error: sessionData.error || 'Failed to start viewing session',
          details: sessionData.details || 'Check server logs for more information',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(sessionResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session started successfully:', JSON.stringify(sessionData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'VIEWING_SESSION_STARTED',
      data: {
        success: true,
        sessionId: sessionData.id,
        mediaType: mediaType,
        title: title,
        seriesTitle: seriesTitle,
        customOrderItemId: customOrderItemId,
        startedAt: sessionData.startedAt,
        isPaused: sessionData.isPaused || false,
        message: `Started viewing session for "${title}"`,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session start successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session start endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Pause/Resume Viewing Session
router.post('/viewing/pause', async (req, res) => {
  console.log('📱 Android app requesting to pause/resume viewing session...');
  
  try {
    // Use existing viewing session pause endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const pauseResponse = await fetch(`${baseUrl}/api/viewing/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const pauseData = await pauseResponse.json();
    
    if (!pauseResponse.ok) {
      console.error('Failed to pause/resume viewing session:', pauseData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: pauseData.error || 'Failed to pause/resume viewing session',
          details: pauseData.details || 'No active viewing session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(pauseResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session paused/resumed successfully:', JSON.stringify(pauseData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: pauseData.isPaused ? 'VIEWING_SESSION_PAUSED' : 'VIEWING_SESSION_RESUMED',
      data: {
        success: true,
        sessionId: pauseData.id,
        isPaused: pauseData.isPaused,
        title: pauseData.title,
        mediaType: pauseData.mediaType,
        message: pauseData.isPaused ? 
          `Paused viewing session for "${pauseData.title}"` : 
          `Resumed viewing session for "${pauseData.title}"`,
        pausedAt: pauseData.pausedAt,
        totalActiveTime: pauseData.totalActiveTime,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session pause/resume successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session pause endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Stop Viewing Session
router.post('/viewing/stop', async (req, res) => {
  console.log('📱 Android app requesting to stop viewing session...');
  
  try {
    const { progress } = req.body;
    
    // Use existing viewing session stop endpoint
    const baseUrl = getAndroidApiBaseUrl();
    const stopResponse = await fetch(`${baseUrl}/api/viewing/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ progress })
    });
    
    const stopData = await stopResponse.json();
    
    if (!stopResponse.ok) {
      console.error('Failed to stop viewing session:', stopData);
      
      const androidErrorResponse = {
        type: 'VIEWING_SESSION_ERROR',
        data: {
          success: false,
          error: stopData.error || 'Failed to stop viewing session',
          details: stopData.details || 'No active viewing session found',
          timestamp: new Date().toISOString()
        }
      };
      
      return res.status(stopResponse.status).json(androidErrorResponse);
    }
    
    console.log('✅ Viewing session stopped successfully:', JSON.stringify(stopData, null, 2));
    
    // Success response in Android format
    const androidResponse = {
      type: 'VIEWING_SESSION_STOPPED',
      data: {
        success: true,
        sessionId: stopData.id,
        title: stopData.title,
        mediaType: stopData.mediaType,
        duration: stopData.duration,
        totalActiveTime: stopData.totalActiveTime,
        progressUpdated: progress ? true : false,
        progress: progress || null,
        message: `Stopped viewing session for "${stopData.title}"`,
        completedAt: stopData.completedAt,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Viewing session stop successful:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android viewing session stop endpoint:', error);
    
    const androidErrorResponse = {
      type: 'VIEWING_SESSION_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Random Gallery Image
router.get('/gallery/:galleryName/random-image', async (req, res) => {
  console.log('📱 Android app requesting random image from gallery...');
  
  try {
    const { galleryName } = req.params;
    
    if (!galleryName) {
      return res.status(400).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Missing gallery name',
          message: 'Gallery name is required in the URL path',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Find the gallery by name (exact match only)
    const gallery = await prisma.BackgroundGallery.findFirst({
      where: {
        name: galleryName
      },
      include: {
        backgrounds: true
      }
    });
    
    if (!gallery) {
      return res.status(404).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Gallery not found',
          message: `Gallery "${galleryName}" does not exist`,
          galleryName: galleryName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!gallery.backgrounds || gallery.backgrounds.length === 0) {
      return res.status(404).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'No images in gallery',
          message: `Gallery "${galleryName}" contains no images`,
          galleryName: galleryName,
          galleryId: gallery.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random image from gallery
    const randomIndex = Math.floor(Math.random() * gallery.backgrounds.length);
    const randomImage = gallery.backgrounds[randomIndex];
    
    // Generate image URL based on available data
    let imageUrl = null;
    const baseUrl = getAndroidApiBaseUrl();
    
    if (randomImage.url) {
      // Direct URL available
      imageUrl = randomImage.url;
    } else if (randomImage.path) {
      // Use path to construct URL (assuming it's relative to uploads/backgrounds)
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename || path.basename(randomImage.path)}`;
    } else if (randomImage.filename) {
      // Use filename to construct URL
      imageUrl = `${baseUrl}/uploads/backgrounds/${randomImage.filename}`;
    }
    
    const androidResponse = {
      type: 'RANDOM_IMAGE_SUCCESS',
      data: {
        success: true,
        galleryName: gallery.name,
        galleryId: gallery.id,
        galleryDescription: gallery.description,
        image: {
          id: randomImage.id,
          filename: randomImage.filename,
          originalName: randomImage.originalName,
          url: imageUrl,
          width: randomImage.width,
          height: randomImage.height,
          size: randomImage.size,
          mimetype: randomImage.mimetype
        },
        totalImages: gallery.backgrounds.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random gallery image response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android random gallery image endpoint:', error);
    
    const androidErrorResponse = {
      type: 'RANDOM_IMAGE_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android companion app endpoint - Random Playlist Track
router.get('/playlist/:playlistName/random-track', async (req, res) => {
  console.log('📱 Android app requesting random track from playlist...');
  
  try {
    const { playlistName } = req.params;
    
    if (!playlistName) {
      return res.status(400).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Missing playlist name',
          message: 'Playlist name is required in the URL path',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Search for playlist in both Plex and Custom playlists
    let playlist = null;
    let playlistType = null;
    let tracks = [];
    
    // Try Plex playlists first (exact match only)
    const plexPlaylist = await prisma.plexPlaylist.findFirst({
      where: {
        title: playlistName
      },
      include: {
        items: true
      }
    });
    
    if (plexPlaylist) {
      playlist = plexPlaylist;
      playlistType = 'plex';
      tracks = plexPlaylist.items || [];
    } else {
      // Try Custom playlists (exact match only)
      const customPlaylist = await prisma.customPlaylist.findFirst({
        where: {
          title: playlistName
        },
        include: {
          tracks: true
        }
      });
      
      if (customPlaylist) {
        playlist = customPlaylist;
        playlistType = 'custom';
        tracks = customPlaylist.tracks || [];
      }
    }
    
    if (!playlist) {
      return res.status(404).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Playlist not found',
          message: `Playlist "${playlistName}" does not exist in Plex or Custom playlists`,
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!tracks || tracks.length === 0) {
      return res.status(404).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'No tracks in playlist',
          message: `Playlist "${playlistName}" contains no tracks`,
          playlistName: playlistName,
          playlistType: playlistType,
          playlistId: playlist.id || playlist.ratingKey,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Select random track from playlist
    const randomIndex = Math.floor(Math.random() * tracks.length);
    const randomTrack = tracks[randomIndex];
    
    // Get full track metadata from Plex for streaming and artwork information
    const settings = await prisma.settings.findFirst();
    let plexTrackMetadata = null;
    let streamUrl = null;
    let artworkUrl = null;
    
    if (settings && settings.plexUrl && settings.plexToken && randomTrack.ratingKey) {
      try {
        console.log(`📱 Fetching Plex metadata for track ${randomTrack.ratingKey}...`);
        const trackResponse = await fetch(`${settings.plexUrl}/library/metadata/${randomTrack.ratingKey}?X-Plex-Token=${settings.plexToken}`, {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (trackResponse.ok) {
          const trackData = await trackResponse.json();
          plexTrackMetadata = trackData.MediaContainer?.Metadata?.[0];
          
          // Get streaming URL
          const mediaPart = plexTrackMetadata?.Media?.[0]?.Part?.[0];
          if (mediaPart && mediaPart.key) {
            streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
          }
          
          // Get artwork URL
          if (plexTrackMetadata?.thumb) {
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.thumb}?X-Plex-Token=${settings.plexToken}`;
          } else if (plexTrackMetadata?.parentThumb) {
            // Use album artwork if track artwork not available
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.parentThumb}?X-Plex-Token=${settings.plexToken}`;
          } else if (plexTrackMetadata?.grandparentThumb) {
            // Use artist artwork as fallback
            artworkUrl = `${settings.plexUrl}${plexTrackMetadata.grandparentThumb}?X-Plex-Token=${settings.plexToken}`;
          }
          
          console.log(`📱 Plex metadata loaded:`, {
            title: plexTrackMetadata?.title,
            hasStreamUrl: !!streamUrl,
            hasArtwork: !!artworkUrl
          });
        } else {
          console.warn(`⚠️ Failed to fetch Plex metadata for track ${randomTrack.ratingKey}:`, trackResponse.status);
        }
      } catch (error) {
        console.error(`❌ Error fetching Plex metadata for track ${randomTrack.ratingKey}:`, error);
      }
    }
    
    // Format track data based on playlist type
    let trackData = {};
    if (playlistType === 'plex') {
      trackData = {
        ratingKey: randomTrack.ratingKey,
        title: plexTrackMetadata?.title || randomTrack.title,
        artist: plexTrackMetadata?.originalTitle || plexTrackMetadata?.grandparentTitle || null,
        album: plexTrackMetadata?.parentTitle || null,
        duration: plexTrackMetadata?.duration || randomTrack.duration,
        type: randomTrack.type || 'track',
        addedAt: randomTrack.addedAt,
        // Android-specific fields
        streamUrl: streamUrl,
        artworkUrl: artworkUrl,
        plexUrl: settings?.plexUrl,
        // Additional metadata from Plex
        year: plexTrackMetadata?.year,
        index: plexTrackMetadata?.index, // Track number
        discNumber: randomTrack.discNumber || plexTrackMetadata?.parentIndex, // Disc number
        discTotal: randomTrack.discTotal || plexTrackMetadata?.parentCount, // Disc total
        rating: plexTrackMetadata?.rating
      };
    } else {
      trackData = {
        ratingKey: randomTrack.ratingKey,
        title: plexTrackMetadata?.title || randomTrack.title,
        artist: plexTrackMetadata?.originalTitle || plexTrackMetadata?.grandparentTitle || randomTrack.artist,
        album: plexTrackMetadata?.parentTitle || randomTrack.album,
        duration: plexTrackMetadata?.duration || randomTrack.duration,
        sortOrder: randomTrack.sortOrder,
        addedAt: randomTrack.addedAt,
        // Android-specific fields
        streamUrl: streamUrl,
        artworkUrl: artworkUrl,
        plexUrl: settings?.plexUrl,
        // Additional metadata from Plex
        year: plexTrackMetadata?.year,
        index: plexTrackMetadata?.index, // Track number
        discNumber: randomTrack.discNumber || plexTrackMetadata?.parentIndex, // Disc number
        discTotal: randomTrack.discTotal || plexTrackMetadata?.parentCount, // Disc total
        rating: plexTrackMetadata?.rating
      };
    }
    
    const androidResponse = {
      type: 'RANDOM_TRACK_SUCCESS',
      data: {
        success: true,
        playlistName: playlist.title,
        playlistType: playlistType,
        playlistId: playlist.id || playlist.ratingKey,
        playlistDescription: playlist.description || playlist.summary,
        track: trackData,
        totalTracks: tracks.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('📱 Random playlist track response:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android random playlist track endpoint:', error);
    
    const androidErrorResponse = {
      type: 'RANDOM_TRACK_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

// Android Gallery Endpoint - Get Random Gallery Image
router.get('/gallery/:galleryName/random-image', async (req, res) => {
  console.log('📱 Android app requesting random gallery image...');
  
  try {
    const { galleryName } = req.params;
    
    if (!galleryName) {
      return res.status(400).json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Gallery name required',
          message: 'Gallery name is required as URL parameter',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log(`📱 Looking for gallery: "${galleryName}"`);
    
    // Find the gallery by exact name match
    const gallery = await prisma.backgroundGallery.findFirst({
      where: {
        name: galleryName
      },
      include: {
        images: true
      }
    });
    
    if (!gallery) {
      return res.json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'Gallery not found',
          message: `Gallery "${galleryName}" does not exist`,
          galleryName: galleryName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!gallery.images || gallery.images.length === 0) {
      return res.json({
        type: 'RANDOM_IMAGE_ERROR',
        data: {
          error: 'No images found',
          message: `Gallery "${galleryName}" contains no images`,
          galleryName: galleryName,
          galleryId: gallery.id,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Get random image
    const randomIndex = Math.floor(Math.random() * gallery.images.length);
    const randomImage = gallery.images[randomIndex];
    
    const androidResponse = {
      type: 'RANDOM_IMAGE_SUCCESS',
      data: {
        success: true,
        galleryName: gallery.name,
        galleryId: gallery.id,
        galleryDescription: gallery.description || null,
        image: {
          id: randomImage.id,
          filename: randomImage.filename || randomImage.url?.split('/').pop() || 'unknown',
          originalName: randomImage.originalName || randomImage.filename || 'Unnamed Image',
          url: randomImage.url,
          width: randomImage.width || null,
          height: randomImage.height || null,
          size: randomImage.size || null,
          mimetype: randomImage.mimetype || 'image/jpeg'
        },
        totalImages: gallery.images.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Random gallery image selected:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android gallery random image endpoint:', error);
    const androidErrorResponse = {
      type: 'RANDOM_IMAGE_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    res.status(500).json(androidErrorResponse);
  }
});

// Android Playlist Endpoint - Get Random Playlist Track
router.get('/playlist/:playlistName/random-track', async (req, res) => {
  console.log('📱 Android app requesting random playlist track...');
  
  try {
    const { playlistName } = req.params;
    
    if (!playlistName) {
      return res.status(400).json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Playlist name required',
          message: 'Playlist name is required as URL parameter',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    console.log(`📱 Looking for playlist: "${playlistName}"`);
    
    // Search both Plex and custom playlists
    let playlist = null;
    let playlistType = null;
    let tracks = [];
    
    // First, try to find Plex playlist
    const plexPlaylist = await prisma.plexPlaylist.findFirst({
      where: {
        title: playlistName
      },
      include: {
        plexPlaylistItems: {
          include: {
            plexMusicTrack: true
          }
        }
      }
    });
    
    if (plexPlaylist) {
      playlist = plexPlaylist;
      playlistType = 'plex';
      tracks = plexPlaylist.plexPlaylistItems.map(item => item.plexMusicTrack).filter(Boolean);
      console.log(`📱 Found Plex playlist with ${tracks.length} tracks`);
    } else {
      // Try custom playlist
      const customPlaylist = await prisma.customPlaylist.findFirst({
        where: {
          title: playlistName
        },
        include: {
          customPlaylistItems: {
            include: {
              plexMusicTrack: true
            }
          }
        }
      });
      
      if (customPlaylist) {
        playlist = customPlaylist;
        playlistType = 'custom';
        tracks = customPlaylist.customPlaylistItems.map(item => item.plexMusicTrack).filter(Boolean);
        console.log(`📱 Found custom playlist with ${tracks.length} tracks`);
      }
    }
    
    if (!playlist) {
      return res.json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'Playlist not found',
          message: `Playlist "${playlistName}" does not exist in Plex or Custom playlists`,
          playlistName: playlistName,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (tracks.length === 0) {
      return res.json({
        type: 'RANDOM_TRACK_ERROR',
        data: {
          error: 'No tracks found',
          message: `Playlist "${playlistName}" contains no tracks`,
          playlistName: playlistName,
          playlistType: playlistType,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Get random track
    const randomIndex = Math.floor(Math.random() * tracks.length);
    const randomTrack = tracks[randomIndex];
    
    // Get Plex settings for stream URL generation
    const settings = await prisma.settings.findFirst();
    const baseUrl = getAndroidApiBaseUrl();
    
    let streamUrl = null;
    let artworkUrl = null;
    let plexUrl = settings?.plexUrl || null;
    
    // Generate stream URL if we have Plex configuration
    if (settings?.plexUrl && settings?.plexToken && randomTrack.ratingKey) {
      streamUrl = `${settings.plexUrl}/library/parts/${randomTrack.ratingKey}/stream?X-Plex-Token=${settings.plexToken}`;
      
      // Generate artwork URL with fallback hierarchy
      if (randomTrack.thumb) {
        artworkUrl = randomTrack.thumb.startsWith('http') 
          ? randomTrack.thumb 
          : `${settings.plexUrl}${randomTrack.thumb}?X-Plex-Token=${settings.plexToken}`;
      } else if (randomTrack.parentThumb) {
        artworkUrl = randomTrack.parentThumb.startsWith('http')
          ? randomTrack.parentThumb
          : `${settings.plexUrl}${randomTrack.parentThumb}?X-Plex-Token=${settings.plexToken}`;
      } else if (randomTrack.grandparentThumb) {
        artworkUrl = randomTrack.grandparentThumb.startsWith('http')
          ? randomTrack.grandparentThumb
          : `${settings.plexUrl}${randomTrack.grandparentThumb}?X-Plex-Token=${settings.plexToken}`;
      }
    }
    
    const androidResponse = {
      type: 'RANDOM_TRACK_SUCCESS',
      data: {
        success: true,
        playlistName: playlist.title,
        playlistType: playlistType,
        playlistId: playlistType === 'plex' ? playlist.ratingKey : playlist.id,
        playlistDescription: playlist.summary || playlist.description || null,
        track: {
          ratingKey: randomTrack.ratingKey,
          title: randomTrack.title,
          artist: randomTrack.grandparentTitle || randomTrack.originalTitle || 'Unknown Artist',
          album: randomTrack.parentTitle || 'Unknown Album',
          duration: randomTrack.duration || 0,
          type: randomTrack.type || 'track',
          streamUrl: streamUrl,
          artworkUrl: artworkUrl,
          plexUrl: plexUrl,
          year: randomTrack.year ? parseInt(randomTrack.year) : null,
          index: randomTrack.index ? parseInt(randomTrack.index) : null,
          parentIndex: randomTrack.parentIndex ? parseInt(randomTrack.parentIndex) : null,
          rating: randomTrack.rating ? parseFloat(randomTrack.rating) : null,
          addedAt: randomTrack.addedAt ? randomTrack.addedAt.toISOString() : null
        },
        totalTracks: tracks.length,
        timestamp: new Date().toISOString()
      }
    };
    
    console.log('✅ Random playlist track selected:', JSON.stringify(androidResponse, null, 2));
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android playlist random track endpoint:', error);
    const androidErrorResponse = {
      type: 'RANDOM_TRACK_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    res.status(500).json(androidErrorResponse);
  }
});

// Android Weather Endpoint - Get Current Weather
router.get('/weather', async (req, res) => {
  console.log('📱 Android app requesting current weather...');
  
  try {
    // Get settings to check weather configuration
    const settings = await prisma.settings.findFirst();
    
    if (!settings?.weatherEnabled) {
      return res.json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather service disabled',
          message: 'Weather functionality is not enabled in settings',
          enabled: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!settings?.weatherApiKey) {
      return res.json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather API key missing',
          message: 'Weather API key is not configured in settings',
          enabled: true,
          configured: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!settings?.weatherLocation) {
      return res.json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather location missing',
          message: 'Weather location is not configured in settings',
          enabled: true,
          configured: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Use existing weather endpoint to get data
    const baseUrl = getAndroidApiBaseUrl();
    const weatherResponse = await fetch(`${baseUrl}/api/weather/current`);
    
    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      return res.json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather API error',
          message: `Failed to fetch weather data: ${errorText}`,
          statusCode: weatherResponse.status,
          enabled: true,
          configured: true,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const weatherData = await weatherResponse.json();
    
    // Transform to Android format
    const androidResponse = {
      type: 'WEATHER_SUCCESS',
      data: {
        success: true,
        location: {
          name: weatherData.name || settings.weatherLocation,
          country: weatherData.sys?.country || 'Unknown',
          coordinates: {
            latitude: weatherData.coord?.lat || null,
            longitude: weatherData.coord?.lon || null
          },
          timezone: weatherData.timezone || null,
          sunrise: weatherData.sys?.sunrise ? new Date(weatherData.sys.sunrise * 1000).toISOString() : null,
          sunset: weatherData.sys?.sunset ? new Date(weatherData.sys.sunset * 1000).toISOString() : null
        },
        current: {
          temperature: weatherData.main?.temp || null,
          feelsLike: weatherData.main?.feels_like || null,
          tempMin: weatherData.main?.temp_min || null,
          tempMax: weatherData.main?.temp_max || null,
          humidity: weatherData.main?.humidity || null,
          pressure: weatherData.main?.pressure || null,
          visibility: weatherData.visibility ? weatherData.visibility / 1000 : null, // Convert to km
          uvIndex: weatherData.uvi || null
        },
        weather: {
          condition: weatherData.weather?.[0]?.main || 'Unknown',
          description: weatherData.weather?.[0]?.description || 'No description',
          icon: weatherData.weather?.[0]?.icon || null,
          iconUrl: weatherData.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png` : null
        },
        wind: {
          speed: weatherData.wind?.speed || null,
          direction: weatherData.wind?.deg || null,
          gust: weatherData.wind?.gust || null
        },
        clouds: {
          cloudiness: weatherData.clouds?.all || null
        },
        rain: {
          oneHour: weatherData.rain?.['1h'] || null,
          threeHours: weatherData.rain?.['3h'] || null
        },
        snow: {
          oneHour: weatherData.snow?.['1h'] || null,
          threeHours: weatherData.snow?.['3h'] || null
        },
        units: {
          system: settings.weatherUnits || 'metric',
          temperature: settings.weatherUnits === 'imperial' ? '°F' : settings.weatherUnits === 'kelvin' ? 'K' : '°C',
          windSpeed: settings.weatherUnits === 'imperial' ? 'mph' : 'm/s',
          pressure: 'hPa',
          visibility: 'km'
        },
        metadata: {
          dataTime: weatherData.dt ? new Date(weatherData.dt * 1000).toISOString() : null,
          requestTime: new Date().toISOString(),
          source: 'OpenWeatherMap',
          apiVersion: '2.5'
        }
      }
    };
    
    console.log('✅ Weather data retrieved successfully');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android weather endpoint:', error);
    const androidErrorResponse = {
      type: 'WEATHER_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
    res.status(500).json(androidErrorResponse);
  }
});

  // Mount the router to the app with Android prefix
  app.use('/api/android', router);
  
  console.log('✅ Android companion routes (COMPLETE) loaded successfully');
};
