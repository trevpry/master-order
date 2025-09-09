/**
 * Android Stash Integration Routes
 * Handles Stash content management, scenes, and image operations for Android app
 */

const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

/**
 * Create Stash integration routes for Android app
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createStashIntegrationRoutes(prisma) {
  const router = express.Router();

  // Get Stash images with pagination
  router.get('/stash/images', async (req, res) => {
    console.log('📱 Android app requesting Stash images...');
    
    try {
      const { page = 1, perPage = 50 } = req.query;
      
      const images = await prisma.stashImage.findMany({
        skip: (parseInt(page) - 1) * parseInt(perPage),
        take: parseInt(perPage),
        orderBy: { createdAt: 'desc' },
        include: {
          gallery: {
            select: {
              id: true,
              title: true,
              studio: true
            }
          },
          performers: {
            include: {
              performer: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      const baseUrl = getAndroidApiBaseUrl();
      
      const androidResponse = createAndroidResponse('STASH_IMAGES_SUCCESS', {
        success: true,
        images: images.map(image => ({
          id: image.id,
          title: image.title || 'Untitled',
          path: image.path,
          url: `${baseUrl}/api/stash-image-proxy/${image.path}`,
          width: image.width,
          height: image.height,
          filesize: image.filesize,
          gallery: image.gallery ? {
            id: image.gallery.id,
            title: image.gallery.title,
            studio: image.gallery.studio
          } : null,
          performers: image.performers?.map(p => ({
            id: p.performer.id,
            name: p.performer.name
          })) || [],
          tags: image.tags?.map(t => ({
            id: t.tag.id,
            name: t.tag.name
          })) || [],
          createdAt: image.createdAt,
          updatedAt: image.updatedAt
        })),
        pagination: {
          page: parseInt(page),
          perPage: parseInt(perPage),
          hasMore: images.length === parseInt(perPage)
        }
      });

      console.log(`📱 Returning ${images.length} Stash images for Android app`);
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash images endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_IMAGES_ERROR',
        'Failed to fetch Stash images',
        error.message
      ));
    }
  });

  // Get next Stash clip
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
      
      if (!nextClipData || !nextClipData.clip) {
        return res.json(createAndroidResponse('STASH_NEXT_CONTENT', {
          hasContent: false,
          message: 'No clips available'
        }));
      }
      
      const androidResponse = createAndroidResponse('STASH_NEXT_CONTENT', {
        hasContent: true,
        clip: nextClipData.clip
      });
      
      console.log('📱 Next Stash content sent to Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash next endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_CONTENT_ERROR',
        'Failed to get next Stash content',
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
        return res.json(createAndroidResponse('STASH_NEXT_SCENE', {
          hasContent: false,
          message: 'No scenes available'
        }));
      }
      
      const androidResponse = createAndroidResponse('STASH_NEXT_SCENE', {
        hasContent: true,
        scene: nextSceneData.scene
      });
      
      console.log('📱 Next Stash scene sent to Android app');
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
      const sceneId = parseInt(req.params.id);
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
        return res.status(500).json({ 
          error: 'Failed to mark scene as watched',
          details: errorText 
        });
      }
      
      const watchedData = await watchedResponse.json();
      
      const androidResponse = createAndroidResponse('STASH_SCENE_WATCHED', {
        success: true,
        sceneId: sceneId,
        result: watchedData
      });
      
      console.log('📱 Stash scene marked as watched for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash scene watched endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_SCENE_WATCHED_ERROR',
        'Failed to mark scene as watched',
        error.message
      ));
    }
  });

  // Delete Stash scene
  router.delete('/stash/scene/:id', async (req, res) => {
    console.log('📱 Android app deleting Stash scene:', req.params.id);
    
    try {
      const sceneId = parseInt(req.params.id);
      const baseUrl = getAndroidApiBaseUrl();
      
      // Delete scene using existing logic
      const deleteResponse = await fetch(`${baseUrl}/api/stash/scenes/${sceneId}`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error('Failed to delete scene:', errorText);
        return res.status(500).json({ 
          error: 'Failed to delete scene',
          details: errorText 
        });
      }
      
      const deleteData = await deleteResponse.json();
      
      const androidResponse = createAndroidResponse('STASH_SCENE_DELETED', {
        success: true,
        sceneId: sceneId,
        result: deleteData
      });
      
      console.log('📱 Stash scene deleted for Android app');
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android Stash scene delete endpoint:', error);
      
      res.status(500).json(createAndroidErrorResponse(
        'STASH_SCENE_DELETE_ERROR',
        'Failed to delete scene',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createStashIntegrationRoutes;
