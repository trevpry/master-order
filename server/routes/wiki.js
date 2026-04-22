const express = require('express');
const router = express.Router();
const WikiService = require('../services/WikiService');
const { asyncHandler, sendSuccess, sendBadRequest, sendNotFound, sendServerError, logError } = require('../utils/responses');

const wikiService = new WikiService();

// ============================================================================
// WIKI SETTINGS & SCHEMA
// ============================================================================

// GET /api/wiki/settings
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await wikiService.getWikiSettings();
  sendSuccess(res, settings);
}));

// PUT /api/wiki/settings
router.put('/settings', asyncHandler(async (req, res) => {
  const { wikiContextEnabled, wikiAutoIngestEnabled, wikiAutoIngestInterval, wikiChatExtractionEnabled } = req.body;
  const data = {};
  if (wikiContextEnabled !== undefined) data.wikiContextEnabled = wikiContextEnabled;
  if (wikiAutoIngestEnabled !== undefined) data.wikiAutoIngestEnabled = wikiAutoIngestEnabled;
  if (wikiAutoIngestInterval !== undefined) data.wikiAutoIngestInterval = wikiAutoIngestInterval;
  if (wikiChatExtractionEnabled !== undefined) data.wikiChatExtractionEnabled = wikiChatExtractionEnabled;
  await wikiService.updateWikiSettings(data);
  sendSuccess(res, data);
}));

// GET /api/wiki/schema
router.get('/schema', asyncHandler(async (req, res) => {
  const schema = await wikiService.getWikiSchema();
  sendSuccess(res, { schema });
}));

// PUT /api/wiki/schema
router.put('/schema', asyncHandler(async (req, res) => {
  const { schema } = req.body;
  if (!schema || !schema.trim()) return sendBadRequest(res, 'Schema content is required');
  await wikiService.updateWikiSchema(schema);
  sendSuccess(res, { schema });
}));

// ============================================================================
// WIKI PAGES
// ============================================================================

// GET /api/wiki/pages
router.get('/pages', asyncHandler(async (req, res) => {
  const { type, category, search } = req.query;
  const pages = await wikiService.getAllPages({ type, category, search });
  sendSuccess(res, pages);
}));

// GET /api/wiki/pages/:slug
router.get('/pages/:slug', asyncHandler(async (req, res) => {
  const page = await wikiService.getPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Wiki page not found');
  // Parse JSON fields
  sendSuccess(res, {
    ...page,
    inboundLinks: JSON.parse(page.inboundLinks || '[]'),
    outboundLinks: JSON.parse(page.outboundLinks || '[]'),
    sourceNoteIds: JSON.parse(page.sourceNoteIds || '[]'),
    sourceChatIds: JSON.parse(page.sourceChatIds || '[]')
  });
}));

// DELETE /api/wiki/pages/:slug
router.delete('/pages/:slug', asyncHandler(async (req, res) => {
  const page = await wikiService.getPage(req.params.slug);
  if (!page) return sendNotFound(res, 'Wiki page not found');
  await wikiService.deletePage(req.params.slug);
  sendSuccess(res, { deleted: req.params.slug });
}));

// ============================================================================
// INGEST OPERATIONS
// ============================================================================

// POST /api/wiki/ingest - Ingest specific notes
router.post('/ingest', asyncHandler(async (req, res) => {
  const { noteIds } = req.body;
  if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
    return sendBadRequest(res, 'noteIds array is required');
  }
  const result = await wikiService.ingestNotes(noteIds);
  sendSuccess(res, result);
}));

// POST /api/wiki/ingest/all - Ingest all un-ingested notes
router.post('/ingest/all', asyncHandler(async (req, res) => {
  const result = await wikiService.ingestAllUningested();
  sendSuccess(res, result);
}));

// POST /api/wiki/ingest/dating - Ingest dating-section data into wiki
router.post('/ingest/dating', asyncHandler(async (req, res) => {
  const result = await wikiService.ingestDatingData();
  sendSuccess(res, result);
}));

// POST /api/wiki/backfill-chat - Backfill wiki extraction from past chats
router.post('/backfill-chat', asyncHandler(async (req, res) => {
  const batchSize = parseInt(req.query.batchSize) || 20;
  const result = await wikiService.backfillChatExtraction(batchSize);
  sendSuccess(res, result);
}));

// ============================================================================
// LINT
// ============================================================================

// POST /api/wiki/lint
router.post('/lint', asyncHandler(async (req, res) => {
  const result = await wikiService.lintWiki();
  sendSuccess(res, result);
}));

// ============================================================================
// LOG & STATS
// ============================================================================

// GET /api/wiki/log
router.get('/log', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const log = await wikiService.getLog(limit);
  sendSuccess(res, log);
}));

// GET /api/wiki/stats
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await wikiService.getStats();
  sendSuccess(res, stats);
}));

module.exports = router;
