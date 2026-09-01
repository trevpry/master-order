const prisma = require('./prismaClient'); // Use the shared Prisma client

class PlexDatabaseService {
  constructor() {
    this.prisma = prisma; // Assign the shared instance
    
    // Detect database provider to handle table name casing differences
    this.isPostgreSQL = this.detectPostgreSQL();
  }
  
  /**
   * Detect if we're using PostgreSQL based on DATABASE_URL
   */
  detectPostgreSQL() {
    const databaseUrl = process.env.DATABASE_URL || '';
    return databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
  }
  
  /**
   * Get the correct table name based on database provider
   * PostgreSQL uses Pascal case (PlexEpisode), SQLite uses camelCase (plexEpisode)
   */
  getTableName(tableName) {
    if (this.isPostgreSQL) {
      // Convert camelCase to PascalCase for PostgreSQL
      return tableName.charAt(0).toUpperCase() + tableName.slice(1);
    }
    return tableName;
  }  // Get all library sections from database
  async getLibrarySections() {
    try {
      return await this.prisma.plexLibrarySection.findMany();
    } catch (error) {
      console.error('Error fetching library sections:', error);
      throw error;
    }
  }

  // Get TV sections only
  async getTVSections() {
    try {
      return await this.prisma.plexLibrarySection.findMany({
        where: { type: 'show' }
      });
    } catch (error) {
      console.error('Error fetching TV sections:', error);
      throw error;
    }
  }

  // Get movie sections only
  async getMovieSections() {
    try {
      return await this.prisma.plexLibrarySection.findMany({
        where: { type: 'movie' }
      });
    } catch (error) {
      console.error('Error fetching movie sections:', error);
      throw error;
    }
  }

  // Get all TV shows from database
  async getAllTVShows() {
    try {
      return await this.prisma.plexTVShow.findMany({
        where: { removed: false },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching all TV shows:', error);
      throw error;
    }
  }
  // Get TV shows from specific section
  async getTVShowsBySection(sectionKey) {
    try {
      return await this.prisma.plexTVShow.findMany({
        where: { 
          sectionKey,
          removed: false 
        },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching TV shows by section:', error);
      throw error;
    }
  }

  // Get TV shows by collection name
  async getTVShowsByCollection(collectionName) {
    try {
      // If no collection name provided, return empty array
      if (!collectionName || collectionName.trim() === '') {
        console.log('No collection name provided, returning empty array');
        return [];
      }

      return await this.prisma.plexTVShow.findMany({
        where: {
          collections: {
            contains: collectionName
          },
          removed: false
        },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching TV shows by collection:', error);
      throw error;
    }
  }

  // Get all movies from database
  async getAllMovies() {
    try {
      return await this.prisma.plexMovie.findMany({
        where: { removed: false },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching all movies:', error);
      throw error;
    }
  }

  // Get movies from specific section
  async getMoviesBySection(sectionKey) {
    try {
      return await this.prisma.plexMovie.findMany({
        where: { 
          sectionKey,
          removed: false 
        },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching movies by section:', error);
      throw error;
    }
  }

  // Get movies by collection name
  async getMoviesByCollection(collectionName) {
    try {
      return await this.prisma.plexMovie.findMany({
        where: {
          collections: {
            contains: collectionName
          },
          removed: false
        },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching movies by collection:', error);
      throw error;
    }
  }

  // Get TV show by rating key
  async getTVShowByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexTVShow.findUnique({
        where: { ratingKey },
        include: {
          section: true,
          seasons: {
            include: {
              episodes: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching TV show by rating key:', error);
      throw error;
    }
  }

  // Get movie by rating key
  async getMovieByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexMovie.findUnique({
        where: { ratingKey },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error fetching movie by rating key:', error);
      throw error;
    }
  }

  // Get seasons for a TV show
  async getSeasonsByShowRatingKey(showRatingKey) {
    try {
      return await this.prisma.plexSeason.findMany({
        where: { 
          showRatingKey,
          removed: false 
        },
        include: {
          episodes: {
            where: { removed: false }
          }
        },
        orderBy: { index: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching seasons:', error);
      throw error;
    }
  }

  // Get episodes for a season
  async getEpisodesBySeasonRatingKey(seasonRatingKey) {
    try {
      return await this.prisma.plexEpisode.findMany({
        where: { 
          seasonRatingKey,
          removed: false 
        },
        orderBy: { index: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching episodes:', error);
      throw error;
    }
  }
  // Search for TV shows by title
  async searchTVShows(query, year = null) {
    try {
      // Extract year from query if it contains a year in parentheses
      const yearMatch = query.match(/^(.+?)\s*\((\d{4})\)$/);
      let searchTitle = query;
      let searchYear = year; // Start with provided year
      
      if (yearMatch) {
        searchTitle = yearMatch[1].trim(); // Title without year
        searchYear = parseInt(yearMatch[2]); // Extracted year takes precedence
        console.log(`📺 Extracted year from TV show query: "${query}" -> title: "${searchTitle}", year: ${searchYear}`);
      }
      
      const whereCondition = {
        title: {
          equals: searchTitle.trim()
        }
      };
      
      // Add year filter if we have one (either provided or extracted)
      if (searchYear !== null) {
        whereCondition.year = searchYear;
      }
      
      return await this.prisma.plexTVShow.findMany({
        where: whereCondition,
        include: {
          section: true,
          seasons: {
            include: {
              episodes: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error searching TV shows:', error);
      throw error;
    }
  }

  // Search for movies by title
  async searchMovies(query) {
    try {
      return await this.prisma.plexMovie.findMany({
        where: {
          title: {
            contains: query
          }
        },
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error searching movies:', error);
      throw error;
    }
  }

  // Search for episodes by title or series title
  async searchEpisodes(query) {
    try {
      // Extract year from query if it contains a year in parentheses
      const yearMatch = query.match(/^(.+?)\s*\((\d{4})\)$/);
      let searchQuery = query;
      let searchYear = null;
      
      if (yearMatch) {
        searchQuery = yearMatch[1].trim(); // Query without year
        searchYear = parseInt(yearMatch[2]); // Extracted year
        console.log(`📺 Extracted year from episode search: "${query}" -> query: "${searchQuery}", year: ${searchYear}`);
      }
      
      const whereCondition = {
        OR: [
          {
            title: {
              contains: searchQuery
            }
          },
          {
            showTitle: {
              contains: searchQuery
            }
          }
        ]
      };
      
      // If we extracted a year, also search for episodes from shows with that year
      if (searchYear) {
        whereCondition.OR.push({
          AND: [
            {
              showTitle: {
                contains: searchQuery
              }
            },
            {
              season: {
                show: {
                  year: searchYear
                }
              }
            }
          ]
        });
      }
      
      return await this.prisma.plexEpisode.findMany({
        where: whereCondition,
        include: {
          season: {
            include: {
              show: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error searching episodes:', error);
      throw error;
    }
  }

  // Get all episodes for a specific TV show
  async getAllEpisodesForShow(showRatingKey) {
    try {
      const seasons = await this.getSeasonsByShowRatingKey(showRatingKey);
      const allEpisodes = [];
      
      for (const season of seasons) {
        allEpisodes.push(...season.episodes);
      }
      
      // Sort by season and episode number
      return allEpisodes.sort((a, b) => {
        if (a.seasonIndex !== b.seasonIndex) {
          return a.seasonIndex - b.seasonIndex;
        }
        return a.index - b.index;
      });
    } catch (error) {
      console.error('Error fetching all episodes for show:', error);
      throw error;
    }
  }

  // Get next unwatched episode for a TV show
  async getNextUnwatchedEpisode(showRatingKey) {
    try {
      const seasons = await this.getSeasonsByShowRatingKey(showRatingKey);
      
      // Sort seasons by index
      const sortedSeasons = seasons.sort((a, b) => a.index - b.index);
      
      for (const season of sortedSeasons) {
        // Skip season 0 (specials) unless it's the only season
        if (season.index === 0 && seasons.length > 1) continue;
        
        // Sort episodes by index
        const sortedEpisodes = season.episodes.sort((a, b) => a.index - b.index);
        
        // Find first unwatched episode
        const unwatchedEpisode = sortedEpisodes.find(episode => 
          !episode.viewCount || episode.viewCount === 0
        );
        
        if (unwatchedEpisode) {
          return {
            ...unwatchedEpisode,
            seasonNumber: season.index,
            seasonTitle: season.title,
            totalEpisodesInSeason: sortedEpisodes.length,
            episodeTitle: unwatchedEpisode.title,
            episodeNumber: unwatchedEpisode.index
          };
        }
      }
      
      return null; // No unwatched episodes found
    } catch (error) {
      console.error('Error finding next unwatched episode:', error);
      throw error;
    }
  }

  // Get all collections for TV shows
  async getAllTVCollections() {
    try {
      const shows = await this.getAllTVShows();
      const collectionsSet = new Set();
      
      shows.forEach(show => {
        if (show.collections) {
          try {
            const collections = JSON.parse(show.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for show:', show.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching TV collections:', error);
      throw error;
    }
  }

  // Get all collections for movies
  async getAllMovieCollections() {
    try {
      const movies = await this.getAllMovies();
      const collectionsSet = new Set();
      
      movies.forEach(movie => {
        if (movie.collections) {
          try {
            const collections = JSON.parse(movie.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for movie:', movie.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching movie collections:', error);
      throw error;
    }
  }

  // Get detailed metadata for a specific item (similar to Plex API metadata endpoint)
  async getItemMetadata(ratingKey, type = null) {
    try {
      // Try to find in TV shows first
      let item = await this.getTVShowByRatingKey(ratingKey);
      if (item) {
        return {
          ...item,
          type: 'show',
          Collection: this.parseCollections(item.collections)
        };
      }
      
      // Try to find in movies
      item = await this.getMovieByRatingKey(ratingKey);
      if (item) {
        return {
          ...item,
          type: 'movie',
          Collection: this.parseCollections(item.collections)
        };
      }
      
      // Try to find in episodes
      const episode = await this.prisma.plexEpisode.findUnique({
        where: { ratingKey },
        include: {
          season: {
            include: {
              show: true
            }
          }
        }
      });
      
      if (episode) {
        return {
          ...episode,
          type: 'episode',
          grandparentTitle: episode.season.show.title,
          parentTitle: episode.season.title,
          parentIndex: episode.seasonIndex,
          grandparentRatingKey: episode.season.show.ratingKey,
          parentRatingKey: episode.season.ratingKey
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching item metadata:', error);
      throw error;
    }
  }
  // Helper method to parse collections JSON
  parseCollections(collectionsJson) {
    if (!collectionsJson) return [];
    try {
      const collections = JSON.parse(collectionsJson);
      return collections; // Return the array of strings directly
    } catch (error) {
      console.error('Error parsing collections JSON:', error);
      return [];
    }
  }
  // Get database sync status
  async getSyncStatus() {
    try {
      const sections = await this.prisma.plexLibrarySection.count();
      const shows = await this.prisma.plexTVShow.count();
      const seasons = await this.prisma.plexSeason.count();
      const episodes = await this.prisma.plexEpisode.count();
      const movies = await this.prisma.plexMovie.count();
      
      // Get last sync time
      const lastSyncedShow = await this.prisma.plexTVShow.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedMovie = await this.prisma.plexMovie.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSync = [lastSyncedShow?.lastSyncedAt, lastSyncedMovie?.lastSyncedAt]
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      
      return {
        sections,
        shows,
        seasons,
        episodes,
        movies,
        lastSync,
        hasData: sections > 0
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  // Search methods for the API endpoints  // Search TV shows by title
  async searchTVShows(query, year = null) {
    try {
      // Extract year from query if it contains a year in parentheses
      const yearMatch = query.match(/^(.+?)\s*\((\d{4})\)$/);
      let searchTitle = query;
      let searchYear = year; // Start with provided year
      
      if (yearMatch) {
        searchTitle = yearMatch[1].trim(); // Title without year
        searchYear = parseInt(yearMatch[2]); // Extracted year takes precedence
        console.log(`📺 Extracted year from TV show query: "${query}" -> title: "${searchTitle}", year: ${searchYear}`);
      }
      
      const whereCondition = {
        title: {
          equals: searchTitle.trim()
        }
      };
      
      // Add year filter if we have one (either provided or extracted)
      if (searchYear !== null) {
        whereCondition.year = searchYear;
      }
      
      console.log(`📺 Database search condition:`, JSON.stringify(whereCondition, null, 2));
      
      const results = await this.prisma.plexTVShow.findMany({
        where: whereCondition,
        include: {
          section: true
        }
      });
      
      console.log(`📺 Found ${results.length} shows in database`);
      if (results.length > 0) {
        console.log(`📺 First result:`, { title: results[0].title, year: results[0].year });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching TV shows:', error);
      throw error;
    }
  }

  // Search TV episodes by series title, season, and episode number
  async searchTVEpisodes(seriesTitle, seasonNumber, episodeNumber) {
    try {
      // Extract year from series title if it contains a year in parentheses
      const yearMatch = seriesTitle.match(/^(.+?)\s*\((\d{4})\)$/);
      let searchTitle = seriesTitle;
      let searchYear = null;
      
      if (yearMatch) {
        searchTitle = yearMatch[1].trim(); // Title without year
        searchYear = parseInt(yearMatch[2]); // Extracted year
        console.log(`📺 Extracted year from series title: "${seriesTitle}" -> title: "${searchTitle}", year: ${searchYear}`);
      }
      
      const whereCondition = {
        seasonIndex: seasonNumber,
        index: episodeNumber,
        season: {
          show: {
            title: {
              equals: searchTitle.trim()
            }
          }
        }
      };
      
      // If we extracted a year, also filter by the show's year
      if (searchYear) {
        whereCondition.season.show.year = searchYear;
      }
      
      return await this.prisma.plexEpisode.findMany({
        where: whereCondition,
        include: {
          season: {
            include: {
              show: {
                include: {
                  section: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error searching TV episodes:', error);
      return [];
    }
  }

  // Search movies by title
  async searchMovies(query, year = null) {
    try {
      const whereCondition = {
        title: {
          contains: query
        }
      };
      
      // Add year filter if provided
      if (year !== null) {
        whereCondition.year = year;
      }
      
      return await this.prisma.plexMovie.findMany({
        where: whereCondition,
        include: {
          section: true
        }
      });
    } catch (error) {
      console.error('Error searching movies:', error);
      throw error;
    }
  }  // Search episodes by title
  async searchEpisodes(query, year = null) {
    try {
      const whereCondition = {
        OR: [
          {
            title: {
              contains: query
            }
          },
          {
            grandparentTitle: {
              contains: query
            }
          }
        ]
      };
      
      // Add year filter if provided (filter by show year through season relationship)
      if (year !== null) {
        whereCondition.season = {
          show: {
            year: year
          }
        };
      }
      
      return await this.prisma.plexEpisode.findMany({
        where: whereCondition,
        include: {
          season: {
            include: {
              show: true
            }
          }
        }
      });
    } catch (error) {      console.error('Error searching episodes:', error);
      throw error;
    }
  }

  // Mark an episode as watched by updating its viewCount
  async markEpisodeAsWatched(ratingKey) {
    try {
      console.log(`🔍 Marking episode with ratingKey ${ratingKey} as watched (DB: ${this.isPostgreSQL ? 'PostgreSQL' : 'SQLite'})`);
      
      const tableName = this.getTableName('plexEpisode');
      console.log(`📊 Using table name: ${tableName}`);
      
      // First check if the episode exists
      const existingEpisode = await this.prisma[tableName].findUnique({
        where: { ratingKey: ratingKey }
      });
      
      if (!existingEpisode) {
        console.warn(`⚠️  Episode with ratingKey ${ratingKey} not found in ${tableName} table`);
        return null;
      }
      
      console.log(`✅ Found episode: ${existingEpisode.title} (current viewCount: ${existingEpisode.viewCount})`);
      
      const result = await this.prisma[tableName].update({
        where: { ratingKey: ratingKey },
        data: { viewCount: 1 } // Set viewCount to 1 to mark as watched
      });
      
      console.log(`🎯 Successfully marked episode ${ratingKey} as watched (viewCount set to 1)`);
      return result;
    } catch (error) {
      console.error(`❌ Error marking episode ${ratingKey} as watched:`, error);
      throw error;
    }
  }

  // Mark a movie as watched by updating its viewCount
  async markMovieAsWatched(ratingKey) {
    try {
      console.log(`🔍 Marking movie with ratingKey ${ratingKey} as watched (DB: ${this.isPostgreSQL ? 'PostgreSQL' : 'SQLite'})`);
      
      const tableName = this.getTableName('plexMovie');
      console.log(`📊 Using table name: ${tableName}`);
      
      // First check if the movie exists
      const existingMovie = await this.prisma[tableName].findUnique({
        where: { ratingKey: ratingKey }
      });
      
      if (!existingMovie) {
        console.warn(`⚠️  Movie with ratingKey ${ratingKey} not found in ${tableName} table`);
        return null;
      }
      
      console.log(`✅ Found movie: ${existingMovie.title} (current viewCount: ${existingMovie.viewCount})`);
      
      const result = await this.prisma[tableName].update({
        where: { ratingKey: ratingKey },
        data: { viewCount: 1 } // Set viewCount to 1 to mark as watched
      });
      
      console.log(`🎯 Successfully marked movie ${ratingKey} as watched (viewCount set to 1)`);
      return result;
    } catch (error) {
      console.error(`❌ Error marking movie ${ratingKey} as watched:`, error);
      throw error;
    }
  }

  // Music-related methods
  
  // Build a starts-with filter for alphabet-letter browsing by sort name.
  makeStartsWithFilter(value) {
    return this.isPostgreSQL
      ? { startsWith: value, mode: 'insensitive' }
      : { startsWith: value };
  }

  // Letter browsing follows the sorted catalog. Fall back to the display title only when
  // no explicit sort name exists.
  buildArtistLetterFilter(letter) {
    if (!letter) {
      return null;
    }

    return {
      OR: [
        { titleSort: this.makeStartsWithFilter(letter) },
        {
          AND: [
            {
              OR: [
                { titleSort: null },
                { titleSort: '' }
              ]
            },
            { title: this.makeStartsWithFilter(letter) }
          ]
        }
      ]
    };
  }

  // Get all artists from database
  async getAllArtists(limit, offset, letter) {
    try {
      const where = { removed: false };
      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND = [letterFilter];
      }

      const query = {
        where,
        include: {
          librarySection: true
        },
        orderBy: [
          { titleSort: 'asc' },
          { title: 'asc' }
        ]
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexArtist.findMany(query);
    } catch (error) {
      console.error('Error fetching all artists:', error);
      throw error;
    }
  }

  // Get total count of artists
  async getArtistsCount(letter) {
    try {
      const where = { removed: false };
      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND = [letterFilter];
      }

      return await this.prisma.plexArtist.count({ where });
    } catch (error) {
      console.error('Error fetching artists count:', error);
      throw error;
    }
  }

  // Get artists from specific section
  async getArtistsBySection(sectionKey, limit, offset, letter) {
    try {
      const where = {
        librarySection: {
          sectionKey: sectionKey
        }
      };
      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND = [letterFilter];
      }

      const query = {
        where,
        include: {
          librarySection: true
        },
        orderBy: [
          { titleSort: 'asc' },
          { title: 'asc' }
        ]
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexArtist.findMany(query);
    } catch (error) {
      console.error('Error fetching artists by section:', error);
      throw error;
    }
  }

  // Get total count of artists in a specific section
  async getArtistsBySectionCount(sectionKey, letter) {
    try {
      const where = {
        librarySection: {
          sectionKey: sectionKey
        }
      };
      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND = [letterFilter];
      }

      return await this.prisma.plexArtist.count({ where });
    } catch (error) {
      console.error('Error fetching artists count by section:', error);
      throw error;
    }
  }

  // Search artists by title
  async searchArtists(searchQuery, letter) {
    try {
      const makeContainsFilter = (value) => (
        this.isPostgreSQL
          ? { contains: value, mode: 'insensitive' }
          : { contains: value }
      );

      const where = {
        removed: false,
        AND: [
          {
            OR: [
              {
                title: makeContainsFilter(searchQuery)
              },
              {
                titleSort: makeContainsFilter(searchQuery)
              },
              {
                userTitle: makeContainsFilter(searchQuery)
              },
              {
                userSortName: makeContainsFilter(searchQuery)
              },
              {
                musicBrainzAliases: makeContainsFilter(searchQuery)
              }
            ]
          }
        ]
      };

      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND.push(letterFilter);
      }

      return await this.prisma.plexArtist.findMany({
        where,
        include: {
          librarySection: true
        },
        orderBy: [
          { titleSort: 'asc' },
          { title: 'asc' }
        ]
      });
    } catch (error) {
      console.error('Error searching artists:', error);
      throw error;
    }
  }

  // Search artists by title within a specific section
  async searchArtistsBySection(sectionKey, searchQuery, limit, offset, letter) {
    try {
      const makeContainsFilter = (value) => (
        this.isPostgreSQL
          ? { contains: value, mode: 'insensitive' }
          : { contains: value }
      );

      const where = {
        removed: false,
        AND: [
          {
            librarySection: {
              sectionKey: sectionKey
            }
          },
          {
            OR: [
              {
                title: makeContainsFilter(searchQuery)
              },
              {
                titleSort: makeContainsFilter(searchQuery)
              },
              {
                userTitle: makeContainsFilter(searchQuery)
              },
              {
                userSortName: makeContainsFilter(searchQuery)
              },
              {
                musicBrainzAliases: makeContainsFilter(searchQuery)
              }
            ]
          }
        ]
      };

      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND.push(letterFilter);
      }

      const query = {
        where,
        include: {
          librarySection: true
        },
        orderBy: [
          { titleSort: 'asc' },
          { title: 'asc' }
        ]
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexArtist.findMany(query);
    } catch (error) {
      console.error('Error searching artists by section:', error);
      throw error;
    }
  }

  // Get total count of searched artists in a specific section
  async searchArtistsBySectionCount(sectionKey, searchQuery, letter) {
    try {
      const makeContainsFilter = (value) => (
        this.isPostgreSQL
          ? { contains: value, mode: 'insensitive' }
          : { contains: value }
      );

      const where = {
        removed: false,
        AND: [
          {
            librarySection: {
              sectionKey: sectionKey
            }
          },
          {
            OR: [
              {
                title: makeContainsFilter(searchQuery)
              },
              {
                titleSort: makeContainsFilter(searchQuery)
              },
              {
                userTitle: makeContainsFilter(searchQuery)
              },
              {
                userSortName: makeContainsFilter(searchQuery)
              },
              {
                musicBrainzAliases: makeContainsFilter(searchQuery)
              }
            ]
          }
        ]
      };

      const letterFilter = this.buildArtistLetterFilter(letter);
      if (letterFilter) {
        where.AND.push(letterFilter);
      }

      return await this.prisma.plexArtist.count({
        where
      });
    } catch (error) {
      console.error('Error counting searched artists by section:', error);
      throw error;
    }
  }

  // Get artist by rating key
  async getArtistByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexArtist.findUnique({
        where: { ratingKey },
        include: {
          librarySection: true,
          albums: true
        }
      });
    } catch (error) {
      console.error('Error fetching artist by rating key:', error);
      throw error;
    }
  }

  // Create or update artist
  async upsertArtist(artistData) {
    try {
      return await this.prisma.plexArtist.upsert({
        where: { ratingKey: artistData.ratingKey },
        update: artistData,
        create: artistData
      });
    } catch (error) {
      console.error('Error upserting artist:', error);
      throw error;
    }
  }

  // Get all albums from database
  async getAllAlbums(limit, offset) {
    try {
      const query = {
        where: { removed: false },
        include: {
          librarySection: true,
          artist: true
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexAlbum.findMany(query);
    } catch (error) {
      console.error('Error fetching all albums:', error);
      throw error;
    }
  }

  // Get albums from specific section
  async getAlbumsBySection(sectionKey, limit, offset) {
    try {
      const query = {
        where: {
          librarySection: {
            sectionKey: sectionKey
          }
        },
        include: {
          librarySection: true,
          artist: true
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexAlbum.findMany(query);
    } catch (error) {
      console.error('Error fetching albums by section:', error);
      throw error;
    }
  }

  // Get albums by artist
  async getAlbumsByArtist(artistRatingKey) {
    try {
      return await this.prisma.plexAlbum.findMany({
        where: {
          removed: false,
          OR: [
            { parentRatingKey: artistRatingKey },
            {
              albumArtists: {
                some: {
                  artistKey: artistRatingKey
                }
              }
            }
          ]
        },
        include: {
          librarySection: true,
          artist: true,
          tracks: true
        },
        orderBy: { year: 'desc' }
      });
    } catch (error) {
      console.error('Error fetching albums by artist:', error);
      throw error;
    }
  }

  // Get album by rating key
  async getAlbumByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexAlbum.findUnique({
        where: { ratingKey },
        include: {
          librarySection: true,
          artist: true,
          tracks: true,
          albumArtists: {
            include: {
              artist: true,
              artistType: true
            },
            orderBy: [
              { artistType: { name: 'asc' } },
              { artist: { title: 'asc' } }
            ]
          }
        }
      });
    } catch (error) {
      console.error('Error fetching album by rating key:', error);
      throw error;
    }
  }

  // Create or update album
  async upsertAlbum(albumData) {
    try {
      return await this.prisma.plexAlbum.upsert({
        where: { ratingKey: albumData.ratingKey },
        update: albumData,
        create: albumData
      });
    } catch (error) {
      console.error('Error upserting album:', error);
      throw error;
    }
  }

  // Get album count for pagination
  async getAlbumsCount() {
    try {
      return await this.prisma.plexAlbum.count();
    } catch (error) {
      console.error('Error counting albums:', error);
      throw error;
    }
  }

  // Get albums by section count for pagination
  async getAlbumsBySectionCount(sectionKey) {
    try {
      return await this.prisma.plexAlbum.count({
        where: {
          librarySection: {
            sectionKey: sectionKey
          }
        }
      });
    } catch (error) {
      console.error('Error counting albums by section:', error);
      throw error;
    }
  }

  // Search albums with pagination
  async searchAlbums(searchTerm, limit, offset) {
    try {
      const query = {
        where: {
          OR: [
            { title: { contains: searchTerm } },
            { artist: { title: { contains: searchTerm } } }
          ]
        },
        include: {
          librarySection: true,
          artist: true
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexAlbum.findMany(query);
    } catch (error) {
      console.error('Error searching albums:', error);
      throw error;
    }
  }

  // Search albums by section with pagination
  async searchAlbumsBySection(searchTerm, sectionKey, limit, offset) {
    try {
      const query = {
        where: {
          AND: [
            {
              OR: [
                { title: { contains: searchTerm } },
                { artist: { title: { contains: searchTerm } } }
              ]
            },
            {
              librarySection: {
                sectionKey: sectionKey
              }
            }
          ]
        },
        include: {
          librarySection: true,
          artist: true
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexAlbum.findMany(query);
    } catch (error) {
      console.error('Error searching albums by section:', error);
      throw error;
    }
  }

  // Get all tracks from database
  async getAllTracks(limit, offset) {
    try {
      const query = {
        where: { removed: false },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexTrack.findMany(query);
    } catch (error) {
      console.error('Error fetching all tracks:', error);
      throw error;
    }
  }

  // Get tracks from specific section
  async getTracksBySection(sectionKey, limit, offset) {
    try {
      const query = {
        where: {
          librarySection: {
            sectionKey: sectionKey
          }
        },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexTrack.findMany(query);
    } catch (error) {
      console.error('Error fetching tracks by section:', error);
      throw error;
    }
  }

  // Get tracks by album
  async getTracksByAlbum(albumRatingKey) {
    try {
      return await this.prisma.plexTrack.findMany({
        where: { parentRatingKey: albumRatingKey },
        include: {
          librarySection: true,
          work: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: { index: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching tracks by album:', error);
      throw error;
    }
  }

  // Get tracks by artist
  async getTracksByArtist(artistRatingKey) {
    try {
      return await this.prisma.plexTrack.findMany({
        where: { grandparentRatingKey: artistRatingKey },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: [
          { parentRatingKey: 'asc' }, // Group by album first
          { index: 'asc' }            // Then by track index
        ]
      });
    } catch (error) {
      console.error('Error fetching tracks by artist:', error);
      throw error;
    }
  }

  // Get track by rating key
  async getTrackByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexTrack.findUnique({
        where: { ratingKey },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching track by rating key:', error);
      throw error;
    }
  }

  // Create or update track
  async upsertTrack(trackData) {
    try {
      return await this.prisma.plexTrack.upsert({
        where: { ratingKey: trackData.ratingKey },
        update: trackData,
        create: trackData
      });
    } catch (error) {
      console.error('Error upserting track:', error);
      throw error;
    }
  }

  // Get track count for pagination
  async getTracksCount() {
    try {
      return await this.prisma.plexTrack.count();
    } catch (error) {
      console.error('Error counting tracks:', error);
      throw error;
    }
  }

  // Get tracks by section count for pagination
  async getTracksBySectionCount(sectionKey) {
    try {
      return await this.prisma.plexTrack.count({
        where: {
          librarySection: {
            sectionKey: sectionKey
          }
        }
      });
    } catch (error) {
      console.error('Error counting tracks by section:', error);
      throw error;
    }
  }

  // Search tracks with pagination
  async searchTracks(searchTerm, limit, offset) {
    try {
      const query = {
        where: {
          OR: [
            { title: { contains: searchTerm } },
            { album: { title: { contains: searchTerm } } },
            { album: { artist: { title: { contains: searchTerm } } } }
          ]
        },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexTrack.findMany(query);
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw error;
    }
  }

  // Search tracks by section with pagination
  async searchTracksBySection(searchTerm, sectionKey, limit, offset) {
    try {
      const query = {
        where: {
          AND: [
            {
              OR: [
                { title: { contains: searchTerm } },
                { album: { title: { contains: searchTerm } } },
                { album: { artist: { title: { contains: searchTerm } } } }
              ]
            },
            {
              librarySection: {
                sectionKey: sectionKey
              }
            }
          ]
        },
        include: {
          librarySection: true,
          album: {
            include: {
              artist: true
            }
          }
        },
        orderBy: { title: 'asc' }
      };

      // Add pagination if limit is provided
      if (limit !== undefined) {
        query.take = limit;
        if (offset !== undefined) {
          query.skip = offset;
        }
      }

      return await this.prisma.plexTrack.findMany(query);
    } catch (error) {
      console.error('Error searching tracks by section:', error);
      throw error;
    }
  }

  // Get music statistics
  async getMusicStats() {
    try {
      const [artistCount, albumCount, trackCount, musicSections] = await Promise.all([
        this.prisma.plexArtist.count(),
        this.prisma.plexAlbum.count(),
        this.prisma.plexTrack.count(),
        this.prisma.plexLibrarySection.count({
          where: { type: 'artist' }
        })
      ]);

      return {
        artists: artistCount,
        albums: albumCount,
        tracks: trackCount,
        musicSections: musicSections
      };
    } catch (error) {
      console.error('Error fetching music statistics:', error);
      throw error;
    }
  }

  // Get music sections only
  async getMusicSections() {
    try {
      return await this.prisma.plexLibrarySection.findMany({
        where: { type: 'artist' },
        orderBy: { title: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching music sections:', error);
      throw error;
    }
  }

  // Get all music collections for artists
  async getAllMusicArtistCollections() {
    try {
      const artists = await this.prisma.plexArtist.findMany({
        where: {
          collections: {
            not: null
          }
        }
      });
      const collectionsSet = new Set();
      
      artists.forEach(artist => {
        if (artist.collections) {
          try {
            const collections = JSON.parse(artist.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for artist:', artist.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching music artist collections:', error);
      throw error;
    }
  }

  // Get all music collections for albums
  async getAllMusicAlbumCollections() {
    try {
      const albums = await this.prisma.plexAlbum.findMany({
        where: {
          collections: {
            not: null
          }
        }
      });
      const collectionsSet = new Set();
      
      albums.forEach(album => {
        if (album.collections) {
          try {
            const collections = JSON.parse(album.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for album:', album.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching music album collections:', error);
      throw error;
    }
  }

  // Get all music collections for artists by section
  async getAllMusicArtistCollectionsBySection(sectionKey) {
    try {
      const artists = await this.prisma.plexArtist.findMany({
        where: {
          AND: [
            { collections: { not: null } },
            { librarySection: { sectionKey: sectionKey } }
          ]
        },
        include: {
          librarySection: true
        }
      });
      const collectionsSet = new Set();
      
      artists.forEach(artist => {
        if (artist.collections) {
          try {
            const collections = JSON.parse(artist.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for artist:', artist.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching music artist collections by section:', error);
      throw error;
    }
  }

  // Get all music collections for albums by section
  async getAllMusicAlbumCollectionsBySection(sectionKey) {
    try {
      const albums = await this.prisma.plexAlbum.findMany({
        where: {
          AND: [
            { collections: { not: null } },
            { librarySection: { sectionKey: sectionKey } }
          ]
        },
        include: {
          librarySection: true
        }
      });
      const collectionsSet = new Set();
      
      albums.forEach(album => {
        if (album.collections) {
          try {
            const collections = JSON.parse(album.collections);
            collections.forEach(collection => collectionsSet.add(collection));
          } catch (error) {
            console.error('Error parsing collections for album:', album.title, error);
          }
        }
      });
      
      return Array.from(collectionsSet).sort();
    } catch (error) {
      console.error('Error fetching music album collections by section:', error);
      throw error;
    }
  }

  // Get all playlists from database
  async getAllPlaylists() {
    try {
      return await this.prisma.plexPlaylist.findMany({
        where: { removed: false },
        include: {
          librarySection: true,
          items: {
            orderBy: { addedAt: 'asc' }
          }
        },
        orderBy: { title: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching all playlists:', error);
      throw error;
    }
  }

  // Get playlists from specific section
  async getPlaylistsBySection(sectionKey) {
    try {
      return await this.prisma.plexPlaylist.findMany({
        where: {
          librarySection: {
            sectionKey: sectionKey
          }
        },
        include: {
          librarySection: true,
          items: {
            orderBy: { id: 'asc' }
          }
        },
        orderBy: { title: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching playlists by section:', error);
      throw error;
    }
  }

  // Get playlist by rating key
  async getPlaylistByRatingKey(ratingKey) {
    try {
      return await this.prisma.plexPlaylist.findUnique({
        where: { ratingKey },
        include: {
          librarySection: true,
          items: {
            orderBy: { id: 'asc' }
          }
        }
      });
    } catch (error) {
      console.error('Error fetching playlist by rating key:', error);
      throw error;
    }
  }

  // Get music statistics including playlists
  async getMusicStats() {
    try {
      const stats = await Promise.all([
        this.prisma.plexArtist.count(),
        this.prisma.plexAlbum.count(),
        this.prisma.plexTrack.count(),
        this.prisma.plexPlaylist.count(),
        this.prisma.plexLibrarySection.count({ where: { type: 'artist' } })
      ]);
      
      return {
        artists: stats[0],
        albums: stats[1],
        tracks: stats[2],
        playlists: stats[3],
        sections: stats[4]
      };
    } catch (error) {
      console.error('Error fetching music statistics:', error);
      throw error;
    }
  }

  // Get Plex settings for server configuration
  async getPlexSettings() {
    try {
      return await this.prisma.settings.findFirst({
        select: {
          plexUrl: true,
          plexToken: true
        }
      });
    } catch (error) {
      console.error('Error fetching Plex settings:', error);
      throw error;
    }
  }
}

module.exports = PlexDatabaseService;
