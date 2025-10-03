/**
 * Android Clip Tag Management Routes
 * Wraps existing /api/stash clip tag endpoints for Android standardized responses.
 * Endpoints:
 *  POST   /stash/clip/:clipId/tags       { tagIds: [] }
 *  DELETE /stash/clip/:clipId/tags/:tagId
 */
const express = require('express');
const fetch = require('node-fetch');
const { getAndroidApiBaseUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

function createStashClipTagRoutes() {
  const router = express.Router();

  // Add tags to clip
  router.post('/stash/clip/:clipId/tags', async (req, res) => {
    try {
      const { clipId } = req.params;
      const { tagIds } = req.body || {};
      if (!clipId || isNaN(parseInt(clipId))) {
        return res.status(400).json(createAndroidErrorResponse('STASH_CLIP_TAG_ERROR', 'INVALID_CLIP_ID', 'Valid numeric clipId required'));
      }
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return res.status(400).json(createAndroidErrorResponse('STASH_CLIP_TAG_ERROR', 'INVALID_TAG_IDS', 'tagIds must be a non-empty array'));
      }

      const baseUrl = getAndroidApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/stash/clips/${clipId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds })
      });

      const json = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(createAndroidErrorResponse('STASH_CLIP_TAG_ERROR', 'UPSTREAM_FAILED', json.error || json.message || 'Failed to add tags'));
      }

      return res.json(createAndroidResponse('STASH_CLIP_TAGS_ADDED', {
        clipId: parseInt(clipId),
        addedCount: json.addedTags ? json.addedTags.length : json.addedTagsCount || 0,
        tags: json.addedTags || [],
        raw: json
      }));
    } catch (error) {
      console.error('❌ Android add clip tags error:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_CLIP_TAG_ERROR', 'SERVER_ERROR', error.message));
    }
  });

  // Remove a single tag from clip
  router.delete('/stash/clip/:clipId/tags/:tagId', async (req, res) => {
    try {
      const { clipId, tagId } = req.params;
      if (!clipId || isNaN(parseInt(clipId))) {
        return res.status(400).json(createAndroidErrorResponse('STASH_CLIP_TAG_DELETE_ERROR', 'INVALID_CLIP_ID', 'Valid numeric clipId required'));
      }
      if (!tagId) {
        return res.status(400).json(createAndroidErrorResponse('STASH_CLIP_TAG_DELETE_ERROR', 'INVALID_TAG_ID', 'tagId required'));
      }

      const baseUrl = getAndroidApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/stash/clips/${clipId}/tags/${tagId}`, {
        method: 'DELETE'
      });
      const json = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(createAndroidErrorResponse('STASH_CLIP_TAG_DELETE_ERROR', 'UPSTREAM_FAILED', json.error || json.message || 'Failed to remove tag'));
      }

      return res.json(createAndroidResponse('STASH_CLIP_TAG_REMOVED', {
        clipId: parseInt(clipId),
        tagId,
        raw: json
      }));
    } catch (error) {
      console.error('❌ Android delete clip tag error:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_CLIP_TAG_DELETE_ERROR', 'SERVER_ERROR', error.message));
    }
  });

  return router;
}

module.exports = createStashClipTagRoutes;
