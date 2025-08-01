const prisma = require('./prismaClient');
const PlexDatabaseService = require('./plexDatabaseService');
const TVDBService = require('./tvdbService');

class StartNewSeriesService {
  constructor() {
    this.maxAttempts = 100; // Maximum attempts to find a suitable episode
    this.plexDb = new PlexDatabaseService(); // Create instance of the service
  }

  async findNewSeries() {
    console.log('🎬 Starting search for new series...');
    
    // Get settings for collection filtering
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    const selectedCollection = settings?.collectionName;
    const ignoredTVCollections = settings?.ignoredTVCollections ? 
      JSON.parse(settings.ignoredTVCollections) : [];
    
    console.log('Selected collection:', selectedCollection);
    console.log('Ignored TV collections:', ignoredTVCollections);
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      console.log(`\n--- Attempt ${attempt} ---`);
      
      try {
        // Step 1: Find a random unplayed episode in Plex
        const randomEpisode = await this.findRandomUnplayedEpisode();
        if (!randomEpisode) {
          console.log('❌ No unplayed episodes found');
          continue;
        }
        
        console.log(`🎲 Random episode: "${randomEpisode.grandparentTitle}" S${randomEpisode.parentIndex}E${randomEpisode.index}: ${randomEpisode.title}`);
        
        // Step 2: Find any collections to which the episode's series belongs
        const seriesCollections = await this.getSeriesCollections(randomEpisode.grandparentTitle);
        console.log(`📁 Series collections: ${seriesCollections.length > 0 ? seriesCollections.join(', ') : 'No collections'}`);
        
        // Step 3: If any of those collections is the collection selected in settings, go back to step 1
        if (selectedCollection && seriesCollections.some(col => 
          col.toLowerCase().includes(selectedCollection.toLowerCase())
        )) {
          console.log(`❌ Series is in selected collection "${selectedCollection}", skipping...`);
          continue;
        }
        
        // Step 6a: Check if collection is an excluded collection (only if series has collections)
        if (seriesCollections.length > 0) {
          const hasIgnoredCollection = seriesCollections.some(collection => 
            ignoredTVCollections.some(ignored => 
              collection.toLowerCase() === ignored.toLowerCase()
            )
          );
          
          if (hasIgnoredCollection) {
            const ignoredCols = seriesCollections.filter(col => 
              ignoredTVCollections.some(ignored => col.toLowerCase() === ignored.toLowerCase())
            );
            console.log(`❌ Series is in ignored collection(s): ${ignoredCols.join(', ')}, skipping...`);
            continue;
          }
        }
        
        // Step 4: Find the earliest episode from among all series in those collections
        // Also check for movies in related movie collections
        let earliestMedia;
        if (seriesCollections.length === 0) {
          // Series has no collections - find earliest episode from this same series
          earliestMedia = await this.findEarliestEpisodeInSeries(randomEpisode.grandparentTitle);
          console.log(`📺 Series has no collections, using earliest episode from same series: "${randomEpisode.grandparentTitle}"`);
        } else {
          // Series has collections - find earliest episode in those specific collections
          // Also check for movies in related movie collections
          earliestMedia = await this.findEarliestMediaInCollections(seriesCollections);
        }
        if (!earliestMedia) {
          console.log('❌ No unplayed episodes or movies found in collections');
          continue;
        }
        
        // Check if we found a movie or episode
        const isMovie = earliestMedia.type === 'movie';
        const mediaTitle = isMovie ? earliestMedia.title : `"${earliestMedia.grandparentTitle}" S${earliestMedia.parentIndex}E${earliestMedia.index}: ${earliestMedia.title}`;
        console.log(`🎯 Earliest ${isMovie ? 'movie' : 'episode'} in collections: ${mediaTitle}`);
        
        // Step 5: Check if the series/movie has an "Ended" status on TVDB (skip for movies)
        let isMediaEnded = { isEnded: true, status: 'Movie', seriesDetails: null };
        if (!isMovie) {
          isMediaEnded = await this.checkSeriesEndedStatus(earliestMedia.grandparentTitle);
        }
        if (!isMediaEnded.isEnded) {
          const seriesTitle = isMovie ? earliestMedia.title : earliestMedia.grandparentTitle;
          console.log(`❌ ${isMovie ? 'Movie' : 'Series'} "${seriesTitle}" is not ended on TVDB (status: ${isMediaEnded.status}), skipping...`);
          continue;
        }
        
        const seriesTitle = isMovie ? earliestMedia.title : earliestMedia.grandparentTitle;
        console.log(`✅ ${isMovie ? 'Movie' : 'Series'} "${seriesTitle}" is ended on TVDB`);
        
        // Step 6b: Make sure the episode/movie is not in a custom order
        const isInCustomOrder = isMovie ? 
          await this.checkMovieInCustomOrder(earliestMedia) :
          await this.checkEpisodeInCustomOrder(earliestMedia);
        if (isInCustomOrder) {
          console.log(`❌ ${isMovie ? 'Movie' : 'Episode'} is in a custom order, skipping...`);
          continue;
        }
        
        // Step 7: Select and display the media
        console.log(`🎬 Successfully found new ${isMovie ? 'movie' : 'series episode'}!`);
        
        if (isMovie) {
          return await this.formatMovieResponse(earliestMedia);
        } else {
          return await this.formatEpisodeResponse(earliestMedia, isMediaEnded.seriesDetails);
        }
        
      } catch (error) {
        console.error(`Error in attempt ${attempt}:`, error.message);
        continue;
      }
    }
    
    throw new Error(`Could not find a suitable new series after ${this.maxAttempts} attempts`);
  }
  
  async findRandomUnplayedEpisode() {
    // Get count of all unplayed episodes
    const totalUnplayedCount = await prisma.PlexEpisode.count({
      where: {
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      }
    });
    
    if (totalUnplayedCount === 0) {
      return null;
    }
    
    // Get a random offset
    const randomOffset = Math.floor(Math.random() * totalUnplayedCount);
    
    // Get the episode at that offset
    const randomEpisode = await prisma.PlexEpisode.findFirst({
      where: {
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      },
      skip: randomOffset,
      take: 1
    });
    
    return randomEpisode;
  }
  
  async getSeriesCollections(seriesTitle) {
    const tvShow = await prisma.PlexTVShow.findFirst({
      where: { title: seriesTitle },
      select: { collections: true }
    });
    
    if (!tvShow || !tvShow.collections) {
      return [];
    }
    
    return this.plexDb.parseCollections(tvShow.collections);
  }
  
  async findEarliestEpisodeInCollections(collections) {
    // Find all series that belong to any of these collections
    const allTVShows = await this.plexDb.getAllTVShows();
    const seriesInCollections = [];
    
    for (const show of allTVShows) {
      const showCollections = this.plexDb.parseCollections(show.collections || '');
      
      // Check if this show belongs to any of the target collections
      const hasMatchingCollection = showCollections.some(showCol => 
        collections.some(targetCol => 
          showCol.toLowerCase() === targetCol.toLowerCase()
        )
      );
      
      if (hasMatchingCollection) {
        seriesInCollections.push(show.title);
      }
    }
    
    if (seriesInCollections.length === 0) {
      return null;
    }
    
    console.log(`📺 Found ${seriesInCollections.length} series in collections: ${seriesInCollections.join(', ')}`);
    
    // Find the earliest unplayed episode across all these series (by air date)
    const earliestEpisode = await prisma.PlexEpisode.findFirst({
      where: {
        grandparentTitle: {
          in: seriesInCollections
        },
        originallyAvailableAt: {
          not: null  // Exclude episodes with no air date
        },
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      },
      orderBy: [
        { originallyAvailableAt: 'asc' },  // Sort by air date first
        { parentIndex: 'asc' },           // Then by season
        { index: 'asc' }                  // Then by episode
      ]
    });
    
    return earliestEpisode;
  }
  
  async findEarliestEpisodeInSeries(seriesTitle) {
    // Find the earliest unplayed episode in a specific series (by air date)
    const earliestEpisode = await prisma.PlexEpisode.findFirst({
      where: {
        grandparentTitle: seriesTitle,
        originallyAvailableAt: {
          not: null  // Exclude episodes with no air date
        },
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      },
      orderBy: [
        { originallyAvailableAt: 'asc' },  // Sort by air date first
        { parentIndex: 'asc' },           // Then by season
        { index: 'asc' }                  // Then by episode
      ]
    });
    
    return earliestEpisode;
  }
  
  async findEarliestEpisodeNotInSelectedCollection(selectedCollection) {
    // Find all series that are NOT in the selected collection
    const allTVShows = await this.plexDb.getAllTVShows();
    const seriesNotInSelected = [];
    
    for (const show of allTVShows) {
      const showCollections = this.plexDb.parseCollections(show.collections || '');
      
      // Check if this show is NOT in the selected collection
      const isInSelectedCollection = selectedCollection && showCollections.some(showCol => 
        showCol.toLowerCase().includes(selectedCollection.toLowerCase())
      );
      
      if (!isInSelectedCollection) {
        seriesNotInSelected.push(show.title);
      }
    }
    
    if (seriesNotInSelected.length === 0) {
      return null;
    }
    
    console.log(`📺 Found ${seriesNotInSelected.length} series not in selected collection`);
    
    // Find the earliest unplayed episode across all these series (by air date)
    const earliestEpisode = await prisma.PlexEpisode.findFirst({
      where: {
        grandparentTitle: {
          in: seriesNotInSelected
        },
        originallyAvailableAt: {
          not: null  // Exclude episodes with no air date
        },
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      },
      orderBy: [
        { originallyAvailableAt: 'asc' },  // Sort by air date first
        { parentIndex: 'asc' },           // Then by season
        { index: 'asc' }                  // Then by episode
      ]
    });
    
    return earliestEpisode;
  }
  
  async checkSeriesEndedStatus(seriesTitle) {
    try {
      const seriesResults = await TVDBService.searchSeries(seriesTitle);
      
      if (!seriesResults || seriesResults.length === 0) {
        return { isEnded: false, status: 'Not found on TVDB', seriesDetails: null };
      }
      
      const seriesDetails = await TVDBService.getSeriesDetails(seriesResults[0].tvdb_id);
      
      if (!seriesDetails || !seriesDetails.status) {
        return { isEnded: false, status: 'Unknown', seriesDetails: null };
      }
      
      const isEnded = seriesDetails.status.name === 'Ended';
      return { 
        isEnded, 
        status: seriesDetails.status.name, 
        seriesDetails 
      };
      
    } catch (error) {
      console.error(`Error checking TVDB status for ${seriesTitle}:`, error.message);
      return { isEnded: false, status: 'Error checking TVDB', seriesDetails: null };
    }
  }
  
  async checkEpisodeInCustomOrder(episode) {
    try {
      // Check if this episode exists in any custom order
      const customOrderItem = await prisma.CustomOrderItem.findFirst({
        where: {
          plexKey: episode.ratingKey
        }
      });
      
      return !!customOrderItem;
    } catch (error) {
      console.error('Error checking custom order:', error.message);
      return false;
    }
  }
  
  async formatEpisodeResponse(episode, seriesDetails) {
    // Get series details
    const series = await prisma.PlexTVShow.findFirst({
      where: { title: episode.grandparentTitle }
    });
    
    // Get series artwork
    const artworkUrl = await TVDBService.getCurrentSeasonArtwork(
      episode.grandparentTitle,
      episode.parentIndex,
      episode.index
    );
    
    // Get total episodes in season
    const totalEpisodesInSeason = await prisma.PlexEpisode.count({
      where: {
        grandparentTitle: episode.grandparentTitle,
        parentIndex: episode.parentIndex
      }
    });
    
    return {
      type: 'episode',
      ratingKey: episode.ratingKey,
      episodeRatingKey: episode.ratingKey,
      title: episode.title,
      episodeTitle: episode.title,
      seriesTitle: episode.grandparentTitle,
      seasonNumber: episode.parentIndex,
      episodeNumber: episode.index,
      currentSeason: episode.parentIndex,
      currentEpisode: episode.index,
      nextEpisodeTitle: episode.title,
      summary: episode.summary,
      year: series?.year,
      duration: episode.duration,
      orderType: 'NEW_SERIES',
      tvdbStatus: seriesDetails?.status?.name || 'Unknown',
      seriesStatus: seriesDetails?.status?.name || 'Unknown',
      seriesOverview: seriesDetails?.overview || '',
      // Add Plex artwork fields as fallback
      thumb: episode.thumb,
      art: episode.art || series?.art,
      // Add TVDB artwork in the expected format
      tvdbArtwork: artworkUrl ? {
        url: artworkUrl.url,
        seasonNumber: artworkUrl.seasonNumber,
        seriesName: artworkUrl.seriesName,
        isCurrentSeasonFinal: artworkUrl.isCurrentSeasonFinal
      } : null,
      totalEpisodesInSeason
    };
  }
  
  async findEarliestMediaInCollections(collections) {
    // Find earliest episode from series in collections
    const earliestEpisode = await this.findEarliestEpisodeInCollections(collections);
    
    // Find earliest movie from related movie collections
    const earliestMovie = await this.findEarliestMovieInCollections(collections);
    
    // Compare and return the earliest by air date
    if (!earliestEpisode && !earliestMovie) {
      return null;
    } else if (!earliestEpisode) {
      return { ...earliestMovie, type: 'movie' };
    } else if (!earliestMovie) {
      return { ...earliestEpisode, type: 'episode' };
    } else {
      // Compare air dates
      const episodeDate = new Date(earliestEpisode.originallyAvailableAt);
      const movieDate = new Date(earliestMovie.originallyAvailableAt);
      
      if (movieDate < episodeDate) {
        console.log(`🎬 Movie "${earliestMovie.title}" (${earliestMovie.originallyAvailableAt}) is earlier than episode`);
        return { ...earliestMovie, type: 'movie' };
      } else {
        console.log(`📺 Episode is earlier than movie "${earliestMovie.title}" (${earliestMovie.originallyAvailableAt})`);
        return { ...earliestEpisode, type: 'episode' };
      }
    }
  }
  
  async findEarliestMovieInCollections(seriesCollections) {
    // Look for movie collections that start with the same name as series collections
    const allMovies = await this.plexDb.getAllMovies();
    const moviesInRelatedCollections = [];
    
    for (const movie of allMovies) {
      const movieCollections = this.plexDb.parseCollections(movie.collections || '');
      
      // Check if any movie collection starts with a series collection name
      const hasRelatedCollection = movieCollections.some(movieCol =>
        seriesCollections.some(seriesCol =>
          movieCol.toLowerCase().startsWith(seriesCol.toLowerCase()) ||
          seriesCol.toLowerCase().startsWith(movieCol.toLowerCase())
        )
      );
      
      if (hasRelatedCollection) {
        moviesInRelatedCollections.push(movie.title);
      }
    }
    
    if (moviesInRelatedCollections.length === 0) {
      console.log('📽️ No related movie collections found');
      return null;
    }
    
    console.log(`📽️ Found ${moviesInRelatedCollections.length} movies in related collections: ${moviesInRelatedCollections.join(', ')}`);
    
    // Find the earliest unwatched movie
    const earliestMovie = await prisma.PlexMovie.findFirst({
      where: {
        title: {
          in: moviesInRelatedCollections
        },
        originallyAvailableAt: {
          not: null  // Exclude movies with no air date
        },
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      },
      orderBy: [
        { originallyAvailableAt: 'asc' }
      ]
    });
    
    return earliestMovie;
  }
  
  async checkMovieInCustomOrder(movie) {
    try {
      const customOrderItem = await prisma.CustomOrderItem.findFirst({
        where: {
          ratingKey: movie.ratingKey
        }
      });
      
      return !!customOrderItem;
    } catch (error) {
      console.error('Error checking if movie is in custom order:', error);
      return false;
    }
  }
  
  async formatMovieResponse(movie) {
    // Format movie response similar to episode response
    return {
      type: 'movie',
      ratingKey: movie.ratingKey,
      title: movie.title,
      summary: movie.summary,
      year: movie.year,
      duration: movie.duration,
      orderType: 'NEW_SERIES',
      // Add Plex artwork fields
      thumb: movie.thumb,
      art: movie.art,
      // Movie-specific fields
      studio: movie.studio,
      rating: movie.rating,
      originallyAvailableAt: movie.originallyAvailableAt
    };
  }
}

module.exports = new StartNewSeriesService();
