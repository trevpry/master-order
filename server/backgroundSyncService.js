const PlexSyncService = require('./plexSyncService');
const prisma = require('./prismaClient');

class BackgroundSyncService {
  constructor() {
    this.syncService = new PlexSyncService();
    this.isRunning = false;
    this.currentTimer = null;
    this.lastSyncStatus = null;
    this.syncInProgress = false;
  }

  async start() {
    if (this.isRunning) {
      console.log('Background sync service is already running');
      return;
    }

    console.log('Starting background Plex sync service...');
    this.isRunning = true;
    
    // Schedule the first sync immediately
    await this.scheduleNextSync();
    
    console.log('Background Plex sync service started');
  }

  async stop() {
    if (!this.isRunning) {
      console.log('Background sync service is not running');
      return;
    }

    console.log('Stopping background Plex sync service...');
    this.isRunning = false;
    
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    
    console.log('Background Plex sync service stopped');
  }

  async scheduleNextSync() {
    if (!this.isRunning) return;

    try {
      // Get sync interval from settings
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      const syncInterval = settings?.plexSyncInterval || 12; // Default to 12 hours
      const intervalMs = syncInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      
      console.log(`Next Plex sync scheduled in ${syncInterval} hours`);
      
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
      console.error('Error scheduling next sync:', error);
      // Fallback to default interval if there's an error
      this.currentTimer = setTimeout(async () => {
        await this.performSync();
        await this.scheduleNextSync();
      }, 12 * 60 * 60 * 1000); // 12 hours
    }
  }

  async performSync() {
    if (this.syncInProgress) {
      console.log('Sync already in progress, skipping scheduled sync');
      return;
    }

    console.log('Starting scheduled Plex sync...');
    this.syncInProgress = true;

    try {
      const startTime = Date.now();
      
      // Perform the sync using existing sync service
      const result = await this.syncService.fullSync();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      this.lastSyncStatus = {
        success: true,
        timestamp: new Date(),
        duration: `${duration}s`,
        sections: result.sections,
        totalShows: result.totalShows,
        totalMovies: result.totalMovies,
        message: `Background sync completed: ${result.totalShows} shows, ${result.totalMovies} movies in ${duration}s`
      };
      
      console.log('Background Plex sync completed successfully:', this.lastSyncStatus.message);
      
    } catch (error) {
      console.error('Background Plex sync failed:', error);
      
      this.lastSyncStatus = {
        success: false,
        timestamp: new Date(),
        error: error.message,
        message: `Background sync failed: ${error.message}`
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Force a sync now (used by manual triggers)
  async forceSyncNow() {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
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
      console.log('Updating sync interval...');
      await this.scheduleNextSync(); // This will read the new interval and reschedule
    }
  }
}

module.exports = BackgroundSyncService;
