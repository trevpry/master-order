/**
 * Android Stash Tag Routes
 * Endpoints:
 *  GET /stash/tags        -> hierarchical tag listing
 *  POST /stash/tags       -> create tag (name, description?, parentIds[])
 *  DELETE /stash/tags/:id -> delete tag
 */
const express = require('express');
const StashTagService = require('../../services/stashTagService');
const { createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');

function createStashTagRoutes() {
  const router = express.Router();
  const tagService = new StashTagService();

  // GET hierarchy
  router.get('/stash/tags', async (req, res) => {
    try {
      const includeCounts = req.query.counts === 'true';
      const hierarchy = await tagService.getHierarchy({ includeCounts });
      return res.json(createAndroidResponse('STASH_TAG_HIERARCHY', hierarchy));
    } catch (error) {
      console.error('❌ Error fetching tag hierarchy:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_TAG_ERROR', 'TAG_HIERARCHY_FAILED', error.message));
    }
  });

  // CREATE tag
  router.post('/stash/tags', async (req, res) => {
    try {
      const { name, description, parentIds } = req.body || {};
      if (!name) {
        return res.status(400).json(createAndroidErrorResponse('STASH_TAG_CREATE_ERROR', 'NAME_REQUIRED', 'Tag name is required'));
      }
      const tag = await tagService.createTag({ name, description, parentIds });
      return res.status(201).json(createAndroidResponse('STASH_TAG_CREATED', { tag }));
    } catch (error) {
      console.error('❌ Error creating tag:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_TAG_CREATE_ERROR', 'CREATE_FAILED', error.message));
    }
  });

  // DELETE tag
  router.delete('/stash/tags/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await tagService.deleteTag(id);
      if (result.notFound) {
        return res.status(404).json(createAndroidErrorResponse('STASH_TAG_DELETE_ERROR', 'NOT_FOUND', 'Tag not found'));
      }
      return res.json(createAndroidResponse('STASH_TAG_DELETED', { id }));
    } catch (error) {
      console.error('❌ Error deleting tag:', error);
      return res.status(500).json(createAndroidErrorResponse('STASH_TAG_DELETE_ERROR', 'DELETE_FAILED', error.message));
    }
  });

  return router;
}

module.exports = createStashTagRoutes;
