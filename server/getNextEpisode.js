require('dotenv').config();
const prisma = require('./prismaClient'); // Use the shared Prisma client
const tvdbService = require('./tvdbCachedService');
const PlexDatabaseService = require('./plexDatabaseService');

// Initialize Database Service
const plexDb = new PlexDatabaseService(prisma);

function getCollectionName() {
  return prisma.Settings.findUnique({
    where: { id: 1 }
  }).then(settings => {
    if (settings) {
      console.log('Collection Name:', settings.collectionName);
      return settings.collectionName;
    } else {
      console.log('No settings found');
      return null;
    }
  }).catch(error => {
    console.error('Error fetching collection name:', error);
    return null;
  });
}

async function getOrderTypeSettings() {
  try {
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
      if (settings) {
      return {
        tvGeneralPercent: settings.tvGeneralPercent ?? 50,
        moviesGeneralPercent: settings.moviesGeneralPercent ?? 50,
        customOrderPercent: settings.customOrderPercent ?? 0
      };
    } else {
      console.log('No order type settings found, using defaults');
      return {
        tvGeneralPercent: 50,
        moviesGeneralPercent: 50,
        customOrderPercent: 0
      };
    }
  } catch (error) {
    console.error('Error fetching order type settings:', error);
    return {
      tvGeneralPercent: 50,
      moviesGeneralPercent: 50,
      customOrderPercent: 0
    };
  }
}

async function selectOrderType() {
  const settings = await getOrderTypeSettings();
  console.log(`Order type percentages - TV General: ${settings.tvGeneralPercent}%, Movies General: ${settings.moviesGeneralPercent}%, Custom Order: ${settings.customOrderPercent}%`);
  
  // Generate random number between 0-100
  const randomPercent = Math.floor(Math.random() * 100) + 1;
  console.log(`Random selection: ${randomPercent}%`);
  
  // Determine order type based on cumulative percentages
  if (randomPercent <= settings.tvGeneralPercent) {
    console.log('Selected order type: TV General');
    return 'TV_GENERAL';
  } else if (randomPercent <= settings.tvGeneralPercent + settings.moviesGeneralPercent) {
    console.log('Selected order type: Movies General');
    return 'MOVIES_GENERAL';
  } else {
    console.log('Selected order type: Custom Order');
    return 'CUSTOM_ORDER';
  }
}

async function getTVGeneralContent() {
  try {
    console.log('Fetching TV General content from all TV libraries');
    
    // Get all TV shows from database
    const allSeries = await plexDb.getAllTVShows();
    
    if (allSeries.length > 0) {
      console.log(`Total TV series found: ${allSeries.length}`);
        // Filter by ignored collections
      const filteredSeries = await filterTVShowsByIgnoredCollections(allSeries);
      
      if (filteredSeries.length > 0) {
        console.log(`TV series after ignored collections filtering: ${filteredSeries.length}`);
        
        // Filter out TV shows that have episodes in active custom orders
        const seriesNotInCustomOrders = await filterTVShowsNotInCustomOrders(filteredSeries);
        
        if (seriesNotInCustomOrders.length > 0) {
          console.log(`TV series after custom orders filtering: ${seriesNotInCustomOrders.length}`);
          return seriesNotInCustomOrders;
        } else {
          console.log('All remaining TV series have episodes in custom orders, using ignored collections filtered list');
          return filteredSeries;
        }
      } else {
        console.log('All TV series are in ignored collections');
        return { message: "No TV series found after filtering ignored collections" };
      }
    } else {
      return { message: "No TV series found" };
    }
  } catch (error) {
    console.error('Error fetching TV General content:', error.message);
    return { message: error.message };
  }
}

async function getMoviesGeneralContent() {
  try {
    console.log('Fetching Movies General content from all movie libraries');
    
    // Get all movies from database
    const allMovies = await plexDb.getAllMovies();
    
    if (allMovies.length > 0) {
      console.log(`Total movies found: ${allMovies.length}`);
      return allMovies;
    } else {
      return { message: "No movies found" };
    }
  } catch (error) {
    console.error('Error fetching Movies General content:', error.message);
    return { message: error.message };
  }
}

async function selectRandomTVSeries(allSeries) {
  if (allSeries.length === 0) {
    return { message: "No TV series found" };
  }

  // Filter for unwatched series
  const unwatchedSeries = allSeries.filter(series => {
    const isUnwatched = series.leafCount > (series.viewedLeafCount || 0);
    return isUnwatched;
  });

  console.log(`Found ${unwatchedSeries.length} unwatched series out of ${allSeries.length} total`);

  if (unwatchedSeries.length === 0) {
    console.log('No unwatched series found, selecting from all series');
    const randomSeries = allSeries[Math.floor(Math.random() * allSeries.length)];
    return randomSeries;
  }

  // Select random unwatched series
  const randomSeries = unwatchedSeries[Math.floor(Math.random() * unwatchedSeries.length)];
  console.log(`Selected random TV series: ${randomSeries.title}`);
  return randomSeries;
}

// Function to filter TV shows by ignored collections
async function filterTVShowsByIgnoredCollections(tvShows) {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (!settings) {
      settings = { ignoredTVCollections: null };
    }

    // Parse ignored collections from JSON string
    let ignoredTVCollections = [];
    if (settings.ignoredTVCollections && typeof settings.ignoredTVCollections === 'string') {
      try {
        ignoredTVCollections = JSON.parse(settings.ignoredTVCollections);
      } catch (e) {
        console.warn('Failed to parse ignoredTVCollections JSON:', e);
        ignoredTVCollections = [];
      }
    }

    if (ignoredTVCollections.length === 0) {
      console.log('📺 No ignored TV collections configured, returning all TV shows');
      return tvShows;
    }

    console.log(`📺 Filtering TV shows with ignored collections: ${ignoredTVCollections.join(', ')}`);

    const filteredTVShows = tvShows.filter(tvShow => {
      const showCollections = plexDb.parseCollections(tvShow.collections || '');
      
      // Check if this TV show belongs to any ignored collections
      const isInIgnoredCollection = showCollections.some(collection => 
        ignoredTVCollections.some(ignored => 
          collection.toLowerCase() === ignored.toLowerCase()
        )
      );

      if (isInIgnoredCollection) {
        console.log(`📺 ⚠️  Filtering out TV show "${tvShow.title}" - found in ignored collection(s): ${showCollections.filter(col => 
          ignoredTVCollections.some(ignored => col.toLowerCase() === ignored.toLowerCase())
        ).join(', ')}`);
        return false;
      }

      return true;
    });

    console.log(`📺 Collection filtering results:`);
    console.log(`   - TV shows after filtering: ${filteredTVShows.length}`);
    console.log(`   - TV shows excluded: ${tvShows.length - filteredTVShows.length}`);

    return filteredTVShows;
  } catch (error) {
    console.error('Error filtering TV shows by ignored collections:', error);
    return tvShows; // Return original list if error
  }
}

async function selectRandomMovie(allMovies) {
  if (allMovies.length === 0) {
    return { message: "No movies found" };
  }

  // Filter for unwatched movies
  const unwatchedMovies = allMovies.filter(movie => {
    const isUnwatched = !movie.viewCount || movie.viewCount === 0;
    return isUnwatched;
  });

  console.log(`Found ${unwatchedMovies.length} unwatched movies out of ${allMovies.length} total`);

  if (unwatchedMovies.length === 0) {
    console.log('No unwatched movies found, selecting from all movies');
    const randomMovie = allMovies[Math.floor(Math.random() * allMovies.length)];
    return randomMovie;
  }

  // Select random unwatched movie
  const randomMovie = unwatchedMovies[Math.floor(Math.random() * unwatchedMovies.length)];
  console.log(`Selected random movie: ${randomMovie.title}`);
  return randomMovie;
}

async function getSeriesFromCollection(collection) {
  try {
    // Get TV shows by collection from database
    const series = await plexDb.getTVShowsByCollection(collection);
    
    if (series.length > 0) {
      console.log(`Total TV shows found in collection "${collection}": ${series.length}`);
        // Filter by ignored collections
      const filteredSeries = await filterTVShowsByIgnoredCollections(series);
      
      if (filteredSeries.length > 0) {
        console.log(`TV shows after ignored collections filtering: ${filteredSeries.length}`);
        
        // Filter out TV shows that have episodes in active custom orders
        const seriesNotInCustomOrders = await filterTVShowsNotInCustomOrders(filteredSeries);
        
        if (seriesNotInCustomOrders.length > 0) {
          console.log(`TV shows after custom orders filtering: ${seriesNotInCustomOrders.length}`);
          return seriesNotInCustomOrders;
        } else {
          console.log('All remaining TV shows have episodes in custom orders, using ignored collections filtered list');
          return filteredSeries;
        }
      } else {
        console.log(`All TV shows in collection "${collection}" are in ignored collections, falling back to all TV shows`);
        return await getAllTVShows();
      }
    } else {
      console.log(`No TV shows found in collection "${collection}", falling back to all TV shows`);
      return await getAllTVShows();
    }
  } catch (error) {
    console.error('Error getting series from collection:', error.message);
    console.log('Falling back to all TV shows due to error');
    return await getAllTVShows();
  }
}

async function getAllTVShows() {
  try {
    console.log('Getting all TV shows from all TV libraries...');
    const allTVShows = await plexDb.getAllTVShows();
    console.log(`Total TV shows found across all libraries: ${allTVShows.length}`);
      // Filter by ignored collections
    const filteredTVShows = await filterTVShowsByIgnoredCollections(allTVShows);
    console.log(`TV shows after ignored collections filtering: ${filteredTVShows.length}`);
    
    // Filter out TV shows that have episodes in active custom orders
    const tvShowsNotInCustomOrders = await filterTVShowsNotInCustomOrders(filteredTVShows);
    console.log(`TV shows after custom orders filtering: ${tvShowsNotInCustomOrders.length}`);
    
    return tvShowsNotInCustomOrders.length > 0 ? tvShowsNotInCustomOrders : filteredTVShows;
  } catch (error) {
    console.error('Error getting all TV shows:', error.message);
    return { message: error.message };
  }
}

async function selectInitialSeries(series) {  // Check if series is an array and has items
  if (Array.isArray(series) && series.length > 0) {
    // Pick an initial series (will be replaced by earliest-date selection if collections found)
    const initialSeries = series[Math.floor(Math.random() * series.length)];
    console.log('Selected initial series for collection check:', initialSeries?.title || 'Unknown');

    const watched = await determineIfWatched(initialSeries);
    if (watched) {
      const newInitialSeries = await selectInitialSeries(series);
      return newInitialSeries;
    } else {
      return initialSeries;
    }
  } else {
    // If series is not an array or is empty, return error message
    if (typeof series === 'object' && series.message) {
      return series; // Return the error object from getSeriesFromCollection
    } else {
      return { message: "No episodes found" };
    }
  }
}

async function determineIfWatched(series){
  let watched = false;

  if (series.leafCount === series.viewedLeafCount) {
    watched = true;
  } else {
    watched = false;
  }

  return watched;
}

async function selectEarliestUnplayedFromCollections(selectedSeries) {
  // If there are no other collections, return the original selection
  if (!selectedSeries.otherCollections || selectedSeries.otherCollections.length === 0) {
    console.log('No other collections found, returning original selection');
    return selectedSeries;
  }

  // Collect all items from all collections
  const allItems = [];
  // Add the original series/movie to the pool
  allItems.push({
    ...selectedSeries,
    libraryType: 'tv', // Ensure the original series is properly typed as TV
    fromCollection: 'original'
  });

  // Add all items from other collections
  for (const collection of selectedSeries.otherCollections) {
    for (const item of collection.items) {
      allItems.push({
        ...item,
        fromCollection: collection.title
      });
    }
  }  console.log(`Found ${allItems.length} total items across all collections`);

  // Filter to unplayed items only
  const unplayedItems = allItems.filter(item => {
    if (item.libraryType === 'movie') {
      // For movies, check if it's not watched (viewCount === undefined or 0)
      return !item.viewCount || item.viewCount === 0;
    } else {
      // For TV series, check if there are unwatched episodes
      return item.leafCount > (item.viewedLeafCount || 0);
    }
  });

  console.log(`Found ${unplayedItems.length} unplayed items for selection`);

  if (unplayedItems.length === 0) {
    console.log('No unplayed items found, returning original selection');
    return selectedSeries;
  }  // Sort by release/air date (earliest first) - Enhanced to consider episode air dates
  // First, enhance TV series items with their next episode air dates for accurate sorting
  const enhancedItems = await Promise.all(unplayedItems.map(async (item) => {
    if (item.libraryType === 'tv') {
      try {
        const nextEpisode = await plexDb.getNextUnwatchedEpisode(item.ratingKey);
        if (nextEpisode && nextEpisode.originallyAvailableAt) {
          return {
            ...item,
            episodeAirDate: nextEpisode.originallyAvailableAt,
            nextEpisodeInfo: nextEpisode,
            sortDate: nextEpisode.originallyAvailableAt
          };
        } else {
          return {
            ...item,
            sortDate: item.originallyAvailableAt || item.year || '9999'
          };
        }
      } catch (error) {
        console.warn(`⚠️  Could not get episode info for "${item.title}":`, error.message);
        return {
          ...item,
          sortDate: item.originallyAvailableAt || item.year || '9999'
        };
      }
    } else {
      // For movies, use the movie's release date
      return {
        ...item,
        sortDate: item.originallyAvailableAt || item.year || '9999'
      };
    }
  }));
  
  const sortedItems = enhancedItems.sort((a, b) => {
    const dateA = new Date(a.sortDate);
    const dateB = new Date(b.sortDate);
    return dateA - dateB;
  });
  
  const earliestItem = sortedItems[0];
  console.log(`✓ Selected earliest unplayed: "${earliestItem.title}" (${earliestItem.sortDate}) from collection: ${earliestItem.fromCollection}`);  // If the earliest item is a TV series, ensure we're using the correct episode air date
  if (earliestItem.libraryType === 'tv' && earliestItem.nextEpisodeInfo) {
    console.log('Earliest item is a TV series with episode info, validating chronological order...');
    
    // Enhanced logic: Compare episode air date with movie release dates
    console.log('🔍 Checking if episode air date is truly the earliest among all items...');
    
    // Get all movies from the sorted items for date comparison
    const movies = sortedItems.filter(item => item.libraryType === 'movie');
    
    if (movies.length > 0 && earliestItem.episodeAirDate) {
      const episodeDate = new Date(earliestItem.episodeAirDate);
      console.log(`📅 Episode air date: ${earliestItem.episodeAirDate}`);
      
      // Find movies that aired before this episode
      const moviesBeforeEpisode = movies.filter(movie => {
        const movieDate = new Date(movie.originallyAvailableAt || movie.year || '9999');
        return movieDate < episodeDate;
      });
      
      if (moviesBeforeEpisode.length > 0) {
        // There are movies that should come before this episode
        const earliestMovie = moviesBeforeEpisode[0]; // Already sorted
        console.log(`📅 Found movie that airs before episode: "${earliestMovie.title}" (${earliestMovie.originallyAvailableAt || earliestMovie.year})`);
        console.log(`🎯 Selecting movie as it released earlier chronologically`);
        
        // Return the movie instead
        return earliestMovie;
      } else {
        console.log(`📅 No movies found before episode air date, episode is chronologically earliest`);
      }
    } else if (!earliestItem.episodeAirDate) {
      console.log(`⚠️  Episode has no air date, falling back to series comparison logic`);
    }
  }

  // If the earliest item is from another collection, we need to re-fetch its collections
  if (earliestItem.fromCollection !== 'original') {
    console.log('Earliest item is from another collection, re-fetching collection data...');
    const updatedItem = await checkCollections(earliestItem);
    return updatedItem;
  }

  return earliestItem;
}

async function checkCollections(selectedSeries) {
  try {
    const currentCollection = await getCollectionName();
    
    // Get TV show details from database to find all collections it belongs to
    const seriesDetail = await plexDb.getTVShowByRatingKey(selectedSeries.ratingKey);
    if (!seriesDetail) {
      console.log(`Series "${selectedSeries.title}" not found in database`);
      selectedSeries.otherCollections = [];
      return selectedSeries;
    }
    
    const seriesCollections = plexDb.parseCollections(seriesDetail.collections || '');
    
    if (seriesCollections.length === 0) {
      console.log(`Series "${selectedSeries.title}" is not in any collections`);
      selectedSeries.otherCollections = [];
      return selectedSeries;
    }
    
    console.log(`Series "${selectedSeries.title}" belongs to ${seriesCollections.length} collection(s):`, 
      seriesCollections);
    
    // Filter out the current settings collection and keep the others
    const otherCollections = seriesCollections.filter(collection => {
      const isNotCurrentCollection = collection.toLowerCase() !== currentCollection?.toLowerCase();
      return isNotCurrentCollection;
    });
    
    if (otherCollections.length > 0) {
      console.log(`Found ${otherCollections.length} other collection(s) for "${selectedSeries.title}":`, 
        otherCollections);
      
      // Get additional details for each collection to determine library type
      const enrichedCollections = [];
      
      for (const collectionName of otherCollections) {
        try {
          console.log(`Searching for collection "${collectionName}" (and variants) in database`);
          
          const collectionData = {
            title: collectionName,
            id: collectionName, // Use name as ID for database collections
            ratingKey: collectionName,
            items: []
          };
            // Create collection search variants (original name and with " Collection" removed)
          const searchVariants = [
            collectionName,
            collectionName.replace(/ Collection$/, '')
          ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
          
          // Search for TV series in this collection
          for (const searchTerm of searchVariants) {
            try {
              const tvSeries = await plexDb.getTVShowsByCollection(searchTerm);
              if (tvSeries.length > 0) {
                console.log(`Found ${tvSeries.length} TV series using search term: "${searchTerm}"`);
              }
              
              // Add items, but avoid duplicates by checking ratingKey
              const existingKeys = new Set(collectionData.items.map(item => item.ratingKey));
              const newItems = tvSeries.filter(item => !existingKeys.has(item.ratingKey));
              
              collectionData.items.push(...newItems.map(item => ({
                ...item,
                libraryType: 'tv'
              })));
            } catch (error) {
              console.warn(`Failed to search TV shows for collection "${searchTerm}":`, error.message);
            }
          }
          
          // Search for movies in this collection
          for (const searchTerm of searchVariants) {
            try {
              const movies = await plexDb.getMoviesByCollection(searchTerm);
              if (movies.length > 0) {
                console.log(`Found ${movies.length} movies using search term: "${searchTerm}"`);
              }
              
              // Add items, but avoid duplicates by checking ratingKey
              const existingKeys = new Set(collectionData.items.map(item => item.ratingKey));
              const newItems = movies.filter(item => !existingKeys.has(item.ratingKey));
              
              collectionData.items.push(...newItems.map(item => ({
                ...item,
                libraryType: 'movie'
              })));
            } catch (error) {
              console.warn(`Failed to search movies for collection "${searchTerm}":`, error.message);
            }
          }
          
          console.log(`Found ${collectionData.items.length} items in collection "${collectionName}"`);
          console.log(collectionData);
          enrichedCollections.push(collectionData);
          
        } catch (error) {
          console.warn(`Failed to process collection "${collectionName}":`, error.message);
          // Add basic info even if we can't get full details
          enrichedCollections.push({
            title: collectionName,
            id: collectionName,
            ratingKey: collectionName,
            items: []
          });
        }
      }
      
      selectedSeries.otherCollections = enrichedCollections;
    } else {
      console.log(`No other collections found for "${selectedSeries.title}" (excluding current settings collection)`);
      selectedSeries.otherCollections = [];
    }
    
    return selectedSeries;
    
  } catch (error) {
    console.error('Error checking collections:', error.message);
    // Return the series unchanged if there's an error
    selectedSeries.otherCollections = [];
    return selectedSeries;
  }
}

async function getCurrentSeasonNumber(selectedSeries) {
  // Get the actual next unwatched episode from Plex
  try {
    const nextEpisode = await getNextUnwatchedEpisode(selectedSeries);
    return nextEpisode ? nextEpisode.seasonNumber : 1;
  } catch (error) {
    console.error('Error getting current season:', error);
    return 1;
  }
}

async function getCurrentEpisodeNumber(selectedSeries) {
  // Get the actual next unwatched episode from Plex
  try {
    const nextEpisode = await getNextUnwatchedEpisode(selectedSeries);
    return nextEpisode ? nextEpisode.episodeNumber : 1;
  } catch (error) {
    console.error('Error getting current episode:', error);
    return 1;
  }
}

async function getNextUnwatchedEpisode(selectedSeries) {
  try {
    console.log(`Getting next unwatched episode for: ${selectedSeries.title}`);
    
    // Use the database service to get the next unwatched episode
    const nextEpisode = await plexDb.getNextUnwatchedEpisode(selectedSeries.ratingKey);
    
    if (nextEpisode) {
      console.log(`Found next unwatched episode: Season ${nextEpisode.seasonNumber}, Episode ${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
      return {
        seasonNumber: nextEpisode.seasonNumber,
        episodeNumber: nextEpisode.episodeNumber,
        episodeTitle: nextEpisode.title,
        seasonTitle: nextEpisode.seasonTitle,
        ratingKey: nextEpisode.ratingKey,
        totalEpisodesInSeason: nextEpisode.totalEpisodesInSeason
      };
    } else {
      // If we get here, all episodes are watched
      console.log(`All episodes of ${selectedSeries.title} appear to be watched`);
      return null;
    }
    
  } catch (error) {
    console.error('Error getting next unwatched episode:', error);
    return null;
  }
}

async function enhanceWithTVDBArtwork(selectedSeries) {
  try {
    console.log(`Enhancing ${selectedSeries.title} with TVDB artwork`);
      // Get the actual next unwatched episode from Plex
    const nextEpisode = await getNextUnwatchedEpisode(selectedSeries);
      if (nextEpisode) {
      console.log(`Found next unwatched episode: Season ${nextEpisode.seasonNumber}, Episode ${nextEpisode.episodeNumber} - "${nextEpisode.episodeTitle}"`);
      selectedSeries.type = 'episode'; // Explicitly set type for episode data
      selectedSeries.currentSeason = nextEpisode.seasonNumber;
      selectedSeries.currentEpisode = nextEpisode.episodeNumber;
      selectedSeries.nextEpisodeTitle = nextEpisode.episodeTitle;
      selectedSeries.seasonTitle = nextEpisode.seasonTitle;
      selectedSeries.totalEpisodesInSeason = nextEpisode.totalEpisodesInSeason;
      selectedSeries.episodeRatingKey = nextEpisode.ratingKey; // Add episodeRatingKey for the specific episode
        // Get TVDB artwork for the current season and episode details
      const tvdbArtwork = await tvdbService.getCurrentSeasonArtwork(selectedSeries.title, nextEpisode.seasonNumber, nextEpisode.episodeNumber);
        if (tvdbArtwork) {
        console.log(`TVDB artwork found: ${tvdbArtwork.url}`);
        selectedSeries.tvdbArtwork = tvdbArtwork;
        
        // Check for finale type in episode details
        if (tvdbArtwork.episodeDetails && tvdbArtwork.episodeDetails.finaleType) {
          console.log(`Episode finale type found: ${tvdbArtwork.episodeDetails.finaleType}`);
          selectedSeries.finaleType = tvdbArtwork.episodeDetails.finaleType;
        }
        
        // Check for final season status
        if (tvdbArtwork.isCurrentSeasonFinal && tvdbArtwork.seriesStatus === 'Ended') {
          console.log(`Current season is final season of ended series`);
          selectedSeries.isCurrentSeasonFinal = true;
          selectedSeries.seriesStatus = tvdbArtwork.seriesStatus;
        }
      } else {
        console.log(`No TVDB artwork found for ${selectedSeries.title} season ${nextEpisode.seasonNumber}`);
      }
    } else {
      console.log(`No unwatched episodes found for ${selectedSeries.title}, using fallback values`);
      selectedSeries.currentSeason = null;
      selectedSeries.currentEpisode = null;
      selectedSeries.nextEpisodeTitle = null;
    }
    
    return selectedSeries;
  } catch (error) {
    console.error('Error enhancing with TVDB artwork:', error.message);
    return selectedSeries; // Return original if TVDB fails
  }
}

async function getNextEpisode() {
  try {
    // First, determine which order type to use
    const orderType = await selectOrderType();
    
    if (orderType === 'MOVIES_GENERAL') {
      // Return indication that movie should be selected
      // The actual movie selection will be handled by the main router
      return {
        orderType: 'MOVIES_GENERAL'
      };
    }
    
    if (orderType === 'CUSTOM_ORDER') {
      // Return indication that custom order should be selected
      // The actual custom order selection will be handled by the main router
      return {
        orderType: 'CUSTOM_ORDER'
      };
    }
      // Continue with TV General (original logic)
    const collection = await getCollectionName();
    console.log('Collection:', collection);

    const series = await getSeriesFromCollection(collection);

    let selectedSeries = await selectInitialSeries(series);
      // Check if selectInitialSeries returned an error
    if (selectedSeries.message) {
      return {
        message: selectedSeries.message,
        orderType: 'TV_GENERAL'
      };
    }
    
    console.log('Initially selected series for collection check:', selectedSeries?.title || 'Unknown');
      selectedSeries = await checkCollections(selectedSeries);
    console.log('Found collections for:', selectedSeries?.title || 'Unknown');
      // Now select the earliest unplayed item from all collections
    const finalSelection = await selectEarliestUnplayedFromCollections(selectedSeries);
    console.log('Final selection (earliest unplayed):', finalSelection?.title || 'Unknown');

    // Enhance with TVDB artwork
    const enhancedSelection = await enhanceWithTVDBArtwork(finalSelection);
    
    // Add order type to the response
    enhancedSelection.orderType = 'TV_GENERAL';

    return enhancedSelection;
      } catch (error) {
    console.error('Error making API call:', error.message);
    return {
      message: `Error in TV selection: ${error.message}`,
      orderType: 'TV_GENERAL'
    };
  }
}

// Function to check if a TV show exists in any active custom order
async function tvShowExistsInCustomOrder(plexKey) {
  try {
    // For TV shows, we need to check if any episodes from this series exist in custom orders
    // We can identify this by checking if any custom order item has this series as seriesTitle
    // or by checking the plexKey directly
    
    // First, get the series details to find its title
    const seriesDetail = await plexDb.getTVShowByRatingKey(plexKey);
    if (!seriesDetail) {
      return false;
    }
    
    // Check if any episodes from this series exist in custom orders
    const result = await prisma.customOrderItem.findFirst({
      where: {        OR: [
          // Check by series title
          {
            seriesTitle: seriesDetail.title,
            mediaType: 'episode',
            customOrder: {
              isActive: true
            }
          },
          // Check by plexKey if the series itself is added
          {
            plexKey: plexKey,
            mediaType: 'episode',
            customOrder: {
              isActive: true
            }
          }
        ]
      }
    });
    
    return !!result;
  } catch (error) {
    console.warn(`Error checking if TV show exists in custom order:`, error.message);
    return false; // If error, don't filter out the show
  }
}

// Function to filter out TV shows that have episodes in active custom orders
async function filterTVShowsNotInCustomOrders(tvShows) {
  try {
    console.log(`📺 Filtering ${tvShows.length} TV shows to exclude those with episodes in active custom orders...`);
    
    const filteredTVShows = [];
    let excludedCount = 0;
    
    for (const tvShow of tvShows) {
      const inCustomOrder = await tvShowExistsInCustomOrder(tvShow.ratingKey);
      if (inCustomOrder) {
        console.log(`🚫 Excluding TV show "${tvShow.title}" - has episodes in active custom order`);
        excludedCount++;
      } else {
        filteredTVShows.push(tvShow);
      }
    }
    
    console.log(`📺 Custom order filtering results:`);
    console.log(`   - TV shows after filtering: ${filteredTVShows.length}`);
    console.log(`   - TV shows excluded (in custom orders): ${excludedCount}`);
    
    return filteredTVShows;
  } catch (error) {
    console.error('Error filtering TV shows by custom orders:', error);
    return tvShows; // Return original list if error
  }
}

module.exports = getNextEpisode;