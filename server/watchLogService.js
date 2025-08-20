const { PrismaClient } = require('@prisma/client');

class WatchLogService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
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
      throw error;
    }
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
      const groupedStats = this.groupWatchStats(watchLogs, groupBy);
      
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
   * @private
   */
  groupWatchStats(watchLogs, groupBy) {
    const grouped = {};

    watchLogs.forEach(log => {
      const date = new Date(log.startTime);
      let key;

      switch (groupBy) {
        case 'day':
          // Use local date to avoid timezone issues
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          tvEpisodes: 0,
          movies: 0,
          books: 0,
          comics: 0,
          shortStories: 0,
          tvWatchTime: 0,
          movieWatchTime: 0,
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
      } else if (log.mediaType === 'movie') {
        grouped[key].movies++;
        grouped[key].movieWatchTime += watchTime;
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
      
      grouped[key].totalWatchTime += watchTime;
      grouped[key].entries.push(log);
    });

    // Convert to array and sort by period
    return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate total statistics
   * @private
   */
  calculateTotalStats(watchLogs) {
    let totalTvEpisodes = 0;
    let totalMovies = 0;
    let totalBooks = 0;
    let totalComics = 0;
    let totalShortStories = 0;
    let totalTvWatchTime = 0;
    let totalMovieWatchTime = 0;
    let totalBookReadTime = 0;
    let totalComicReadTime = 0;
    let totalShortStoryReadTime = 0;

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
      }
    });

    return {
      // Watch stats
      totalTvEpisodes,
      totalMovies,
      totalTvWatchTime,
      totalMovieWatchTime,
      totalWatchTime: totalTvWatchTime + totalMovieWatchTime,
      totalWatchItems: totalTvEpisodes + totalMovies,
      
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
      totalItems: totalTvEpisodes + totalMovies + totalBooks + totalComics + totalShortStories,
      totalActivityTime: totalTvWatchTime + totalMovieWatchTime + totalBookReadTime + totalComicReadTime + totalShortStoryReadTime
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
        orderBy: { startTime: 'desc' },
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
   * Get watch statistics for today
   * @returns {Promise<Object>} Today's watch statistics
   */
  async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getWatchStats({
      startDate: today,
      endDate: tomorrow,
      groupBy: 'day'
    });
  }

  /**
   * Start a reading session for an item
   * @param {Object} params - Reading session parameters
   * @param {string} params.mediaType - 'book', 'comic', or 'shortstory'
   * @param {string} params.title - Title of the content
   * @param {string} params.seriesTitle - Series title (for comics)
   * @param {number} params.customOrderItemId - Custom order item ID
   * @returns {Promise<Object>} The created reading log entry
   */
  async startReading(params) {
    try {
      // Check if there's already an active reading session for this item
      const activeSession = await this.prisma.watchLog.findFirst({
        where: {
          customOrderItemId: params.customOrderItemId,
          activityType: 'read',
          endTime: null
        }
      });

      if (activeSession) {
        console.log(`Resuming existing reading session for ${params.title}`);
        // Resume the existing session (unpause it)
        return await this.resumeReading(activeSession.id);
      }

      const readingLog = await this.prisma.watchLog.create({
        data: {
          mediaType: params.mediaType,
          activityType: 'read',
          title: params.title,
          seriesTitle: params.seriesTitle || null,
          customOrderItemId: params.customOrderItemId,
          startTime: new Date(),
          endTime: null,
          duration: null, // No set duration for reading
          totalWatchTime: 0,
          isCompleted: false,
          isPaused: false
        }
      });

      console.log(`Started reading session for ${params.mediaType}: ${params.title}`);
      return readingLog;
    } catch (error) {
      console.error('Error starting reading session:', error);
      throw error;
    }
  }

  /**
   * Pause an active reading session
   * @param {number} readingLogId - ID of the reading log to pause
   * @returns {Promise<Object>} Updated reading log
   */
  async pauseReading(readingLogId) {
    try {
      const readingLog = await this.prisma.watchLog.findUnique({
        where: { id: readingLogId }
      });

      if (!readingLog) {
        throw new Error('Reading session not found');
      }

      if (readingLog.isPaused) {
        // If already paused, resume it
        console.log('Reading session is paused, resuming...');
        return await this.resumeReading(readingLogId);
      }

      // Calculate time since last resume (or start if never paused)
      const now = new Date();
      const sessionStartTime = readingLog.endTime ? new Date(readingLog.endTime) : new Date(readingLog.startTime);
      const timeElapsed = Math.floor((now - sessionStartTime) / 1000 / 60); // in minutes

      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          isPaused: true,
          endTime: now, // Temporarily store pause time in endTime
          totalWatchTime: (readingLog.totalWatchTime || 0) + timeElapsed
        }
      });

      console.log(`Paused reading session (${timeElapsed} minutes added)`);
      return updatedLog;
    } catch (error) {
      console.error('Error pausing reading session:', error);
      throw error;
    }
  }

  /**
   * Resume a paused reading session
   * @param {number} readingLogId - ID of the reading log to resume
   * @returns {Promise<Object>} Updated reading log
   */
  async resumeReading(readingLogId) {
    try {
      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          isPaused: false,
          endTime: null // Clear the temporary pause time
        }
      });

      console.log('Resumed reading session');
      return updatedLog;
    } catch (error) {
      console.error('Error resuming reading session:', error);
      throw error;
    }
  }

  /**
   * Stop and complete a reading session
   * @param {number} readingLogId - ID of the reading log to stop
   * @returns {Promise<Object>} Completed reading log
   */
  async stopReading(readingLogId) {
    try {
      const readingLog = await this.prisma.watchLog.findUnique({
        where: { id: readingLogId }
      });

      if (!readingLog) {
        throw new Error('Reading session not found');
      }

      const now = new Date();
      let finalTotalTime = readingLog.totalWatchTime || 0;

      // If not paused, add the time since last resume
      if (!readingLog.isPaused) {
        const sessionStartTime = readingLog.endTime ? new Date(readingLog.endTime) : new Date(readingLog.startTime);
        const timeElapsed = Math.floor((now - sessionStartTime) / 1000 / 60); // in minutes
        finalTotalTime += timeElapsed;
      }

      // If total time is less than 1 minute, delete the session instead of completing it
      if (finalTotalTime < 1) {
        await this.prisma.watchLog.delete({
          where: { id: readingLogId }
        });
        
        console.log(`Deleted reading session with ${finalTotalTime} minutes (less than 1 minute)`);
        
        // Return a special response indicating the session was deleted
        return {
          deleted: true,
          totalTime: finalTotalTime * 60, // Convert to seconds for client
          message: 'Reading session deleted (less than 1 minute)'
        };
      }

      const updatedLog = await this.prisma.watchLog.update({
        where: { id: readingLogId },
        data: {
          endTime: now,
          totalWatchTime: finalTotalTime,
          isCompleted: true,
          isPaused: false
        }
      });

      // Add totalTime in seconds for client compatibility
      updatedLog.totalTime = finalTotalTime * 60; // Convert minutes to seconds

      console.log(`Completed reading session: ${finalTotalTime} minutes total`);
      return updatedLog;
    } catch (error) {
      console.error('Error stopping reading session:', error);
      throw error;
    }
  }

  /**
   * Get active reading session for a custom order item
   * @param {number} customOrderItemId - Custom order item ID (optional - if not provided, finds any active session)
   * @returns {Promise<Object|null>} Active reading session or null
   */
  async getActiveReadingSession(customOrderItemId) {
    try {
      const whereClause = customOrderItemId 
        ? {
            customOrderItemId: customOrderItemId,
            activityType: 'read',
            OR: [
              { endTime: null },  // Not ended
              { AND: [{ endTime: { not: null } }, { isPaused: true }] }  // Paused (has endTime but is paused)
            ]
          }
        : {
            activityType: 'read',
            OR: [
              { endTime: null },  // Not ended
              { AND: [{ endTime: { not: null } }, { isPaused: true }] }  // Paused (has endTime but is paused)
            ]
          };

      const activeSession = await this.prisma.watchLog.findFirst({
        where: whereClause,
        orderBy: {
          startTime: 'desc'
        }
      });

      return activeSession;
    } catch (error) {
      console.error('Error getting active reading session:', error);
      return null;
    }
  }

  /**
   * Format time in minutes to a readable format
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  formatWatchTime(minutes) {
    if (!minutes || minutes === 0) return '0 minutes';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return `${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
    } else if (remainingMinutes === 0) {
      return `${hours} hour${hours === 1 ? '' : 's'}`;
    } else {
      return `${hours} hour${hours === 1 ? '' : 's'} ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
    }
  }
}

module.exports = WatchLogService;
