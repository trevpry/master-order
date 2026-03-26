const cheerio = require('cheerio');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getParser } = require('./parsers/ParserRegistry');

const prisma = new PrismaClient();

class ListScraperService {
  constructor() {
    this.name = 'ListScraperService';
  }

  /**
   * Generate a fingerprint for deduplication
   */
  generateFingerprint(title, position) {
    const normalized = `${title.toLowerCase().trim()}::${position}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 32);
  }

  /**
   * Scrape a list page using the appropriate parser
   * @param {Object} config - ListScrapeConfig record
   * @returns {Array<Object>} - Array of extracted items with fingerprints
   */
  async scrapeList(config) {
    const parserType = config.parserType || 'css-selectors';
    const parser = getParser(parserType);
    const items = await parser.parse(config);

    // Add fingerprints to all items
    return items.map((item, index) => ({
      ...item,
      position: item.position ?? index,
      fingerprint: this.generateFingerprint(item.title, item.position ?? index)
    }));
  }

  /**
   * Detect new items by comparing scraped list against tracked items
   * @param {number} configId - ListScrapeConfig ID
   * @param {Array} scrapedItems - Items from scrapeList()
   * @returns {Array} - New items not yet tracked
   */
  async detectNewItems(configId, scrapedItems) {
    const existingItems = await prisma.listScrapedItem.findMany({
      where: { listScrapeConfigId: configId },
      select: { fingerprint: true }
    });

    const existingFingerprints = new Set(existingItems.map(i => i.fingerprint));
    return scrapedItems.filter(item => !existingFingerprints.has(item.fingerprint));
  }

  /**
   * Calculate the sortOrder for inserting a new item at a given list position
   * @param {number} configId - ListScrapeConfig ID
   * @param {number} customOrderId - CustomOrder ID
   * @param {number} position - The list position of the new item
   * @returns {number} - The sortOrder value to use
   */
  async calculateInsertSortOrder(configId, customOrderId, position) {
    // Find previously-tracked items around this position that have custom order items
    const prevTracked = await prisma.listScrapedItem.findFirst({
      where: {
        listScrapeConfigId: configId,
        position: { lt: position },
        customOrderItemId: { not: null },
        wasSkipped: false
      },
      orderBy: { position: 'desc' },
      include: { customOrderItem: { select: { sortOrder: true } } }
    });

    const nextTracked = await prisma.listScrapedItem.findFirst({
      where: {
        listScrapeConfigId: configId,
        position: { gt: position },
        customOrderItemId: { not: null },
        wasSkipped: false
      },
      orderBy: { position: 'asc' },
      include: { customOrderItem: { select: { sortOrder: true } } }
    });

    if (prevTracked?.customOrderItem && nextTracked?.customOrderItem) {
      const prevSort = prevTracked.customOrderItem.sortOrder;
      const nextSort = nextTracked.customOrderItem.sortOrder;
      // If there's room between them, use the midpoint
      if (nextSort - prevSort > 1) {
        return Math.floor((prevSort + nextSort) / 2);
      }
      // No room — shift everything after prevSort up by 1
      await prisma.customOrderItem.updateMany({
        where: {
          customOrderId,
          sortOrder: { gt: prevSort }
        },
        data: { sortOrder: { increment: 1 } }
      });
      return prevSort + 1;
    }

    if (prevTracked?.customOrderItem) {
      return prevTracked.customOrderItem.sortOrder + 1;
    }

    if (nextTracked?.customOrderItem) {
      const nextSort = nextTracked.customOrderItem.sortOrder;
      if (nextSort > 1) {
        return nextSort - 1;
      }
      // Shift everything up
      await prisma.customOrderItem.updateMany({
        where: { customOrderId },
        data: { sortOrder: { increment: 1 } }
      });
      return 1;
    }

    // No neighbors — place at end
    const lastItem = await prisma.customOrderItem.findFirst({
      where: { customOrderId },
      orderBy: { sortOrder: 'desc' }
    });
    return lastItem ? lastItem.sortOrder + 1 : 1;
  }

  /**
   * Enforce that all custom order items linked to this list appear in scraped-list-position order.
   * Takes the existing sortOrder slots held by list items, sorts them, and reassigns them
   * in list-position order — so non-list items stay in their relative slots untouched.
   */
  async enforceListOrder(configId, customOrderId) {
    const trackedItems = await prisma.listScrapedItem.findMany({
      where: {
        listScrapeConfigId: configId,
        customOrderItemId: { not: null }
      },
      orderBy: { position: 'asc' },
      include: { customOrderItem: { select: { id: true, sortOrder: true } } }
    });

    if (trackedItems.length < 2) return;

    // Collect current sortOrder values and sort them numerically
    const sortOrders = trackedItems.map(t => t.customOrderItem.sortOrder).sort((a, b) => a - b);

    // Reassign: each tracked item (in list position order) gets the corresponding sorted slot
    for (let i = 0; i < trackedItems.length; i++) {
      const item = trackedItems[i];
      if (item.customOrderItem.sortOrder !== sortOrders[i]) {
        await prisma.customOrderItem.update({
          where: { id: item.customOrderItem.id },
          data: { sortOrder: sortOrders[i] }
        });
      }
    }
  }

  /**
   * Add a matched item to a custom order
   * @param {number} customOrderId
   * @param {Object} itemData - Enriched item data
   * @param {number} sortOrder
   * @returns {Object} - Created CustomOrderItem
   */
  async addItemToOrder(customOrderId, itemData, sortOrder) {
    return await prisma.customOrderItem.create({
      data: {
        customOrderId,
        mediaType: itemData.mediaType || 'movie',
        plexKey: itemData.plexKey || null,
        title: itemData.title,
        seasonNumber: itemData.seasonNumber || null,
        episodeNumber: itemData.episodeNumber || null,
        seriesTitle: itemData.seriesTitle || null,
        sortOrder,
        // Comic fields
        comicSeries: itemData.comicSeries || null,
        comicYear: itemData.comicYear || null,
        comicIssue: itemData.comicIssue || null,
        comicPublisher: itemData.comicPublisher || null,
        comicVineId: itemData.comicVineId || null,
        comicVineDetailsJson: itemData.comicVineDetailsJson || null,
        comicVineSeriesId: itemData.comicVineSeriesId || null,
        comicVineIssueId: itemData.comicVineIssueId || null,
        comicIssueName: itemData.comicIssueName || null,
        comicDescription: itemData.comicDescription || null,
        comicCoverDate: itemData.comicCoverDate || null,
        comicStoreDate: itemData.comicStoreDate || null,
        comicCreators: itemData.comicCreators || null,
        comicCharacters: itemData.comicCharacters || null,
        comicStoryArcs: itemData.comicStoryArcs || null,
        // Artwork
        originalArtworkUrl: itemData.originalArtworkUrl || null,
        // TV/movie metadata
        tvdbId: itemData.tvdbId || null,
        tvdbYear: itemData.tvdbYear || null,
        tvdbOverview: itemData.tvdbOverview || null,
        tvdbArtworkUrl: itemData.tvdbArtworkUrl || null,
        // Web video
        webTitle: itemData.webTitle || null,
        webUrl: itemData.webUrl || null,
        webDescription: itemData.webDescription || null,
        // Other
        bookId: itemData.bookId || null,
        gameId: itemData.gameId || null,
        isFromTvdbOnly: itemData.isFromTvdbOnly || false
      }
    });
  }

  /**
   * Perform initial import — either import all items or mark them as skipped
   * @param {number} configId
   * @param {boolean} importAll - true: add all items; false: track all as skipped so future Check detects only new ones
   * @param {Object} matcherService - ListItemMatcherService instance
   */
  async initialImport(configId, importAll, matcherService) {
    const config = await prisma.listScrapeConfig.findUnique({
      where: { id: configId }
    });
    if (!config) throw new Error('List scrape config not found');

    const hasOrder = !!config.customOrderId;

    const scrapedItems = await this.scrapeList(config);
    const results = { added: 0, skipped: 0, errors: [], notInPlex: [] };

    // When headImportCount or tailImportCount is set and we're doing importAll,
    // only import the first/last N items respectively.
    // Everything outside the slice is tracked as skipped so future checks won't re-surface them.
    const headCount = config.headImportCount;
    const tailCount = config.tailImportCount;
    let importableFingerprints = null;
    if (importAll && hasOrder) {
      if (headCount && headCount > 0) {
        importableFingerprints = new Set(scrapedItems.slice(0, headCount).map(i => i.fingerprint));
      } else if (tailCount && tailCount > 0) {
        importableFingerprints = new Set(scrapedItems.slice(-tailCount).map(i => i.fingerprint));
      }
    }

    // === PHASE 1: Match all items, detect duplicates and Plex availability ===
    // We must know about ALL duplicates before inserting anything so that
    // calculateInsertSortOrder can see anchors both before AND after each new item.
    const itemPlan = []; // { item, enriched, duplicate, shouldImport }

    for (const item of scrapedItems) {
      try {
        const shouldImport = hasOrder && importAll &&
          (importableFingerprints === null || importableFingerprints.has(item.fingerprint));

        if (!shouldImport) {
          itemPlan.push({ item, enriched: null, duplicate: null, shouldImport: false });
          continue;
        }

        const enriched = await matcherService.matchItem(item);

        // Not-in-Plex check — stop immediately, track the item, skip remaining
        if ((enriched.mediaType === 'movie' || enriched.mediaType === 'episode') && !enriched.plexKey && !enriched.plexShowFound) {
          results.notInPlex.push({ title: item.title, mediaType: enriched.mediaType });
          await prisma.listScrapedItem.upsert({
            where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
            update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, wasSkipped: true, notInPlex: true },
            create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, wasSkipped: true, notInPlex: true }
          });
          break; // Stop — user must acknowledge and retry
        }

        const duplicate = await this.checkDuplicate(config.customOrderId, enriched);
        itemPlan.push({ item, enriched, duplicate, shouldImport: true });
      } catch (error) {
        console.error(`Error matching item "${item.title}":`, error.message);
        results.errors.push({ title: item.title, error: error.message });
      }
    }

    // === PHASE 2: Link duplicates and skipped items (establishes anchor points) ===
    for (const { item, duplicate, shouldImport } of itemPlan) {
      if (shouldImport && duplicate) {
        await prisma.listScrapedItem.upsert({
          where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
          update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, customOrderItemId: duplicate.id, wasSkipped: false },
          create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, customOrderItemId: duplicate.id, wasSkipped: false }
        });
        results.skipped++;
      } else if (!shouldImport) {
        await prisma.listScrapedItem.upsert({
          where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
          update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, wasSkipped: true },
          create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, wasSkipped: true }
        });
        results.skipped++;
      }
    }

    // === PHASE 3: Insert new items (all anchor points are now visible) ===
    for (const { item, enriched, duplicate, shouldImport } of itemPlan) {
      if (!shouldImport || duplicate) continue;
      try {
        const sortOrder = await this.calculateInsertSortOrder(configId, config.customOrderId, item.position);
        const createdItem = await this.addItemToOrder(config.customOrderId, enriched, sortOrder);
        await prisma.listScrapedItem.upsert({
          where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
          update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, customOrderItemId: createdItem.id, wasSkipped: false },
          create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, customOrderItemId: createdItem.id, wasSkipped: false }
        });
        results.added++;
      } catch (error) {
        console.error(`Error inserting item "${item.title}":`, error.message);
        results.errors.push({ title: item.title, error: error.message });
      }
    }

    // === PHASE 4: Enforce scraped list order on all linked items ===
    if (hasOrder && config.customOrderId) {
      await this.enforceListOrder(configId, config.customOrderId);
    }

    // Update config — don't mark as importedAll if we stopped early due to a not-in-Plex item
    const stoppedEarly = results.notInPlex.length > 0;
    console.log(`[ListSync] initialImport COMPLETE — added:${results.added} skipped:${results.skipped} notInPlex:${results.notInPlex.length} errors:${results.errors.length}`);
    if (results.notInPlex.length > 0) {
      console.log(`[ListSync] ⛔ NOT IN PLEX:`, JSON.stringify(results.notInPlex));
    }
    await prisma.listScrapeConfig.update({
      where: { id: configId },
      data: {
        importedAll: stoppedEarly ? false : importAll,
        lastCheckedAt: new Date(),
        lastItemCount: scrapedItems.length,
        lastError: null
      }
    });

    return results;
  }

  /**
   * Check for updates on a configured list
   * @param {number} configId
   * @param {Object} matcherService - ListItemMatcherService instance
   */
  async checkForUpdates(configId, matcherService) {
    const config = await prisma.listScrapeConfig.findUnique({
      where: { id: configId }
    });
    if (!config || !config.isActive) return { added: 0, checked: true };

    try {
      const scrapedItems = await this.scrapeList(config);
      const newItems = await this.detectNewItems(configId, scrapedItems);

      // Also find orphaned tracked items: fingerprint exists but customOrderItemId was set to null
      // by onDelete:SetNull (i.e. the linked CustomOrderItem was deleted after import)
      const orphanedTracked = await prisma.listScrapedItem.findMany({
        where: {
          listScrapeConfigId: configId,
          customOrderItemId: null,
          wasSkipped: false
        },
        select: { fingerprint: true }
      });
      const orphanedFingerprints = new Set(orphanedTracked.map(i => i.fingerprint));
      const orphanedItems = scrapedItems.filter(i => orphanedFingerprints.has(i.fingerprint));

      // Re-check items previously skipped because they weren't in Plex — they may have been added since
      const previouslyNotInPlex = await prisma.listScrapedItem.findMany({
        where: {
          listScrapeConfigId: configId,
          notInPlex: true,
          customOrderItemId: null
        },
        select: { fingerprint: true }
      });
      const notInPlexFingerprints = new Set(previouslyNotInPlex.map(i => i.fingerprint));
      const retryItems = scrapedItems.filter(i => notInPlexFingerprints.has(i.fingerprint));

      // Find items that were previously skipped due to head/tail limits but now fall
      // within the expanded range (user increased headImportCount/tailImportCount),
      // or are now eligible because the limit was removed entirely.
      let newlyEligibleItems = [];
      if (config.customOrderId) {
        const headCount = config.headImportCount;
        const tailCount = config.tailImportCount;
        let eligibleFingerprints = null;
        if (headCount && headCount > 0) {
          eligibleFingerprints = new Set(scrapedItems.slice(0, headCount).map(i => i.fingerprint));
        } else if (tailCount && tailCount > 0) {
          eligibleFingerprints = new Set(scrapedItems.slice(-tailCount).map(i => i.fingerprint));
        } else {
          // No limit — all items are eligible
          eligibleFingerprints = new Set(scrapedItems.map(i => i.fingerprint));
        }
        const previouslySkipped = await prisma.listScrapedItem.findMany({
          where: {
            listScrapeConfigId: configId,
            wasSkipped: true,
            notInPlex: false,
            customOrderItemId: null
          },
          select: { fingerprint: true }
        });
        const skippedFingerprints = new Set(previouslySkipped.map(i => i.fingerprint));
        newlyEligibleItems = scrapedItems.filter(i =>
          eligibleFingerprints.has(i.fingerprint) && skippedFingerprints.has(i.fingerprint)
        );
      }

      // Deduplicate: don't double-process items already in newItems or orphanedItems
      const processedFingerprints = new Set([...newItems, ...orphanedItems].map(i => i.fingerprint));
      const uniqueRetryItems = retryItems.filter(i => !processedFingerprints.has(i.fingerprint));
      const allProcessed = new Set([...processedFingerprints, ...uniqueRetryItems.map(i => i.fingerprint)]);
      const uniqueEligibleItems = newlyEligibleItems.filter(i => !allProcessed.has(i.fingerprint));

      const itemsToProcess = [...newItems, ...orphanedItems, ...uniqueRetryItems, ...uniqueEligibleItems];
      // Sort by list position so we process items in order — if we hit a not-in-Plex item,
      // we stop BEFORE processing any items that come after it
      itemsToProcess.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const results = { added: 0, newItemsFound: itemsToProcess.length, errors: [], notInPlex: [] };

      // If not linked to an order, just track new items
      if (!config.customOrderId) {
        for (const item of newItems) {
          await prisma.listScrapedItem.create({
            data: {
              listScrapeConfigId: configId,
              title: item.title,
              position: item.position,
              itemUrl: item.itemUrl,
              itemYear: item.itemYear,
              mediaType: item.mediaType,
              fingerprint: item.fingerprint,
              wasSkipped: true
            }
          });
        }
        results.newItemsFound = newItems.length;
        await prisma.listScrapeConfig.update({
          where: { id: configId },
          data: { lastCheckedAt: new Date(), lastItemCount: scrapedItems.length, lastError: null }
        });
        return results;
      }

      // === PHASE 1: Match all items, detect duplicates and Plex availability ===
      const updatePlan = [];

      for (const item of itemsToProcess) {
        try {
          const enriched = await matcherService.matchItem(item);

          // Not-in-Plex check — stop immediately
          if ((enriched.mediaType === 'movie' || enriched.mediaType === 'episode') && !enriched.plexKey && !enriched.plexShowFound) {
            results.notInPlex.push({ title: item.title, mediaType: enriched.mediaType });
            await prisma.listScrapedItem.upsert({
              where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
              update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, wasSkipped: true, notInPlex: true },
              create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, wasSkipped: true, notInPlex: true }
            });
            break; // Stop — user must acknowledge and retry
          }

          const duplicate = await this.checkDuplicate(config.customOrderId, enriched);
          updatePlan.push({ item, enriched, duplicate });
        } catch (error) {
          console.error(`Error matching item "${item.title}":`, error.message);
          results.errors.push({ title: item.title, error: error.message });
        }
      }

      // === PHASE 2: Link duplicates first (establishes anchor points for correct ordering) ===
      for (const { item, duplicate } of updatePlan) {
        if (!duplicate) continue;
        await prisma.listScrapedItem.upsert({
          where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
          update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, customOrderItemId: duplicate.id, wasSkipped: false },
          create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, customOrderItemId: duplicate.id, wasSkipped: false }
        });
      }

      // === PHASE 3: Insert new items (all anchor points now visible) ===
      for (const { item, enriched, duplicate } of updatePlan) {
        if (duplicate) continue;
        try {
          const sortOrder = await this.calculateInsertSortOrder(configId, config.customOrderId, item.position);
          const createdItem = await this.addItemToOrder(config.customOrderId, enriched, sortOrder);

          await prisma.listScrapedItem.upsert({
            where: { listScrapeConfigId_fingerprint: { listScrapeConfigId: configId, fingerprint: item.fingerprint } },
            update: { title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, customOrderItemId: createdItem.id, wasSkipped: false, notInPlex: false },
            create: { listScrapeConfigId: configId, title: item.title, position: item.position, itemUrl: item.itemUrl, itemYear: item.itemYear, mediaType: item.mediaType, fingerprint: item.fingerprint, customOrderItemId: createdItem.id, wasSkipped: false, notInPlex: false }
          });
          results.added++;
        } catch (error) {
          console.error(`Error inserting item "${item.title}":`, error.message);
          results.errors.push({ title: item.title, error: error.message });
        }
      }

      // === PHASE 4: Enforce scraped list order on all linked items ===
      await this.enforceListOrder(configId, config.customOrderId);

      console.log(`[ListSync] checkForUpdates COMPLETE — added:${results.added} notInPlex:${results.notInPlex.length} errors:${results.errors.length}`);
      if (results.notInPlex.length > 0) {
        console.log(`[ListSync] ⛔ NOT IN PLEX:`, JSON.stringify(results.notInPlex));
      }

      await prisma.listScrapeConfig.update({
        where: { id: configId },
        data: {
          lastCheckedAt: new Date(),
          lastItemCount: scrapedItems.length,
          lastError: null
        }
      });

      return results;
    } catch (error) {
      await prisma.listScrapeConfig.update({
        where: { id: configId },
        data: {
          lastCheckedAt: new Date(),
          lastError: error.message
        }
      });
      throw error;
    }
  }

  /**
   * Check if an enriched item already exists in the custom order
   */
  async checkDuplicate(customOrderId, enrichedItem) {
    const mediaType = enrichedItem.mediaType;

    if (mediaType === 'movie') {
      if (enrichedItem.plexKey) {
        return await prisma.customOrderItem.findFirst({
          where: { customOrderId, plexKey: enrichedItem.plexKey }
        });
      }
      return await prisma.customOrderItem.findFirst({
        where: { customOrderId, mediaType: 'movie', title: enrichedItem.title }
      });
    }

    if (mediaType === 'episode') {
      if (enrichedItem.plexKey) {
        return await prisma.customOrderItem.findFirst({
          where: { customOrderId, plexKey: enrichedItem.plexKey }
        });
      }
      return await prisma.customOrderItem.findFirst({
        where: {
          customOrderId,
          mediaType: 'episode',
          seriesTitle: enrichedItem.seriesTitle,
          seasonNumber: enrichedItem.seasonNumber,
          episodeNumber: enrichedItem.episodeNumber
        }
      });
    }

    if (mediaType === 'comic') {
      return await prisma.customOrderItem.findFirst({
        where: {
          customOrderId,
          mediaType: 'comic',
          title: enrichedItem.title,
          comicSeries: enrichedItem.comicSeries || undefined
        }
      });
    }

    if (mediaType === 'book') {
      return await prisma.customOrderItem.findFirst({
        where: { customOrderId, mediaType: 'book', title: enrichedItem.title }
      });
    }

    if (mediaType === 'webvideo') {
      if (enrichedItem.webUrl) {
        return await prisma.customOrderItem.findFirst({
          where: { customOrderId, mediaType: 'webvideo', webUrl: enrichedItem.webUrl }
        });
      }
    }

    if (mediaType === 'game') {
      return await prisma.customOrderItem.findFirst({
        where: { customOrderId, mediaType: 'game', title: enrichedItem.title }
      });
    }

    // Generic fallback
    return await prisma.customOrderItem.findFirst({
      where: { customOrderId, title: enrichedItem.title, mediaType }
    });
  }
}

module.exports = ListScraperService;
