const express = require('express');
const router = express.Router();
const StashWikiService = require('../services/StashWikiService');
const { asyncHandler, sendSuccess, sendBadRequest, sendNotFound } = require('../utils/responses');

const stashWikiService = new StashWikiService();

// ============================================================================
// WIKI PAGES
// ============================================================================

// GET /api/stash-wiki/pages
router.get('/pages', asyncHandler(async (req, res) => {
  const { search, hasTag } = req.query;
  const filters = {};
  if (search) filters.search = search;
  if (hasTag !== undefined) filters.hasTag = hasTag === 'true';
  const pages = await stashWikiService.getAllPages(filters);
  sendSuccess(res, pages);
}));

// GET /api/stash-wiki/pages/:slug
router.get('/pages/:slug', asyncHandler(async (req, res) => {
  const page = await stashWikiService.getPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Stash wiki page not found');
  sendSuccess(res, {
    ...page,
    inboundLinks: JSON.parse(page.inboundLinks || '[]'),
    outboundLinks: JSON.parse(page.outboundLinks || '[]'),
    relatedTagIds: JSON.parse(page.relatedTagIds || '[]')
  });
}));

// DELETE /api/stash-wiki/pages/:slug
router.delete('/pages/:slug', asyncHandler(async (req, res) => {
  const page = await stashWikiService.getPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Stash wiki page not found');
  await stashWikiService.deletePage(req.params.slug);
  sendSuccess(res, { deleted: req.params.slug });
}));

// ============================================================================
// GENERATION
// ============================================================================

// POST /api/stash-wiki/generate - Generate wiki from all unprocessed tags
router.post('/generate', asyncHandler(async (req, res) => {
  const result = await stashWikiService.generateFromTags();
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/generate/tags - Generate wiki from specific tags
router.post('/generate/tags', asyncHandler(async (req, res) => {
  const { tagIds } = req.body;
  if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
    return sendBadRequest(res, 'tagIds array is required');
  }
  const result = await stashWikiService.generateFromTags(tagIds);
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/pages/:slug/regenerate - Regenerate a single page
router.post('/pages/:slug/regenerate', asyncHandler(async (req, res) => {
  const page = await stashWikiService.regeneratePage(req.params.slug);
  sendSuccess(res, page);
}));

// ============================================================================
// CORRECTIONS
// ============================================================================

// POST /api/stash-wiki/pages/:slug/correct - User corrects a page
router.post('/pages/:slug/correct', asyncHandler(async (req, res) => {
  const { correction } = req.body;
  if (!correction || !correction.trim()) {
    return sendBadRequest(res, 'Correction text is required');
  }
  const page = await stashWikiService.correctPage(req.params.slug, correction);
  sendSuccess(res, page);
}));

// ============================================================================
// TAG LIFECYCLE HOOKS
// ============================================================================

// POST /api/stash-wiki/hooks/tag-created
router.post('/hooks/tag-created', asyncHandler(async (req, res) => {
  const { tagId } = req.body;
  if (!tagId) return sendBadRequest(res, 'tagId is required');
  const result = await stashWikiService.onTagCreated(tagId);
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/hooks/tag-deleted
router.post('/hooks/tag-deleted', asyncHandler(async (req, res) => {
  const { tagId, tagName } = req.body;
  if (!tagId) return sendBadRequest(res, 'tagId is required');
  const result = await stashWikiService.onTagDeleted(tagId, tagName || 'Unknown');
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/hooks/tag-merged
router.post('/hooks/tag-merged', asyncHandler(async (req, res) => {
  const { sourceTagIds, targetTagId } = req.body;
  if (!sourceTagIds || !targetTagId) {
    return sendBadRequest(res, 'sourceTagIds and targetTagId are required');
  }
  const result = await stashWikiService.onTagMerged(sourceTagIds, targetTagId);
  sendSuccess(res, result);
}));

// ============================================================================
// SEARCH & SUGGESTIONS
// ============================================================================

// GET /api/stash-wiki/suggest-tags - Suggest tags for a scene description
router.get('/suggest-tags', asyncHandler(async (req, res) => {
  const { description } = req.query;
  if (!description) return sendBadRequest(res, 'description query parameter is required');
  const suggestions = await stashWikiService.suggestTagsForDescription(description);
  sendSuccess(res, suggestions);
}));

// ============================================================================
// LOG & STATS
// ============================================================================

// GET /api/stash-wiki/log
router.get('/log', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const log = await stashWikiService.getLog(limit);
  sendSuccess(res, log);
}));

// GET /api/stash-wiki/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await stashWikiService.getStats();
  sendSuccess(res, stats);
}));

module.exports = router;
