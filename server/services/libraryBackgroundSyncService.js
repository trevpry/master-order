const prisma = require('../prismaClient');

/**
 * Generic interval-based background sync runner, generalized from
 * server/backgroundSyncService.js (Plex) so it can drive both the Radarr
 * and Sonarr sync services without duplicating the scheduling logic.
 * See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 1).
 */
class LibraryBackgroundSyncService {
  /**
   * @param {object} options
   * @param {string} options.providerName - "radarr" | "sonarr" (used in logs only)
   * @param {{ fullSync: (trigger: string) => Promise<any> }} options.syncService
   * @param {string} options.intervalSettingsKey - Settings column holding the interval in hours
   * @param {number} [options.defaultIntervalHours=12]
   */
  constructor({ providerName, syncService, intervalSettingsKey, defaultIntervalHours = 12 }) {
    this.providerName = providerName;
    this.syncService = syncService;
    this.intervalSettingsKey = intervalSettingsKey;
    this.defaultIntervalHours = defaultIntervalHours;

    this.isRunning = false;
    this.currentTimer = null;
    this.lastSyncStatus = null;
    this.syncInProgress = false;
  }

  async start() {
    if (this.isRunning) {
      console.log(`${this.providerName} background sync service is already running`);
      return;
    }

    console.log(`Starting background ${this.providerName} sync service...`);
    this.isRunning = true;

    await this.scheduleNextSync();

    console.log(`Background ${this.providerName} sync service started`);
  }

  async stop() {
    if (!this.isRunning) {
      console.log(`${this.providerName} background sync service is not running`);
      return;
    }

    console.log(`Stopping background ${this.providerName} sync service...`);
    this.isRunning = false;

    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }

    console.log(`Background ${this.providerName} sync service stopped`);
  }

  async scheduleNextSync() {
    if (!this.isRunning) return;

    try {
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const syncIntervalHours = settings?.[this.intervalSettingsKey] || this.defaultIntervalHours;
      const intervalMs = syncIntervalHours * 60 * 60 * 1000;

      console.log(`Next ${this.providerName} sync scheduled in ${syncIntervalHours} hours`);

      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
      }

      this.currentTimer = setTimeout(async () => {
        await this.performSync();
        await this.scheduleNextSync();
      }, intervalMs);
    } catch (error) {
      console.error(`Error scheduling next ${this.providerName} sync:`, error);
      this.currentTimer = setTimeout(async () => {
        await this.performSync();
        await this.scheduleNextSync();
      }, this.defaultIntervalHours * 60 * 60 * 1000);
    }
  }

  async performSync(trigger = 'background') {
    if (this.syncInProgress) {
      console.log(`${this.providerName} sync already in progress, skipping scheduled sync`);
      return;
    }

    console.log(`Starting scheduled ${this.providerName} sync...`);
    this.syncInProgress = true;

    try {
      const startTime = Date.now();
      const result = await this.syncService.fullSync(trigger);
      const duration = (Date.now() - startTime) / 1000;

      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        duration: `${duration}s`,
        totalItems: result.totalItems,
        added: result.added,
        updated: result.updated,
        removed: result.removed,
        message: `Background ${this.providerName} sync completed: ${result.added} added, ${result.updated} updated, ${result.removed} removed in ${duration}s`,
      };

      console.log(`Background ${this.providerName} sync completed successfully:`, this.lastSyncStatus.message);
    } catch (error) {
      console.error(`Background ${this.providerName} sync failed:`, error);

      this.lastSyncStatus = {
        success: false,
        timestamp: new Date(),
        error: error.message,
        message: `Background ${this.providerName} sync failed: ${error.message}`,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async forceSyncNow() {
    if (this.syncInProgress) {
      throw new Error(`${this.providerName} sync already in progress`);
    }

    await this.performSync(`${this.providerName}-forced`);
    await this.scheduleNextSync();

    return this.lastSyncStatus;
  }

  getSyncStatus() {
    return {
      provider: this.providerName,
      isRunning: this.isRunning,
      syncInProgress: this.syncInProgress,
      lastSyncStatus: this.lastSyncStatus,
    };
  }
}

module.exports = LibraryBackgroundSyncService;
