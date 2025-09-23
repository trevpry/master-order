// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client

class PlexSyncService {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.plexUrl = null;
    this.plexToken = null;
  }

  // Helper function to handle database timeout/connection errors
  async handleDatabaseError(error, operation, itemName, retryCallback) {
    const isDatabaseTimeout = error.code === 'P1008' || // SQLite/Database timeout
                              error.code === 'P1017' || // PostgreSQL connection timeout
                              error.code === 'P2024' || // Connection timeout
                              error.message?.includes('timeout') ||
                              error.message?.includes('connection') ||
                              error.message?.includes('ECONNRESET');
    
    if (isDatabaseTimeout) {
      console.warn(`Database timeout/connection error for ${operation} ${itemName}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await retryCallback();
    } else {
      throw error;
    }
  }

  async ensureConfigLoaded() {
    if (!this.plexUrl || !this.plexToken) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.plexUrl = settings?.plexUrl;
      this.plexToken = settings?.plexToken;
      
      if (!this.plexToken) {
        throw new Error('Plex token not configured. Please set it in the Settings page.');
      }
      if (!this.plexUrl) {
        throw new Error('Plex URL not configured. Please set it in the Settings page.');
      }
    }
  }

  async makeRequest(endpoint) {
    await this.ensureConfigLoaded();
    
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.plexUrl}${endpoint}${separator}X-Plex-Token=${this.plexToken}`;
    console.log(`Making Plex request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Plex API request failed: ${response.status} ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    return jsonData;
  }  async syncLibrarySections() {
    console.log('Syncing Plex library sections...');
    
    try {
      const data = await this.makeRequest('/library/sections');
      const sections = data.MediaContainer?.Directory || [];
      
      const syncedSections = [];
      
      for (const section of sections) {        
        // Sync TV, Movie, and Music sections
        if (section.type === 'show' || section.type === 'movie' || section.type === 'artist') {        const sectionData = {
          sectionKey: section.key,
          title: section.title,
          type: section.type,
          // Additional fields from Plex API
          agent: section.agent || null,
          allowSync: (section.allowSync && !isNaN(parseInt(section.allowSync))) ? parseInt(section.allowSync) : null,
          art: section.art || null,
          composite: section.composite || null,
          content: typeof section.content === 'string' ? section.content : (section.content ? 'true' : null),
          contentChangedAt: section.contentChangedAt ? parseInt(section.contentChangedAt) : null,
          createdAt_plex: section.createdAt ? parseInt(section.createdAt) : null,
          directory: typeof section.directory === 'string' ? section.directory : (section.directory ? 'true' : null),
          filters: section.filters ? (typeof section.filters === 'string' ? section.filters : JSON.stringify(section.filters)) : null,
          hidden: section.hidden ? parseInt(section.hidden) : null,
          language: section.language || null,
          refreshing: section.refreshing ? parseInt(section.refreshing) : null,
          scannedAt: section.scannedAt ? parseInt(section.scannedAt) : null,
          scanner: section.scanner || null,
          thumb: section.thumb || null,
          updatedAt_plex: section.updatedAt ? parseInt(section.updatedAt) : null,
          uuid: section.uuid || null
        };
          
          const syncedSection = await prisma.plexLibrarySection.upsert({
            where: { sectionKey: section.key },
            update: sectionData,
            create: sectionData
          });
          
          syncedSections.push(syncedSection);
          console.log(`Synced section: ${section.title} (${section.type})`);
        }
      }
      
      return syncedSections;
    } catch (error) {
      console.error('Error syncing library sections:', error);
      throw error;
    }
  }async syncTVShows(sectionKey) {
    console.log(`Syncing TV shows for section ${sectionKey}...`);
    
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all?type=2`);
      const shows = data.MediaContainer?.Metadata || [];
      
      const syncedShows = [];
      
      for (const show of shows) {
        // Fetch detailed metadata for each show to ensure we get collections and labels
        let detailedShow = show;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${show.ratingKey}`);
          detailedShow = detailData.MediaContainer?.Metadata?.[0] || show;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for show ${show.title} (${show.ratingKey}):`, error.message);
          // Fall back to the basic show data from the bulk endpoint
        }
          const showData = {
          ratingKey: detailedShow.ratingKey,
          title: detailedShow.title,
          year: detailedShow.year ? parseInt(detailedShow.year) : null,
          summary: detailedShow.summary || null,
          thumb: detailedShow.thumb || null,
          art: detailedShow.art || null,
          leafCount: detailedShow.leafCount ? parseInt(detailedShow.leafCount) : null,
          viewedLeafCount: detailedShow.viewedLeafCount ? parseInt(detailedShow.viewedLeafCount) : null,
          addedAt: detailedShow.addedAt ? parseInt(detailedShow.addedAt) : null,
          updatedAt_plex: detailedShow.updatedAt ? parseInt(detailedShow.updatedAt) : null,
          collections: detailedShow.Collection ? JSON.stringify(detailedShow.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields from Plex API
          childCount: detailedShow.childCount ? parseInt(detailedShow.childCount) : null,
          guid: detailedShow.guid || null,
          index: detailedShow.index ? parseInt(detailedShow.index) : null,
          key: detailedShow.key || null,
          lastViewedAt: detailedShow.lastViewedAt ? parseInt(detailedShow.lastViewedAt) : null,
          skipCount: detailedShow.skipCount ? parseInt(detailedShow.skipCount) : null,
          type: detailedShow.type || null,
          viewCount: detailedShow.viewCount ? parseInt(detailedShow.viewCount) : null,
          sectionKey: sectionKey,
          lastSyncedAt: new Date()
        };
          const syncedShow = await prisma.plexTVShow.upsert({
          where: { ratingKey: detailedShow.ratingKey },
          update: showData,
          create: showData
        });
        
        // Clear and sync complex fields
        await this.clearComplexFields(detailedShow.ratingKey, 'show');
        await this.syncComplexFields(detailedShow, 'show', detailedShow.ratingKey);
        
        syncedShows.push(syncedShow);
        
        // Sync seasons for this show
        await this.syncSeasons(show.ratingKey);
      }
      
      console.log(`Synced ${syncedShows.length} TV shows`);
      return syncedShows;
    } catch (error) {
      console.error('Error syncing TV shows:', error);
      throw error;
    }
  }  async syncSeasons(showRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${showRatingKey}/children`);
      const seasons = data.MediaContainer?.Metadata || [];
        for (const season of seasons) {
        // Fetch detailed metadata for each season to get all fields
        let detailedSeason = season;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${season.ratingKey}`);
          detailedSeason = detailData.MediaContainer?.Metadata?.[0] || season;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for season ${season.title} (${season.ratingKey}):`, error.message);
        }

        const seasonData = {
          ratingKey: detailedSeason.ratingKey,
          title: detailedSeason.title,
          index: detailedSeason.index ? parseInt(detailedSeason.index) : 0,
          showRatingKey: showRatingKey,
          leafCount: detailedSeason.leafCount ? parseInt(detailedSeason.leafCount) : null,
          viewedLeafCount: detailedSeason.viewedLeafCount ? parseInt(detailedSeason.viewedLeafCount) : null,
          // Additional fields from Plex API
          addedAt: detailedSeason.addedAt ? parseInt(detailedSeason.addedAt) : null,
          guid: detailedSeason.guid || null,
          key: detailedSeason.key || null,
          lastViewedAt: detailedSeason.lastViewedAt ? parseInt(detailedSeason.lastViewedAt) : null,
          librarySectionID: detailedSeason.librarySectionID ? parseInt(detailedSeason.librarySectionID) : null,
          librarySectionKey: detailedSeason.librarySectionKey || null,
          librarySectionTitle: detailedSeason.librarySectionTitle || null,
          parentGuid: detailedSeason.parentGuid || null,
          parentIndex: detailedSeason.parentIndex ? parseInt(detailedSeason.parentIndex) : null,
          parentKey: detailedSeason.parentKey || null,
          parentRatingKey: detailedSeason.parentRatingKey || null,
          parentThumb: detailedSeason.parentThumb || null,
          parentTitle: detailedSeason.parentTitle || null,
          skipCount: detailedSeason.skipCount ? parseInt(detailedSeason.skipCount) : null,
          summary: detailedSeason.summary || null,
          thumb: detailedSeason.thumb || null,
          type: detailedSeason.type || null,
          updatedAt_plex: detailedSeason.updatedAt ? parseInt(detailedSeason.updatedAt) : null,
          viewCount: detailedSeason.viewCount ? parseInt(detailedSeason.viewCount) : null
        };
          await prisma.plexSeason.upsert({
          where: { ratingKey: detailedSeason.ratingKey },
          update: seasonData,
          create: seasonData
        });
        
        // Clear and sync complex fields
        await this.clearComplexFields(detailedSeason.ratingKey, 'season');
        await this.syncComplexFields(detailedSeason, 'season', detailedSeason.ratingKey);
        
        // Sync episodes for this season
        await this.syncEpisodes(detailedSeason.ratingKey, showRatingKey);
      }
    } catch (error) {
      console.error(`Error syncing seasons for show ${showRatingKey}:`, error);
      throw error;
    }
  }
  async syncEpisodes(seasonRatingKey, showRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${seasonRatingKey}/children`);
      const episodes = data.MediaContainer?.Metadata || [];
      
      // Get show title for denormalization
      const show = await prisma.plexTVShow.findUnique({
        where: { ratingKey: showRatingKey }
      });        for (const episode of episodes) {
        // Fetch detailed metadata for each episode to get all fields
        let detailedEpisode = episode;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${episode.ratingKey}`);
          detailedEpisode = detailData.MediaContainer?.Metadata?.[0] || episode;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for episode ${episode.title} (${episode.ratingKey}):`, error.message);
        }

        const episodeData = {
          ratingKey: detailedEpisode.ratingKey,
          title: detailedEpisode.title,
          index: detailedEpisode.index ? parseInt(detailedEpisode.index) : 0,
          seasonIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : 0,
          showTitle: show?.title || 'Unknown',
          seasonRatingKey: seasonRatingKey,
          viewCount: detailedEpisode.viewCount ? parseInt(detailedEpisode.viewCount) : null,
          lastViewedAt: detailedEpisode.lastViewedAt ? parseInt(detailedEpisode.lastViewedAt) : null,
          addedAt: detailedEpisode.addedAt ? parseInt(detailedEpisode.addedAt) : null,
          originallyAvailableAt: detailedEpisode.originallyAvailableAt || null,
          summary: detailedEpisode.summary || null,
          thumb: detailedEpisode.thumb || null,
          // Additional fields from Plex API
          duration: detailedEpisode.duration ? parseInt(detailedEpisode.duration) : null,
          grandparentGuid: detailedEpisode.grandparentGuid || null,
          grandparentKey: detailedEpisode.grandparentKey || null,
          grandparentRatingKey: detailedEpisode.grandparentRatingKey || null,
          grandparentThumb: detailedEpisode.grandparentThumb || null,
          grandparentTitle: detailedEpisode.grandparentTitle || null,
          guid: detailedEpisode.guid || null,
          key: detailedEpisode.key || null,
          librarySectionID: detailedEpisode.librarySectionID ? parseInt(detailedEpisode.librarySectionID) : null,
          librarySectionKey: detailedEpisode.librarySectionKey || null,
          librarySectionTitle: detailedEpisode.librarySectionTitle || null,
          parentGuid: detailedEpisode.parentGuid || null,
          parentIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : null,
          parentKey: detailedEpisode.parentKey || null,
          parentRatingKey: detailedEpisode.parentRatingKey || null,
          parentThumb: detailedEpisode.parentThumb || null,
          parentTitle: detailedEpisode.parentTitle || null,
          skipCount: detailedEpisode.skipCount ? parseInt(detailedEpisode.skipCount) : null,
          titleSort: detailedEpisode.titleSort || null,
          type: detailedEpisode.type || null,
          updatedAt_plex: detailedEpisode.updatedAt ? parseInt(detailedEpisode.updatedAt) : null
        };
          await prisma.plexEpisode.upsert({
          where: { ratingKey: episode.ratingKey },
          update: episodeData,
          create: episodeData
        });
        
        // Clear and sync complex fields
        await this.clearComplexFields(detailedEpisode.ratingKey, 'episode');
        await this.syncComplexFields(detailedEpisode, 'episode', detailedEpisode.ratingKey);
      }
    } catch (error) {
      console.error(`Error syncing episodes for season ${seasonRatingKey}:`, error);
      throw error;
    }
  }  async syncMovies(sectionKey) {
    console.log(`Syncing movies for section ${sectionKey}...`);
    
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all?type=1`);
      const movies = data.MediaContainer?.Metadata || [];
      
      const syncedMovies = [];
      
      for (const movie of movies) {
        // Fetch detailed metadata for each movie to ensure we get collections and labels
        let detailedMovie = movie;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${movie.ratingKey}`);
          detailedMovie = detailData.MediaContainer?.Metadata?.[0] || movie;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for movie ${movie.title} (${movie.ratingKey}):`, error.message);
          // Fall back to the basic movie data from the bulk endpoint
        }        const movieData = {
          ratingKey: detailedMovie.ratingKey,
          title: detailedMovie.title,
          year: detailedMovie.year ? parseInt(detailedMovie.year) : null,
          summary: detailedMovie.summary || null,
          thumb: detailedMovie.thumb || null,
          art: detailedMovie.art || null,
          viewCount: detailedMovie.viewCount ? parseInt(detailedMovie.viewCount) : null,
          lastViewedAt: detailedMovie.lastViewedAt ? parseInt(detailedMovie.lastViewedAt) : null,
          addedAt: detailedMovie.addedAt ? parseInt(detailedMovie.addedAt) : null,
          originallyAvailableAt: detailedMovie.originallyAvailableAt || null,
          updatedAt_plex: detailedMovie.updatedAt ? parseInt(detailedMovie.updatedAt) : null,
          collections: detailedMovie.Collection ? JSON.stringify(detailedMovie.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields from Plex API
          audienceRating: detailedMovie.audienceRating ? parseFloat(detailedMovie.audienceRating) : null,
          audienceRatingImage: detailedMovie.audienceRatingImage || null,
          chapterSource: detailedMovie.chapterSource || null,
          contentRating: detailedMovie.contentRating || null,
          duration: detailedMovie.duration ? parseInt(detailedMovie.duration) : null,
          guid: detailedMovie.guid || null,
          key: detailedMovie.key || null,
          librarySectionID: detailedMovie.librarySectionID ? parseInt(detailedMovie.librarySectionID) : null,
          librarySectionKey: detailedMovie.librarySectionKey || null,
          librarySectionTitle: detailedMovie.librarySectionTitle || null,
          primaryExtraKey: detailedMovie.primaryExtraKey || null,
          rating: detailedMovie.rating ? parseFloat(detailedMovie.rating) : null,
          ratingImage: detailedMovie.ratingImage || null,
          skipCount: detailedMovie.skipCount ? parseInt(detailedMovie.skipCount) : null,
          slug: detailedMovie.slug || null,
          studio: detailedMovie.studio || null,
          tagline: detailedMovie.tagline || null,
          titleSort: detailedMovie.titleSort || null,
          type: detailedMovie.type || null,
          sectionKey: sectionKey,
          lastSyncedAt: new Date()
        };
          const syncedMovie = await prisma.plexMovie.upsert({
          where: { ratingKey: detailedMovie.ratingKey },
          update: movieData,
          create: movieData
        });
        
        // Clear and sync complex fields
        await this.clearComplexFields(detailedMovie.ratingKey, 'movie');
        await this.syncComplexFields(detailedMovie, 'movie', detailedMovie.ratingKey);
        
        syncedMovies.push(syncedMovie);
      }
      
      console.log(`Synced ${syncedMovies.length} movies`);
      return syncedMovies;
    } catch (error) {
      console.error('Error syncing movies:', error);
      throw error;
    }
  }

  // Helper methods to sync complex field data
  async syncComplexFields(item, itemType, ratingKey) {
    try {
      // Sync Directors
      if (item.Director && Array.isArray(item.Director)) {
        for (const director of item.Director) {
          const directorData = {
            tag: director.tag || director.title,
            filter: director.filter || null,
            tagKey: director.tagKey || null,
            thumb: director.thumb || null
          };
          
          if (itemType === 'movie') {
            directorData.movieRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            directorData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexDirector.create({
            data: directorData
          });
        }
      }
      
      // Sync Genres
      if (item.Genre && Array.isArray(item.Genre)) {
        for (const genre of item.Genre) {
          const genreData = {
            tag: genre.tag || genre.title,
            filter: genre.filter || null,
            tagKey: genre.tagKey || null,
            thumb: genre.thumb || null
          };
          
          if (itemType === 'movie') {
            genreData.movieRatingKey = ratingKey;
          } else if (itemType === 'show') {
            genreData.showRatingKey = ratingKey;
          }
          
          await prisma.plexGenre.create({
            data: genreData
          });
        }
      }
      
      // Sync Producers (Movies only)
      if (itemType === 'movie' && item.Producer && Array.isArray(item.Producer)) {
        for (const producer of item.Producer) {
          await prisma.plexProducer.create({
            data: {
              movieRatingKey: ratingKey,
              tag: producer.tag || producer.title,
              filter: producer.filter || null,
              tagKey: producer.tagKey || null,
              thumb: producer.thumb || null
            }
          });
        }
      }
      
      // Sync Writers
      if (item.Writer && Array.isArray(item.Writer)) {
        for (const writer of item.Writer) {
          const writerData = {
            tag: writer.tag || writer.title,
            filter: writer.filter || null,
            tagKey: writer.tagKey || null,
            thumb: writer.thumb || null
          };
          
          if (itemType === 'movie') {
            writerData.movieRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            writerData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexWriter.create({
            data: writerData
          });
        }
      }
      
      // Sync Cast/Roles
      if (item.Role && Array.isArray(item.Role)) {
        for (const role of item.Role) {
          const roleData = {
            tag: role.tag || role.title,
            filter: role.filter || null,
            tagKey: role.tagKey || null,
            role: role.role || null,
            thumb: role.thumb || null
          };
          
          if (itemType === 'movie') {
            roleData.movieRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            roleData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexRole.create({
            data: roleData
          });
        }
      }
      
      // Sync Countries (Movies only)
      if (itemType === 'movie' && item.Country && Array.isArray(item.Country)) {
        for (const country of item.Country) {
          await prisma.plexCountry.create({
            data: {
              movieRatingKey: ratingKey,
              tag: country.tag || country.title,
              filter: country.filter || null,
              tagKey: country.tagKey || null,
              thumb: country.thumb || null
            }
          });
        }
      }
      
      // Sync Ratings
      if (item.Rating && Array.isArray(item.Rating)) {
        for (const rating of item.Rating) {
          const ratingData = {
            image: rating.image || null,
            value: rating.value ? parseFloat(rating.value) : null,
            type: rating.type || null
          };
          
          if (itemType === 'movie') {
            ratingData.movieRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            ratingData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexRating.create({
            data: ratingData
          });
        }
      }
      
      // Sync GUIDs
      if (item.Guid && Array.isArray(item.Guid)) {
        for (const guid of item.Guid) {
          const guidData = {
            id_value: guid.id || ''
          };
          
          if (itemType === 'movie') {
            guidData.movieRatingKey = ratingKey;
          } else if (itemType === 'show') {
            guidData.showRatingKey = ratingKey;
          } else if (itemType === 'season') {
            guidData.seasonRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            guidData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexGuid.create({
            data: guidData
          });
        }
      }
      
      // Sync Media
      if (item.Media && Array.isArray(item.Media)) {
        for (const media of item.Media) {          const mediaData = {
            id_value: media.id ? String(media.id) : null,
            duration: media.duration ? parseInt(media.duration) : null,
            bitrate: media.bitrate ? parseInt(media.bitrate) : null,
            width: media.width ? parseInt(media.width) : null,
            height: media.height ? parseInt(media.height) : null,
            aspectRatio: media.aspectRatio ? parseFloat(media.aspectRatio) : null,
            audioChannels: media.audioChannels ? parseInt(media.audioChannels) : null,
            audioCodec: media.audioCodec || null,
            videoCodec: media.videoCodec || null,
            videoResolution: media.videoResolution || null,
            container: media.container || null,
            videoFrameRate: media.videoFrameRate || null,
            optimizedForStreaming: media.optimizedForStreaming ? Boolean(media.optimizedForStreaming) : null,
            selected: media.selected ? Boolean(media.selected) : null
          };
          
          if (itemType === 'movie') {
            mediaData.movieRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            mediaData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexMedia.create({
            data: mediaData
          });
        }
      }
      
      // Sync Images
      if (item.Image && Array.isArray(item.Image)) {
        for (const image of item.Image) {
          const imageData = {
            alt: image.alt || null,
            type: image.type || null,
            url: image.url || null
          };
          
          if (itemType === 'movie') {
            imageData.movieRatingKey = ratingKey;
          } else if (itemType === 'show') {
            imageData.showRatingKey = ratingKey;
          } else if (itemType === 'season') {
            imageData.seasonRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            imageData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexImage.create({
            data: imageData
          });        }
      }
      
      // Sync Labels
      if (item.Label && Array.isArray(item.Label)) {
        for (const label of item.Label) {
          const labelData = {
            tag: label.tag || label.title,
            filter: label.filter || null,
            tagKey: label.tagKey || null,
            thumb: label.thumb || null
          };
          
          if (itemType === 'movie') {
            labelData.movieRatingKey = ratingKey;
          } else if (itemType === 'show') {
            labelData.showRatingKey = ratingKey;
          }
          
          await prisma.plexLabel.create({
            data: labelData
          });
        }
      }
      
      // Sync UltraBlurColors
      if (item.UltraBlurColors && Array.isArray(item.UltraBlurColors)) {
        for (const colors of item.UltraBlurColors) {
          const colorData = {
            topLeft: colors.topLeft || null,
            topRight: colors.topRight || null,
            bottomLeft: colors.bottomLeft || null,
            bottomRight: colors.bottomRight || null
          };
          
          if (itemType === 'movie') {
            colorData.movieRatingKey = ratingKey;
          } else if (itemType === 'show') {
            colorData.showRatingKey = ratingKey;
          } else if (itemType === 'season') {
            colorData.seasonRatingKey = ratingKey;
          } else if (itemType === 'episode') {
            colorData.episodeRatingKey = ratingKey;
          }
          
          await prisma.plexUltraBlurColor.create({
            data: colorData
          });
        }
      }
      
    } catch (error) {
      console.warn(`Failed to sync complex fields for ${itemType} ${ratingKey}:`, error.message);
      // Don't throw here - we want the main sync to continue even if complex fields fail
    }
  }
  async clearComplexFields(ratingKey, itemType) {
    try {
      // Clear existing complex field data before re-syncing
      if (itemType === 'movie') {
        await Promise.all([
          prisma.plexDirector.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexGenre.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexProducer.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexWriter.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexRole.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexCountry.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexRating.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexMedia.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { movieRatingKey: ratingKey } }),
          prisma.plexLabel.deleteMany({ where: { movieRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'show') {
        await Promise.all([
          prisma.plexGenre.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexLabel.deleteMany({ where: { showRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'season') {
        await Promise.all([
          prisma.plexGuid.deleteMany({ where: { seasonRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { seasonRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { seasonRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'episode') {
        await Promise.all([
          prisma.plexDirector.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexWriter.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexRole.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexRating.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexMedia.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { episodeRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { episodeRatingKey: ratingKey } })
        ]);
      }
    } catch (error) {
      console.warn(`Failed to clear complex fields for ${itemType} ${ratingKey}:`, error.message);
    }
  }

  async fullSync() {
    console.log('Starting full Plex library sync...');
    const startTime = Date.now();
    
    try {
      // Step 1: Sync library sections
      const sections = await this.syncLibrarySections();
      
      let totalShows = 0;
      let totalMovies = 0;
      let totalArtists = 0;
      
      // Step 2: Sync content for each section
      for (const section of sections) {
        if (section.type === 'show') {
          const shows = await this.syncTVShows(section.sectionKey);
          totalShows += shows.length;
        } else if (section.type === 'movie') {
          const movies = await this.syncMovies(section.sectionKey);
          totalMovies += movies.length;
        } else if (section.type === 'artist') {
          await this.syncMusic(section.sectionKey);
          const artists = await prisma.plexArtist.count({
            where: {
              librarySection: {
                sectionKey: section.sectionKey
              }
            }
          });
          totalArtists += artists;
        }
      }

      // Step 3: Cleanup orphaned entities (similar to Stash sync)
      console.log('🧹 Starting Plex cleanup of orphaned entities...');
      const cleanupResults = await this.cleanupOrphanedEntities();
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      const result = {
        success: true,
        sections: sections.length,
        totalShows,
        totalMovies,
        totalArtists,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
        cleanup: cleanupResults // Include cleanup results in response
      };
      
      console.log('Full sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  // ================================
  // COMPREHENSIVE CLEANUP METHODS
  // Similar to Stash cleanup functionality
  // ================================

  /**
   * Clean up entities that no longer exist in Plex
   */
  async cleanupOrphanedEntities() {
    console.log('🧹 Starting comprehensive Plex cleanup...');
    const results = {
      episodes: 0,
      seasons: 0,
      shows: 0,
      movies: 0,
      artists: 0,
      albums: 0,
      tracks: 0,
      playlists: 0,
      complexFields: 0
    };

    try {
      // Step 1: Get all valid entity IDs from Plex
      console.log('🧹 Step 1: Collecting valid entity IDs from Plex...');
      const validPlexIds = await this.getAllValidPlexEntityIds();

      // Step 2: Mark removed content entities (don't delete for stats purposes)
      console.log('🧹 Step 2: Marking removed content entities...');
      results.episodes += await this.markRemovedEpisodes(validPlexIds.episodes);
      results.seasons += await this.markRemovedSeasons(validPlexIds.seasons);
      results.shows += await this.markRemovedShows(validPlexIds.shows);
      results.movies += await this.markRemovedMovies(validPlexIds.movies);
      results.tracks += await this.markRemovedTracks(validPlexIds.tracks);
      results.albums += await this.markRemovedAlbums(validPlexIds.albums);
      results.artists += await this.markRemovedArtists(validPlexIds.artists);
      results.playlists += await this.markRemovedPlaylists(validPlexIds.playlists);

      // Step 3: Clean up complex fields for items that no longer exist in Plex
      console.log('🧹 Step 3: Cleaning complex fields for deleted Plex items...');
      results.complexFields += await this.cleanupComplexFieldsForDeletedItems(validPlexIds);

      const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);
      console.log(`✅ Plex cleanup completed! Removed ${totalCleaned} orphaned entities:`, results);
      
      return results;
    } catch (error) {
      console.error('❌ Error during Plex cleanup:', error);
      throw error;
    }
  }

  /**
   * Get all valid entity IDs from Plex API
   */
  async getAllValidPlexEntityIds() {
    const validIds = {
      shows: new Set(),
      seasons: new Set(),
      episodes: new Set(),
      movies: new Set(),
      artists: new Set(),
      albums: new Set(),
      tracks: new Set(),
      playlists: new Set()
    };

    try {
      // Get library sections
      const sectionsData = await this.makeRequest('/library/sections');
      const sections = sectionsData.MediaContainer?.Directory || [];

      for (const section of sections) {
        if (section.type === 'show') {
          // Get all shows in this section
          const showsData = await this.makeRequest(`/library/sections/${section.key}/all?type=2`);
          const shows = showsData.MediaContainer?.Metadata || [];
          
          for (const show of shows) {
            validIds.shows.add(show.ratingKey);
            
            // Get seasons for this show
            const seasonsData = await this.makeRequest(`/library/metadata/${show.ratingKey}/children`);
            const seasons = seasonsData.MediaContainer?.Metadata || [];
            
            for (const season of seasons) {
              validIds.seasons.add(season.ratingKey);
              
              // Get episodes for this season
              const episodesData = await this.makeRequest(`/library/metadata/${season.ratingKey}/children`);
              const episodes = episodesData.MediaContainer?.Metadata || [];
              
              for (const episode of episodes) {
                validIds.episodes.add(episode.ratingKey);
              }
            }
          }
        } else if (section.type === 'movie') {
          // Get all movies in this section
          const moviesData = await this.makeRequest(`/library/sections/${section.key}/all?type=1`);
          const movies = moviesData.MediaContainer?.Metadata || [];
          
          for (const movie of movies) {
            validIds.movies.add(movie.ratingKey);
          }
        } else if (section.type === 'artist') {
          // Get all artists in this section
          const artistsData = await this.makeRequest(`/library/sections/${section.key}/all?type=8`);
          const artists = artistsData.MediaContainer?.Metadata || [];
          
          for (const artist of artists) {
            validIds.artists.add(artist.ratingKey);
            
            // Get albums for this artist using hybrid approach (same as sync)
            // 1. Get albums from artist's children endpoint
            const childrenData = await this.makeRequest(`/library/metadata/${artist.ratingKey}/children`);
            const childrenAlbums = childrenData.MediaContainer?.Metadata || [];
            
            for (const album of childrenAlbums) {
              validIds.albums.add(album.ratingKey);
              
              // Get tracks for this album
              const tracksData = await this.makeRequest(`/library/metadata/${album.ratingKey}/children`);
              const tracks = tracksData.MediaContainer?.Metadata || [];
              
              for (const track of tracks) {
                validIds.tracks.add(track.ratingKey);
              }
            }
          }
          
          // 2. Also scan section for albums by parentRatingKey (same as sync)
          console.log(`🧹 Section-level album scan for cleanup in section ${section.key}...`);
          const pageSize = 500;
          let start = 0;
          let totalProcessed = 0;
          let totalSize = 0;

          while (true) {
            const page = await this.makeRequest(`/library/sections/${section.key}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
            const pageAlbums = page.MediaContainer?.Metadata || [];
            if (!totalSize) totalSize = page.MediaContainer?.totalSize || 0;

            if (pageAlbums.length === 0) break;

            for (const album of pageAlbums) {
              // Only include albums that belong to artists we've identified
              if (validIds.artists.has(album.parentRatingKey)) {
                validIds.albums.add(album.ratingKey);
                
                // Get tracks for this album
                const tracksData = await this.makeRequest(`/library/metadata/${album.ratingKey}/children`);
                const tracks = tracksData.MediaContainer?.Metadata || [];
                
                for (const track of tracks) {
                  validIds.tracks.add(track.ratingKey);
                }
              }
            }
            
            totalProcessed += pageAlbums.length;
            if (totalSize > 0 && totalProcessed >= totalSize) {
              break;
            }
            
            start += pageSize;
          }
        }
      }

      // Get playlists
      const playlistsData = await this.makeRequest('/playlists');
      const playlists = playlistsData.MediaContainer?.Metadata || [];
      for (const playlist of playlists) {
        validIds.playlists.add(playlist.ratingKey);
      }

      console.log(`📊 Valid Plex entity counts:`, {
        shows: validIds.shows.size,
        seasons: validIds.seasons.size,
        episodes: validIds.episodes.size,
        movies: validIds.movies.size,
        artists: validIds.artists.size,
        albums: validIds.albums.size,
        tracks: validIds.tracks.size,
        playlists: validIds.playlists.size
      });

      return validIds;
    } catch (error) {
      console.error('Error collecting valid Plex entity IDs:', error);
      throw error;
    }
  }

  async markRemovedEpisodes(validEpisodeIds) {
    const localEpisodes = await prisma.plexEpisode.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const episode of localEpisodes) {
      if (!validEpisodeIds.has(episode.ratingKey)) {
        // Mark episode as removed instead of deleting
        await prisma.plexEpisode.update({ 
          where: { ratingKey: episode.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} episodes as removed`);
    }
    return marked;
  }

  async markRemovedSeasons(validSeasonIds) {
    const localSeasons = await prisma.plexSeason.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const season of localSeasons) {
      if (!validSeasonIds.has(season.ratingKey)) {
        // Mark season as removed instead of deleting
        await prisma.plexSeason.update({ 
          where: { ratingKey: season.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} seasons as removed`);
    }
    return marked;
  }

  async markRemovedShows(validShowIds) {
    const localShows = await prisma.plexTVShow.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const show of localShows) {
      if (!validShowIds.has(show.ratingKey)) {
        // Mark show as removed instead of deleting
        await prisma.plexTVShow.update({ 
          where: { ratingKey: show.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} TV shows as removed`);
    }
    return marked;
  }

  async markRemovedMovies(validMovieIds) {
    const localMovies = await prisma.plexMovie.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const movie of localMovies) {
      if (!validMovieIds.has(movie.ratingKey)) {
        // Mark movie as removed instead of deleting
        await prisma.plexMovie.update({ 
          where: { ratingKey: movie.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎬 Marked ${marked} movies as removed`);
    }
    return marked;
  }

  async markRemovedTracks(validTrackIds) {
    const localTracks = await prisma.plexTrack.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const track of localTracks) {
      if (!validTrackIds.has(track.ratingKey)) {
        await prisma.plexTrack.update({ 
          where: { ratingKey: track.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} tracks as removed`);
    }
    return marked;
  }

  async markRemovedAlbums(validAlbumIds) {
    const localAlbums = await prisma.plexAlbum.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const album of localAlbums) {
      if (!validAlbumIds.has(album.ratingKey)) {
        await prisma.plexAlbum.update({ 
          where: { ratingKey: album.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} albums as removed`);
    }
    return marked;
  }

  async markRemovedArtists(validArtistIds) {
    const localArtists = await prisma.plexArtist.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const artist of localArtists) {
      if (!validArtistIds.has(artist.ratingKey)) {
        await prisma.plexArtist.update({ 
          where: { ratingKey: artist.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`🎵 Marked ${marked} artists as removed`);
    }
    return marked;
  }

  async markRemovedPlaylists(validPlaylistIds) {
    const localPlaylists = await prisma.plexPlaylist.findMany({
      select: { ratingKey: true },
      where: { removed: false }
    });

    let marked = 0;
    for (const playlist of localPlaylists) {
      if (!validPlaylistIds.has(playlist.ratingKey)) {
        await prisma.plexPlaylist.update({ 
          where: { ratingKey: playlist.ratingKey },
          data: { removed: true }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`� Marked ${marked} playlists as removed`);
    }
    return marked;
  }

  async cleanupComplexFieldsForDeletedItems(validPlexIds) {
    let totalRemoved = 0;
    
    console.log('🧹 Cleaning complex fields for items deleted from Plex...');

    // Clean up complex fields for movies that don't exist in Plex anymore
    const movieComplexFields = [
      { model: prisma.plexDirector, field: 'movieRatingKey' },
      { model: prisma.plexGenre, field: 'movieRatingKey' },
      { model: prisma.plexProducer, field: 'movieRatingKey' },
      { model: prisma.plexWriter, field: 'movieRatingKey' },
      { model: prisma.plexRole, field: 'movieRatingKey' },
      { model: prisma.plexCountry, field: 'movieRatingKey' },
      { model: prisma.plexRating, field: 'movieRatingKey' },
      { model: prisma.plexGuid, field: 'movieRatingKey' },
      { model: prisma.plexMedia, field: 'movieRatingKey' },
      { model: prisma.plexImage, field: 'movieRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'movieRatingKey' },
      { model: prisma.plexLabel, field: 'movieRatingKey' }
    ];

    for (const { model, field } of movieComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the movie doesn't exist in Plex anymore
          if (!validPlexIds.movies.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted movie ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for movies:`, error.message);
      }
    }

    // Clean up complex fields for episodes that don't exist in Plex anymore
    const episodeComplexFields = [
      { model: prisma.plexDirector, field: 'episodeRatingKey' },
      { model: prisma.plexWriter, field: 'episodeRatingKey' },
      { model: prisma.plexRole, field: 'episodeRatingKey' },
      { model: prisma.plexRating, field: 'episodeRatingKey' },
      { model: prisma.plexGuid, field: 'episodeRatingKey' },
      { model: prisma.plexMedia, field: 'episodeRatingKey' },
      { model: prisma.plexImage, field: 'episodeRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'episodeRatingKey' }
    ];

    for (const { model, field } of episodeComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the episode doesn't exist in Plex anymore
          if (!validPlexIds.episodes.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted episode ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for episodes:`, error.message);
      }
    }

    // Clean up complex fields for shows that don't exist in Plex anymore
    const showComplexFields = [
      { model: prisma.plexGenre, field: 'showRatingKey' },
      { model: prisma.plexGuid, field: 'showRatingKey' },
      { model: prisma.plexImage, field: 'showRatingKey' },
      { model: prisma.plexUltraBlurColor, field: 'showRatingKey' },
      { model: prisma.plexLabel, field: 'showRatingKey' }
    ];

    for (const { model, field } of showComplexFields) {
      try {
        const orphanedRecords = await model.findMany({
          select: { [field]: true },
          distinct: [field],
          where: {
            [field]: { not: null }
          }
        });
        
        for (const record of orphanedRecords) {
          // Only delete if the show doesn't exist in Plex anymore
          if (!validPlexIds.shows.has(record[field])) {
            const deleted = await model.deleteMany({
              where: { [field]: record[field] }
            });
            totalRemoved += deleted.count;
            console.log(`🗑️ Removed ${deleted.count} ${model.name} records for deleted show ${record[field]}`);
          }
        }
      } catch (error) {
        console.warn(`Error cleaning up ${model.name} for shows:`, error.message);
      }
    }

    if (totalRemoved > 0) {
      console.log(`🗑️ Total removed ${totalRemoved} complex field records for items deleted from Plex`);
    } else {
      console.log(`✅ No orphaned complex fields found - all items still exist in Plex`);
    }
    
    return totalRemoved;
  }

  // ================================
  // END COMPREHENSIVE CLEANUP METHODS
  // ================================

  async getSyncStatus() {
    try {
      const sections = await prisma.plexLibrarySection.count();
      const shows = await prisma.plexTVShow.count();
      const seasons = await prisma.plexSeason.count();
      const episodes = await prisma.plexEpisode.count();
      const movies = await prisma.plexMovie.count();
      const artists = await prisma.plexArtist.count();
      const albums = await prisma.plexAlbum.count();
      const tracks = await prisma.plexTrack.count();
      const playlists = await prisma.plexPlaylist.count();
      
      // Get last sync time
      const lastSyncedShow = await prisma.plexTVShow.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedMovie = await prisma.plexMovie.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedArtist = await prisma.plexArtist.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      
      const lastSync = [lastSyncedShow?.lastSyncedAt, lastSyncedMovie?.lastSyncedAt, lastSyncedArtist?.updatedAt]
        .filter(Boolean)
        .sort((a, b) => b - a)[0];
      
      return {
        sections,
        shows,
        seasons,
        episodes,
        movies,
        artists,
        albums,
        tracks,
        playlists,
        lastSync,
        hasData: sections > 0
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }  // Music sync methods
  async syncMusic(sectionKey) {
    console.log(`Syncing music for section ${sectionKey}...`);
    
    try {
      // Sync artists first
      await this.syncArtists(sectionKey);
      
      // Get all artists in this section and sync their albums with batching
      const artists = await prisma.plexArtist.findMany({
        where: {
          librarySection: {
            sectionKey: String(sectionKey)
          }
        },
        orderBy: { title: 'asc' }
      });

      console.log(`🎤 Found ${artists.length} artists. Starting album sync with batching...`);
      
      // Process artists in batches to avoid database timeouts
      const artistBatchSize = 25;
      for (let i = 0; i < artists.length; i += artistBatchSize) {
        const batch = artists.slice(i, i + artistBatchSize);
        console.log(`   Processing artist batch ${Math.floor(i/artistBatchSize) + 1}/${Math.ceil(artists.length/artistBatchSize)} (${batch.length} artists)`);
        
        for (const artist of batch) {
          try {
            await this.syncAlbums(sectionKey, artist.ratingKey);
          } catch (error) {
            console.warn(`Failed to sync albums for artist ${artist.title}:`, error.message);
            // Continue with next artist on error
          }
        }
        
        // Small delay between batches
        if (i + artistBatchSize < artists.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Get all albums in this section and sync their tracks with batching
      const albums = await prisma.plexAlbum.findMany({
        where: {
          librarySection: {
            sectionKey: String(sectionKey)
          }
        },
        orderBy: { title: 'asc' }
      });

      console.log(`💿 Found ${albums.length} albums. Starting track sync with batching...`);
      
      // Process albums in batches to avoid database timeouts
      const albumBatchSize = 50;
      for (let i = 0; i < albums.length; i += albumBatchSize) {
        const batch = albums.slice(i, i + albumBatchSize);
        console.log(`   Processing album batch ${Math.floor(i/albumBatchSize) + 1}/${Math.ceil(albums.length/albumBatchSize)} (${batch.length} albums)`);
        
        for (const album of batch) {
          try {
            await this.syncTracks(sectionKey, album.ratingKey);
          } catch (error) {
            console.warn(`Failed to sync tracks for album ${album.title}:`, error.message);
            // Continue with next album on error
          }
        }
        
        // Small delay between batches
        if (i + albumBatchSize < albums.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Finally sync playlists
      await this.syncPlaylists(sectionKey);

      console.log(`✅ Music sync completed for section ${sectionKey}`);
    } catch (error) {
      console.error(`❌ Error syncing music for section ${sectionKey}:`, error);
      throw error;
    }
  }

  async syncArtists(sectionKey) {
    try {
      const data = await this.makeRequest(`/library/sections/${sectionKey}/all`);
      const artists = data.MediaContainer?.Metadata || [];
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      for (const artist of artists) {
        // Fetch detailed metadata for each artist to get collections
        let detailedArtist = artist;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${artist.ratingKey}`);
          detailedArtist = detailData.MediaContainer?.Metadata?.[0] || artist;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for artist ${artist.title} (${artist.ratingKey}):`, error.message);
        }

        const artistData = {
          ratingKey: detailedArtist.ratingKey,
          key: detailedArtist.key,
          guid: detailedArtist.guid || null,
          type: detailedArtist.type || 'artist',
          title: detailedArtist.title,
          titleSort: detailedArtist.titleSort || null,
          summary: detailedArtist.summary || null,
          index: detailedArtist.index ? parseInt(detailedArtist.index) : null,
          thumb: detailedArtist.thumb || null,
          art: detailedArtist.art || null,
          addedAt: detailedArtist.addedAt ? new Date(parseInt(detailedArtist.addedAt) * 1000) : null,
          updatedAt: detailedArtist.updatedAt ? new Date(parseInt(detailedArtist.updatedAt) * 1000) : null,
          librarySectionID: section.id,
          collections: detailedArtist.Collection ? JSON.stringify(detailedArtist.Collection.map(c => c.tag || c.title)) : null
        };

        try {
          await prisma.plexArtist.upsert({
            where: { ratingKey: detailedArtist.ratingKey },
            update: artistData,
            create: artistData
          });
        } catch (error) {
          await this.handleDatabaseError(
            error,
            'artist',
            detailedArtist.title,
            async () => {
              return await prisma.plexArtist.upsert({
                where: { ratingKey: detailedArtist.ratingKey },
                update: artistData,
                create: artistData
              });
            }
          );
        }

        // Add small delay every 10 artists to prevent overwhelming the database
        if (artists.indexOf(artist) % 10 === 9) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Synced ${artists.length} artists for section ${sectionKey}`);
    } catch (error) {
      console.error('Error syncing artists:', error);
      throw error;
    }
  }

  async syncAlbums(sectionKey, artistRatingKey) {
    try {
      // 1. Get albums from artist's children endpoint
      const childrenData = await this.makeRequest(`/library/metadata/${artistRatingKey}/children`);
      const childrenAlbums = childrenData.MediaContainer?.Metadata || [];
      if (childrenAlbums.length > 0) {
        console.log(`ℹ️ Found ${childrenAlbums.length} album(s) via artist children endpoint for artist ${artistRatingKey}.`);
      }

      // 2. Always perform a section-level scan to find albums by parentRatingKey
      const pageSize = 500; // Larger page size for efficiency
      let start = 0;
      let totalProcessed = 0;
      const scannedAlbums = [];
      let totalSize = 0;

      console.log(`ℹ️ Scanning section ${sectionKey} for albums by artist ${artistRatingKey}...`);
      while (true) {
        const page = await this.makeRequest(`/library/sections/${sectionKey}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
        const pageAlbums = page.MediaContainer?.Metadata || [];
        if (!totalSize) totalSize = page.MediaContainer?.totalSize || 0;

        if (pageAlbums.length === 0) break;

        for (const a of pageAlbums) {
          if (String(a.parentRatingKey) === String(artistRatingKey)) {
            scannedAlbums.push(a);
          }
        }
        
        totalProcessed += pageAlbums.length;
        if (totalSize > 0 && totalProcessed >= totalSize) {
          break; // Scanned all albums in the section
        }
        
        start += pageSize;
      }
      
      if (scannedAlbums.length > 0) {
        console.log(`   🔍 Section scan found ${scannedAlbums.length} album(s) for artist ${artistRatingKey} after checking ${totalProcessed} items.`);
      }

      // 3. Combine and deduplicate results
      const allAlbums = new Map();
      [...childrenAlbums, ...scannedAlbums].forEach(album => {
        allAlbums.set(album.ratingKey, album);
      });
      const albums = Array.from(allAlbums.values());
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      for (const album of albums) {
        // Fetch detailed metadata for each album to get collections
        let detailedAlbum = album;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${album.ratingKey}`);
          detailedAlbum = detailData.MediaContainer?.Metadata?.[0] || album;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for album ${album.title} (${album.ratingKey}):`, error.message);
        }

        const albumData = {
          ratingKey: detailedAlbum.ratingKey,
          key: detailedAlbum.key,
          parentRatingKey: detailedAlbum.parentRatingKey || artistRatingKey,
          guid: detailedAlbum.guid || null,
          type: detailedAlbum.type || 'album',
          title: detailedAlbum.title,
          titleSort: detailedAlbum.titleSort || null,
          summary: detailedAlbum.summary || null,
          index: detailedAlbum.index ? parseInt(detailedAlbum.index) : null,
          year: detailedAlbum.year ? parseInt(detailedAlbum.year) : null,
          thumb: detailedAlbum.thumb || null,
          art: detailedAlbum.art || null,
          parentThumb: detailedAlbum.parentThumb || null,
          originallyAvailableAt: detailedAlbum.originallyAvailableAt ? new Date(detailedAlbum.originallyAvailableAt) : null,
          addedAt: detailedAlbum.addedAt ? new Date(parseInt(detailedAlbum.addedAt) * 1000) : null,
          updatedAt: detailedAlbum.updatedAt ? new Date(parseInt(detailedAlbum.updatedAt) * 1000) : null,
          librarySectionID: section.id,
          collections: detailedAlbum.Collection ? JSON.stringify(detailedAlbum.Collection.map(c => c.tag || c.title)) : null
        };

        try {
          await prisma.plexAlbum.upsert({
            where: { ratingKey: detailedAlbum.ratingKey },
            update: albumData,
            create: albumData
          });
        } catch (error) {
          await this.handleDatabaseError(
            error,
            'album',
            detailedAlbum.title,
            async () => {
              return await prisma.plexAlbum.upsert({
                where: { ratingKey: detailedAlbum.ratingKey },
                update: albumData,
                create: albumData
              });
            }
          );
        }

        // Add small delay every 5 albums to prevent database overload
        if (albums.indexOf(album) % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Synced ${albums.length} albums for artist ${artistRatingKey}`);
    } catch (error) {
      console.error('Error syncing albums:', error);
      throw error;
    }
  }

  async syncTracks(sectionKey, albumRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${albumRatingKey}/children`);
      const tracks = data.MediaContainer?.Metadata || [];
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: String(sectionKey) }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      for (const track of tracks) {
        const trackData = {
          ratingKey: track.ratingKey,
          key: track.key,
          parentRatingKey: track.parentRatingKey || albumRatingKey,
          grandparentRatingKey: track.grandparentRatingKey || null,
          guid: track.guid || null,
          type: track.type || 'track',
          title: track.title,
          titleSort: track.titleSort || null,
          summary: track.summary || null,
          index: track.index ? parseInt(track.index) : null,
          duration: track.duration ? parseInt(track.duration) : null,
          thumb: track.thumb || null,
          art: track.art || null,
          parentThumb: track.parentThumb || null,
          grandparentThumb: track.grandparentThumb || null,
          addedAt: track.addedAt ? new Date(parseInt(track.addedAt) * 1000) : null,
          updatedAt: track.updatedAt ? new Date(parseInt(track.updatedAt) * 1000) : null,
          librarySectionID: section.id
        };

        try {
          await prisma.plexTrack.upsert({
            where: { ratingKey: track.ratingKey },
            update: trackData,
            create: trackData
          });
        } catch (error) {
          await this.handleDatabaseError(error, `track ${track.title}`, async () => {
            await prisma.plexTrack.upsert({
              where: { ratingKey: track.ratingKey },
              update: trackData,
              create: trackData
            });
          });
        }

        // Add small delay every 20 tracks to prevent overwhelming the database
        if (tracks.indexOf(track) % 20 === 19) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      console.log(`✅ Synced ${tracks.length} tracks for album ${albumRatingKey}`);
    } catch (error) {
      console.error('Error syncing tracks:', error);
      throw error;
    }
  }

  async syncPlaylists(sectionKey) {
    try {
      // Try the general playlists endpoint first
      let data;
      try {
        data = await this.makeRequest(`/playlists/all`);
      } catch (error) {
        console.log(`No playlists found at /playlists/all, trying section-specific: ${error.message}`);
        // If that fails, try to get playlists from the root
        try {
          data = await this.makeRequest(`/playlists`);
        } catch (error2) {
          console.log(`No playlists found at /playlists either: ${error2.message}`);
          // If no playlists endpoint works, just log and continue
          console.log(`✅ No playlists found for section ${sectionKey} (this is normal if no playlists exist)`);
          return;
        }
      }
      
      const playlists = data.MediaContainer?.Metadata || [];
      
      // Filter to audio playlists only
      const musicPlaylists = playlists.filter(playlist => 
        playlist.playlistType === 'audio' || 
        !playlist.playlistType // If no type specified, assume it could be music
      );
      
      if (musicPlaylists.length === 0) {
        console.log(`✅ No music playlists found for section ${sectionKey}`);
        return;
      }
      
      const section = await prisma.plexLibrarySection.findUnique({
        where: { sectionKey: sectionKey }
      });

      if (!section) {
        console.error(`Section ${sectionKey} not found`);
        return;
      }

      for (const playlist of musicPlaylists) {
        // Fetch detailed metadata for each playlist
        let detailedPlaylist = playlist;
        try {
          const detailData = await this.makeRequest(`/library/metadata/${playlist.ratingKey}`);
          detailedPlaylist = detailData.MediaContainer?.Metadata?.[0] || playlist;
        } catch (error) {
          console.warn(`Failed to fetch detailed metadata for playlist ${playlist.title} (${playlist.ratingKey}):`, error.message);
        }

        const playlistData = {
          ratingKey: detailedPlaylist.ratingKey,
          key: detailedPlaylist.key,
          guid: detailedPlaylist.guid || null,
          type: detailedPlaylist.type || 'playlist',
          title: detailedPlaylist.title,
          titleSort: detailedPlaylist.titleSort || null,
          summary: detailedPlaylist.summary || null,
          smart: detailedPlaylist.smart === '1' || detailedPlaylist.smart === true,
          playlistType: detailedPlaylist.playlistType || 'audio',
          thumb: detailedPlaylist.thumb || null,
          art: detailedPlaylist.art || null,
          duration: detailedPlaylist.duration ? parseInt(detailedPlaylist.duration) : null,
          leafCount: detailedPlaylist.leafCount ? parseInt(detailedPlaylist.leafCount) : null,
          addedAt: detailedPlaylist.addedAt ? new Date(parseInt(detailedPlaylist.addedAt) * 1000) : null,
          updatedAt: detailedPlaylist.updatedAt ? new Date(parseInt(detailedPlaylist.updatedAt) * 1000) : null,
          librarySectionID: section.id
        };

        await prisma.plexPlaylist.upsert({
          where: { ratingKey: detailedPlaylist.ratingKey },
          update: playlistData,
          create: playlistData
        });

        // Sync playlist items
        await this.syncPlaylistItems(detailedPlaylist.ratingKey);
      }

      console.log(`✅ Synced ${musicPlaylists.length} music playlists for section ${sectionKey}`);
    } catch (error) {
      console.error('Error syncing playlists:', error);
      // Don't throw the error - just log and continue since playlists are optional
      console.log(`⚠️ Continuing sync without playlists for section ${sectionKey}`);
    }
  }

  async syncPlaylistItems(playlistRatingKey) {
    try {
      const data = await this.makeRequest(`/library/metadata/${playlistRatingKey}/children`);
      const items = data.MediaContainer?.Metadata || [];

      // Clear existing playlist items
      await prisma.plexPlaylistItem.deleteMany({
        where: { playlistRatingKey: playlistRatingKey }
      });

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const itemData = {
          playlistRatingKey: playlistRatingKey,
          ratingKey: item.ratingKey,
          index: i + 1, // 1-based index
          type: item.type || 'track',
          addedAt: item.addedAt ? new Date(parseInt(item.addedAt) * 1000) : new Date()
        };

        try {
          await prisma.plexPlaylistItem.create({
            data: itemData
          });
        } catch (error) {
          console.warn(`Failed to sync playlist item ${item.ratingKey} in playlist ${playlistRatingKey}:`, error.message);
        }
      }

      console.log(`✅ Synced ${items.length} items for playlist ${playlistRatingKey}`);
    } catch (error) {
      console.error('Error syncing playlist items:', error);
      throw error;
    }
  }
}

module.exports = PlexSyncService;
