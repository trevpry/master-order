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
   * Get statistics grouped by custom order
   * @param {string} period - Time period filter
   * @returns {Promise<Array>} Array of custom order statistics
   */
  async getCustomOrderStats(period = 'all') {
    try {
      // Build date filter based on period
      const whereClause = {};
      
      let actualStartDate = null;
      let actualEndDate = null;

      // Handle predefined periods
      switch (period) {
        case 'today':
          actualStartDate = new Date();
          actualStartDate.setHours(0, 0, 0, 0);
          actualEndDate = new Date();
          actualEndDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setDate(actualStartDate.getDate() - 7);
          break;
        case 'month':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setMonth(actualStartDate.getMonth() - 1);
          break;
        case 'year':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setFullYear(actualStartDate.getFullYear() - 1);
          break;
        case 'all':
        default:
          // No date filtering
          break;
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
            totalBooks: 0,
            totalComics: 0,
            totalShortStories: 0,
            totalTvWatchTime: 0,
            totalMovieWatchTime: 0,
            totalBookReadTime: 0,
            totalComicReadTime: 0,
            totalShortStoryReadTime: 0,
          };
        }

        const stats = orderStats[orderId];
        const watchTime = log.totalWatchTime || 0;

        if (log.activityType === 'watch') {
          stats.totalWatchTime += watchTime;
          if (log.mediaType === 'tv') {
            stats.totalTvEpisodes += 1;
            stats.totalTvWatchTime += watchTime;
          } else if (log.mediaType === 'movie') {
            stats.totalMovies += 1;
            stats.totalMovieWatchTime += watchTime;
          }
        } else if (log.activityType === 'read') {
          stats.totalReadTime += watchTime;
          if (log.mediaType === 'book') {
            stats.totalBooks += 1;
            stats.totalBookReadTime += watchTime;
          } else if (log.mediaType === 'comic') {
            stats.totalComics += 1;
            stats.totalComicReadTime += watchTime;
          } else if (log.mediaType === 'shortstory') {
            stats.totalShortStories += 1;
            stats.totalShortStoryReadTime += watchTime;
          }
        }
      });

      // Format the results and convert to array
      const results = Object.values(orderStats).map(stats => ({
        ...stats,
        totalWatchTimeFormatted: this.formatWatchTime(stats.totalWatchTime),
        totalReadTimeFormatted: this.formatWatchTime(stats.totalReadTime),
        totalTvWatchTimeFormatted: this.formatWatchTime(stats.totalTvWatchTime),
        totalMovieWatchTimeFormatted: this.formatWatchTime(stats.totalMovieWatchTime),
        totalBookReadTimeFormatted: this.formatWatchTime(stats.totalBookReadTime),
        totalComicReadTimeFormatted: this.formatWatchTime(stats.totalComicReadTime),
        totalShortStoryReadTimeFormatted: this.formatWatchTime(stats.totalShortStoryReadTime),
      }));

      // Sort by total activity time (watch + read) descending
      results.sort((a, b) => (b.totalWatchTime + b.totalReadTime) - (a.totalWatchTime + a.totalReadTime));

      return results;
    } catch (error) {
      console.error('Error fetching custom order stats:', error);
      throw error;
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
      // Get settings to check for ignored collections and main collection
      const settings = await this.prisma.settings.findFirst();
      const ignoredTVCollections = settings?.ignoredTVCollections ? 
        settings.ignoredTVCollections.split(',').map(c => c.trim()) : [];
      
      // Add the main collection from settings to the ignored list
      const mainCollection = settings?.collectionName?.trim();
      if (mainCollection) {
        ignoredTVCollections.push(mainCollection);
      }
      
      console.log(`TV Stats - Main collection: "${mainCollection}", Ignored collections:`, ignoredTVCollections);
      
      // Build date filter based on period
      const whereClause = { mediaType };
      
      let actualStartDate = null;
      let actualEndDate = null;

      // Handle predefined periods
      switch (period) {
        case 'today':
          actualStartDate = new Date();
          actualStartDate.setHours(0, 0, 0, 0);
          actualEndDate = new Date();
          actualEndDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setDate(actualStartDate.getDate() - 7);
          break;
        case 'month':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setMonth(actualStartDate.getMonth() - 1);
          break;
        case 'year':
          actualEndDate = new Date();
          actualStartDate = new Date();
          actualStartDate.setFullYear(actualStartDate.getFullYear() - 1);
          break;
        case 'all':
        default:
          // No date filtering
          break;
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

      // For TV shows, we need to get collection information
      let tvShowsWithCollections = [];
      if (mediaType === 'tv') {
        // Get unique series titles from the watch logs
        const uniqueSeriesTitles = [...new Set(watchLogs.map(log => log.seriesTitle).filter(Boolean))];
        
        if (uniqueSeriesTitles.length > 0) {
          // Query TV shows to get collection information
          tvShowsWithCollections = await this.prisma.plexTVShow.findMany({
            where: {
              title: {
                in: uniqueSeriesTitles
              }
            },
            select: {
              title: true,
              collections: true
            }
          });
        }
      }

      // Group the data based on the groupBy parameter
      const groupedStats = this.groupWatchStats(watchLogs, groupBy);
      
      // Calculate specific stats for this media type
      const totalStats = {
        totalItems: watchLogs.length,
        totalActivityTime: 0,
        totalWatchTime: 0,
        totalReadTime: 0,
        titles: [],
        series: new Set(),
        customOrders: new Set()
      };

      // Media type specific stats
      if (mediaType === 'tv') {
        totalStats.totalTvEpisodes = watchLogs.length;
        totalStats.totalTvWatchTime = 0;
        totalStats.shows = new Set();
        totalStats.seasons = new Set();
        totalStats.collections = new Set();
      } else if (mediaType === 'movie') {
        totalStats.totalMovies = watchLogs.length;
        totalStats.totalMovieWatchTime = 0;
      } else if (mediaType === 'book') {
        totalStats.totalBooks = watchLogs.length;
        totalStats.totalBookReadTime = 0;
      } else if (mediaType === 'comic') {
        totalStats.totalComics = watchLogs.length;
        totalStats.totalComicReadTime = 0;
      } else if (mediaType === 'shortstory') {
        totalStats.totalShortStories = watchLogs.length;
        totalStats.totalShortStoryReadTime = 0;
      }

      watchLogs.forEach(log => {
        const watchTime = log.totalWatchTime || 0;
        totalStats.totalActivityTime += watchTime;
        
        // Determine if this is a watch or read activity
        const isReadActivity = log.activityType === 'read' || 
                               (log.mediaType && ['book', 'comic', 'shortstory'].includes(log.mediaType));
        const isWatchActivity = log.activityType === 'watch' || 
                                (log.mediaType && ['tv', 'movie'].includes(log.mediaType));
        
        if (isWatchActivity) {
          totalStats.totalWatchTime += watchTime;
          if (mediaType === 'tv') {
            totalStats.totalTvWatchTime += watchTime;
            if (log.seriesTitle) {
              totalStats.shows.add(log.seriesTitle);
              
              // Find the corresponding TV show for collections
              const tvShow = tvShowsWithCollections.find(show => show.title === log.seriesTitle);
              if (tvShow && tvShow.collections) {
                // Parse collections (they might be comma-separated or JSON)
                try {
                  let collections = [];
                  if (tvShow.collections.startsWith('[')) {
                    // Handle JSON array format
                    collections = JSON.parse(tvShow.collections);
                  } else if (tvShow.collections.includes(',')) {
                    collections = tvShow.collections.split(',').map(c => c.trim());
                  } else {
                    collections = [tvShow.collections.trim()];
                  }
                  
                  console.log(`Parsed collections for ${log.seriesTitle}:`, collections);
                  console.log(`Ignored collections:`, ignoredTVCollections);
                  
                  // Add collections that aren't ignored (case-insensitive comparison)
                  collections.forEach(collection => {
                    const normalizedCollection = collection.trim();
                    const isIgnored = ignoredTVCollections.some(ignored => 
                      ignored.toLowerCase() === normalizedCollection.toLowerCase()
                    );
                    
                    console.log(`Checking collection "${normalizedCollection}": ignored = ${isIgnored}`);
                    
                    if (!isIgnored) {
                      totalStats.collections.add(normalizedCollection);
                      console.log(`Added collection: "${normalizedCollection}"`);
                    } else {
                      console.log(`Filtering out collection: "${normalizedCollection}" (matches ignored: "${ignoredTVCollections.find(ignored => ignored.toLowerCase() === normalizedCollection.toLowerCase())}")`);
                    }
                  });
                } catch (error) {
                  console.warn(`Error parsing collections for ${tvShow.title}:`, error);
                  // Treat as single collection if parsing fails
                  const normalizedCollection = tvShow.collections.trim();
                  const isIgnored = ignoredTVCollections.some(ignored => 
                    ignored.toLowerCase() === normalizedCollection.toLowerCase()
                  );
                  
                  if (!isIgnored) {
                    totalStats.collections.add(normalizedCollection);
                  } else {
                    console.log(`Filtering out collection: "${normalizedCollection}" (matches ignored: "${ignoredTVCollections.find(ignored => ignored.toLowerCase() === normalizedCollection.toLowerCase())}")`);
                  }
                }
              }
            }
            if (log.seasonNumber) totalStats.seasons.add(`${log.seriesTitle} S${log.seasonNumber}`);
          } else if (mediaType === 'movie') {
            totalStats.totalMovieWatchTime += watchTime;
          }
        } else if (isReadActivity) {
          totalStats.totalReadTime += watchTime;
          if (mediaType === 'book') {
            totalStats.totalBookReadTime += watchTime;
          } else if (mediaType === 'comic') {
            totalStats.totalComicReadTime += watchTime;
          } else if (mediaType === 'shortstory') {
            totalStats.totalShortStoryReadTime += watchTime;
          }
        }

        // Track titles
        totalStats.titles.push(log.title);
        
        // Track custom orders
        if (log.customOrderItem?.customOrder) {
          totalStats.customOrders.add(log.customOrderItem.customOrder.name);
        }
      });

      // For TV shows, create detailed breakdowns
      if (mediaType === 'tv') {
        // Create collection breakdown
        totalStats.collectionBreakdown = [];
        totalStats.collections.forEach(collectionName => {
          const collectionShows = tvShowsWithCollections
            .filter(show => {
              if (!show.collections) return false;
              try {
                let collections = [];
                if (show.collections.startsWith('[')) {
                  // Handle JSON array format first
                  collections = JSON.parse(show.collections);
                } else if (show.collections.includes(',')) {
                  collections = show.collections.split(',').map(c => c.trim());
                } else {
                  collections = [show.collections.trim()];
                }
                return collections.includes(collectionName);
              } catch (error) {
                return show.collections === collectionName;
              }
            })
            .map(show => show.title);

          const collectionLogs = watchLogs.filter(log => 
            log.seriesTitle && collectionShows.includes(log.seriesTitle)
          );

          const collectionStats = {
            name: collectionName,
            totalEpisodes: collectionLogs.length,
            totalWatchTime: collectionLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0),
            uniqueShows: new Set(collectionLogs.map(log => log.seriesTitle)).size,
            uniqueSeasons: new Set(collectionLogs.filter(log => log.seasonNumber).map(log => `${log.seriesTitle} S${log.seasonNumber}`)).size,
            shows: collectionShows
          };
          
          collectionStats.totalWatchTimeFormatted = this.formatWatchTime(collectionStats.totalWatchTime);
          totalStats.collectionBreakdown.push(collectionStats);
        });

        // Create series breakdown
        totalStats.seriesBreakdown = [];
        totalStats.shows.forEach(showName => {
          const showLogs = watchLogs.filter(log => log.seriesTitle === showName);
          const showSeasons = new Set(showLogs.filter(log => log.seasonNumber).map(log => log.seasonNumber));
          
          const seriesStats = {
            name: showName,
            totalEpisodes: showLogs.length,
            totalWatchTime: showLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0),
            uniqueSeasons: showSeasons.size,
            seasons: Array.from(showSeasons).sort((a, b) => a - b),
            recentEpisodes: showLogs.slice(-5).reverse(), // Last 5 episodes watched
            averageEpisodeLength: showLogs.length > 0 ? 
              Math.round(showLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0) / showLogs.length) : 0
          };
          
          seriesStats.totalWatchTimeFormatted = this.formatWatchTime(seriesStats.totalWatchTime);
          
          // Find collection for this show
          const tvShow = tvShowsWithCollections.find(show => show.title === showName);
          if (tvShow && tvShow.collections) {
            try {
              let collections = [];
              if (tvShow.collections.startsWith('[')) {
                // Handle JSON array format first
                collections = JSON.parse(tvShow.collections);
              } else if (tvShow.collections.includes(',')) {
                collections = tvShow.collections.split(',').map(c => c.trim());
              } else {
                collections = [tvShow.collections.trim()];
              }
              seriesStats.collections = collections.filter(c => {
                const normalizedCollection = c.trim();
                return !ignoredTVCollections.some(ignored => 
                  ignored.toLowerCase() === normalizedCollection.toLowerCase()
                );
              });
            } catch (error) {
              const normalizedCollection = tvShow.collections.trim();
              const isIgnored = ignoredTVCollections.some(ignored => 
                ignored.toLowerCase() === normalizedCollection.toLowerCase()
              );
              if (!isIgnored) {
                seriesStats.collections = [normalizedCollection];
              }
            }
          }
          
          totalStats.seriesBreakdown.push(seriesStats);
        });

        // Sort breakdowns by watch time (descending)
        totalStats.collectionBreakdown.sort((a, b) => b.totalWatchTime - a.totalWatchTime);
        totalStats.seriesBreakdown.sort((a, b) => b.totalWatchTime - a.totalWatchTime);

        // Create actor breakdown for TV shows
        try {
          console.log('Creating actor breakdown for TV shows...');
          const actorStats = new Map(); // Will store { totalWatchTime, episodeCount, seriesSet }

          // Get all TV watch logs with plexKey for completed episodes
          const watchedTVLogs = watchLogs.filter(log => 
            log.plexKey && 
            log.totalWatchTime > 0 && 
            log.mediaType === 'tv'
          );

          console.log(`Found ${watchedTVLogs.length} watched TV episodes with plexKey`);

          if (watchedTVLogs.length > 0) {
            const plexKeys = watchedTVLogs.map(log => log.plexKey);

            // Get episodes with roles using plexKey (ratingKey in PlexEpisode)
            const episodesWithRoles = await this.prisma.plexEpisode.findMany({
              where: {
                ratingKey: {
                  in: plexKeys
                }
              },
              include: {
                roles: true,
                season: {
                  include: {
                    show: true
                  }
                }
              }
            });

            console.log(`Found ${episodesWithRoles.length} episodes with roles data`);

            for (const episode of episodesWithRoles) {
              // Find the corresponding watch logs for this episode
              const episodeLogs = watchedTVLogs.filter(log => log.plexKey === episode.ratingKey);
              const totalEpisodeWatchTime = episodeLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0);
              const seriesTitle = episode.season?.show?.title || 'Unknown Series';

              if (totalEpisodeWatchTime > 0 && episode.roles.length > 0) {
                console.log(`Episode "${episode.title}" has ${episode.roles.length} roles with total watch time ${totalEpisodeWatchTime}`);
                
                for (const role of episode.roles) {
                  if (role.tag && role.tag.trim()) {
                    const actorName = role.tag.trim();
                    
                    if (!actorStats.has(actorName)) {
                      actorStats.set(actorName, {
                        totalWatchTime: 0,
                        episodeCount: 0,
                        seriesSet: new Set()
                      });
                    }
                    
                    const stats = actorStats.get(actorName);
                    stats.totalWatchTime += totalEpisodeWatchTime;
                    stats.episodeCount += 1;
                    stats.seriesSet.add(seriesTitle);
                  }
                }
              }
            }
          }

          // Create actor breakdown with all metrics
          const actorBreakdownData = Array.from(actorStats.entries())
            .map(([actor, stats]) => ({
              name: actor,
              totalWatchTime: stats.totalWatchTime,
              totalWatchTimeFormatted: this.formatWatchTime(stats.totalWatchTime),
              episodeCount: stats.episodeCount,
              seriesCount: stats.seriesSet.size,
              series: Array.from(stats.seriesSet)
            }));

          // Store the full data for different sorting methods
          totalStats.actorBreakdown = {
            byPlaytime: [...actorBreakdownData].sort((a, b) => b.totalWatchTime - a.totalWatchTime).slice(0, 10),
            byEpisodeCount: [...actorBreakdownData].sort((a, b) => b.episodeCount - a.episodeCount).slice(0, 10),
            bySeriesCount: [...actorBreakdownData].sort((a, b) => b.seriesCount - a.seriesCount).slice(0, 10)
          };

          console.log(`Created actor breakdown with ${actorBreakdownData.length} actors`);
          if (actorBreakdownData.length > 0) {
            console.log('Top 3 by playtime:', totalStats.actorBreakdown.byPlaytime.slice(0, 3).map(a => `${a.name} (${a.totalWatchTimeFormatted})`));
            console.log('Top 3 by episodes:', totalStats.actorBreakdown.byEpisodeCount.slice(0, 3).map(a => `${a.name} (${a.episodeCount} episodes)`));
            console.log('Top 3 by series:', totalStats.actorBreakdown.bySeriesCount.slice(0, 3).map(a => `${a.name} (${a.seriesCount} series)`));
          }
          
        } catch (error) {
          console.error('Error creating actor breakdown:', error);
          totalStats.actorBreakdown = {
            byPlaytime: [],
            byEpisodeCount: [],
            bySeriesCount: []
          };
        }
      }

      // For Movies, create detailed actor breakdowns
      if (mediaType === 'movie') {
        console.log(`Movie actor breakdown requested with movieActorSortBy: ${movieActorSortBy}`);
        try {
          console.log('Creating actor breakdown for movies...');
          const actorStats = new Map(); // Will store { totalWatchTime, movieCount, collections }

          // Get all movie watch logs with plexKey for completed movies
          const watchedMovieLogs = watchLogs.filter(log => 
            log.plexKey && 
            log.totalWatchTime > 0 && 
            log.mediaType === 'movie'
          );

          console.log(`Found ${watchedMovieLogs.length} watched movies with plexKey`);

          if (watchedMovieLogs.length > 0) {
            const plexKeys = watchedMovieLogs.map(log => log.plexKey);

            // Get movies with roles using plexKey (ratingKey in PlexMovie)
            const moviesWithRoles = await this.prisma.plexMovie.findMany({
              where: {
                ratingKey: {
                  in: plexKeys
                }
              },
              include: {
                roles: true
              }
            });

            console.log(`Found ${moviesWithRoles.length} movies with roles data`);

            for (const movie of moviesWithRoles) {
              // Find the corresponding watch logs for this movie
              const movieLogs = watchedMovieLogs.filter(log => log.plexKey === movie.ratingKey);
              const totalMovieWatchTime = movieLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0);
              
              // Parse collections from the movie
              let movieCollections = [];
              if (movie.collections) {
                try {
                  movieCollections = JSON.parse(movie.collections);
                } catch {
                  movieCollections = movie.collections
                    .split(',')
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
                }
              }

              if (totalMovieWatchTime > 0 && movie.roles.length > 0) {
                console.log(`Movie "${movie.title}" has ${movie.roles.length} roles with total watch time ${totalMovieWatchTime}`);
                
                for (const role of movie.roles) {
                  if (role.tag && role.tag.trim()) {
                    const actorName = role.tag.trim();
                    
                    if (!actorStats.has(actorName)) {
                      actorStats.set(actorName, {
                        totalWatchTime: 0,
                        movieCount: 0,
                        collectionsSet: new Set(),
                        movies: []
                      });
                    }
                    
                    const stats = actorStats.get(actorName);
                    stats.totalWatchTime += totalMovieWatchTime;
                    stats.movieCount += 1;
                    stats.movies.push(movie.title);
                    movieCollections.forEach(collection => stats.collectionsSet.add(collection));
                  }
                }
              }
            }
          }

          // Create actor breakdown with all metrics
          const actorBreakdownData = Array.from(actorStats.entries())
            .map(([actor, stats]) => ({
              name: actor,
              totalWatchTime: stats.totalWatchTime,
              totalWatchTimeFormatted: this.formatWatchTime(stats.totalWatchTime),
              movieCount: stats.movieCount,
              collectionCount: stats.collectionsSet.size,
              collections: Array.from(stats.collectionsSet),
              movies: stats.movies
            }));

          // Store the full data for different sorting methods
          totalStats.actorBreakdown = {
            byPlaytime: [...actorBreakdownData].sort((a, b) => b.totalWatchTime - a.totalWatchTime).slice(0, 10),
            byMovieCount: [...actorBreakdownData].sort((a, b) => b.movieCount - a.movieCount).slice(0, 10),
            byCollectionCount: [...actorBreakdownData].sort((a, b) => b.collectionCount - a.collectionCount).slice(0, 10)
          };

          console.log(`Created actor breakdown with ${actorBreakdownData.length} actors`);
          if (actorBreakdownData.length > 0) {
            console.log('Top 3 by playtime:', totalStats.actorBreakdown.byPlaytime.slice(0, 3).map(a => `${a.name} (${a.totalWatchTimeFormatted})`));
            console.log('Top 3 by movies:', totalStats.actorBreakdown.byMovieCount.slice(0, 3).map(a => `${a.name} (${a.movieCount} movies)`));
            console.log('Top 3 by collections:', totalStats.actorBreakdown.byCollectionCount.slice(0, 3).map(a => `${a.name} (${a.collectionCount} collections)`));
          }
          
        } catch (error) {
          console.error('Error creating movie actor breakdown:', error);
          totalStats.actorBreakdown = {
            byPlaytime: [],
            byMovieCount: [],
            byCollectionCount: []
          };
        }
      }

      // For Books, create detailed author breakdowns and pages read statistics
      if (mediaType === 'book') {
        console.log('Creating author breakdown and pages read statistics for books...');
        try {
          const authorStats = new Map(); // Will store { totalReadTime, bookCount, totalPagesRead, books }
          let totalPagesRead = 0;

          // Get all book read logs with custom order items
          const bookReadLogs = watchLogs.filter(log => 
            log.customOrderItemId && 
            log.totalWatchTime > 0 && 
            log.mediaType === 'book'
          );

          console.log(`Found ${bookReadLogs.length} book reading sessions`);

          if (bookReadLogs.length > 0) {
            const customOrderItemIds = [...new Set(bookReadLogs.map(log => log.customOrderItemId))];

            // Get custom order items (books) with reading progress data
            const booksWithProgress = await this.prisma.customOrderItem.findMany({
              where: {
                id: {
                  in: customOrderItemIds
                },
                mediaType: 'book'
              },
              select: {
                id: true,
                title: true,
                bookAuthor: true,
                bookCurrentPage: true,
                bookPageCount: true,
                bookPercentRead: true
              }
            });

            console.log(`Found ${booksWithProgress.length} books with progress data`);

            // Calculate pages read and author statistics
            for (const book of booksWithProgress) {
              const bookLogs = bookReadLogs.filter(log => log.customOrderItemId === book.id);
              const totalBookReadTime = bookLogs.reduce((sum, log) => sum + (log.totalWatchTime || 0), 0);

              // Calculate pages read for this book
              let bookPagesRead = 0;
              if (book.bookCurrentPage && book.bookCurrentPage > 0) {
                bookPagesRead = book.bookCurrentPage;
              } else if (book.bookPercentRead && book.bookPageCount) {
                bookPagesRead = Math.round((book.bookPercentRead / 100) * book.bookPageCount);
              }

              totalPagesRead += bookPagesRead;

              // Track author statistics
              if (book.bookAuthor && book.bookAuthor.trim()) {
                const authorName = book.bookAuthor.trim();
                
                if (!authorStats.has(authorName)) {
                  authorStats.set(authorName, {
                    totalReadTime: 0,
                    bookCount: 0,
                    totalPagesRead: 0,
                    books: []
                  });
                }
                
                const stats = authorStats.get(authorName);
                stats.totalReadTime += totalBookReadTime;
                stats.bookCount += 1;
                stats.totalPagesRead += bookPagesRead;
                stats.books.push({
                  title: book.title,
                  pagesRead: bookPagesRead,
                  totalPages: book.bookPageCount,
                  readTime: totalBookReadTime
                });
              }
            }
          }

          // Set total pages read on totalStats
          totalStats.totalPagesRead = totalPagesRead;

          // Get completed books count (100% read books from custom orders)
          const completedBooksCount = await this.prisma.customOrderItem.count({
            where: {
              mediaType: 'book',
              OR: [
                { bookPercentRead: 100 },
                { isWatched: true }
              ]
            }
          });

          totalStats.totalCompletedBooks = completedBooksCount;
          console.log(`Found ${completedBooksCount} completed books`);

          // Get list of completed books for display
          const completedBooksList = await this.prisma.customOrderItem.findMany({
            where: {
              mediaType: 'book',
              OR: [
                { bookPercentRead: 100 },
                { isWatched: true }
              ]
            },
            select: {
              id: true,
              title: true,
              bookTitle: true,
              bookAuthor: true,
              bookYear: true,
              bookPageCount: true,
              bookPercentRead: true,
              isWatched: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: {
              updatedAt: 'desc'
            },
            take: 20 // Limit to 20 most recently completed books
          });

          totalStats.completedBooks = completedBooksList.map(book => ({
            title: book.bookTitle || book.title,
            author: book.bookAuthor || 'Unknown Author',
            year: book.bookYear,
            pageCount: book.bookPageCount,
            percentRead: book.bookPercentRead || (book.isWatched ? 100 : 0),
            isWatched: book.isWatched,
            completedDate: book.updatedAt
          }));

          console.log(`Found ${completedBooksList.length} completed books for display`);

          // Create completed books author statistics
          const completedAuthorStats = new Map();
          for (const book of completedBooksList) {
            if (book.bookAuthor && book.bookAuthor.trim()) {
              const authorName = book.bookAuthor.trim();
              
              if (!completedAuthorStats.has(authorName)) {
                completedAuthorStats.set(authorName, {
                  completedBooks: 0,
                  completedBooksList: []
                });
              }
              
              const stats = completedAuthorStats.get(authorName);
              stats.completedBooks += 1;
              stats.completedBooksList.push({
                title: book.bookTitle || book.title,
                year: book.bookYear,
                pageCount: book.bookPageCount
              });
            }
          }

          // Create author breakdown with all metrics
          const authorBreakdownData = Array.from(authorStats.entries())
            .map(([author, stats]) => {
              // Merge with completed books data if available
              const completedStats = completedAuthorStats.get(author) || { completedBooks: 0, completedBooksList: [] };
              
              return {
                name: author,
                totalReadTime: stats.totalReadTime,
                totalReadTimeFormatted: this.formatWatchTime(stats.totalReadTime),
                bookCount: stats.bookCount,
                totalPagesRead: stats.totalPagesRead,
                books: stats.books,
                averagePagesPerBook: stats.bookCount > 0 ? Math.round(stats.totalPagesRead / stats.bookCount) : 0,
                completedBooks: completedStats.completedBooks,
                completedBooksList: completedStats.completedBooksList
              };
            });

          // Also add authors that only have completed books (not in reading logs)
          for (const [author, completedStats] of completedAuthorStats.entries()) {
            if (!authorStats.has(author)) {
              authorBreakdownData.push({
                name: author,
                totalReadTime: 0,
                totalReadTimeFormatted: this.formatWatchTime(0),
                bookCount: 0,
                totalPagesRead: 0,
                books: [],
                averagePagesPerBook: 0,
                completedBooks: completedStats.completedBooks,
                completedBooksList: completedStats.completedBooksList
              });
            }
          }

          // Store the full data for different sorting methods
          totalStats.authorBreakdown = {
            byReadTime: [...authorBreakdownData].sort((a, b) => b.totalReadTime - a.totalReadTime).slice(0, 10),
            byPagesRead: [...authorBreakdownData].sort((a, b) => b.totalPagesRead - a.totalPagesRead).slice(0, 10),
            byBookCount: [...authorBreakdownData].sort((a, b) => b.bookCount - a.bookCount).slice(0, 10),
            byCompletedBooks: [...authorBreakdownData].sort((a, b) => b.completedBooks - a.completedBooks).slice(0, 10)
          };

          console.log(`Created author breakdown with ${authorBreakdownData.length} authors`);
          console.log(`Total pages read across all books: ${totalPagesRead}`);
          if (authorBreakdownData.length > 0) {
            console.log('Top 3 by read time:', totalStats.authorBreakdown.byReadTime.slice(0, 3).map(a => `${a.name} (${a.totalReadTimeFormatted})`));
            console.log('Top 3 by pages read:', totalStats.authorBreakdown.byPagesRead.slice(0, 3).map(a => `${a.name} (${a.totalPagesRead} pages)`));
            console.log('Top 3 by book count:', totalStats.authorBreakdown.byBookCount.slice(0, 3).map(a => `${a.name} (${a.bookCount} books)`));
            console.log('Top 3 by completed books:', totalStats.authorBreakdown.byCompletedBooks.slice(0, 3).map(a => `${a.name} (${a.completedBooks} completed)`));
          }
          
        } catch (error) {
          console.error('Error creating book author breakdown:', error);
          totalStats.totalPagesRead = 0;
          totalStats.totalCompletedBooks = 0;
          totalStats.completedBooks = [];
          totalStats.authorBreakdown = {
            byReadTime: [],
            byPagesRead: [],
            byBookCount: [],
            byCompletedBooks: []
          };
        }
      }

      // Convert sets to arrays and get counts
      if (totalStats.shows) {
        totalStats.uniqueShows = totalStats.shows.size;
        totalStats.shows = Array.from(totalStats.shows);
      }
      if (totalStats.seasons) {
        totalStats.uniqueSeasons = totalStats.seasons.size;
        totalStats.seasons = Array.from(totalStats.seasons);
      }
      if (totalStats.collections) {
        totalStats.uniqueCollections = totalStats.collections.size;
        totalStats.collections = Array.from(totalStats.collections);
      }
      
      totalStats.uniqueCustomOrders = totalStats.customOrders.size;
      totalStats.customOrders = Array.from(totalStats.customOrders);

      // Add formatted time strings
      totalStats.totalActivityTimeFormatted = this.formatWatchTime(totalStats.totalActivityTime);
      totalStats.totalWatchTimeFormatted = this.formatWatchTime(totalStats.totalWatchTime);
      totalStats.totalReadTimeFormatted = this.formatWatchTime(totalStats.totalReadTime);
      
      if (mediaType === 'tv') {
        totalStats.totalTvWatchTimeFormatted = this.formatWatchTime(totalStats.totalTvWatchTime);
      } else if (mediaType === 'movie') {
        totalStats.totalMovieWatchTimeFormatted = this.formatWatchTime(totalStats.totalMovieWatchTime);
      } else if (mediaType === 'book') {
        totalStats.totalBookReadTimeFormatted = this.formatWatchTime(totalStats.totalBookReadTime);
      } else if (mediaType === 'comic') {
        totalStats.totalComicReadTimeFormatted = this.formatWatchTime(totalStats.totalComicReadTime);
      } else if (mediaType === 'shortstory') {
        totalStats.totalShortStoryReadTimeFormatted = this.formatWatchTime(totalStats.totalShortStoryReadTime);
      }

      return {
        totalStats,
        groupedStats,
        totalEntries: watchLogs.length,
        logs: watchLogs.slice(0, 10) // Recent 10 items for display
      };
    } catch (error) {
      console.error(`Error fetching ${mediaType} stats:`, error);
      throw error;
    }
  }
}

module.exports = WatchLogService;
