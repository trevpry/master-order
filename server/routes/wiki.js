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
  const {
    wikiContextEnabled,
    wikiAutoIngestEnabled,
    wikiAutoIngestInterval,
    wikiChatExtractionEnabled,
    ollamaWikiExtractionModel,
    ollamaChatExtractionModel,
    ollamaNotesExtractionModel,
    ollamaDatingExtractionModel
  } = req.body;
  const data = {};
  if (wikiContextEnabled !== undefined) data.wikiContextEnabled = wikiContextEnabled;
  if (wikiAutoIngestEnabled !== undefined) data.wikiAutoIngestEnabled = wikiAutoIngestEnabled;
  if (wikiAutoIngestInterval !== undefined) data.wikiAutoIngestInterval = wikiAutoIngestInterval;
  if (wikiChatExtractionEnabled !== undefined) data.wikiChatExtractionEnabled = wikiChatExtractionEnabled;
  if (ollamaWikiExtractionModel !== undefined) data.ollamaWikiExtractionModel = String(ollamaWikiExtractionModel || '').trim();
  if (ollamaChatExtractionModel !== undefined) data.ollamaChatExtractionModel = String(ollamaChatExtractionModel || '').trim();
  if (ollamaNotesExtractionModel !== undefined) data.ollamaNotesExtractionModel = String(ollamaNotesExtractionModel || '').trim();
  if (ollamaDatingExtractionModel !== undefined) data.ollamaDatingExtractionModel = String(ollamaDatingExtractionModel || '').trim();
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
  const parsedBatchSize = parseInt(req.query.batchSize, 10);
  const batchSize = Number.isNaN(parsedBatchSize) ? 0 : parsedBatchSize;
  const reprocessRecent = parseInt(req.query.reprocessRecent, 10);
  const result = await wikiService.backfillChatExtraction(batchSize, {
    reprocessRecent: Number.isNaN(reprocessRecent) ? 1 : reprocessRecent
  });
  sendSuccess(res, result);
}));

// POST /api/wiki/backfill-chat/reset-flags - Reset wiki extraction flags for scoped chat messages
router.post('/backfill-chat/reset-flags', asyncHandler(async (req, res) => {
  const {
    conversationId,
    startDate,
    endDate,
    roles,
    limit,
    dryRun = true,
    confirm = false
  } = req.body || {};

  const hasScope = !!conversationId || !!startDate || !!endDate;
  if (!hasScope) {
    return sendBadRequest(res, 'At least one scope filter is required: conversationId, startDate, or endDate');
  }

  const parsedConversationId = conversationId !== undefined && conversationId !== null
    ? parseInt(conversationId)
    : undefined;
  if (parsedConversationId !== undefined && Number.isNaN(parsedConversationId)) {
    return sendBadRequest(res, 'conversationId must be a valid number');
  }

  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(endDate) : null;
  if (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) {
    return sendBadRequest(res, 'startDate must be a valid date/time');
  }
  if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
    return sendBadRequest(res, 'endDate must be a valid date/time');
  }
  if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
    return sendBadRequest(res, 'startDate must be earlier than or equal to endDate');
  }

  let parsedRoles = ['user', 'assistant'];
  if (roles !== undefined) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return sendBadRequest(res, 'roles must be a non-empty array when provided');
    }
    const allowedRoles = new Set(['user', 'assistant']);
    const invalidRole = roles.find(r => !allowedRoles.has(r));
    if (invalidRole) {
      return sendBadRequest(res, `Invalid role: ${invalidRole}. Allowed roles: user, assistant`);
    }
    parsedRoles = roles;
  }

  let parsedLimit;
  if (limit !== undefined && limit !== null) {
    parsedLimit = parseInt(limit);
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
      return sendBadRequest(res, 'limit must be a positive integer');
    }
  }

  const isDryRun = !!dryRun;
  if (!isDryRun && confirm !== true) {
    return sendBadRequest(res, 'confirm=true is required when dryRun is false');
  }

  const result = await wikiService.resetChatExtractionFlags({
    conversationId: parsedConversationId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    roles: parsedRoles,
    limit: parsedLimit,
    dryRun: isDryRun
  });

  sendSuccess(res, result);
}));

// ============================================================================
// LINT
// ============================================================================

// POST /api/wiki/lint
router.post('/lint', asyncHandler(async (req, res) => {
  const fixInput = req.query.fix ?? req.body?.fix;
  const autoFix = fixInput === undefined
    ? true
    : !['0', 'false', 'no'].includes(String(fixInput).toLowerCase());

  const result = await wikiService.lintWiki({ autoFix });
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

// GET /api/wiki/chat-extraction-health
router.get('/chat-extraction-health', asyncHandler(async (req, res) => {
  const { hours, limit } = req.query;
  const health = await wikiService.getChatExtractionHealth({ hours, limit });
  sendSuccess(res, health);
}));

module.exports = router;
