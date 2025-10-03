/**
 * Android Stash Performer Detail Route
 * GET /stash/performer/:id - Returns comprehensive performer data including tags, scenes, images.
 */
const express = require('express');
const StashPerformerService = require('../../services/stashPerformerService');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

function createStashPerformerRoutes() {
  const router = express.Router();
  const service = new StashPerformerService();

  router.get('/stash/performer/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json(createAndroidErrorResponse('STASH_PERFORMER_ERROR', 'INVALID_ID', 'Performer ID required'));
      }

      const performer = await service.getPerformer(id);
      if (!performer) {
        return res.status(404).json(createAndroidErrorResponse('STASH_PERFORMER_ERROR', 'NOT_FOUND', 'Performer not found'));
      }

      // Base URL for constructing image URLs (if needed externally later)
      const baseUrl = getAndroidApiBaseUrl();

      return res.json(createAndroidResponse('STASH_PERFORMER_DETAIL', {
        ...performer,
        imageUrl: performer.image ? `${baseUrl}/api/stash-image-proxy/${encodeURIComponent(performer.image)}` : null,
        images: performer.images.map(img => ({
          ...img,
          url: `${baseUrl}/api/stash-image-proxy/${encodeURIComponent(img.path)}`
        }))
      }));
    } catch (error) {
      console.error('❌ Android performer detail error:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_PERFORMER_ERROR', 'SERVER_ERROR', error.message));
    }
  });

  return router;
}

module.exports = createStashPerformerRoutes;
