const prisma = require('./prismaClient'); // Use the shared Prisma client

class PlexDatabaseService {
  constructor() {
    this.prisma = prisma; // Assign the shared instance
  }  // Get all library sections from database
  async getLibrarySections() {
    try {
      return await this.prisma.PlexLibrarySection.findMany();
    } catch (error) {
      console.error('Error fetching library sections:', error);
      throw error;
    }
  }

  // Get TV sections only
  async getTVSections() {
    try {
      return await this.prisma.PlexLibrarySection.findMany({
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
      return await this.prisma.PlexLibrarySection.findMany({
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
      return await this.prisma.PlexTVShow.findMany({
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
      return await this.prisma.PlexTVShow.findMany({
        where: { sectionKey },
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
      return await this.prisma.PlexTVShow.findMany({
        where: {
          collections: {
            contains: collectionName
          }
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
      return await this.prisma.PlexMovie.findMany({
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
      return await this.prisma.PlexMovie.findMany({
        where: { sectionKey },
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
      return await this.prisma.PlexMovie.findMany({
        where: {
          collections: {
            contains: collectionName
          }
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
      return await this.prisma.PlexTVShow.findUnique({
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
      return await this.prisma.PlexMovie.findUnique({
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
      return await this.prisma.PlexSeason.findMany({
        where: { showRatingKey },
        include: {
          episodes: true
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
      return await this.prisma.PlexEpisode.findMany({
        where: { seasonRatingKey },
        orderBy: { index: 'asc' }
      });
    } catch (error) {
      console.error('Error fetching episodes:', error);
      throw error;
    }
  }

  // Search for TV shows by title
  async searchTVShows(query) {
    try {
      return await this.prisma.PlexTVShow.findMany({
        where: {
          title: {
            contains: query,
            mode: 'insensitive'
          }
        },
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
      return await this.prisma.PlexMovie.findMany({
        where: {
          title: {
            contains: query,
            mode: 'insensitive'
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
      return await this.prisma.PlexEpisode.findMany({
        where: {
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              showTitle: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        },
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
      const episode = await this.prisma.PlexEpisode.findUnique({
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
      const sections = await this.prisma.PlexLibrarySection.count();
      const shows = await this.prisma.PlexTVShow.count();
      const seasons = await this.prisma.PlexSeason.count();
      const episodes = await this.prisma.PlexEpisode.count();
      const movies = await this.prisma.PlexMovie.count();
      
      // Get last sync time
      const lastSyncedShow = await this.prisma.PlexTVShow.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedMovie = await this.prisma.PlexMovie.findFirst({
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

  // Search methods for the API endpoints
  // Search TV shows by title
  async searchTVShows(query) {
    try {
      return await this.prisma.PlexTVShow.findMany({
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
      console.error('Error searching TV shows:', error);
      throw error;
    }
  }
  // Search movies by title
  async searchMovies(query) {
    try {
      return await this.prisma.PlexMovie.findMany({
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
  // Search episodes by title
  async searchEpisodes(query) {
    try {
      return await this.prisma.PlexEpisode.findMany({
        where: {
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
        },        include: {
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
}

module.exports = PlexDatabaseService;
