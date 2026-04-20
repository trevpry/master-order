const express = require('express');
const router = express.Router();
const StashWikiService = require('../services/StashWikiService');
const { asyncHandler, sendSuccess, sendBadRequest, sendNotFound } = require('../utils/responses');

const stashWikiService = new StashWikiService();

// ============================================================================
// SETTINGS & SCHEMA
// ============================================================================

// GET /api/stash-wiki/settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await stashWikiService.getStashWikiSettings();
  sendSuccess(res, settings);
}));

// PUT /api/stash-wiki/settings
router.put('/settings', asyncHandler(async (req, res) => {
  const { stashWikiAutoGenEnabled, stashWikiAutoGenInterval } = req.body;
  const data = {};
  if (stashWikiAutoGenEnabled !== undefined) data.stashWikiAutoGenEnabled = stashWikiAutoGenEnabled;
  if (stashWikiAutoGenInterval !== undefined) data.stashWikiAutoGenInterval = stashWikiAutoGenInterval;
  await stashWikiService.updateStashWikiSettings(data);
  sendSuccess(res, data);
}));

// GET /api/stash-wiki/schema
router.get('/schema', asyncHandler(async (req, res) => {
  const schema = await stashWikiService.getStashWikiSchema();
  sendSuccess(res, { schema });
}));

// PUT /api/stash-wiki/schema
router.put('/schema', asyncHandler(async (req, res) => {
  const { schema } = req.body;
  if (!schema || !schema.trim()) return sendBadRequest(res, 'Schema content is required');
  await stashWikiService.updateStashWikiSchema(schema);
  sendSuccess(res, { updated: true });
}));

// ============================================================================
// TAG WIKI PAGES
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

// GET /api/stash-wiki/tags/:tagId/page
router.get('/tags/:tagId/page', asyncHandler(async (req, res) => {
  const page = await stashWikiService.getPageByTagId(req.params.tagId);
  if (!page) return sendNotFound(res, 'Stash wiki page not found for this tag');
  sendSuccess(res, {
    slug: page.slug,
    title: page.title,
    tagId: page.tagId,
    updatedAt: page.updatedAt
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

// POST /api/stash-wiki/tags/:tagId/update - Create/update wiki page for one app DB tag
router.post('/tags/:tagId/update', asyncHandler(async (req, res) => {
  const { tagId } = req.params;
  if (!tagId) return sendBadRequest(res, 'tagId is required');

  const result = await stashWikiService.upsertTagWikiPage(tagId);
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

// ============================================================================
// LINT
// ============================================================================

// POST /api/stash-wiki/lint - Check tag wiki health
router.post('/lint', asyncHandler(async (req, res) => {
  const result = await stashWikiService.lintWiki();
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/performers/lint - Check performer wiki health
router.post('/performers/lint', asyncHandler(async (req, res) => {
  const result = await stashWikiService.lintPerformerWiki();
  sendSuccess(res, result);
}));

// ============================================================================
// PERFORMER WIKI PAGES
// ============================================================================

// GET /api/stash-wiki/performers/pages
router.get('/performers/pages', asyncHandler(async (req, res) => {
  const { search, hasPerformer } = req.query;
  const filters = {};
  if (search) filters.search = search;
  if (hasPerformer !== undefined) filters.hasPerformer = hasPerformer === 'true';
  const pages = await stashWikiService.getAllPerformerPages(filters);
  sendSuccess(res, pages);
}));

// GET /api/stash-wiki/performers/stats
router.get('/performers/stats', asyncHandler(async (req, res) => {
  const stats = await stashWikiService.getPerformerStats();
  sendSuccess(res, stats);
}));

// GET /api/stash-wiki/performers/log
router.get('/performers/log', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const log = await stashWikiService.getPerformerLog(limit);
  sendSuccess(res, log);
}));

// GET /api/stash-wiki/performers/pages/:slug
router.get('/performers/pages/:slug', asyncHandler(async (req, res) => {
  const page = await stashWikiService.getPerformerPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Performer wiki page not found');
  sendSuccess(res, {
    ...page,
    inboundLinks: JSON.parse(page.inboundLinks || '[]'),
    outboundLinks: JSON.parse(page.outboundLinks || '[]'),
    relatedPerformerIds: JSON.parse(page.relatedPerformerIds || '[]')
  });
}));

// DELETE /api/stash-wiki/performers/pages/:slug
router.delete('/performers/pages/:slug', asyncHandler(async (req, res) => {
  const page = await stashWikiService.getPerformerPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Performer wiki page not found');
  await stashWikiService.deletePerformerPage(req.params.slug);
  sendSuccess(res, { deleted: req.params.slug });
}));

// POST /api/stash-wiki/performers/generate - Generate performer wiki pages
router.post('/performers/generate', asyncHandler(async (req, res) => {
  const result = await stashWikiService.generatePerformerPages();
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/performers/generate/specific - Generate for specific performers
router.post('/performers/generate/specific', asyncHandler(async (req, res) => {
  const { performerIds } = req.body;
  if (!performerIds || !Array.isArray(performerIds) || performerIds.length === 0) {
    return sendBadRequest(res, 'performerIds array is required');
  }
  const result = await stashWikiService.generatePerformerPages(performerIds);
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/performers/:performerId/update - Create/update wiki page for one app DB performer
router.post('/performers/:performerId/update', asyncHandler(async (req, res) => {
  const { performerId } = req.params;
  if (!performerId) return sendBadRequest(res, 'performerId is required');

  const result = await stashWikiService.upsertPerformerWikiPage(performerId);
  sendSuccess(res, result);
}));

// POST /api/stash-wiki/performers/pages/:slug/regenerate
router.post('/performers/pages/:slug/regenerate', asyncHandler(async (req, res) => {
  const page = await stashWikiService.regeneratePerformerPage(req.params.slug);
  sendSuccess(res, page);
}));

// POST /api/stash-wiki/performers/pages/:slug/correct
router.post('/performers/pages/:slug/correct', asyncHandler(async (req, res) => {
  const { correction } = req.body;
  if (!correction || !correction.trim()) return sendBadRequest(res, 'Correction text is required');
  const page = await stashWikiService.correctPerformerPage(req.params.slug, correction);
  sendSuccess(res, page);
}));

module.exports = router;
