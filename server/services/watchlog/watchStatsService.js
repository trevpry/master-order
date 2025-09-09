/**
 * Watch Stats Service
 * Handles statistics, analytics, and reporting
 */

const { PrismaClient } = require('@prisma/client');

class WatchStatsService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
  }

  /**
   * Get watch statistics for a date range
   * @param {Object} params - Query parameters
   * @param {Date} params.startDate - Start date for the range
   * @param {Date} params.endDate - End date for the range
   * @param {string} params.groupBy - 'day', 'week', 'month', or 'year'
   * @returns {Promise<Object>} Watch statistics
   */
  async getWatchStats(params = {}) {
    try {
      const { startDate, endDate, groupBy = 'day' } = params;
      
      // Build date filter
      const dateFilter = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      
      const whereClause = {};
      if (Object.keys(dateFilter).length > 0) {
        whereClause.startTime = dateFilter;
      }

      // Get all watch logs in the date range
      const watchLogs = await this.prisma.watchLog.findMany({
        where: whereClause,
        orderBy: { startTime: 'asc' }
      });

      // Group the data based on the groupBy parameter
      const groupedStats = await this.groupWatchStats(watchLogs, groupBy);
      
      // Calculate totals
      const totalStats = this.calculateTotalStats(watchLogs);

      return {
        totalStats,
        groupedStats,
        totalEntries: watchLogs.length
      };
    } catch (error) {
      console.error('Error getting watch stats:', error);
      throw error;
    }
  }

  /**
   * Group watch statistics by time period
   * @param {Array} watchLogs - Array of watch log entries
   * @param {string} groupBy - Grouping period ('day', 'week', 'month', 'year')
   * @returns {Promise<Array>} Grouped statistics
   */
  async groupWatchStats(watchLogs, groupBy) {
    const grouped = {};
    
    // Get timezone setting
    const { getSettings } = require('../../databaseUtils');
    const settings = await getSettings();
    const timezone = settings?.timezone || 'UTC';

    watchLogs.forEach(log => {
      // Convert the UTC timestamp to the configured timezone
      const utcDate = new Date(log.startTime);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const parts = formatter.formatToParts(utcDate);
      const year = parseInt(parts.find(part => part.type === 'year').value);
      const month = parseInt(parts.find(part => part.type === 'month').value);
      const day = parseInt(parts.find(part => part.type === 'day').value);
      
      let key;

      switch (groupBy) {
        case 'day':
          key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
          weekStart.setDate(day - weekStart.getDay());
          key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
          break;
        case 'month':
          key = `${year}-${String(month).padStart(2, '0')}`;
          break;
        case 'year':
          key = year.toString();
          break;
        default:
          key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          displayDate: new Date(year, month - 1, day), // Local date object for display
          tvEpisodes: 0,
          movies: 0,
          webVideos: 0,
          books: 0,
          comics: 0,
          shortStories: 0,
          tvWatchTime: 0,
          movieWatchTime: 0,
          webVideoViewTime: 0,
          bookReadTime: 0,
          comicReadTime: 0,
          shortStoryReadTime: 0,
          totalWatchTime: 0,
          totalReadTime: 0,
          entries: []
        };
      }

      const watchTime = log.totalWatchTime || log.duration || 0;
      
      if (log.mediaType === 'tv') {
        grouped[key].tvEpisodes++;
        grouped[key].tvWatchTime += watchTime;
        grouped[key].totalWatchTime += watchTime;
      } else if (log.mediaType === 'movie') {
        grouped[key].movies++;
        grouped[key].movieWatchTime += watchTime;
        grouped[key].totalWatchTime += watchTime;
      } else if (log.mediaType === 'webvideo') {
        grouped[key].webVideos++;
        grouped[key].webVideoViewTime += watchTime;
        grouped[key].totalWatchTime += watchTime;
      } else if (log.mediaType === 'book') {
        grouped[key].books++;
        grouped[key].bookReadTime += watchTime;
        grouped[key].totalReadTime += watchTime;
      } else if (log.mediaType === 'comic') {
        grouped[key].comics++;
        grouped[key].comicReadTime += watchTime;
        grouped[key].totalReadTime += watchTime;
      } else if (log.mediaType === 'shortstory') {
        grouped[key].shortStories++;
        grouped[key].shortStoryReadTime += watchTime;
        grouped[key].totalReadTime += watchTime;
      }
      
      grouped[key].entries.push(log);
    });

    // Convert to array and sort by period
    return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate total statistics
   * @param {Array} watchLogs - Array of watch log entries
   * @returns {Object} Total statistics
   */
  calculateTotalStats(watchLogs) {
    let totalTvEpisodes = 0;
    let totalMovies = 0;
    let totalBooks = 0;
    let totalComics = 0;
    let totalShortStories = 0;
    let totalWebVideos = 0;
    let totalTvWatchTime = 0;
    let totalMovieWatchTime = 0;
    let totalBookReadTime = 0;
    let totalComicReadTime = 0;
    let totalShortStoryReadTime = 0;
    let totalWebVideoViewTime = 0;

    watchLogs.forEach(log => {
      const time = log.totalWatchTime || log.duration || 0;
      
      if (log.mediaType === 'tv') {
        totalTvEpisodes++;
        totalTvWatchTime += time;
      } else if (log.mediaType === 'movie') {
        totalMovies++;
        totalMovieWatchTime += time;
      } else if (log.mediaType === 'book') {
        totalBooks++;
        totalBookReadTime += time;
      } else if (log.mediaType === 'comic') {
        totalComics++;
        totalComicReadTime += time;
      } else if (log.mediaType === 'shortstory') {
        totalShortStories++;
        totalShortStoryReadTime += time;
      } else if (log.mediaType === 'webvideo') {
        totalWebVideos++;
        totalWebVideoViewTime += time;
      }
    });

    return {
      // Watch stats
      totalTvEpisodes,
      totalMovies,
      totalWebVideos,
      totalTvWatchTime,
      totalMovieWatchTime,
      totalWebVideoViewTime,
      totalWatchTime: totalTvWatchTime + totalMovieWatchTime + totalWebVideoViewTime,
      totalWatchItems: totalTvEpisodes + totalMovies + totalWebVideos,
      
      // Read stats
      totalBooks,
      totalComics,
      totalShortStories,
      totalBookReadTime,
      totalComicReadTime,
      totalShortStoryReadTime,
      totalReadTime: totalBookReadTime + totalComicReadTime + totalShortStoryReadTime,
      totalReadItems: totalBooks + totalComics + totalShortStories,
      
      // Combined stats
      totalItems: totalTvEpisodes + totalMovies + totalWebVideos + totalBooks + totalComics + totalShortStories,
      totalActivityTime: totalTvWatchTime + totalMovieWatchTime + totalWebVideoViewTime + totalBookReadTime + totalComicReadTime + totalShortStoryReadTime
    };
  }

  /**
   * Get recent watch activity
   * @param {number} limit - Maximum number of entries to return
   * @returns {Promise<Array>} Recent watch logs
   */
  async getRecentActivity(limit = 20) {
    try {
      const recentLogs = await this.prisma.watchLog.findMany({
        orderBy: { createdAt: 'desc' }, // Sort by when the log was created/completed
        take: limit,
        include: {
          customOrderItem: {
            select: {
              id: true,
              title: true,
              customOrder: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      return recentLogs;
    } catch (error) {
      console.error('Error getting recent activity:', error);
      throw error;
    }
  }

  /**
   * Get the current date in the configured timezone
   * @returns {Date} Date object for "today" in the configured timezone
   */
  async getTodayInTimezone() {
    try {
      const { getSettings } = require('../../databaseUtils');
      const settings = await getSettings();
      const timezone = settings?.timezone || 'UTC';
      
      // Get today's date in the configured timezone
      const now = new Date();
      const todayString = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
      
      // Parse the date components
      const [year, month, day] = todayString.split('-').map(n => parseInt(n));
      
      // Create a date object for the start of today in local server time
      // This will be used for filtering and will be compared against stored UTC timestamps
      const todayStart = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      return todayStart;
    } catch (error) {
      console.warn('Error getting timezone setting, falling back to local date:', error.message);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return now;
    }
  }

  /**
   * Get watch statistics for today
   * @returns {Promise<Object>} Today's watch statistics
   */
  async getTodayStats() {
    const { getSettings } = require('../../databaseUtils');
    const settings = await getSettings();
    const timezone = settings?.timezone || 'UTC';
    
    // Get what "today" means in the configured timezone
    const todayInConfiguredTZ = new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
    
    // Create start and end of this day in UTC
    const startOfDayInTZ = new Date(`${todayInConfiguredTZ}T00:00:00`);
    const endOfDayInTZ = new Date(`${todayInConfiguredTZ}T23:59:59.999`);
    
    // Convert to UTC by adjusting for timezone offset
    const testDate = new Date(`${todayInConfiguredTZ}T12:00:00`);
    const utcTime = testDate.getTime();
    const tzTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone })).getTime();
    const offsetMs = utcTime - tzTime;
    
    const startDate = new Date(startOfDayInTZ.getTime() + offsetMs);
    const endDate = new Date(endOfDayInTZ.getTime() + offsetMs);

    return this.getWatchStats({
      startDate: startDate,
      endDate: endDate,
      groupBy: 'day'
    });
  }
}

module.exports = WatchStatsService;
