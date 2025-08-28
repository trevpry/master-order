const StashSyncService = require('./stashSyncService');
const StashSyncServiceOptimized = require('./stashSyncServiceOptimized');
const prisma = require('./prismaClient');

class StashBackgroundSyncService {
  constructor() {
    this.syncService = null;
    this.syncServiceOptimized = null;
    this.isRunning = false;
    this.currentTimer = null;
    this.lastSyncStatus = null;
    this.syncInProgress = false;
    
    // Configuration for sync service type
    this.syncType = process.env.STASH_SYNC_OPTIMIZED === 'false' ? 'legacy' : 'optimized';
  }

  async initializeSyncService() {
    if (!this.syncService || !this.syncServiceOptimized) {
      this.syncService = new StashSyncService();
      this.syncServiceOptimized = new StashSyncServiceOptimized();
      console.log(`Background sync initialized with ${this.syncType} service`);
    }
  }

  getActiveSyncService() {
    return this.syncType === 'optimized' ? this.syncServiceOptimized : this.syncService;
  }

  async start() {
    if (this.isRunning) {
      console.log('Background Stash sync service is already running');
      return;
    }

    console.log('Starting background Stash sync service...');
    this.isRunning = true;
    
    // Initialize the sync service
    await this.initializeSyncService();
    
    // Schedule the first sync immediately
    await this.scheduleNextSync();
    
    console.log('Background Stash sync service started');
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Background Stash sync service is not running');
      return;
    }

    console.log('Stopping background Stash sync service...');
    this.isRunning = false;
    
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    
    console.log('Background Stash sync service stopped');
  }

  async scheduleNextSync() {
    if (!this.isRunning) return;

    try {
      // Get sync interval from settings
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      const syncInterval = settings?.stashSyncInterval || 24; // Default to 24 hours
      const intervalMs = syncInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      
      console.log(`Next Stash sync scheduled in ${syncInterval} hours`);
      
      // Clear any existing timer
      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
      }
      
      // Schedule the next sync
      this.currentTimer = setTimeout(async () => {
        await this.performSync();
        await this.scheduleNextSync(); // Schedule the next one
      }, intervalMs);
      
    } catch (error) {
      console.error('Error scheduling next Stash sync:', error);
      // Fallback to default interval if there's an error
      this.currentTimer = setTimeout(async () => {
        await this.performSync();
        await this.scheduleNextSync();
      }, 24 * 60 * 60 * 1000); // 24 hours
    }
  }

  async performSync() {
    if (this.syncInProgress) {
      console.log('Stash sync already in progress, skipping scheduled sync');
      return;
    }

    console.log(`Starting scheduled Stash sync (${this.syncType})...`);
    this.syncInProgress = true;

    try {
      // Make sure sync services are initialized
      await this.initializeSyncService();
      
      const activeSyncService = this.getActiveSyncService();
      if (!activeSyncService) {
        throw new Error('Stash sync service not configured');
      }

      const startTime = Date.now();
      
      // Use optimized sync if available, fallback to legacy
      const result = this.syncType === 'optimized' && activeSyncService.fullSyncOptimized
        ? await activeSyncService.fullSyncOptimized()
        : await activeSyncService.fullSync();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        duration: `${duration}s`,
        syncType: this.syncType,
        results: result,
        performanceImprovement: result?.performanceImprovement || null,
        message: `Background Stash sync (${this.syncType}) completed in ${duration}s`
      };
      
      console.log('Background Stash sync completed successfully:', this.lastSyncStatus.message);
      
      if (this.lastSyncStatus.performanceImprovement) {
        console.log(`Performance: ${this.lastSyncStatus.performanceImprovement.speedup}x faster than baseline`);
      }
      
    } catch (error) {
      console.error(`Background Stash sync (${this.syncType}) failed:`, error);
      
      this.lastSyncStatus = {
        success: false,
        timestamp: new Date(),
        syncType: this.syncType,
        error: error.message,
        message: `Background Stash sync (${this.syncType}) failed: ${error.message}`
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Force a sync now (used by manual triggers)
  async forceSyncNow() {
    if (this.syncInProgress) {
      throw new Error('Stash sync already in progress');
    }
    
    await this.performSync();
    
    // Reschedule the next automatic sync
    await this.scheduleNextSync();
    
    return this.lastSyncStatus;
  }

  // Get current sync status
  getSyncStatus() {
    return {
      isRunning: this.isRunning,
      syncInProgress: this.syncInProgress,
      lastSync: this.lastSyncStatus,
      nextSyncTime: this.currentTimer ? new Date(Date.now() + this.currentTimer._idleTimeout) : null
    };
  }

  // Update sync interval (called when settings change)
  async updateSyncInterval() {
    if (this.isRunning) {
      console.log('Updating Stash sync interval...');
      await this.scheduleNextSync(); // This will read the new interval and reschedule
    }
  }
}

module.exports = StashBackgroundSyncService;
