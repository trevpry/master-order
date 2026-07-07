/**
 * Android Stash Integration Routes
 * Handles Stash content management, scenes, and image operations for Android app
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

const CLIP_FILTER_QUERY_KEYS = ['search', 'watched', 'rating', 'includeHigherRatings', 'tags'];

function buildClipFilterQueryString(query = {}) {
  const params = new URLSearchParams();

  CLIP_FILTER_QUERY_KEYS.forEach((key) => {
    const value = query[key];
    if (value === undefined || value === null) {
      return;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return;
    }

    params.set(key, normalized);
  });

  return params.toString();
}

/**
 * Create Stash integration routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} io - Socket.io instance for WebSocket events
 * @returns {express.Router} Configured router
 */
function createStashIntegrationRoutes(prisma, io) {
  const router = express.Router();

  // Get clip filter options for Android UI parity with web clips page
  router.get('/stash/clips/filter-options', async (req, res) => {
    console.log('📱 Android app requesting Stash clip filter options...');

    try {
      const baseUrl = getAndroidApiBaseUrl();
      const tagsResponse = await fetch(`${baseUrl}/api/stash/clips/tags`);

      if (!tagsResponse.ok) {
        const errorText = await tagsResponse.text();
        console.error('❌ Failed to fetch clip tag filter options:', errorText);
        return res.status(500).json(createAndroidErrorResponse(
          'STASH_CLIP_FILTER_OPTIONS_ERROR',
          'FAILED_TO_FETCH_CLIP_TAGS',
          errorText
        ));
      }

      const tagsData = await tagsResponse.json();
      const tags = tagsData?.success ? (tagsData.data || []) : [];

      return res.json(createAndroidResponse('STASH_CLIP_FILTER_OPTIONS', {
        search: {
          enabled: true,
          queryParam: 'search'
        },
        watched: {
          queryParam: 'watched',
          options: [
            { value: 'all', label: 'All clips' },
            { value: 'true', label: 'Played' },
            { value: 'false', label: 'Unplayed' }
          ]
        },
        rating: {
          queryParam: 'rating',
          options: [
            { value: 'all', label: 'All ratings' },
            { value: '5', label: '5 stars' },
            { value: '4', label: '4 stars' },
            { value: '3', label: '3 stars' },
            { value: '2', label: '2 stars' },
            { value: '1', label: '1 star' },
            { value: 'unrated', label: 'Unrated' }
          ],
          includeHigherRatings: {
            queryParam: 'includeHigherRatings',
            supported: true
          }
        },
        tags: {
          queryParam: 'tags',
          format: 'comma-separated tag IDs',
          options: tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            favorite: Boolean(tag.favorite)
          }))
        }
      }));
    } catch (error) {
      console.error('❌ Error returning Android clip filter options:', error);
      return res.status(500).json(createAndroidErrorResponse(
        'STASH_CLIP_FILTER_OPTIONS_ERROR',
        'INTERNAL_ERROR',
        error.message
      ));
    }
  });

  // Get Random Stash Images
  router.get('/stash/images', async (req, res) => {
    console.log('📱 Android app requesting random Stash images...');
    
    try {
      // Parse and validate count parameter
      let count = parseInt(req.query.count) || 1;
      count = Math.max(1, Math.min(50, count)); // Enforce min: 1, max: 50
      
      // Get total count of images
      const totalAvailable = await prisma.stashImage.count();
      
      if (totalAvailable === 0) {
        return res.json({
          type: 'NO_IMAGES',
          data: {
            message: 'No images found in Stash library',
            images: []
          }
        });
      }
      
      // Get random images by using random skip values
      const randomImages = [];
      const usedIndices = new Set();
      
      for (let i = 0; i < Math.min(count, totalAvailable); i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * totalAvailable);
        } while (usedIndices.has(randomIndex) && usedIndices.size < totalAvailable);
        
        usedIndices.add(randomIndex);
        
        const image = await prisma.stashImage.findFirst({
          skip: randomIndex,
          include: {
            gallery: {
              select: {
                id: true,
                title: true
              }
            },
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                }
              }
            },
            studioObject: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        });
        
        if (image) {
          randomImages.push(image);
        }
      }
      
      const baseUrl = getAndroidApiBaseUrl();
      
      // Format response according to documentation
      const androidResponse = {
        type: 'RANDOM_IMAGES',
        data: {
          images: randomImages.map(image => ({
            id: image.id,
            title: image.title || 'Untitled',
            path: image.path,
            url: `${baseUrl}/api/stash-image-proxy/${encodeURIComponent(image.path)}`,
            photographer: image.photographer || null,
            performers: image.performers?.map(p => ({
              id: p.performer.id,
              name: p.performer.name,
              image: p.performer.image || null
            })) || [],
            studio: image.studioObject ? {
              name: image.studioObject.name,
              image: image.studioObject.image || null
            } : null,
            gallery: image.gallery ? {
              title: image.gallery.title
            } : null,
            rating: image.rating || null,
            organized: image.organized || false
          })),
          count: randomImages.length,
          totalAvailable: totalAvailable
        }
      };

      console.log(`📱 Returning ${randomImages.length} random Stash images for Android app`);
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash random images endpoint:', error);
      
      res.status(500).json({
        type: 'NO_IMAGES',
        data: {
          message: 'Failed to fetch random Stash images',
          images: [],
          error: error.message
        }
      });
    }
  });

  // Get next Stash clip
  router.get('/stash/next', async (req, res) => {
    console.log('📱 Android app requesting next Stash content...');
    
    try {
      const baseUrl = getAndroidApiBaseUrl();
      const filterQueryString = buildClipFilterQueryString(req.query);
      const fetchUrl = filterQueryString
        ? `${baseUrl}/api/stash/clips/next?${filterQueryString}`
        : `${baseUrl}/api/stash/clips/next`;
      
      console.log('🌐 Fetching clip from URL:', fetchUrl);
      
      // Get next clip using existing logic
      const nextClipResponse = await fetch(fetchUrl);
      
      if (!nextClipResponse.ok) {
        const errorText = await nextClipResponse.text();
        console.error('Failed to get next clip:', errorText);
        return res.status(500).json({ 
          error: 'Failed to get next clip',
          details: errorText 
        });
      }
      
      const nextClipData = await nextClipResponse.json();
      
      console.log('📦 Received next clip data:', {
        hasClip: !!nextClipData.clip,
        clipId: nextClipData.clip?.id,
        sceneId: nextClipData.clip?.scene?.id
      });
      
      if (!nextClipData || !nextClipData.clip) {
        return res.status(404).json({ 
          error: 'No clips available',
          message: 'No unwatched clips found.' 
        });
      }
      
      const clip = nextClipData.clip;
      const scene = clip.scene;

      // Validate clip has required fields
      if (!clip.id || !scene || !scene.id) {
        console.error('❌ Invalid clip data received:', {
          hasClipId: !!clip.id,
          hasScene: !!scene,
          hasSceneId: !!scene?.id,
          clipData: clip
        });
        return res.status(500).json({
          error: 'Invalid clip data',
          message: 'Received clip data is missing required fields'
        });
      }

      // VERIFY: Check if clip actually exists in database
      const clipVerification = await prisma.stashClip.findUnique({
        where: { id: clip.id }
      });
      
      console.log('🔍 Clip database verification:', {
        clipId: clip.id,
        existsInDb: !!clipVerification,
        dbClipId: clipVerification?.id,
        dbSceneId: clipVerification?.sceneId
      });

      // Enrich with full parent scene metadata (including tags, performers, studio) for Android client
      let fullScene = null;
      try {
        fullScene = await prisma.stashScene.findUnique({
          where: { id: scene.id },
          include: {
            performers: {
              include: {
                performer: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    gender: true,
                    rating: true
                  }
                }
              }
            },
            tags: {
              include: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    childTags: {
                      select: {
                        childTagId: true
                      }
                    }
                  }
                }
              }
            },
            studioObject: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        });
      } catch (sceneMetaError) {
        console.warn('⚠️ Failed to load full scene metadata for Android enrichment:', sceneMetaError.message);
      }
      
      // Get Stash URL for stream URL
      const settings = await prisma.settings.findFirst();
      let stashUrl = settings?.stashUrl || process.env.STASH_URL;
      if (stashUrl) {
        stashUrl = stashUrl.replace(/\/+$/, '');
      }
      
      // Get scene performers and studio
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
      
      // Handle title with filename fallback logic (as per documentation)
      let title = scene?.title;
      if (!title || title.trim() === '') {
        // Extract filename from path and remove extension
        if (scene?.path) {
          const pathParts = scene.path.split(/[/\\]/);
          const filename = pathParts[pathParts.length - 1];
          const lastDot = filename.lastIndexOf('.');
          title = lastDot > 0 ? filename.substring(0, lastDot) : filename;
        } else {
          title = 'Unknown Scene';
        }
      }

      // Create Android response in expected PLAY_CLIP format
      const androidResponse = {
        type: 'PLAY_CLIP',
        data: {
          url: stashUrl ? `${stashUrl}/scene/${scene.id}/stream` : '',
          title: title,
            // Basic playback / clip data
          performers: performers,
          studio: studio,
          duration: clip.duration || 60,
          startTime: clip.startTime || 0,
          endTime: clip.endTime || 60,
          clipId: clip.id,
          sceneId: scene?.id || '',
          clipIndex: clip.clipIndex || 0,
          rating: clip.rating || null,
          // Full scene metadata enrichment
          scene: fullScene ? {
            id: fullScene.id,
            title: fullScene.title,
            details: fullScene.details,
            date: fullScene.date,
            rating: fullScene.rating,
            organized: fullScene.organized,
            path: fullScene.path,
            duration: fullScene.duration,
            fileSize: fullScene.fileSize ? Number(fullScene.fileSize) : null,
            resolution: fullScene.resolution,
            width: fullScene.width,
            height: fullScene.height,
            frameRate: fullScene.frameRate,
            codec: fullScene.codec,
            userRating: fullScene.userRating,
            favorite: fullScene.favorite,
            playCount: fullScene.playCount,
            studio: fullScene.studioObject ? {
              id: fullScene.studioObject.id,
              name: fullScene.studioObject.name,
              image: fullScene.studioObject.image
            } : null,
            performers: fullScene.performers?.map(p => ({
              id: p.performer.id,
              name: p.performer.name,
              image: p.performer.image,
              gender: p.performer.gender,
              rating: p.performer.rating
            })) || [],
            tags: fullScene.tags?.map(t => ({
              id: t.tag.id,
              name: t.tag.name,
              description: t.tag.description,
              hasChildren: t.tag.childTags && t.tag.childTags.length > 0
            })) || []
          } : null
        }
      };
      
      console.log('📱 Next Stash clip sent to Android app:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
      // Emit WebSocket event to web app for overlay display
      if (io) {
        console.log('🔔 Emitting stashClipRequested event with data:', {
          clipId: androidResponse.data.clipId,
          sceneId: androidResponse.data.sceneId,
          hasScene: !!androidResponse.data.scene
        });
        io.emit('stashClipRequested', androidResponse.data);
      }
      
    } catch (error) {
      console.error('❌ Error in Android Stash next endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_CONTENT_ERROR',
        'Failed to get next Stash content',
        error.message
      ));
    }
  });

  // Get next Stash clip from filtered pool (same filters as web clips page)
  router.get('/stash/next/filtered', async (req, res) => {
    console.log('📱 Android app requesting filtered next Stash clip...');

    const filterQueryString = buildClipFilterQueryString(req.query);
    if (!filterQueryString) {
      return res.status(400).json(createAndroidErrorResponse(
        'STASH_FILTERED_CLIP_ERROR',
        'FILTERS_REQUIRED',
        'Provide at least one filter: search, watched, rating, includeHigherRatings, or tags'
      ));
    }

    try {
      const baseUrl = getAndroidApiBaseUrl();
      // Reuse the existing Android PLAY_CLIP response by delegating to /stash/next with same filters
      const delegatedResponse = await fetch(`${baseUrl}/api/android/stash/next?${filterQueryString}`);
      const delegatedJson = await delegatedResponse.json();
      return res.status(delegatedResponse.status).json(delegatedJson);
    } catch (error) {
      console.error('❌ Error in Android filtered Stash next endpoint:', error);
      return res.status(500).json(createAndroidErrorResponse(
        'STASH_FILTERED_CLIP_ERROR',
        'INTERNAL_ERROR',
        error.message
      ));
    }
  });

  // Get next Stash scene
  router.get('/stash/scene/next', async (req, res) => {
    console.log('📱 Android app requesting next Stash scene...');
    
    try {
      const baseUrl = getAndroidApiBaseUrl();
      
      // Get next scene using existing logic
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
      
      if (!nextSceneData || !nextSceneData.scene) {
        return res.status(404).json({ 
          error: 'No unwatched scenes available',
          message: 'No scenes available' 
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
            const paths = stashData.data?.findScene?.paths;
            if (paths) {
              // Convert to full URLs for Android app
              artwork = {
                screenshot: `${baseUrl}/api/stash/image-proxy/scene/${scene.id}/screenshot`,
                preview: `${baseUrl}/api/stash/image-proxy/scene/${scene.id}/preview`,
                stream: `${baseUrl}/api/stash/image-proxy/scene/${scene.id}/stream`,
                webp: `${baseUrl}/api/stash/image-proxy/scene/${scene.id}/webp`
              };
            }
          }
        } catch (error) {
          console.warn('Failed to get Stash artwork:', error.message);
        }
      }
      
      // Create Android response in expected PLAY_SCENE format
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
      
      console.log('📱 Next Stash scene sent to Android app:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash scene next endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_SCENE_ERROR',
        'Failed to get next Stash scene',
        error.message
      ));
    }
  });

  // Mark Stash scene as watched
  router.post('/stash/scene/:id/watched', async (req, res) => {
    console.log('📱 Android app marking Stash scene as watched:', req.params.id);
    
    try {
      const sceneId = req.params.id; // Keep as string to match documentation
      const baseUrl = getAndroidApiBaseUrl();
      
      // Mark scene as watched using existing logic
      const watchedResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}/watched`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(req.body)
      });
      
      if (!watchedResponse.ok) {
        const errorText = await watchedResponse.text();
        console.error('Failed to mark scene as watched:', errorText);
        
        if (watchedResponse.status === 400) {
          return res.status(400).json({ 
            error: 'Invalid scene ID',
            message: 'The provided scene ID is invalid'
          });
        } else if (watchedResponse.status === 404) {
          return res.status(404).json({ 
            error: 'Scene not found',
            message: 'The requested scene does not exist'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to mark scene as watched',
            details: errorText 
          });
        }
      }
      
      const watchedData = await watchedResponse.json();
      
      // Format response according to documentation
      const androidResponse = {
        type: 'SCENE_MARKED_WATCHED',
        data: {
          success: true,
          sceneId: sceneId,
          playCount: watchedData.scene.playCount,
          lastPlayedAt: watchedData.scene.lastPlayedAt,
          stashUpdated: watchedData.stashUpdate?.success || false,
          message: 'Scene marked as watched successfully'
        }
      };
      
      console.log('📱 Stash scene marked as watched for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash scene watched endpoint:', error);
      
      res.status(500).json({
        error: 'Failed to mark scene as watched',
        message: error.message
      });
    }
  });

  // Delete Stash scene
  router.delete('/stash/scene/:id', async (req, res) => {
    console.log('📱 Android app deleting Stash scene:', req.params.id);
    
    try {
      const sceneId = req.params.id; // Keep as string to match documentation
      const { deleteFile } = req.query; // Pass through query parameter
      const baseUrl = getAndroidApiBaseUrl();
      
      // Build query string if deleteFile parameter is provided
      const queryString = deleteFile ? `?deleteFile=${deleteFile}` : '';
      
      // Delete scene using existing logic
      const deleteResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}${queryString}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('Failed to delete scene:', errorText);
        
        if (deleteResponse.status === 400) {
          return res.status(400).json({ 
            error: 'Invalid scene ID',
            message: 'The provided scene ID is invalid'
          });
        } else if (deleteResponse.status === 404) {
          return res.status(404).json({ 
            error: 'Scene not found',
            message: 'The requested scene does not exist'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to delete scene',
            details: errorText 
          });
        }
      }
      
      const deleteData = await deleteResponse.json();
      
      // Format response according to documentation
      const androidResponse = {
        type: 'SCENE_DELETED',
        data: {
          success: true,
          sceneId: sceneId,
          localDeleted: deleteData.localDeleted,
          clipsDeleted: deleteData.clipsDeleted,
          stashDeleted: deleteData.stashDeleted,
          fileDeleted: deleteFile === 'true',
          message: 'Scene deleted successfully'
        }
      };
      
      console.log('📱 Stash scene deleted for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash scene delete endpoint:', error);
      
      res.status(500).json({
        error: 'Failed to delete scene',
        message: error.message
      });
    }
  });

  return router;
}

module.exports = createStashIntegrationRoutes;
