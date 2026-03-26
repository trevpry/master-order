const { PrismaClient } = require('@prisma/client');
const ListScraperService = require('./ListScraperService');
const ListItemMatcherService = require('./ListItemMatcherService');

const prisma = new PrismaClient();

class ListScrapeBackgroundService {
  constructor(tvdbService = null) {
    this.scraperService = new ListScraperService();
    this.matcherService = new ListItemMatcherService(tvdbService);
    this.isRunning = false;
    this.currentTimer = null;
    this.lastSyncStatus = null;
    this.syncInProgress = false;
  }

  async start() {
    if (this.isRunning) return;
    console.log('🔗 Starting background list scrape service...');
    this.isRunning = true;
    await this.scheduleNextCheck();
  }

  stop() {
    this.isRunning = false;
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    console.log('🔗 Stopped background list scrape service');
  }

  async scheduleNextCheck() {
    if (!this.isRunning) return;

    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const intervalHours = settings?.listScrapeInterval || 6;
      const intervalMs = intervalHours * 60 * 60 * 1000;

      console.log(`🔗 Next list scrape check in ${intervalHours} hours`);

      this.currentTimer = setTimeout(async () => {
        await this.performCheck();
        await this.scheduleNextCheck();
      }, intervalMs);
    } catch (error) {
      console.error('Error scheduling list scrape check:', error.message);
      // Fallback to 6 hours
      this.currentTimer = setTimeout(async () => {
        await this.performCheck();
        await this.scheduleNextCheck();
      }, 6 * 60 * 60 * 1000);
    }
  }

  async performCheck() {
    if (this.syncInProgress) {
      console.log('🔗 List scrape check already in progress, skipping');
      return;
    }

    console.log('🔗 Starting scheduled list scrape check...');
    this.syncInProgress = true;
    const startTime = Date.now();
    const results = [];

    try {
      const activeConfigs = await prisma.listScrapeConfig.findMany({
        where: { isActive: true },
        include: { customOrder: { select: { name: true } } }
      });

      console.log(`🔗 Found ${activeConfigs.length} active list scrape config(s)`);

      for (const config of activeConfigs) {
        const orderName = config.customOrder?.name || `config #${config.id} (unlinked)`;
        try {
          console.log(`🔗 Checking list for "${orderName}" (${config.url})`);
          const result = await this.scraperService.checkForUpdates(config.id, this.matcherService);
          results.push({
            orderId: config.customOrderId,
            orderName,
            ...result
          });
          if (result.added > 0) {
            console.log(`🔗 Added ${result.added} new item(s) to "${orderName}"`);
          }
        } catch (error) {
          console.error(`🔗 Error checking "${orderName}":`, error.message);
          results.push({
            orderId: config.customOrderId,
            orderName,
            error: error.message
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        duration: `${duration}s`,
        configsChecked: activeConfigs.length,
        results
      };
      console.log(`🔗 List scrape check completed in ${duration}s`);
    } catch (error) {
      console.error('🔗 List scrape check failed:', error.message);
      this.lastSyncStatus = {
        success: false,
        timestamp: new Date(),
        error: error.message,
        results
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      syncInProgress: this.syncInProgress,
      lastSyncStatus: this.lastSyncStatus
    };
  }
}

module.exports = ListScrapeBackgroundService;
