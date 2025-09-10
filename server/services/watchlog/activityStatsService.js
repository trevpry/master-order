/**
 * Activity Stats Service
 * Handles additional statistics and custom order analytics
 */

const { PrismaClient } = require('@prisma/client');
const WatchUtilsService = require('./watchUtilsService');

class ActivityStatsService {
  constructor(prismaInstance) {
    this.prisma = prismaInstance || new PrismaClient();
    this.utilsService = new WatchUtilsService(this.prisma);
  }

  /**
   * Get statistics grouped by custom order
   * @param {string} period - Time period filter
   * @returns {Promise<Array>} Array of custom order statistics
   */
  async getCustomOrderStats(period = 'all') {
    try {
      // Build date filter based on period using timezone-aware calculations
      const whereClause = {};
      
      let actualStartDate = null;
      let actualEndDate = null;

      if (period !== 'all') {
        const bounds = await this.utilsService.getTimezoneAwarePeriodBounds(period);
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
        return {
          ...stats,
          totalWatchTimeFormatted: this.utilsService.formatWatchTime(stats.totalWatchTime),
          totalReadTimeFormatted: this.utilsService.formatWatchTime(stats.totalReadTime)
        };
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
      console.log(`Getting stats for media type: ${mediaType}, period: ${period}`);
      
      // Build date filter based on period using timezone-aware calculations
      const whereClause = { mediaType };
      
      let actualStartDate = null;
      let actualEndDate = null;

      if (period !== 'all') {
        const bounds = await this.utilsService.getTimezoneAwarePeriodBounds(period);
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

      // For TV shows and movies, also get the actor data from Plex (optimized query)
      let episodeActorData = {};
      let movieActorData = {};
      
      if (mediaType === 'tv') {
        const plexKeys = watchLogs
          .filter(log => log.plexKey)
          .map(log => log.plexKey);
        
        if (plexKeys.length > 0) {
          // Use chunked queries to prevent memory issues with large datasets
          const CHUNK_SIZE = 100;
          for (let i = 0; i < plexKeys.length; i += CHUNK_SIZE) {
            const chunk = plexKeys.slice(i, i + CHUNK_SIZE);
            
            const episodesWithRoles = await this.prisma.plexEpisode.findMany({
              where: {
                ratingKey: { in: chunk }
              },
              include: {
                roles: {
                  select: {
                    tag: true,
                    role: true
                  },
                  take: 10 // Limit to prevent excessive memory usage
                }
              }
            });
            
            // Create a map of plexKey to actors
            episodesWithRoles.forEach(episode => {
              if (episode.roles && episode.roles.length > 0) {
                episodeActorData[episode.ratingKey] = episode.roles.map(role => ({
                  name: role.tag,
                  role: role.role
                }));
              }
            });
          }
        }
      } else if (mediaType === 'movie') {
        const plexKeys = watchLogs
          .filter(log => log.plexKey)
          .map(log => log.plexKey);
        
        if (plexKeys.length > 0) {
          const moviesWithRoles = await this.prisma.plexMovie.findMany({
            where: {
              ratingKey: { in: plexKeys }
            },
            include: {
              roles: {
                select: {
                  tag: true,
                  role: true
                }
              }
            }
          });
          
          // Create a map of plexKey to actors
          moviesWithRoles.forEach(movie => {
            if (movie.roles && movie.roles.length > 0) {
              movieActorData[movie.ratingKey] = movie.roles.map(role => ({
                name: role.tag,
                role: role.role
              }));
            }
          });
        }
      }

      console.log(`Found ${watchLogs.length} watch logs for ${mediaType}`);

      // Initialize statistics counters
      let totalTime = 0;
      let uniqueItems = new Set();
      let customOrders = new Set();
      
      // Process each watch log
      watchLogs.forEach(log => {
        totalTime += (log.totalWatchTime || log.duration || 0);
        
        // Add to unique items based on media type
        if (mediaType === 'tv') {
          uniqueItems.add(log.seriesTitle);
        } else if (mediaType === 'movie') {
          uniqueItems.add(log.title);
        } else {
          uniqueItems.add(log.title);
        }
        
        // Track custom orders
        if (log.customOrderItem?.customOrder) {
          customOrders.add(log.customOrderItem.customOrder.name);
        }
      });

      // Create media-type specific stats structure
      let totalStats = {};
      
      if (mediaType === 'tv') {
        // Calculate series breakdown
        const seriesStats = {};
        const seasonStats = {};
        watchLogs.forEach(log => {
          if (log.seriesTitle) {
            if (!seriesStats[log.seriesTitle]) {
              seriesStats[log.seriesTitle] = {
                name: log.seriesTitle,
                totalEpisodes: 0,
                totalWatchTime: 0,
                seasons: new Set()
              };
            }
            seriesStats[log.seriesTitle].totalEpisodes++;
            seriesStats[log.seriesTitle].totalWatchTime += (log.totalWatchTime || log.duration || 0);
            if (log.seasonNumber) {
              seriesStats[log.seriesTitle].seasons.add(log.seasonNumber);
              seasonStats[`${log.seriesTitle}-S${log.seasonNumber}`] = true;
            }
          }
        });

        const seriesBreakdown = Object.values(seriesStats)
          .map(series => ({
            ...series,
            uniqueSeasons: series.seasons.size,
            averageEpisodeLength: series.totalEpisodes > 0 ? Math.round(series.totalWatchTime / series.totalEpisodes) : 0,
            totalWatchTimeFormatted: this.utilsService.formatWatchTime(series.totalWatchTime)
          }))
          .sort((a, b) => b.totalWatchTime - a.totalWatchTime);

        // Calculate collections breakdown (group by collection if available)
        const collectionStats = {};
        watchLogs.forEach(log => {
          const collectionName = log.collection || log.seriesTitle || 'Uncategorized';
          if (!collectionStats[collectionName]) {
            collectionStats[collectionName] = {
              name: collectionName,
              totalWatchTime: 0,
              totalEpisodes: 0,
              uniqueShows: new Set(),
              uniqueSeasons: new Set()
            };
          }
          collectionStats[collectionName].totalEpisodes++;
          collectionStats[collectionName].totalWatchTime += (log.totalWatchTime || log.duration || 0);
          if (log.seriesTitle) {
            collectionStats[collectionName].uniqueShows.add(log.seriesTitle);
          }
          if (log.seasonNumber && log.seriesTitle) {
            collectionStats[collectionName].uniqueSeasons.add(`${log.seriesTitle}-S${log.seasonNumber}`);
          }
        });

        const collectionBreakdown = Object.values(collectionStats)
          .map(collection => ({
            name: collection.name,
            totalEpisodes: collection.totalEpisodes,
            totalWatchTime: collection.totalWatchTime,
            totalWatchTimeFormatted: this.utilsService.formatWatchTime(collection.totalWatchTime),
            uniqueShows: collection.uniqueShows.size,
            uniqueSeasons: collection.uniqueSeasons.size,
            shows: Array.from(collection.uniqueShows)
          }))
          .sort((a, b) => b.totalWatchTime - a.totalWatchTime);

        // Calculate actor breakdown (using Plex episode actor data)
        const actorStats = {};
        watchLogs.forEach(log => {
          // Get actors from episode data if available
          const actors = episodeActorData[log.plexKey] || [];
          
          actors.forEach(actor => {
            const actorName = actor.name;
            if (actorName) {
              if (!actorStats[actorName]) {
                actorStats[actorName] = {
                  name: actorName,
                  totalWatchTime: 0,
                  episodeCount: 0,
                  series: new Set()
                };
              }
              actorStats[actorName].totalWatchTime += (log.totalWatchTime || log.duration || 0);
              actorStats[actorName].episodeCount++;
              if (log.seriesTitle) {
                actorStats[actorName].series.add(log.seriesTitle);
              }
            }
          });
        });

        const actorBreakdown = {
          byPlaytime: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              seriesCount: actor.series.size,
              series: Array.from(actor.series),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.totalWatchTime - a.totalWatchTime)
            .slice(0, 10),
          byEpisodeCount: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              seriesCount: actor.series.size,
              series: Array.from(actor.series),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.episodeCount - a.episodeCount)
            .slice(0, 10),
          bySeriesCount: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              seriesCount: actor.series.size,
              series: Array.from(actor.series),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.seriesCount - a.seriesCount)
            .slice(0, 10)
        };

        totalStats = {
          totalTvEpisodes: watchLogs.length,
          totalTvWatchTime: totalTime,
          totalTvWatchTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          uniqueShows: uniqueItems.size,
          uniqueSeasons: Object.keys(seasonStats).length,
          uniqueCollections: Object.keys(collectionStats).length,
          uniqueCustomOrders: customOrders.size,
          seriesBreakdown: seriesBreakdown,
          collectionBreakdown: collectionBreakdown,
          actorBreakdown: actorBreakdown
        };
      } else if (mediaType === 'movie') {
        // Calculate movie actor breakdown (using Plex movie actor data)
        const actorStats = {};
        watchLogs.forEach(log => {
          // Get actors from movie data if available
          const actors = movieActorData[log.plexKey] || [];
          
          actors.forEach(actor => {
            const actorName = actor.name;
            if (actorName) {
              if (!actorStats[actorName]) {
                actorStats[actorName] = {
                  name: actorName,
                  totalWatchTime: 0,
                  movieCount: 0,
                  movies: new Set(),
                  collections: new Set()
                };
              }
              actorStats[actorName].totalWatchTime += (log.totalWatchTime || log.duration || 0);
              actorStats[actorName].movieCount++;
              if (log.title) {
                actorStats[actorName].movies.add(log.title);
              }
              // Add collection if available (could be from custom order or Plex collection)
              if (log.collection) {
                actorStats[actorName].collections.add(log.collection);
              } else if (log.customOrderItem?.customOrder?.name) {
                actorStats[actorName].collections.add(log.customOrderItem.customOrder.name);
              }
            }
          });
        });

        const movieActorBreakdown = {
          byPlaytime: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              movieCount: actor.movieCount,
              collectionCount: actor.collections.size,
              movies: Array.from(actor.movies),
              collections: Array.from(actor.collections),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.totalWatchTime - a.totalWatchTime)
            .slice(0, 10),
          byMovieCount: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              movieCount: actor.movieCount,
              collectionCount: actor.collections.size,
              movies: Array.from(actor.movies),
              collections: Array.from(actor.collections),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.movieCount - a.movieCount)
            .slice(0, 10),
          byCollectionCount: Object.values(actorStats)
            .map(actor => ({
              ...actor,
              movieCount: actor.movieCount,
              collectionCount: actor.collections.size,
              movies: Array.from(actor.movies),
              collections: Array.from(actor.collections),
              totalWatchTimeFormatted: this.utilsService.formatWatchTime(actor.totalWatchTime)
            }))
            .sort((a, b) => b.collectionCount - a.collectionCount)
            .slice(0, 10)
        };

        totalStats = {
          totalMovies: watchLogs.length,
          totalMovieWatchTime: totalTime,
          totalMovieWatchTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          uniqueCustomOrders: customOrders.size,
          actorBreakdown: movieActorBreakdown
        };
      } else if (mediaType === 'webvideo') {
        totalStats = {
          totalWebVideos: watchLogs.length,
          totalWebVideoViewTime: totalTime,
          totalWebVideoViewTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          uniqueCustomOrders: customOrders.size
        };
      } else if (mediaType === 'book') {
        // Calculate author breakdown and completed books
        const authorStats = {};
        const publisherStats = {};
        const characterStats = {};
        let totalPagesRead = 0;
        let completedBooks = [];
        let totalCompletedBooks = 0;

        // Track unique books to avoid double-counting pages read
        const uniqueBooks = new Map(); // customOrderItemId -> book data
        
        // First, collect unique books and their current reading progress
        watchLogs.forEach(log => {
          if (log.customOrderItemId && log.customOrderItem) {
            const bookId = log.customOrderItemId;
            const item = log.customOrderItem;
            
            // Extract author from various possible fields
            let authorName = 'Unknown Author';
            if (item.bookAuthor) {
              authorName = item.bookAuthor;
            } else if (log.bookAuthor) {
              authorName = log.bookAuthor;
            } else if (log.author) {
              authorName = log.author;
            } else if (log.title && log.title.includes(' by ')) {
              const parts = log.title.split(' by ');
              if (parts.length > 1) {
                authorName = parts[parts.length - 1].trim();
              }
            }
            
            // Extract publisher
            let publisherName = 'Unknown Publisher';
            if (item.bookPublisher) {
              publisherName = item.bookPublisher;
            } else if (log.bookPublisher) {
              publisherName = log.bookPublisher;
            } else if (log.publisher) {
              publisherName = log.publisher;
            }
            
            // Calculate current pages read for this book
            let currentPagesRead = 0;
            if (item.bookCurrentPage && item.bookCurrentPage > 0) {
              currentPagesRead = item.bookCurrentPage;
            } else if (item.bookPercentRead && item.bookPageCount) {
              currentPagesRead = Math.round((item.bookPercentRead / 100) * item.bookPageCount);
            }
            
            // Check if book is completed
            const isCompleted = log.isCompleted === true || 
                                (log.percentRead && log.percentRead >= 100) ||
                                (log.progress && log.progress >= 1.0) ||
                                (item.bookPercentRead && item.bookPercentRead >= 100) ||
                                (item.bookCurrentPage && item.bookPageCount && 
                                 item.bookCurrentPage >= item.bookPageCount);
                                 
            const isActually100Percent = (log.percentRead && log.percentRead >= 100) ||
                                         (log.progress && log.progress >= 1.0) ||
                                         (item.bookPercentRead && item.bookPercentRead >= 100) ||
                                         (item.bookCurrentPage && item.bookPageCount && 
                                          item.bookCurrentPage >= item.bookPageCount) ||
                                         (log.isCompleted === true && !item);
            
            // Calculate actual percent read for display
            let actualPercentRead = 100;
            if (log.percentRead && log.percentRead >= 100) {
              actualPercentRead = log.percentRead;
            } else if (item.bookPercentRead && item.bookPercentRead >= 100) {
              actualPercentRead = item.bookPercentRead;
            } else if (item.bookCurrentPage && item.bookPageCount && 
                       item.bookCurrentPage >= item.bookPageCount) {
              actualPercentRead = Math.round((item.bookCurrentPage / item.bookPageCount) * 100);
            }
            
            // Store or update the book data (use the latest data if multiple logs)
            uniqueBooks.set(bookId, {
              title: log.title,
              authorName: authorName,
              publisherName: publisherName,
              currentPagesRead: currentPagesRead,
              pageCount: item.bookPageCount || 0,
              totalReadTime: 0, // Will be calculated from all logs for this book
              isCompleted: isCompleted,
              isActually100Percent: isActually100Percent,
              actualPercentRead: actualPercentRead,
              comicCharacters: item.comicCharacters,
              endTime: log.endTime || log.updatedAt,
              year: log.bookYear || log.year
            });
          }
        });
        
        // Calculate total read time per book from all watch logs
        watchLogs.forEach(log => {
          if (log.customOrderItemId && uniqueBooks.has(log.customOrderItemId)) {
            const book = uniqueBooks.get(log.customOrderItemId);
            book.totalReadTime += (log.totalWatchTime || log.duration || 0);
          }
        });
        
        // Now process unique books for statistics
        uniqueBooks.forEach((book, bookId) => {
          const authorName = book.authorName;
          const publisherName = book.publisherName;
          
          // Initialize author stats
          if (!authorStats[authorName]) {
            authorStats[authorName] = {
              name: authorName,
              totalReadTime: 0,
              bookCount: 0,
              completedBooks: 0,
              totalPagesRead: 0,
              books: [],
              completedBooksList: []
            };
          }

          // Add to author stats (once per unique book)
          authorStats[authorName].totalReadTime += book.totalReadTime;
          authorStats[authorName].bookCount++;
          authorStats[authorName].books.push({
            title: book.title,
            readTime: book.totalReadTime
          });

          // Add pages read (once per unique book)
          if (book.currentPagesRead > 0) {
            authorStats[authorName].totalPagesRead += book.currentPagesRead;
            totalPagesRead += book.currentPagesRead;
          }

          // Initialize publisher stats
          if (!publisherStats[publisherName]) {
            publisherStats[publisherName] = {
              name: publisherName,
              totalReadTime: 0,
              bookCount: 0,
              completedBooks: 0,
              totalPagesRead: 0,
              books: [],
              completedBooksList: []
            };
          }

          // Add to publisher stats (once per unique book)
          publisherStats[publisherName].totalReadTime += book.totalReadTime;
          publisherStats[publisherName].bookCount++;
          publisherStats[publisherName].books.push({
            title: book.title,
            readTime: book.totalReadTime
          });

          // Add pages to publisher stats (once per unique book)
          if (book.currentPagesRead > 0) {
            publisherStats[publisherName].totalPagesRead += book.currentPagesRead;
          }

          // Handle character breakdown (for books that might have character data)
          if (book.comicCharacters) {
            const characters = book.comicCharacters.split(',').map(c => c.trim());
            characters.forEach(characterName => {
              if (characterName && characterName !== '') {
                // Initialize character stats
                if (!characterStats[characterName]) {
                  characterStats[characterName] = {
                    name: characterName,
                    totalReadTime: 0,
                    bookCount: 0,
                    completedBooks: 0,
                    totalPagesRead: 0,
                    books: [],
                    completedBooksList: []
                  };
                }

                // Add to character stats (once per unique book)
                characterStats[characterName].totalReadTime += book.totalReadTime;
                characterStats[characterName].bookCount++;
                characterStats[characterName].books.push({
                  title: book.title,
                  readTime: book.totalReadTime
                });

                // Add pages to character stats (once per unique book)
                if (book.currentPagesRead > 0) {
                  characterStats[characterName].totalPagesRead += book.currentPagesRead;
                }
              }
            });
          }

          // Handle completed books
          if (book.isCompleted && book.isActually100Percent) {
            authorStats[authorName].completedBooks++;
            authorStats[authorName].completedBooksList.push({
              title: book.title,
              completedDate: book.endTime,
              author: authorName,
              pageCount: book.currentPagesRead,
              percentRead: book.actualPercentRead,
              year: book.year
            });

            // Also update publisher completion stats
            publisherStats[publisherName].completedBooks++;
            publisherStats[publisherName].completedBooksList.push({
              title: book.title,
              completedDate: book.endTime,
              author: authorName,
              publisher: publisherName,
              pageCount: book.currentPagesRead,
              percentRead: book.actualPercentRead,
              year: book.year
            });

            // Also update character completion stats
            if (book.comicCharacters) {
              const characters = book.comicCharacters.split(',').map(c => c.trim());
              characters.forEach(characterName => {
                if (characterName && characterName !== '' && characterStats[characterName]) {
                  characterStats[characterName].completedBooks++;
                  characterStats[characterName].completedBooksList.push({
                    title: book.title,
                    completedDate: book.endTime,
                    author: authorName,
                    character: characterName,
                    pageCount: book.currentPagesRead,
                    percentRead: book.actualPercentRead,
                    year: book.year
                  });
                }
              });
            }

            totalCompletedBooks++;
            
            completedBooks.push({
              title: book.title,
              author: authorName,
              completedDate: book.endTime,
              pageCount: book.currentPagesRead,
              percentRead: book.actualPercentRead,
              year: book.year,
              readTime: book.totalReadTime
            });
          }
        });

        // Calculate average pages per book for each author, publisher, and character
        Object.values(authorStats).forEach(author => {
          author.averagePagesPerBook = author.bookCount > 0 ? 
            Math.round(author.totalPagesRead / author.bookCount) : 0;
        });

        Object.values(publisherStats).forEach(publisher => {
          publisher.averagePagesPerBook = publisher.bookCount > 0 ? 
            Math.round(publisher.totalPagesRead / publisher.bookCount) : 0;
        });

        Object.values(characterStats).forEach(character => {
          character.averagePagesPerBook = character.bookCount > 0 ? 
            Math.round(character.totalPagesRead / character.bookCount) : 0;
        });

        // Create author breakdowns with different sorting
        const authorBreakdown = {
          byReadTime: Object.values(authorStats)
            .map(author => ({
              ...author,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(author.totalReadTime)
            }))
            .sort((a, b) => b.totalReadTime - a.totalReadTime)
            .slice(0, 10),
          byPagesRead: Object.values(authorStats)
            .map(author => ({
              ...author,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(author.totalReadTime)
            }))
            .sort((a, b) => b.totalPagesRead - a.totalPagesRead)
            .slice(0, 10),
          byBookCount: Object.values(authorStats)
            .map(author => ({
              ...author,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(author.totalReadTime)
            }))
            .sort((a, b) => b.bookCount - a.bookCount)
            .slice(0, 10),
          byCompletedBooks: Object.values(authorStats)
            .filter(author => author.completedBooks > 0) // Only include authors with completed books
            .map(author => ({
              ...author,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(author.totalReadTime)
            }))
            .sort((a, b) => b.completedBooks - a.completedBooks)
            .slice(0, 10)
        };

        // Create publisher breakdowns with different sorting
        const publisherBreakdown = {
          byReadTime: Object.values(publisherStats)
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime)
            }))
            .sort((a, b) => b.totalReadTime - a.totalReadTime)
            .slice(0, 10),
          byPagesRead: Object.values(publisherStats)
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime)
            }))
            .sort((a, b) => b.totalPagesRead - a.totalPagesRead)
            .slice(0, 10),
          byBookCount: Object.values(publisherStats)
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime)
            }))
            .sort((a, b) => b.bookCount - a.bookCount)
            .slice(0, 10),
          byCompletedBooks: Object.values(publisherStats)
            .filter(publisher => publisher.completedBooks > 0) // Only include publishers with completed books
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime)
            }))
            .sort((a, b) => b.completedBooks - a.completedBooks)
            .slice(0, 10)
        };

        // Create character breakdowns with different sorting
        const characterBreakdown = {
          byReadTime: Object.values(characterStats)
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime)
            }))
            .sort((a, b) => b.totalReadTime - a.totalReadTime)
            .slice(0, 10),
          byPagesRead: Object.values(characterStats)
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime)
            }))
            .sort((a, b) => b.totalPagesRead - a.totalPagesRead)
            .slice(0, 10),
          byBookCount: Object.values(characterStats)
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime)
            }))
            .sort((a, b) => b.bookCount - a.bookCount)
            .slice(0, 10),
          byCompletedBooks: Object.values(characterStats)
            .filter(character => character.completedBooks > 0) // Only include characters with completed books
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime)
            }))
            .sort((a, b) => b.completedBooks - a.completedBooks)
            .slice(0, 10)
        };

        // Sort completed books by completion date (most recent first)
        completedBooks.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));

        totalStats = {
          totalBooks: watchLogs.length,
          totalBookReadTime: totalTime,
          totalBookReadTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          totalPagesRead: totalPagesRead,
          totalCompletedBooks: totalCompletedBooks,
          uniqueCustomOrders: customOrders.size,
          authorBreakdown: authorBreakdown,
          publisherBreakdown: publisherBreakdown,
          characterBreakdown: characterBreakdown,
          completedBooks: completedBooks
        };
      } else if (mediaType === 'comic') {
        // Initialize comic-specific publisher and character stats
        const comicPublisherStats = {};
        const comicCharacterStats = {};

        // Process each comic log for publisher and character breakdowns
        watchLogs.forEach(log => {
          const comicReadTime = log.totalWatchTime || 0;
          
          // Process publisher data for comics
          if (log.customOrderItem?.comicPublisher && log.customOrderItem.comicPublisher.trim()) {
            const publisherName = log.customOrderItem.comicPublisher.trim();
            
            if (!comicPublisherStats[publisherName]) {
              comicPublisherStats[publisherName] = {
                name: publisherName,
                totalReadTime: 0,
                comicCount: 0,
                comics: []
              };
            }

            comicPublisherStats[publisherName].totalReadTime += comicReadTime;
            comicPublisherStats[publisherName].comicCount++;
            comicPublisherStats[publisherName].comics.push({
              title: log.title,
              series: log.customOrderItem.comicSeries || 'Unknown Series',
              issue: log.customOrderItem.comicIssue || 'Unknown Issue',
              readTime: comicReadTime
            });
          }

          // Process character data for comics
          if (log.customOrderItem?.comicCharacters) {
            try {
              const characters = JSON.parse(log.customOrderItem.comicCharacters);
              characters.forEach(character => {
                if (character.name && character.name.trim()) {
                  const characterName = character.name.trim();
                  
                  if (!comicCharacterStats[characterName]) {
                    comicCharacterStats[characterName] = {
                      name: characterName,
                      totalReadTime: 0,
                      comicCount: 0,
                      comics: []
                    };
                  }

                  comicCharacterStats[characterName].totalReadTime += comicReadTime;
                  comicCharacterStats[characterName].comicCount++;
                  comicCharacterStats[characterName].comics.push({
                    title: log.title,
                    series: log.customOrderItem.comicSeries || 'Unknown Series',
                    issue: log.customOrderItem.comicIssue || 'Unknown Issue',
                    publisher: log.customOrderItem.comicPublisher || 'Unknown Publisher',
                    readTime: comicReadTime
                  });
                }
              });
            } catch (error) {
              console.warn('Error parsing comic characters JSON:', error);
            }
          }
        });

        // Create comic publisher breakdowns with different sorting
        const publisherBreakdown = {
          byReadTime: Object.values(comicPublisherStats)
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime),
              averageReadTime: publisher.comicCount > 0 ? Math.round(publisher.totalReadTime / publisher.comicCount) : 0
            }))
            .sort((a, b) => b.totalReadTime - a.totalReadTime)
            .slice(0, 10),
          byComicCount: Object.values(comicPublisherStats)
            .map(publisher => ({
              ...publisher,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(publisher.totalReadTime),
              averageReadTime: publisher.comicCount > 0 ? Math.round(publisher.totalReadTime / publisher.comicCount) : 0
            }))
            .sort((a, b) => b.comicCount - a.comicCount)
            .slice(0, 10)
        };

        // Create comic character breakdowns with different sorting
        const characterBreakdown = {
          byReadTime: Object.values(comicCharacterStats)
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime),
              averageReadTime: character.comicCount > 0 ? Math.round(character.totalReadTime / character.comicCount) : 0
            }))
            .sort((a, b) => b.totalReadTime - a.totalReadTime)
            .slice(0, 10),
          byComicCount: Object.values(comicCharacterStats)
            .map(character => ({
              ...character,
              totalReadTimeFormatted: this.utilsService.formatWatchTime(character.totalReadTime),
              averageReadTime: character.comicCount > 0 ? Math.round(character.totalReadTime / character.comicCount) : 0
            }))
            .sort((a, b) => b.comicCount - a.comicCount)
            .slice(0, 10)
        };

        totalStats = {
          totalComics: watchLogs.length,
          totalComicReadTime: totalTime,
          totalComicReadTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          uniqueCustomOrders: customOrders.size,
          publisherBreakdown: publisherBreakdown,
          characterBreakdown: characterBreakdown
        };
      } else if (mediaType === 'shortstory') {
        totalStats = {
          totalShortStories: watchLogs.length,
          totalShortStoryReadTime: totalTime,
          totalShortStoryReadTimeFormatted: this.utilsService.formatWatchTime(totalTime),
          uniqueCustomOrders: customOrders.size
        };
      }

      // Return the structure expected by the frontend
      return {
        totalStats,
        logs: watchLogs
      };
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

  /**
   * Get all activity stats across all media types
   * @param {string} period - Time period filter 
   * @param {string} groupBy - How to group the results
   * @returns {Promise<Object>} All activity statistics
   */
  async getAllActivityStats(period = 'all', groupBy = 'day') {
    try {
      // Build date filter based on period using timezone-aware calculations
      const whereClause = {};
      
      let actualStartDate = null;
      let actualEndDate = null;

      if (period !== 'all') {
        const bounds = await this.utilsService.getTimezoneAwarePeriodBounds(period);
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

      // Get all watch logs across all media types
      const watchLogs = await this.prisma.watchLog.findMany({
        where: whereClause,
        orderBy: { startTime: 'desc' }
      });

      console.log(`Found ${watchLogs.length} watch logs for period ${period}`);

      // Group by media type for summary
      const mediaTypeCounts = {};
      const totalMinutes = {
        tv: 0,
        movie: 0,
        book: 0,
        comic: 0,
        shortstory: 0,
        webvideo: 0
      };

      watchLogs.forEach(log => {
        if (!mediaTypeCounts[log.mediaType]) {
          mediaTypeCounts[log.mediaType] = 0;
        }
        mediaTypeCounts[log.mediaType]++;
        
        if (log.duration && totalMinutes[log.mediaType] !== undefined) {
          totalMinutes[log.mediaType] += log.duration;
        }
      });

      return {
        period,
        groupBy,
        totalCount: watchLogs.length,
        logs: watchLogs,
        mediaTypeCounts,
        totalMinutes,
        periodStart: actualStartDate,
        periodEnd: actualEndDate
      };
    } catch (error) {
      console.error('Error getting all activity stats:', error);
      throw error;
    }
  }
}

module.exports = ActivityStatsService;
