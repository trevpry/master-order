/**
 * Statistics service for watch activity data
 */

const { getTimezoneAwarePeriodBounds } = require('../utils/timezoneUtils');
const { getSettings } = require('../databaseUtils');

class StatisticsService {
  constructor(prisma, watchLogService) {
    this.prisma = prisma;
    this.watchLogService = watchLogService;
  }

  /**
   * Get timezone-aware period boundaries for statistics filtering
   */
  async getTimezoneAwarePeriodBounds(period) {
    const { getSettings } = require('../databaseUtils');
    const settings = await getSettings();
    const timezone = settings?.timezone || 'UTC';
    
    return getTimezoneAwarePeriodBounds(period, timezone);
  }

  /**
   * Get statistics for today in the configured timezone
   */
  async getTodayStats() {
    return this.watchLogService.getTodayStats();
  }

  /**
   * Get all activity statistics with timezone-aware filtering
   */
  async getAllActivityStats(period = 'all', groupBy = 'day') {
    return this.watchLogService.getAllActivityStats(period, groupBy);
  }

  /**
   * Get custom order statistics with timezone-aware filtering
   */
  async getCustomOrderStats(period = 'all') {
    return this.watchLogService.getCustomOrderStats(period);
  }

  /**
   * Get media type specific statistics with timezone-aware filtering
   */
  async getMediaTypeStats(mediaType, period = 'all', groupBy = 'day', actorSortBy, movieActorSortBy) {
    // Build date filter based on period using timezone-aware calculations
    const whereClause = { mediaType };
    
    let actualStartDate = null;
    let actualEndDate = null;

    if (period !== 'all') {
      const bounds = await this.getTimezoneAwarePeriodBounds(period);
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

    // Delegate to the main watchLogService for detailed processing
    return this.watchLogService.getMediaTypeStats(mediaType, period, groupBy, actorSortBy, movieActorSortBy);
  }
}

module.exports = StatisticsService;
