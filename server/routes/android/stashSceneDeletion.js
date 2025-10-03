/**
 * Android Stash Scene Deletion Routes
 * Provides endpoint to delete a full Stash scene (local + remote) by supplying a clipId.
 * Response follows standardized Android API pattern (type + data).
 */

const express = require('express');
const StashSceneDeletionService = require('../../services/stashSceneDeletionService');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

function createStashSceneDeletionRoutes(prisma) {
  const router = express.Router();
  const deletionService = new StashSceneDeletionService(prisma);

  /**
   * POST /api/android/stash/clip/delete
   * Body: { clipId: number, deleteFile?: boolean, deleteGenerated?: boolean }
   * Deletes the parent scene of the given clip both locally and (if configured) remotely in Stash.
   */
  router.post('/stash/clip/delete', async (req, res) => {
    try {
      const { clipId, deleteFile = true, deleteGenerated = true } = req.body || {};

      const result = await deletionService.deleteSceneByClipId(clipId, { deleteFile, deleteGenerated });

      if (!result.success) {
        return res.status(result.status || 500).json(createAndroidErrorResponse(
          'STASH_SCENE_DELETE_ERROR',
          result.error || 'UNKNOWN_ERROR',
          result.message || 'Failed to delete scene'
        ));
      }

      return res.status(200).json(createAndroidResponse('STASH_SCENE_DELETED', {
        clipId: result.clipId,
        sceneId: result.sceneId,
        local: result.local,
        remote: result.remote,
        message: result.message
      }));
    } catch (error) {
      console.error('❌ Android Stash clip->scene deletion error:', error);
      return res.status(500).json(createAndroidErrorResponse(
        'STASH_SCENE_DELETE_ERROR',
        'SERVER_ERROR',
        error.message
      ));
    }
  });

  return router;
}

module.exports = createStashSceneDeletionRoutes;
