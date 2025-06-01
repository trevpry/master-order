const prisma = require('./prismaClient'); // Use shared Prisma client

class TvdbDatabaseService {
  constructor() {
    this.prisma = prisma; // Use shared instance
  }

  // Series methods
  async getCachedSeries(seriesName) {
    try {
      const series = await this.prisma.tvdbSeries.findFirst({
        where: {
          name: {
            contains: seriesName
          }
        },
        include: {
          seasons: {
            include: {
              episodes: true,
              artworks: true
            }
          },
          artworks: true
        }
      });
      return series;
    } catch (error) {
      console.error('Error getting cached series:', error);
      return null;
    }
  }

  async getCachedSeriesById(tvdbId) {
    try {
      const series = await this.prisma.tvdbSeries.findUnique({
        where: { tvdbId },
        include: {
          seasons: {
            include: {
              episodes: true,
              artworks: true
            }
          },
          artworks: true
        }
      });
      return series;
    } catch (error) {
      console.error('Error getting cached series by ID:', error);
      return null;
    }
  }

  async storeSeries(tvdbData) {
    try {
      const seriesData = {
        tvdbId: tvdbData.id.toString(),
        name: tvdbData.name,
        slug: tvdbData.slug,
        image: tvdbData.image,
        firstAired: tvdbData.firstAired,
        lastAired: tvdbData.lastAired,
        nextAired: tvdbData.nextAired,
        status: tvdbData.status?.name,
        overview: tvdbData.overview,
        year: tvdbData.year,
        country: tvdbData.country,
        originalCountry: tvdbData.originalCountry,
        originalLanguage: tvdbData.originalLanguage,
        averageRuntime: tvdbData.averageRuntime,
        score: tvdbData.score,
        lastUpdated: tvdbData.lastUpdated,
        lastSyncedAt: new Date()
      };

      const series = await this.prisma.tvdbSeries.upsert({
        where: { tvdbId: seriesData.tvdbId },
        update: seriesData,
        create: seriesData
      });

      // Store artworks if available
      if (tvdbData.artwork && Array.isArray(tvdbData.artwork)) {
        await this.storeArtworks(tvdbData.artwork, series.tvdbId, null);
      }

      // Store seasons if available
      if (tvdbData.seasons && Array.isArray(tvdbData.seasons)) {
        for (const seasonData of tvdbData.seasons) {
          await this.storeSeason(seasonData, series.tvdbId);
        }
      }

      return series;
    } catch (error) {
      console.error('Error storing series:', error);
      throw error;
    }
  }

  // Season methods
  async getCachedSeason(seriesTvdbId, seasonNumber) {
    try {
      const season = await this.prisma.tvdbSeason.findFirst({
        where: {
          seriesTvdbId,
          number: seasonNumber
        },
        include: {
          episodes: true,
          artworks: true
        }
      });
      return season;
    } catch (error) {
      console.error('Error getting cached season:', error);
      return null;
    }
  }

  async getCachedSeasonById(tvdbId) {
    try {
      const season = await this.prisma.tvdbSeason.findUnique({
        where: { tvdbId },
        include: {
          episodes: true,
          artworks: true
        }
      });
      return season;
    } catch (error) {
      console.error('Error getting cached season by ID:', error);
      return null;
    }
  }

  async storeSeason(tvdbData, seriesTvdbId) {
    try {
      const seasonData = {
        tvdbId: tvdbData.id.toString(),
        seriesTvdbId,
        number: tvdbData.number,
        name: tvdbData.name,
        image: tvdbData.image,
        overview: tvdbData.overview,
        year: tvdbData.year,
        lastUpdated: tvdbData.lastUpdated,
        lastSyncedAt: new Date()
      };

      const season = await this.prisma.tvdbSeason.upsert({
        where: { tvdbId: seasonData.tvdbId },
        update: seasonData,
        create: seasonData
      });

      // Store artworks if available
      if (tvdbData.artwork && Array.isArray(tvdbData.artwork)) {
        await this.storeArtworks(tvdbData.artwork, seriesTvdbId, season.tvdbId);
      }

      // Store episodes if available
      if (tvdbData.episodes && Array.isArray(tvdbData.episodes)) {
        for (const episodeData of tvdbData.episodes) {
          await this.storeEpisode(episodeData, season.tvdbId, seriesTvdbId);
        }
      }

      return season;
    } catch (error) {
      console.error('Error storing season:', error);
      throw error;
    }
  }

  // Episode methods
  async getCachedEpisode(seriesTvdbId, seasonNumber, episodeNumber) {
    try {
      const episode = await this.prisma.tvdbEpisode.findFirst({
        where: {
          seriesTvdbId,
          seasonNumber,
          number: episodeNumber
        }
      });
      return episode;
    } catch (error) {
      console.error('Error getting cached episode:', error);
      return null;
    }
  }

  async getCachedEpisodeById(tvdbId) {
    try {
      const episode = await this.prisma.tvdbEpisode.findUnique({
        where: { tvdbId }
      });
      return episode;
    } catch (error) {
      console.error('Error getting cached episode by ID:', error);
      return null;
    }
  }

  async storeEpisode(tvdbData, seasonTvdbId, seriesTvdbId) {
    try {
      const episodeData = {
        tvdbId: tvdbData.id.toString(),
        seasonTvdbId,
        seriesTvdbId,
        number: tvdbData.number,
        seasonNumber: tvdbData.seasonNumber,
        name: tvdbData.name,
        overview: tvdbData.overview,
        image: tvdbData.image,
        aired: tvdbData.aired,
        runtime: tvdbData.runtime,
        finaleType: tvdbData.finaleType,
        year: tvdbData.year,
        lastUpdated: tvdbData.lastUpdated,
        lastSyncedAt: new Date()
      };

      const episode = await this.prisma.tvdbEpisode.upsert({
        where: { tvdbId: episodeData.tvdbId },
        update: episodeData,
        create: episodeData
      });

      return episode;
    } catch (error) {
      console.error('Error storing episode:', error);
      throw error;
    }
  }

  // Artwork methods
  async getCachedArtworks(seriesTvdbId, seasonTvdbId = null, type = null, language = 'eng') {
    try {
      const where = {
        seriesTvdbId
      };

      if (seasonTvdbId) {
        where.seasonTvdbId = seasonTvdbId;
      }

      if (type) {
        where.type = type;
      }

      if (language) {
        where.OR = [
          { language },
          { language: null }
        ];
      }

      const artworks = await this.prisma.tvdbArtwork.findMany({
        where,
        orderBy: [
          { score: 'desc' },
          { width: 'desc' },
          { height: 'desc' }
        ]
      });

      return artworks;
    } catch (error) {
      console.error('Error getting cached artworks:', error);
      return [];
    }
  }
  async storeArtworks(artworkArray, seriesTvdbId, seasonTvdbId = null) {
    try {
      for (const artworkData of artworkArray) {
        const data = {
          tvdbId: artworkData.id.toString(),
          seriesTvdbId,
          seasonTvdbId,
          image: artworkData.image || artworkData.fileName,
          thumbnail: artworkData.thumbnail,
          language: artworkData.language,
          type: artworkData.type,
          width: artworkData.width,
          height: artworkData.height,
          score: artworkData.score,
          includesText: artworkData.includesText,
          lastUpdated: artworkData.lastUpdated,
          lastSyncedAt: new Date()
        };

        // Use composite unique constraint to prevent cross-series contamination
        await this.prisma.tvdbArtwork.upsert({
          where: { 
            artwork_unique_context: {
              tvdbId: data.tvdbId,
              seriesTvdbId: data.seriesTvdbId,
              seasonTvdbId: data.seasonTvdbId
            }
          },
          update: data,
          create: data
        });
      }
    } catch (error) {
      console.error('Error storing artworks:', error);
      throw error;
    }
  }

  // Cache expiry check
  async isCacheExpired(seriesTvdbId, maxAgeHours = 24) {
    try {
      const series = await this.prisma.tvdbSeries.findUnique({
        where: { tvdbId: seriesTvdbId },
        select: { lastSyncedAt: true }
      });

      if (!series) {
        return true; // No cache = expired
      }

      const now = new Date();
      const cacheAge = now - series.lastSyncedAt;
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

      return cacheAge > maxAge;
    } catch (error) {
      console.error('Error checking cache expiry:', error);
      return true; // Assume expired on error
    }
  }
  // Helper method to select best artwork from cached data
  selectBestArtwork(artworks, type = 'season') {
    try {
      if (!artworks || artworks.length === 0) {
        return null;
      }

      // Filter for appropriate artwork types
      const typeFilter = type === 'season' ? [7, 6] : [2, 3]; // 7=season poster, 6=season banner, 2=series poster, 3=series banner
      const filteredArtworks = artworks.filter(artwork => typeFilter.includes(artwork.type));

      if (filteredArtworks.length === 0) {
        return null;
      }

      console.log(`Found ${filteredArtworks.length} ${type} artworks after type filtering`);

      // Prioritize English language artwork
      const englishArtworks = filteredArtworks.filter(artwork => {
        const isEnglish = !artwork.language || 
                         artwork.language === 'eng' || 
                         artwork.language === 'en' ||
                         artwork.language === null ||
                         artwork.language === undefined;
        return isEnglish;
      });

      // Use English artworks if available, otherwise use all filtered artworks
      const artworksToSort = englishArtworks.length > 0 ? englishArtworks : filteredArtworks;
      
      console.log(`Found ${englishArtworks.length} English ${type} artworks out of ${filteredArtworks.length} total`);      // Sort by highest resolution first, then by language preference, then by highest score
      const sortedArtworks = artworksToSort.sort((a, b) => {
        const aResolution = (a.width || 0) * (a.height || 0);
        const bResolution = (b.width || 0) * (b.height || 0);
        
        // Prioritize higher resolution
        if (aResolution !== bResolution) {
          return bResolution - aResolution;
        }
        
        // Secondary sort: prefer explicit English over null/undefined language
        const aIsExplicitEnglish = a.language === 'eng' || a.language === 'en';
        const bIsExplicitEnglish = b.language === 'eng' || b.language === 'en';
        
        if (aIsExplicitEnglish && !bIsExplicitEnglish) {
          return -1; // a comes first
        }
        if (!aIsExplicitEnglish && bIsExplicitEnglish) {
          return 1; // b comes first
        }
        
        // Tertiary sort by score
        return (b.score || 0) - (a.score || 0);
      });

      const selectedArtwork = sortedArtworks[0];
      const artworkUrl = selectedArtwork.image;

      console.log(`Selected ${type} artwork: Language: ${selectedArtwork.language || 'null'}, Resolution: ${selectedArtwork.width || 'unknown'}x${selectedArtwork.height || 'unknown'}, Score: ${selectedArtwork.score || 'unknown'}`);

      if (artworkUrl) {
        if (artworkUrl.startsWith('http')) {
          return artworkUrl;
        } else {
          return `https://artworks.thetvdb.com${artworkUrl}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Error selecting best artwork:', error);
      return null;
    }
  }

  // Cleanup old cache entries
  async cleanupOldCache(maxAgeHours = 168) { // Default 7 days
    try {
      const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      
      // Delete old entries
      await this.prisma.tvdbArtwork.deleteMany({
        where: {
          lastSyncedAt: {
            lt: cutoffDate
          }
        }
      });

      await this.prisma.tvdbEpisode.deleteMany({
        where: {
          lastSyncedAt: {
            lt: cutoffDate
          }
        }
      });

      await this.prisma.tvdbSeason.deleteMany({
        where: {
          lastSyncedAt: {
            lt: cutoffDate
          }
        }
      });

      await this.prisma.tvdbSeries.deleteMany({
        where: {
          lastSyncedAt: {
            lt: cutoffDate
          }
        }
      });

      console.log('TVDB cache cleanup completed');
    } catch (error) {
      console.error('Error cleaning up TVDB cache:', error);
    }
  }
}

module.exports = TvdbDatabaseService;
