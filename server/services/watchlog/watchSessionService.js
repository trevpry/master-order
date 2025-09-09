/**
 * Watch Session Service
 * Handles watch session management (start/complete/log)
 */

class WatchSessionService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Start a watch session for an item
   * @param {Object} params - Watch session parameters
   * @param {string} params.mediaType - 'tv' or 'movie'
   * @param {string} params.title - Title of the content
   * @param {string} params.seriesTitle - Series title (for TV episodes)
   * @param {number} params.seasonNumber - Season number (for TV episodes)
   * @param {number} params.episodeNumber - Episode number (for TV episodes)
   * @param {string} params.plexKey - Plex key if available
   * @param {number} params.customOrderItemId - Custom order item ID if applicable
   * @param {number} params.duration - Expected duration in minutes
   * @returns {Promise<Object>} The created watch log entry
   */
  async startWatching(params) {
    try {
      // Validate customOrderItemId exists if provided
      if (params.customOrderItemId) {
        const existingItem = await this.prisma.customOrderItem.findUnique({
          where: { id: params.customOrderItemId }
        });
        
        if (!existingItem) {
          console.log(`⚠️  CustomOrderItem ${params.customOrderItemId} not found in startWatching - removing link`);
          params.customOrderItemId = null;
        }
      }

      const watchLog = await this.prisma.watchLog.create({
        data: {
          mediaType: params.mediaType,
          title: params.title,
          seriesTitle: params.seriesTitle || null,
          seasonNumber: params.seasonNumber || null,
          episodeNumber: params.episodeNumber || null,
          plexKey: params.plexKey || null,
          customOrderItemId: params.customOrderItemId || null,
          startTime: new Date(),
          endTime: null,
          duration: params.duration || null,
          totalWatchTime: 0,
          isCompleted: false
        }
      });

      console.log(`Started watch session for ${params.mediaType}: ${params.title}`);
      return watchLog;
    } catch (error) {
      console.error('Error starting watch session:', error);
      // If it's a foreign key constraint error, provide more helpful information
      if (error.code === 'P2003' || error.message.includes('Foreign key constraint')) {
        console.error('❌ Foreign key constraint violation - CustomOrderItem may not exist');
        throw new Error('Invalid customOrderItemId: Referenced item does not exist');
      }
      throw error;
    }
  }

  /**
   * Complete a watch session
   * @param {number} watchLogId - ID of the watch log to complete
   * @param {Object} params - Completion parameters
   * @param {number} params.totalWatchTime - Total time watched in minutes
   * @param {boolean} params.isCompleted - Whether the content was fully watched
   * @returns {Promise<Object>} The updated watch log entry
   */
  async completeWatching(watchLogId, params = {}) {
    try {
      const endTime = new Date();
      
      const watchLog = await this.prisma.watchLog.update({
        where: { id: watchLogId },
        data: {
          endTime: endTime,
          totalWatchTime: params.totalWatchTime || null,
          isCompleted: params.isCompleted !== undefined ? params.isCompleted : true,
          updatedAt: endTime
        }
      });

      console.log(`Completed watch session for ID ${watchLogId}`);
      return watchLog;
    } catch (error) {
      console.error('Error completing watch session:', error);
      throw error;
    }
  }

  /**
   * Log a watched item (simple method for when start time isn't tracked)
   * @param {Object} params - Watch log parameters
   * @returns {Promise<Object>} The created watch log entry
   */
  async logWatched(params) {
    try {
      // Validate customOrderItemId exists if provided
      if (params.customOrderItemId) {
        const existingItem = await this.prisma.customOrderItem.findUnique({
          where: { id: params.customOrderItemId }
        });
        
        if (!existingItem) {
          console.log(`⚠️  CustomOrderItem ${params.customOrderItemId} not found in logWatched - removing link`);
          params.customOrderItemId = null;
        }
      }

      const now = new Date();
      const startTime = params.startTime || new Date(now.getTime() - (params.duration || 30) * 60000);
      
      const watchLog = await this.prisma.watchLog.create({
        data: {
          mediaType: params.mediaType,
          title: params.title,
          seriesTitle: params.seriesTitle || null,
          seasonNumber: params.seasonNumber || null,
          episodeNumber: params.episodeNumber || null,
          plexKey: params.plexKey || null,
          customOrderItemId: params.customOrderItemId || null,
          startTime: startTime,
          endTime: now,
          duration: params.duration || null,
          totalWatchTime: params.totalWatchTime || params.duration || null,
          isCompleted: params.isCompleted !== undefined ? params.isCompleted : true
        }
      });

      console.log(`Logged watched ${params.mediaType}: ${params.title}`);
      return watchLog;
    } catch (error) {
      console.error('Error logging watched item:', error);
      // If it's a foreign key constraint error, provide more helpful information
      if (error.code === 'P2003' || error.message.includes('Foreign key constraint')) {
        console.error('❌ Foreign key constraint violation - CustomOrderItem may not exist');
        throw new Error('Invalid customOrderItemId: Referenced item does not exist');
      }
      throw error;
    }
  }
}

module.exports = WatchSessionService;
