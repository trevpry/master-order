const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, sendSuccess, sendBadRequest, sendNotFound, sendCreated } = require('../utils/responses');
const ListScraperService = require('../services/ListScraperService');
const ListItemMatcherService = require('../services/ListItemMatcherService');
const { getAvailableParsers } = require('../services/parsers/ParserRegistry');

const prisma = new PrismaClient();
const scraperService = new ListScraperService();

let tvdbService = null;
let backgroundService = null;

function setTvdbService(service) {
  tvdbService = service;
}

function setBackgroundService(service) {
  backgroundService = service;
}

// ─── Standalone List Sync CRUD ──────────────────────────────────────────

// GET /api/list-scraping/parsers - Get available parser types
router.get('/parsers', asyncHandler(async (req, res) => {
  sendSuccess(res, getAvailableParsers());
}));

// GET /api/list-scraping/status - Get background service status
router.get('/status', asyncHandler(async (req, res) => {
  if (!backgroundService) {
    return sendSuccess(res, { isRunning: false, syncInProgress: false, lastSyncStatus: null });
  }
  sendSuccess(res, backgroundService.getStatus());
}));

// GET /api/list-scraping/configs - List all list sync configs
router.get('/configs', asyncHandler(async (req, res) => {
  const configs = await prisma.listScrapeConfig.findMany({
    include: {
      customOrder: { select: { id: true, name: true } },
      _count: { select: { scrapedItems: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  sendSuccess(res, configs);
}));

// POST /api/list-scraping/configs - Create a new list sync config
router.post('/configs', asyncHandler(async (req, res) => {
  const { name, url, parserType, parserConfig, itemSelector, titleSelector,
          mediaTypeSelector, urlSelector, imageSelector, yearSelector,
          defaultMediaType, useJavaScript, isActive, headImportCount, tailImportCount } = req.body;

  if (!name || !url) {
    return sendBadRequest(res, 'name and url are required');
  }

  // For css-selectors parser, require selectors
  if ((!parserType || parserType === 'css-selectors') && (!itemSelector || !titleSelector)) {
    return sendBadRequest(res, 'itemSelector and titleSelector are required for CSS selector parser');
  }

  const config = await prisma.listScrapeConfig.create({
    data: {
      name,
      url,
      parserType: parserType || 'css-selectors',
      parserConfig: parserConfig ? (typeof parserConfig === 'string' ? parserConfig : JSON.stringify(parserConfig)) : null,
      itemSelector: itemSelector || null,
      titleSelector: titleSelector || null,
      mediaTypeSelector: mediaTypeSelector || null,
      urlSelector: urlSelector || null,
      imageSelector: imageSelector || null,
      yearSelector: yearSelector || null,
      defaultMediaType: defaultMediaType || 'movie',
      useJavaScript: useJavaScript || false,
      isActive: isActive !== undefined ? isActive : true,
      headImportCount: headImportCount ? parseInt(headImportCount) : null,
      tailImportCount: tailImportCount ? parseInt(tailImportCount) : null
    }
  });

  sendCreated(res, config);
}));

// GET /api/list-scraping/configs/:id - Get a specific config
router.get('/configs/:id', asyncHandler(async (req, res) => {
  const config = await prisma.listScrapeConfig.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      customOrder: { select: { id: true, name: true } },
      scrapedItems: { orderBy: { position: 'asc' }, take: 100 }
    }
  });

  if (!config) return sendNotFound(res, 'List sync config not found');
  sendSuccess(res, config);
}));

// PUT /api/list-scraping/configs/:id - Update a config
router.put('/configs/:id', asyncHandler(async (req, res) => {
  const { name, url, parserType, parserConfig, itemSelector, titleSelector,
          mediaTypeSelector, urlSelector, imageSelector, yearSelector,
          defaultMediaType, useJavaScript, isActive, headImportCount, tailImportCount } = req.body;

  const existing = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!existing) return sendNotFound(res, 'List sync config not found');

  const config = await prisma.listScrapeConfig.update({
    where: { id: parseInt(req.params.id) },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(parserType !== undefined && { parserType }),
      ...(parserConfig !== undefined && { parserConfig: typeof parserConfig === 'string' ? parserConfig : JSON.stringify(parserConfig) }),
      ...(itemSelector !== undefined && { itemSelector }),
      ...(titleSelector !== undefined && { titleSelector }),
      ...(mediaTypeSelector !== undefined && { mediaTypeSelector }),
      ...(urlSelector !== undefined && { urlSelector }),
      ...(imageSelector !== undefined && { imageSelector }),
      ...(yearSelector !== undefined && { yearSelector }),
      ...(defaultMediaType !== undefined && { defaultMediaType }),
      ...(useJavaScript !== undefined && { useJavaScript }),
      ...(isActive !== undefined && { isActive }),
      ...(headImportCount !== undefined && { headImportCount: headImportCount ? parseInt(headImportCount) : null }),
      ...(tailImportCount !== undefined && { tailImportCount: tailImportCount ? parseInt(tailImportCount) : null })
    }
  });

  sendSuccess(res, config);
}));

// DELETE /api/list-scraping/configs/:id - Delete a config and its tracked items
router.delete('/configs/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!existing) return sendNotFound(res, 'List sync config not found');

  await prisma.listScrapeConfig.delete({ where: { id: parseInt(req.params.id) } });
  sendSuccess(res, { message: 'List sync config deleted' });
}));

// ─── Link / Unlink to Custom Order ─────────────────────────────────────

// POST /api/list-scraping/configs/:id/link - Link a config to a custom order
router.post('/configs/:id/link', asyncHandler(async (req, res) => {
  const { customOrderId } = req.body;
  if (!customOrderId) return sendBadRequest(res, 'customOrderId is required');

  const order = await prisma.customOrder.findUnique({ where: { id: parseInt(customOrderId) } });
  if (!order) return sendNotFound(res, 'Custom order not found');

  // Check if order already has a linked config
  const existingLink = await prisma.listScrapeConfig.findUnique({ where: { customOrderId: parseInt(customOrderId) } });
  if (existingLink) return sendBadRequest(res, `Order "${order.name}" already has a linked list sync (config #${existingLink.id})`);

  const config = await prisma.listScrapeConfig.update({
    where: { id: parseInt(req.params.id) },
    data: { customOrderId: parseInt(customOrderId) },
    include: { customOrder: { select: { id: true, name: true } } }
  });

  sendSuccess(res, config);
}));

// POST /api/list-scraping/configs/:id/unlink - Unlink from custom order
router.post('/configs/:id/unlink', asyncHandler(async (req, res) => {
  const config = await prisma.listScrapeConfig.update({
    where: { id: parseInt(req.params.id) },
    data: { customOrderId: null }
  });
  sendSuccess(res, config);
}));

// ─── Scraping Operations ────────────────────────────────────────────────

// POST /api/list-scraping/configs/:id/preview - Preview scraped items
router.post('/configs/:id/preview', asyncHandler(async (req, res) => {
  let config;
  // Allow passing config overrides in body for testing
  if (req.body.url) {
    config = { ...req.body, parserType: req.body.parserType || 'css-selectors' };
  } else {
    config = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  }

  if (!config) return sendNotFound(res, 'Config not found');

  const items = await scraperService.scrapeList(config);
  sendSuccess(res, { itemCount: items.length, items: items.slice(0, 200) });
}));

// POST /api/list-scraping/configs/:id/import - Trigger initial import
router.post('/configs/:id/import', asyncHandler(async (req, res) => {
  const { importAll } = req.body;
  if (importAll === undefined) return sendBadRequest(res, 'importAll (true/false) is required');

  const config = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!config) return sendNotFound(res, 'Config not found');

  if (importAll && !config.customOrderId) {
    return sendBadRequest(res, 'Cannot import items — this list sync is not linked to a custom order');
  }

  const matcherService = new ListItemMatcherService(tvdbService);
  const results = await scraperService.initialImport(config.id, importAll, matcherService);
  sendSuccess(res, results);
}));

// POST /api/list-scraping/configs/:id/check - Manual update check
router.post('/configs/:id/check', asyncHandler(async (req, res) => {
  const config = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!config) return sendNotFound(res, 'Config not found');

  const matcherService = new ListItemMatcherService(tvdbService);
  const results = await scraperService.checkForUpdates(config.id, matcherService);
  sendSuccess(res, results);
}));

// POST /api/list-scraping/configs/:id/reprocess-unresolved
// Re-run matcher + provider resolution on unresolved tracked entries.
// Defaults to dry-run mode unless dryRun=false is explicitly passed.
router.post('/configs/:id/reprocess-unresolved', asyncHandler(async (req, res) => {
  const configId = parseInt(req.params.id);
  const config = await prisma.listScrapeConfig.findUnique({ where: { id: configId } });
  if (!config) return sendNotFound(res, 'Config not found');

  const dryRun = req.body?.dryRun !== false;
  const parsedLimit = Number.parseInt(req.body?.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 200;
  const includeAlreadyLinked = req.body?.includeAlreadyLinked === true;

  const matcherService = new ListItemMatcherService(tvdbService);
  const results = await scraperService.reprocessUnresolved(configId, matcherService, {
    dryRun,
    limit,
    includeAlreadyLinked,
  });

  sendSuccess(res, results, dryRun ? 'Unresolved reprocess dry-run completed' : 'Unresolved reprocess completed');
}));

// GET /api/list-scraping/configs/:id/history - Get scraped items history
router.get('/configs/:id/history', asyncHandler(async (req, res) => {
  const config = await prisma.listScrapeConfig.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!config) return sendNotFound(res, 'Config not found');

  const items = await prisma.listScrapedItem.findMany({
    where: { listScrapeConfigId: config.id },
    orderBy: { position: 'asc' },
    include: {
      customOrderItem: { select: { id: true, title: true, mediaType: true, isWatched: true } }
    }
  });

  sendSuccess(res, { configId: config.id, items });
}));

// GET /api/list-scraping/configs/:id/diagnostics - Diagnose unresolved/list-link issues
router.get('/configs/:id/diagnostics', asyncHandler(async (req, res) => {
  const configId = parseInt(req.params.id);
  const parsedLimit = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;

  const config = await prisma.listScrapeConfig.findUnique({
    where: { id: configId },
    include: { customOrder: { select: { id: true, name: true } } }
  });

  if (!config) {
    return sendNotFound(res, 'Config not found');
  }

  const [
    totalTracked,
    linkedTracked,
    skippedTracked,
    unresolvedTracked,
    orphanedTracked,
    unresolvedSamples,
  ] = await Promise.all([
    prisma.listScrapedItem.count({ where: { listScrapeConfigId: configId } }),
    prisma.listScrapedItem.count({
      where: {
        listScrapeConfigId: configId,
        customOrderItemId: { not: null }
      }
    }),
    prisma.listScrapedItem.count({
      where: {
        listScrapeConfigId: configId,
        wasSkipped: true
      }
    }),
    prisma.listScrapedItem.count({
      where: {
        listScrapeConfigId: configId,
        notInPlex: true,
        customOrderItemId: null
      }
    }),
    prisma.listScrapedItem.count({
      where: {
        listScrapeConfigId: configId,
        customOrderItemId: null,
        wasSkipped: false,
        notInPlex: false
      }
    }),
    prisma.listScrapedItem.findMany({
      where: {
        listScrapeConfigId: configId,
        notInPlex: true,
        customOrderItemId: null,
        mediaType: { in: ['movie', 'episode'] }
      },
      orderBy: { position: 'asc' },
      take: limit,
      select: {
        id: true,
        title: true,
        mediaType: true,
        position: true,
        itemUrl: true,
        itemYear: true
      }
    })
  ]);

  const matcherService = new ListItemMatcherService(tvdbService);
  const providerReasonCounts = {};
  const diagnostics = [];

  const incrementProviderReason = (provider, reason) => {
    if (!providerReasonCounts[provider]) {
      providerReasonCounts[provider] = {};
    }
    if (!providerReasonCounts[provider][reason]) {
      providerReasonCounts[provider][reason] = 0;
    }
    providerReasonCounts[provider][reason] += 1;
  };

  for (const sample of unresolvedSamples) {
    try {
      const matched = await matcherService.matchItem({
        title: sample.title,
        mediaType: sample.mediaType,
        itemUrl: sample.itemUrl,
        itemYear: sample.itemYear
      });

      const enriched = await scraperService.resolvePlexMetadata(matched);

      let provider = enriched.sourceProvider || 'unresolved';
      if (enriched.movieId || enriched.episodeId) {
        provider = 'arr';
      } else if (enriched.plexKey || enriched.plexShowFound) {
        provider = 'plex';
      }

      const nowResolvable = !scraperService.isUnresolvedLibraryItem(enriched);
      const reason = nowResolvable
        ? 'now_resolvable'
        : (enriched.isFromTvdbOnly ? 'metadata_only_no_library_match' : 'no_library_match');

      incrementProviderReason(provider, reason);
      diagnostics.push({
        id: sample.id,
        title: sample.title,
        mediaType: sample.mediaType,
        position: sample.position,
        provider,
        reason,
        movieId: enriched.movieId || null,
        episodeId: enriched.episodeId || null,
        plexKey: enriched.plexKey || null
      });
    } catch (error) {
      incrementProviderReason('error', 'matcher_failed');
      diagnostics.push({
        id: sample.id,
        title: sample.title,
        mediaType: sample.mediaType,
        position: sample.position,
        provider: 'error',
        reason: 'matcher_failed',
        error: error.message
      });
    }
  }

  sendSuccess(res, {
    config: {
      id: config.id,
      name: config.name,
      customOrder: config.customOrder || null,
      isActive: config.isActive,
      parserType: config.parserType
    },
    counts: {
      totalTracked,
      linkedTracked,
      skippedTracked,
      unresolvedTracked,
      orphanedTracked
    },
    providerReasonCounts,
    unresolvedSamplesAnalyzed: diagnostics.length,
    diagnostics
  });
}));

// ─── Legacy order-based routes (backward compat) ───────────────────────

// GET /api/list-scraping/by-order/:orderId - Get config for a custom order
router.get('/by-order/:orderId', asyncHandler(async (req, res) => {
  const config = await prisma.listScrapeConfig.findUnique({
    where: { customOrderId: parseInt(req.params.orderId) },
    include: { scrapedItems: { orderBy: { position: 'asc' }, take: 100 } }
  });
  if (!config) return sendNotFound(res, 'No list sync linked to this order');
  sendSuccess(res, config);
}));

// POST /api/list-scraping/check-all - Trigger check on all active lists
router.post('/check-all', asyncHandler(async (req, res) => {
  if (backgroundService && !backgroundService.syncInProgress) {
    backgroundService.performCheck().catch(err => {
      console.error('Manual check-all failed:', err.message);
    });
    sendSuccess(res, { message: 'List scrape check triggered for all active lists' });
  } else if (backgroundService?.syncInProgress) {
    sendBadRequest(res, 'A list scrape check is already in progress');
  } else {
    sendBadRequest(res, 'Background list scrape service is not running');
  }
}));

module.exports = router;
module.exports.setTvdbService = setTvdbService;
module.exports.setBackgroundService = setBackgroundService;
