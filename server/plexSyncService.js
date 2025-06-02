require('dotenv').config();
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client

class PlexSyncService {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.plexUrl = null;
    this.plexToken = null;
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
      
      for (const section of sections) {        // Only sync TV and Movie sections
        if (section.type === 'show' || section.type === 'movie') {        const sectionData = {
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
          prisma.plexUltraBlurColor.deleteMany({ where: { movieRatingKey: ratingKey } })
        ]);
      } else if (itemType === 'show') {
        await Promise.all([
          prisma.plexGenre.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexGuid.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexImage.deleteMany({ where: { showRatingKey: ratingKey } }),
          prisma.plexUltraBlurColor.deleteMany({ where: { showRatingKey: ratingKey } })
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
      
      // Step 2: Sync content for each section
      for (const section of sections) {
        if (section.type === 'show') {
          const shows = await this.syncTVShows(section.sectionKey);
          totalShows += shows.length;
        } else if (section.type === 'movie') {
          const movies = await this.syncMovies(section.sectionKey);
          totalMovies += movies.length;
        }
      }
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      const result = {
        success: true,
        sections: sections.length,
        totalShows,
        totalMovies,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      };
      
      console.log('Full sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('Full sync failed:', error);
      throw error;
    }
  }

  async getSyncStatus() {
    try {
      const sections = await prisma.plexLibrarySection.count();
      const shows = await prisma.plexTVShow.count();
      const seasons = await prisma.plexSeason.count();
      const episodes = await prisma.plexEpisode.count();
      const movies = await prisma.plexMovie.count();
      
      // Get last sync time
      const lastSyncedShow = await prisma.plexTVShow.findFirst({
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true }
      });
      
      const lastSyncedMovie = await prisma.plexMovie.findFirst({
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
}

module.exports = PlexSyncService;
