/**
 * Activity Stats Service
 * Handles additional statistics and custom order analytics
 */

const { PrismaClient } = require('@prisma/client');

class ActivityStatsService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
  }

  /**
   * Get statistics grouped by custom order
   * @param {string} period - Time period filter
   * @returns {Promise<Array>} Array of custom order statistics
   */
  async getCustomOrderStats(period = 'all') {
    try {
      const WatchUtilsService = require('./watchUtilsService');
      const utilsService = new WatchUtilsService(this.prisma);
      
      // Build date filter based on period using timezone-aware calculations
      const whereClause = {};
      
      let actualStartDate = null;
      let actualEndDate = null;

      if (period !== 'all') {
        const bounds = await utilsService.getTimezoneAwarePeriodBounds(period);
        actualStartDate = bounds.startDate;
        actualEndDate = bounds.endDate;
      }

      // Apply date filter if dates are set
      if (actualStartDate || actualEndDate) {
        const dateFilter = {};
        if (actualStartDate) dateFilter.gte = actualStartDate;
        if (actualEndDate) dateFilter.lte = actualEndDate;
        whereClause.startTime = dateFilter;
      }

      // Only include items that have a customOrderItemId
      whereClause.customOrderItemId = { not: null };

      // First get all relevant watch logs with custom order items
      const watchLogs = await this.prisma.watchLog.findMany({
        where: whereClause,
        include: {
          customOrderItem: {
            include: {
              customOrder: true
            }
          }
        }
      });

      // Group by custom order
      const orderStats = {};
      
      watchLogs.forEach(log => {
        if (!log.customOrderItem?.customOrder) return;
        
        const orderId = log.customOrderItem.customOrder.id;
        const orderName = log.customOrderItem.customOrder.name;
        
        if (!orderStats[orderId]) {
          orderStats[orderId] = {
            customOrderName: orderName,
            totalWatchTime: 0,
            totalReadTime: 0,
            totalTvEpisodes: 0,
            totalMovies: 0,
            totalWebVideos: 0,
            totalBooks: 0,
            totalComics: 0,
            totalShortStories: 0,
            items: []
          };
        }

        const time = log.totalWatchTime || log.duration || 0;
        
        if (log.mediaType === 'tv') {
          orderStats[orderId].totalTvEpisodes++;
          orderStats[orderId].totalWatchTime += time;
        } else if (log.mediaType === 'movie') {
          orderStats[orderId].totalMovies++;
          orderStats[orderId].totalWatchTime += time;
        } else if (log.mediaType === 'webvideo') {
          orderStats[orderId].totalWebVideos++;
          orderStats[orderId].totalWatchTime += time;
        } else if (log.mediaType === 'book') {
          orderStats[orderId].totalBooks++;
          orderStats[orderId].totalReadTime += time;
        } else if (log.mediaType === 'comic') {
          orderStats[orderId].totalComics++;
          orderStats[orderId].totalReadTime += time;
        } else if (log.mediaType === 'shortstory') {
          orderStats[orderId].totalShortStories++;
          orderStats[orderId].totalReadTime += time;
        }
        
        orderStats[orderId].items.push(log);
      });

      // Convert to array and add formatted times
      return Object.values(orderStats).map(stats => {
        return utilsService.addFormattedTimeFields(stats);
      });
    } catch (error) {
      console.error('Error getting custom order stats:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a specific media type
   * @param {string} mediaType - The media type to get stats for
   * @param {string} period - Time period for the stats
   * @param {string} groupBy - How to group the time-based data
   * @param {string} actorSortBy - How to sort TV actors (for TV stats)
   * @param {string} movieActorSortBy - How to sort movie actors (for movie stats)
   * @returns {Promise<Object>} Media type specific statistics
   */
  async getMediaTypeStats(mediaType, period = 'all', groupBy = 'day', actorSortBy, movieActorSortBy) {
    try {
      const WatchUtilsService = require('./watchUtilsService');
      const utilsService = new WatchUtilsService(this.prisma);
      
      console.log(`Getting stats for media type: ${mediaType}, period: ${period}`);
      
      // Build date filter based on period using timezone-aware calculations
      const whereClause = { mediaType };
      
      let actualStartDate = null;
      let actualEndDate = null;

      if (period !== 'all') {
        const bounds = await utilsService.getTimezoneAwarePeriodBounds(period);
        actualStartDate = bounds.startDate;
        actualEndDate = bounds.endDate;
      }

      // Apply date filter if dates are set
      if (actualStartDate || actualEndDate) {
        const dateFilter = {};
        if (actualStartDate) dateFilter.gte = actualStartDate;
        if (actualEndDate) dateFilter.lte = actualEndDate;
        whereClause.startTime = dateFilter;
      }

      // Get all logs for this media type in the date range
      const watchLogs = await this.prisma.watchLog.findMany({
        where: whereClause,
        orderBy: { startTime: 'asc' },
        include: {
          customOrderItem: {
            include: {
              customOrder: true
            }
          }
        }
      });

      console.log(`Found ${watchLogs.length} watch logs for ${mediaType}`);

      // Basic statistics
      const stats = {
        totalItems: watchLogs.length,
        totalTime: watchLogs.reduce((sum, log) => sum + (log.totalWatchTime || log.duration || 0), 0),
        items: watchLogs
      };

      // Add media-type specific processing
      if (mediaType === 'tv') {
        stats.totalEpisodes = watchLogs.length;
        stats.uniqueSeries = [...new Set(watchLogs.map(log => log.seriesTitle))].length;
      } else if (mediaType === 'movie') {
        stats.totalMovies = watchLogs.length;
      } else if (mediaType === 'webvideo') {
        stats.totalWebVideos = watchLogs.length;
      }

      // Add formatted time fields
      return utilsService.addFormattedTimeFields(stats);
    } catch (error) {
      console.error('Error getting media type stats:', error);
      throw error;
    }
  }

  /**
   * Get daily activity summary
   * @param {Date} date - Specific date to get summary for (optional, defaults to today)
   * @returns {Promise<Object>} Daily activity summary
   */
  async getDailyStats(date) {
    try {
      const WatchStatsService = require('./watchStatsService');
      const statsService = new WatchStatsService(this.prisma);
      
      if (!date) {
        return await statsService.getTodayStats();
      }

      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      return await statsService.getWatchStats({
        startDate,
        endDate,
        groupBy: 'day'
      });
    } catch (error) {
      console.error('Error getting daily stats:', error);
      throw error;
    }
  }

  /**
   * Get monthly activity summary
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Object>} Monthly activity summary
   */
  async getMonthlyStats(year, month) {
    try {
      const WatchStatsService = require('./watchStatsService');
      const statsService = new WatchStatsService(this.prisma);
      
      const startDate = new Date(year, month - 1, 1); // month is 0-indexed in Date constructor
      const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

      return await statsService.getWatchStats({
        startDate,
        endDate,
        groupBy: 'month'
      });
    } catch (error) {
      console.error('Error getting monthly stats:', error);
      throw error;
    }
  }

  /**
   * Get activity trends over time
   * @param {string} period - Period to analyze ('week', 'month', 'year')
   * @param {number} count - Number of periods to include
   * @returns {Promise<Array>} Array of period statistics
   */
  async getActivityTrends(period = 'week', count = 12) {
    try {
      const WatchStatsService = require('./watchStatsService');
      const statsService = new WatchStatsService(this.prisma);
      
      const trends = [];
      const now = new Date();
      
      for (let i = 0; i < count; i++) {
        let startDate, endDate;
        
        if (period === 'week') {
          endDate = new Date(now);
          endDate.setDate(now.getDate() - (i * 7));
          startDate = new Date(endDate);
          startDate.setDate(endDate.getDate() - 6);
        } else if (period === 'month') {
          endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
          startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        } else if (period === 'year') {
          endDate = new Date(now.getFullYear() - i, 11, 31);
          startDate = new Date(now.getFullYear() - i, 0, 1);
        }

        const periodStats = await statsService.getWatchStats({
          startDate,
          endDate,
          groupBy: period
        });

        trends.unshift({
          period: period,
          startDate,
          endDate,
          ...periodStats.totalStats
        });
      }

      return trends;
    } catch (error) {
      console.error('Error getting activity trends:', error);
      throw error;
    }
  }
}

module.exports = ActivityStatsService;
