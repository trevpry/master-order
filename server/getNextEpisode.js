// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const prisma = require('./prismaClient'); // Use the shared Prisma client
const tvdbService = require('./tvdbCachedService');
const PlexDatabaseService = require('./plexDatabaseService');
const HistoryPlusService = require('./services/historyPlusService');

// Initialize Database Service
const plexDb = new PlexDatabaseService(prisma);
const historyPlusService = new HistoryPlusService();

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
      // Parse media type limiters
      let mediaTypeLimiters = null;
      if (settings.mediaTypeLimiters) {
        try {
          mediaTypeLimiters = typeof settings.mediaTypeLimiters === 'string' 
            ? JSON.parse(settings.mediaTypeLimiters) 
            : settings.mediaTypeLimiters;
        } catch (e) {
          console.warn('Failed to parse mediaTypeLimiters:', e);
        }
      }

      return {
        tvGeneralPercent: settings.tvGeneralPercent ?? 50,
        moviesGeneralPercent: settings.moviesGeneralPercent ?? 50,
        customOrderPercent: settings.customOrderPercent ?? 0,
        historyPlusPercent: settings.historyPlusPercent ?? 0,
        mediaTypeLimiters,
        preferNewRelease: settings.preferNewRelease ?? 0,
        preferLongUnwatched: settings.preferLongUnwatched ?? 0
      };
    } else {
      console.log('No order type settings found, using defaults');
      return {
        tvGeneralPercent: 50,
        moviesGeneralPercent: 50,
        customOrderPercent: 0,
        historyPlusPercent: 0,
        mediaTypeLimiters: null,
        preferNewRelease: 0,
        preferLongUnwatched: 0
      };
    }
  } catch (error) {
    console.error('Error fetching order type settings:', error);
    return {
      tvGeneralPercent: 50,
      moviesGeneralPercent: 50,
      customOrderPercent: 0,
      historyPlusPercent: 0,
      mediaTypeLimiters: null,
      preferNewRelease: 0,
      preferLongUnwatched: 0
    };
  }
}

function getEffectiveOrderTypePercentages(settings) {
  const limiters = settings.mediaTypeLimiters;
  const allEnabled = !limiters || Object.values(limiters).every(v => v);

  let tvPercent = settings.tvGeneralPercent;
  let moviesPercent = settings.moviesGeneralPercent;
  let customPercent = settings.customOrderPercent;
  let historyPercent = settings.historyPlusPercent;

  if (!allEnabled && limiters) {
    // TV_GENERAL only produces episodes
    if (!limiters.episode) {
      tvPercent = 0;
    }

    // MOVIES_GENERAL only produces movies
    if (!limiters.movie) {
      moviesPercent = 0;
    }

    // CUSTOM_ORDER can produce any type - eligible if any limiter is enabled
    const customEligible = limiters.episode || limiters.movie || limiters.book ||
      limiters.webvideo || limiters.videogame || limiters.comic;
    if (!customEligible) {
      customPercent = 0;
    }

    // HISTORY_PLUS produces video, book, chapter, section
    const historyEligible = limiters.webvideo || limiters.book;
    if (!historyEligible) {
      historyPercent = 0;
    }

    // Re-normalize percentages if any were zeroed out
    const total = tvPercent + moviesPercent + customPercent + historyPercent;
    if (total === 0) {
      // All configured order types were excluded by limiters, but some order types
      // COULD serve the requested media types (they just had 0% configured).
      const eligibleTypes = [];
      if (limiters.episode) eligibleTypes.push('tv');
      if (limiters.movie) eligibleTypes.push('movies');
      if (limiters.episode || limiters.movie || limiters.book || limiters.webvideo || limiters.videogame || limiters.comic) eligibleTypes.push('custom');
      if (limiters.webvideo || limiters.book) eligibleTypes.push('history');

      if (eligibleTypes.length > 0) {
        const share = Math.floor(100 / eligibleTypes.length);
        tvPercent = eligibleTypes.includes('tv') ? share : 0;
        moviesPercent = eligibleTypes.includes('movies') ? share : 0;
        customPercent = eligibleTypes.includes('custom') ? share : 0;
        historyPercent = eligibleTypes.includes('history') ? share : 0;

        // Absorb rounding remainder into the last eligible type
        const remainder = 100 - (tvPercent + moviesPercent + customPercent + historyPercent);
        if (eligibleTypes.includes('history')) historyPercent += remainder;
        else if (eligibleTypes.includes('custom')) customPercent += remainder;
        else if (eligibleTypes.includes('movies')) moviesPercent += remainder;
        else tvPercent += remainder;
      } else {
        // No limiter-eligible types found, preserve original settings
        tvPercent = settings.tvGeneralPercent;
        moviesPercent = settings.moviesGeneralPercent;
        customPercent = settings.customOrderPercent;
        historyPercent = settings.historyPlusPercent;
      }
    } else if (total !== 100) {
      const scale = 100 / total;
      tvPercent = Math.round(tvPercent * scale);
      moviesPercent = Math.round(moviesPercent * scale);
      customPercent = Math.round(customPercent * scale);
      historyPercent = 100 - tvPercent - moviesPercent - customPercent; // Absorb rounding error
    }
  }

  return {
    limiters,
    allEnabled,
    tvPercent,
    moviesPercent,
    customPercent,
    historyPercent
  };
}

function selectWeightedTvOrMovie(tvWeight, movieWeight) {
  const total = tvWeight + movieWeight;
  if (total <= 0) {
    return null;
  }

  const random = Math.floor(Math.random() * total) + 1;
  return random <= tvWeight ? 'episode' : 'movie';
}

async function selectOrderType() {
  const settings = await getOrderTypeSettings();
  console.log(`Order type percentages - TV General: ${settings.tvGeneralPercent}%, Movies General: ${settings.moviesGeneralPercent}%, Custom Order: ${settings.customOrderPercent}%, History Plus: ${settings.historyPlusPercent}%`);

  const {
    limiters,
    allEnabled,
    tvPercent,
    moviesPercent,
    customPercent,
    historyPercent
  } = getEffectiveOrderTypePercentages(settings);

  if (!allEnabled && limiters) {
    console.log(`🎯 Media type limiters active:`, limiters);
    console.log(`🎯 Effective percentages - TV: ${tvPercent}%, Movies: ${moviesPercent}%, Custom: ${customPercent}%, History+: ${historyPercent}%`);
  }
  
  // Generate random number between 1-100
  const randomPercent = Math.floor(Math.random() * 100) + 1;
  console.log(`Random selection: ${randomPercent}%`);
  
  // Determine order type based on cumulative percentages
  if (randomPercent <= tvPercent) {
    console.log('Selected order type: TV General');
    return { orderType: 'TV_GENERAL', mediaTypeLimiters: limiters };
  } else if (randomPercent <= tvPercent + moviesPercent) {
    console.log('Selected order type: Movies General');
    return { orderType: 'MOVIES_GENERAL', mediaTypeLimiters: limiters };
  } else if (randomPercent <= tvPercent + moviesPercent + customPercent) {
    console.log('Selected order type: Custom Order');
    return { orderType: 'CUSTOM_ORDER', mediaTypeLimiters: limiters };
  } else {
    console.log('Selected order type: History Plus');
    return { orderType: 'HISTORY_PLUS', mediaTypeLimiters: limiters };
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

async function selectInitialSeries(series, checkedSeries = new Set()) {
  // Check if series is an array and has items
  if (Array.isArray(series) && series.length > 0) {
    // Filter out already checked series to prevent infinite loops
    const uncheckededSeries = series.filter(s => !checkedSeries.has(s.ratingKey));
    
    if (uncheckededSeries.length === 0) {
      // All series have been checked and are watched, return the first one anyway
      console.log('All series have been checked and are watched, returning first available series');
      return series[0];
    }
    
    // Pick an initial series from unchecked series
    const initialSeries = uncheckededSeries[Math.floor(Math.random() * uncheckededSeries.length)];
    console.log('Selected initial series for collection check:', initialSeries?.title || 'Unknown');
    
    // Mark this series as checked
    checkedSeries.add(initialSeries.ratingKey);

    const watched = await determineIfWatched(initialSeries);
    if (watched) {
      const newInitialSeries = await selectInitialSeries(series, checkedSeries);
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

  // Filter out items that are in active custom orders
  const filteredUnplayedItems = [];
  for (const item of unplayedItems) {
    if (item.libraryType === 'tv') {
      const inCustomOrder = await tvShowExistsInCustomOrder(item.ratingKey);
      if (inCustomOrder) {
        console.log(`🚫 Collection selection: Excluding TV show "${item.title}" - has episodes in active custom order`);
      } else {
        filteredUnplayedItems.push(item);
      }
    } else {
      // For movies, we could add similar logic here if needed
      filteredUnplayedItems.push(item);
    }
  }

  console.log(`Found ${filteredUnplayedItems.length} unplayed items after custom order filtering`);

  if (filteredUnplayedItems.length === 0) {
    console.log('No unplayed items found after custom order filtering, returning original selection');
    return selectedSeries;
  }  // Sort by release/air date (earliest first) - Enhanced to consider episode air dates
  // First, enhance TV series items with their next episode air dates for accurate sorting
  const enhancedItems = await Promise.all(filteredUnplayedItems.map(async (item) => {
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
    
    // Primary sort: by air date
    const dateDiff = dateA - dateB;
    if (dateDiff !== 0) {
      return dateDiff;
    }
    
    // Secondary sort (tiebreaker): by series title for consistent selection when dates are identical
    return a.title.localeCompare(b.title);
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

// Find a new release (released within past year) across eligible types
async function findNewRelease(settings) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;

  const candidates = [];
  const effective = getEffectiveOrderTypePercentages(settings);
  const limiters = effective.limiters || { episode: true, movie: true, book: true, webvideo: true, videogame: true, comic: true };

  // Respect effective order type percentages after limiter filtering/re-normalization
  const tvEnabled = limiters.episode && effective.tvPercent > 0;
  const moviesEnabled = limiters.movie && effective.moviesPercent > 0;

  try {
    // Check for new release movies (respecting collection + ignored collections)
    if (moviesEnabled) {
      const collection = await getCollectionName();
      let movies;
      if (collection) {
        movies = await plexDb.getMoviesByCollection(collection);
        if (!movies || movies.length === 0) {
          movies = await plexDb.getAllMovies();
        }
      } else {
        movies = await plexDb.getAllMovies();
      }

      // Filter to unwatched + new release + not in ignored collections
      let ignoredMovieCollections = [];
      const dbSettings = await prisma.settings.findUnique({ where: { id: 1 } });
      if (dbSettings?.ignoredMovieCollections) {
        try { ignoredMovieCollections = JSON.parse(dbSettings.ignoredMovieCollections); } catch (e) {}
      }

      for (const movie of movies) {
        if (movie.removed) continue;
        if (movie.viewCount && movie.viewCount > 0) continue;
        if (!movie.year || movie.year < lastYear) continue;
        if (ignoredMovieCollections.length > 0) {
          const movieCollections = plexDb.parseCollections(movie.collections || '');
          if (movieCollections.some(c => ignoredMovieCollections.includes(c))) continue;
        }
        candidates.push({ type: 'movie', source: 'MOVIES_GENERAL', data: movie });
      }
    }

    // Check for new release TV episodes (respecting collection + ignored collections)
    if (tvEnabled) {
      const collection = await getCollectionName();
      const seriesList = await getSeriesFromCollection(collection);
      if (Array.isArray(seriesList)) {
        for (const show of seriesList) {
          if (show.removed) continue;
          // Get next unwatched episode for this show and check if it's a new release
          const nextEp = await plexDb.getNextUnwatchedEpisode(show.ratingKey);
          if (nextEp && nextEp.originallyAvailableAt && nextEp.originallyAvailableAt >= oneYearAgoStr) {
            candidates.push({ type: 'episode', source: 'TV_GENERAL', data: nextEp, show });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Keep balance picks aligned with configured TV/Movie ratio.
    const preferredType = selectWeightedTvOrMovie(effective.tvPercent, effective.moviesPercent);
    const preferredCandidates = candidates.filter(candidate => candidate.type === preferredType);
    const pool = preferredCandidates.length > 0 ? preferredCandidates : candidates;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    console.log(`🆕 New release selected: "${chosen.data.title}" (${chosen.type})`);

    if (chosen.type === 'movie') {
      return {
        ...chosen.data,
        type: 'movie',
        orderType: 'MOVIES_GENERAL',
        balanceReason: 'new_release'
      };
    } else {
      const ep = chosen.data;
      const show = chosen.show;
      return {
        ...show,
        type: 'episode',
        episodeRatingKey: ep.ratingKey,
        episodeTitle: ep.title,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        originallyAvailableAt: ep.originallyAvailableAt,
        orderType: 'TV_GENERAL',
        balanceReason: 'new_release'
      };
    }
  } catch (error) {
    console.error('Error finding new release:', error.message);
  }
  return null;
}

// Find content from a series/order that hasn't been viewed recently
async function findLongUnwatched(settings) {
  const effective = getEffectiveOrderTypePercentages(settings);
  const limiters = effective.limiters || { episode: true, movie: true, book: true, webvideo: true, videogame: true, comic: true };
  const candidates = [];

  // Respect effective order type percentages after limiter filtering/re-normalization
  const tvEnabled = limiters.episode && effective.tvPercent > 0;
  const moviesEnabled = limiters.movie && effective.moviesPercent > 0;

  try {
    // Find TV shows with unwatched content, sorted by oldest lastViewedAt (respecting collection + ignored)
    if (tvEnabled) {
      const collection = await getCollectionName();
      const seriesList = await getSeriesFromCollection(collection);
      if (Array.isArray(seriesList)) {
        // Filter to shows that have been viewed before but still have unwatched episodes
        const staleShows = seriesList
          .filter(show => !show.removed && show.lastViewedAt && show.lastViewedAt > 0 &&
            (show.viewedLeafCount || 0) < (show.leafCount || 0))
          .sort((a, b) => (a.lastViewedAt || 0) - (b.lastViewedAt || 0));

        for (const show of staleShows.slice(0, 20)) {
          candidates.push({ type: 'episode', source: 'TV_GENERAL', data: show, lastViewed: show.lastViewedAt });
        }
      }
    }

    // Find unwatched movies from collection, preferring oldest added (respecting collection + ignored)
    if (moviesEnabled) {
      const collection = await getCollectionName();
      let movies;
      if (collection) {
        movies = await plexDb.getMoviesByCollection(collection);
        if (!movies || movies.length === 0) {
          movies = await plexDb.getAllMovies();
        }
      } else {
        movies = await plexDb.getAllMovies();
      }

      let ignoredMovieCollections = [];
      const dbSettings = await prisma.settings.findUnique({ where: { id: 1 } });
      if (dbSettings?.ignoredMovieCollections) {
        try { ignoredMovieCollections = JSON.parse(dbSettings.ignoredMovieCollections); } catch (e) {}
      }

      const unwatchedMovies = movies
        .filter(movie => {
          if (movie.removed) return false;
          if (movie.viewCount && movie.viewCount > 0) return false;
          if (ignoredMovieCollections.length > 0) {
            const movieCollections = plexDb.parseCollections(movie.collections || '');
            if (movieCollections.some(c => ignoredMovieCollections.includes(c))) return false;
          }
          return true;
        })
        .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));

      for (const movie of unwatchedMovies.slice(0, 20)) {
        candidates.push({ type: 'movie', source: 'MOVIES_GENERAL', data: movie, lastViewed: movie.addedAt || 0 });
      }
    }

    if (candidates.length === 0) return null;

    // Sort by oldest lastViewed and pick from the top quartile.
    // Apply weighted TV/Movie preference before random pick.
    candidates.sort((a, b) => (a.lastViewed || 0) - (b.lastViewed || 0));
    const topQuartile = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 4)));
    const preferredType = selectWeightedTvOrMovie(effective.tvPercent, effective.moviesPercent);
    const preferredCandidates = topQuartile.filter(candidate => candidate.type === preferredType);
    const pool = preferredCandidates.length > 0 ? preferredCandidates : topQuartile;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    console.log(`⏳ Long unwatched selected: "${chosen.data.title}" (${chosen.type})`);

    if (chosen.type === 'movie') {
      return {
        ...chosen.data,
        type: 'movie',
        orderType: 'MOVIES_GENERAL',
        balanceReason: 'long_unwatched'
      };
    } else {
      const nextEpisode = await plexDb.getNextUnwatchedEpisode(chosen.data.ratingKey);
      if (nextEpisode) {
        return {
          ...chosen.data,
          type: 'episode',
          episodeRatingKey: nextEpisode.ratingKey,
          episodeTitle: nextEpisode.title,
          seasonNumber: nextEpisode.seasonNumber,
          episodeNumber: nextEpisode.episodeNumber,
          originallyAvailableAt: nextEpisode.originallyAvailableAt,
          orderType: 'TV_GENERAL',
          balanceReason: 'long_unwatched'
        };
      }
    }
  } catch (error) {
    console.error('Error finding long unwatched:', error.message);
  }
  return null;
}

async function getNextEpisode() {
  try {
    // Check balance preferences before normal order type selection
    const settings = await getOrderTypeSettings();
    const { preferNewRelease, preferLongUnwatched } = settings;
    console.log(`⚖️ Balance settings - Prefer New Release: ${preferNewRelease}%, Prefer Long Unwatched: ${preferLongUnwatched}%`);

    // Roll for Prefer New Release
    if (preferNewRelease > 0) {
      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= preferNewRelease) {
        console.log(`🆕 New Release roll: ${roll}% <= ${preferNewRelease}% — searching for new releases`);
        const newRelease = await findNewRelease(settings);
        if (newRelease) {
          return newRelease;
        }
        console.log('🆕 No new releases found, falling through to normal selection');
      }
    }

    // Roll for Prefer Long Unwatched
    if (preferLongUnwatched > 0) {
      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= preferLongUnwatched) {
        console.log(`⏳ Long Unwatched roll: ${roll}% <= ${preferLongUnwatched}% — searching for long unwatched`);
        const longUnwatched = await findLongUnwatched(settings);
        if (longUnwatched) {
          return longUnwatched;
        }
        console.log('⏳ No long unwatched content found, falling through to normal selection');
      }
    }

    // Normal order type selection
    const { orderType, mediaTypeLimiters } = await selectOrderType();
    
    if (orderType === 'MOVIES_GENERAL') {
      // Return indication that movie should be selected
      // The actual movie selection will be handled by the main router
      return {
        orderType: 'MOVIES_GENERAL',
        mediaTypeLimiters
      };
    }
    
    if (orderType === 'CUSTOM_ORDER') {
      // Return indication that custom order should be selected
      // The actual custom order selection will be handled by the main router
      return {
        orderType: 'CUSTOM_ORDER',
        mediaTypeLimiters
      };
    }
    
    if (orderType === 'HISTORY_PLUS') {
      try {
        console.log('🏛️ History Plus order type selected - finding next unreviewed event');
        
        // Get the next unreviewed event
        const nextEvent = await historyPlusService.getNextUnreviewedEvent();
        
        if (!nextEvent) {
          console.log('No unreviewed events found');
          return {
            message: 'No History Plus content available',
            orderType: 'HISTORY_PLUS',
            mediaTypeLimiters
          };
        }
        
        console.log(`📚 Found unreviewed event: ${nextEvent.title}`);
        
        // Determine allowed History Plus content types based on limiters
        let allowedTypes = null;
        if (mediaTypeLimiters && !Object.values(mediaTypeLimiters).every(v => v)) {
          allowedTypes = [];
          if (mediaTypeLimiters.webvideo) allowedTypes.push('video');
          if (mediaTypeLimiters.book) allowedTypes.push('book', 'chapter', 'section');
          console.log(`🎯 History Plus filtered to types: ${allowedTypes.join(', ')}`);
        }
        
        // Get random content from the event, filtered by allowed types
        const randomContent = await historyPlusService.getRandomContentFromEvent(nextEvent, allowedTypes);
        
        if (!randomContent) {
          console.log('No content found in event');
          return {
            message: 'No content available in selected event',
            orderType: 'HISTORY_PLUS',
            mediaTypeLimiters
          };
        }
        
        console.log(`🎲 Randomly selected ${randomContent.type}: ${randomContent.title}`);
        
        return {
          orderType: 'HISTORY_PLUS',
          ...randomContent
        };
        
      } catch (error) {
        console.error('Error in History Plus selection:', error);
        return {
          message: `Error in History Plus selection: ${error.message}`,
          orderType: 'HISTORY_PLUS',
          mediaTypeLimiters
        };
      }
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
      where: {
        OR: [
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