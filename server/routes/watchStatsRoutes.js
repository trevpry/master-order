/**
 * Watch statistics API route handlers
 */

const { getTimezoneAwarePeriodBounds } = require('../utils/timezoneUtils');

class WatchStatsRoutes {
  constructor(watchLogService, statisticsService) {
    this.watchLogService = watchLogService;
    this.statisticsService = statisticsService;
  }

  /**
   * GET /api/watch-stats - Main watch statistics endpoint
   */
  async getWatchStats(req, res) {
    try {
      const { 
        startDate, 
        endDate, 
        groupBy = 'day',
        period = 'week' // 'today', 'week', 'month', 'year', 'all', or 'custom'
      } = req.query;

      // Get timezone setting
      const { getSettings } = require('../databaseUtils');
      const settings = await getSettings();
      const timezone = settings?.timezone || 'UTC';

      let actualStartDate = null;
      let actualEndDate = null;

      // Handle predefined periods with timezone awareness
      if (period !== 'custom' && period !== 'all') {
        const bounds = getTimezoneAwarePeriodBounds(period, timezone);
        actualStartDate = bounds.startDate;
        actualEndDate = bounds.endDate;
        
        if (actualStartDate && actualEndDate) {
          console.log(`Filtering for ${period} in timezone ${timezone}`);
          console.log(`Start: ${actualStartDate.toISOString()}, End: ${actualEndDate.toISOString()}`);
        }
      } else if (period === 'custom') {
        if (startDate) actualStartDate = new Date(startDate);
        if (endDate) actualEndDate = new Date(endDate);
      }
      // For 'all' period, no date filtering (actualStartDate and actualEndDate remain null)

      const stats = await this.watchLogService.getWatchStats({
        startDate: actualStartDate,
        endDate: actualEndDate,
        groupBy: groupBy
      });
      
      console.log('DEBUG: Overview stats result:', {
        totalWatchTime: stats?.totalStats?.totalWatchTime,
        totalLogs: stats?.totalStats?.totalLogs,
        groupedStatsLength: stats?.groupedStats?.length
      });
      
      // Add formatted time strings
      if (stats.totalStats) {
        stats.totalStats.totalWatchTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalWatchTime || 0);
        stats.totalStats.totalTvWatchTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalTvWatchTime || 0);
        stats.totalStats.totalMovieWatchTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalMovieWatchTime || 0);
        stats.totalStats.totalReadTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalReadTime || 0);
        stats.totalStats.totalBookReadTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalBookReadTime || 0);
        stats.totalStats.totalComicReadTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalComicReadTime || 0);
        stats.totalStats.totalShortStoryReadTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalShortStoryReadTime || 0);
        stats.totalStats.totalWebVideoViewTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalWebVideoViewTime || 0);
        stats.totalStats.totalActivityTimeFormatted = this.watchLogService.formatWatchTime(stats.totalStats.totalActivityTime || 0);
      }

      res.json(stats);
    } catch (error) {
      console.error('Error getting watch statistics:', error);
      res.status(500).json({ error: 'Failed to get watch statistics' });
    }
  }

  /**
   * GET /api/watch-stats/recent - Recent activity
   */
  async getRecentActivity(req, res) {
    try {
      const { limit = 20 } = req.query;
      const recentActivity = await this.watchLogService.getRecentActivity(parseInt(limit));
      
      // Add formatted times
      const formattedActivity = recentActivity.map(log => ({
        ...log,
        durationFormatted: this.watchLogService.formatWatchTime(log.duration),
        totalWatchTimeFormatted: this.watchLogService.formatWatchTime(log.totalWatchTime)
      }));

      res.json(formattedActivity);
    } catch (error) {
      console.error('Error getting recent watch activity:', error);
      res.status(500).json({ error: 'Failed to get recent watch activity' });
    }
  }

  /**
   * GET /api/watch-stats/today - Today's statistics
   */
  async getTodayStats(req, res) {
    try {
      const todayStats = await this.statisticsService.getTodayStats();
      
      // Add formatted time strings for watch activities
      todayStats.totalStats.totalWatchTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalWatchTime);
      todayStats.totalStats.totalTvWatchTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalTvWatchTime);
      todayStats.totalStats.totalMovieWatchTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalMovieWatchTime);
      
      // Add formatted time strings for reading activities
      todayStats.totalStats.totalReadTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalReadTime || 0);
      todayStats.totalStats.totalBookReadTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalBookReadTime || 0);
      todayStats.totalStats.totalComicReadTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalComicReadTime || 0);
      todayStats.totalStats.totalShortStoryReadTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalShortStoryReadTime || 0);
      todayStats.totalStats.totalActivityTimeFormatted = this.watchLogService.formatWatchTime(todayStats.totalStats.totalActivityTime || 0);

      res.json(todayStats);
    } catch (error) {
      console.error('Error getting today\'s watch statistics:', error);
      res.status(500).json({ error: 'Failed to get today\'s watch statistics' });
    }
  }

  /**
   * GET /api/watch-stats/custom-orders - Custom order statistics
   */
  async getCustomOrderStats(req, res) {
    try {
      const { period = 'all' } = req.query;
      const customOrderStats = await this.statisticsService.getCustomOrderStats(period);
      
      res.json(customOrderStats);
    } catch (error) {
      console.error('Error getting custom order statistics:', error);
      res.status(500).json({ error: 'Failed to get custom order statistics' });
    }
  }

  /**
   * GET /api/watch-stats/media-type/:mediaType - Media type specific statistics
   */
  async getMediaTypeStats(req, res) {
    try {
      const { mediaType } = req.params;
      const { period = 'all', groupBy = 'day', actorSortBy, movieActorSortBy } = req.query;
      
      console.log(`DEBUG: Media type stats requested for: ${mediaType}, period: ${period}`);
      
      const validMediaTypes = ['tv', 'movie', 'webvideo', 'book', 'comic', 'shortstory'];
      if (!validMediaTypes.includes(mediaType)) {
        return res.status(400).json({ error: 'Invalid media type' });
      }
      
      const mediaTypeStats = await this.statisticsService.getMediaTypeStats(mediaType, period, groupBy, actorSortBy, movieActorSortBy);
      
      console.log(`DEBUG: ${mediaType} stats result:`, {
        totalCount: mediaTypeStats?.totalCount,
        logsLength: mediaTypeStats?.logs?.length,
        period: mediaTypeStats?.period,
        firstFewLogs: mediaTypeStats?.logs?.slice(0, 3).map(log => ({
          title: log.title,
          seriesTitle: log.seriesTitle,
          plexKey: log.plexKey,
          mediaType: log.mediaType
        }))
      });
      
      res.json(mediaTypeStats);
    } catch (error) {
      console.error(`Error getting ${req.params.mediaType} statistics:`, error);
      res.status(500).json({ error: `Failed to get ${req.params.mediaType} statistics` });
    }
  }

  /**
   * GET /api/watch-stats/all-activity - All activity across media types
   */
  async getAllActivity(req, res) {
    try {
      console.log('All activity endpoint called with query:', req.query);
      const { period = 'all', groupBy = 'day' } = req.query;
      
      console.log('Calling getAllActivityStats with period:', period, 'groupBy:', groupBy);
      const allActivityStats = await this.statisticsService.getAllActivityStats(period, groupBy);
      
      console.log('All activity stats result:', {
        totalCount: allActivityStats?.totalCount,
        logsLength: allActivityStats?.logs?.length,
        period: allActivityStats?.period
      });
      
      res.json(allActivityStats);
    } catch (error) {
      console.error('Error getting all activity statistics:', error);
      res.status(500).json({ error: 'Failed to get all activity statistics' });
    }
  }
}

module.exports = WatchStatsRoutes;
