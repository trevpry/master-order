require('dotenv').config();
const prisma = require('./prismaClient'); // Use the shared Prisma client
const PlexDatabaseService = require('./plexDatabaseService');

// Initialize Database Service
const plexDb = new PlexDatabaseService(); // prisma is now handled within PlexDatabaseService constructor

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

async function getMoviesFromCollection(collection) {
  try {
    // Get movies by collection from database
    const movies = await plexDb.getMoviesByCollection(collection);
    
    if (movies.length > 0) {
      console.log(`Total movies found in collection "${collection}": ${movies.length}`);
      return movies;
    } else {
      console.log(`No movies found in collection "${collection}", falling back to all movies`);
      return await getAllMovies();
    }
  } catch (error) {
    console.error('Error getting movies from collection:', error.message);
    console.log('Falling back to all movies due to error');
    return await getAllMovies();
  }
}

async function getAllMovies() {
  try {
    console.log('Getting all movies from all movie libraries...');
    const allMovies = await plexDb.getAllMovies();
    console.log(`Total movies found across all libraries: ${allMovies.length}`);
    return allMovies;
  } catch (error) {
    console.error('Error getting all movies:', error.message);
    return { message: error.message };
  }
}

async function selectInitialMovie(movies) {
  // Check if movies is an array and has items
  if (!Array.isArray(movies) || movies.length === 0) {
    // If movies is not an array or is empty, return error message
    if (typeof movies === 'object' && movies.message) {
      return movies; // Return the error object from getMoviesFromCollection
    } else {
      return { message: "No movies found" };
    }
  }

  // Get settings for partially watched collection prioritization and ignored collections
  let settings = await prisma.settings.findUnique({
    where: { id: 1 }
  });
  
  if (!settings) {
    settings = {
      partiallyWatchedCollectionPercent: 75,
      ignoredMovieCollections: null,
      christmasFilterEnabled: false
    };
  }

  const partiallyWatchedPercent = settings.partiallyWatchedCollectionPercent || 75;
  const christmasFilterEnabled = settings.christmasFilterEnabled || false;
  
  // Parse ignored collections from JSON string
  let ignoredMovieCollections = [];
  if (settings.ignoredMovieCollections && typeof settings.ignoredMovieCollections === 'string') {
    try {
      ignoredMovieCollections = JSON.parse(settings.ignoredMovieCollections);
    } catch (e) {
      console.warn('Failed to parse ignoredMovieCollections JSON:', e);
      ignoredMovieCollections = [];
    }
  }
  
  console.log(`🎯 Using ${partiallyWatchedPercent}% priority for partially watched collections`);
  if (ignoredMovieCollections.length > 0) {
    console.log(`🚫 Ignoring movie collections: ${ignoredMovieCollections.join(', ')}`);
  }
  
  // Apply Christmas filter if enabled
  let moviesToFilter = movies;
  if (christmasFilterEnabled) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, we want 1-12
    const isDecember = currentMonth === 12;
    
    console.log(`🎄 Christmas filter enabled. Current month: ${currentMonth} (${isDecember ? 'December' : 'Not December'})`);
      if (!isDecember) {
      // Filter out Christmas movies during non-December months based on Plex labels
      const nonChristmasMovies = [];
      
      for (const movie of movies) {
        // Check if movie has Christmas labels
        const movieLabels = await prisma.plexLabel.findMany({
          where: { movieRatingKey: movie.ratingKey }
        });
        
        const hasChristmasLabel = movieLabels.some(label => 
          label.tag && label.tag.toLowerCase().includes('christmas')
        );
        
        if (hasChristmasLabel) {
          console.log(`🎄 Filtering out Christmas movie "${movie.title}" (found Christmas label, not December)`);
        } else {
          nonChristmasMovies.push(movie);
        }
      }
      
      console.log(`🎄 Christmas filtering: ${movies.length} total movies → ${nonChristmasMovies.length} after removing Christmas movies`);
      moviesToFilter = nonChristmasMovies.length > 0 ? nonChristmasMovies : movies;
      
      if (nonChristmasMovies.length === 0) {
        console.log('⚠️  All movies were Christmas movies, proceeding with original list');
      }
    } else {
      console.log('🎄 December detected: Christmas movies are allowed in selection');
    }
  }
  
  // Filter out movies from ignored collections
  const filteredMovies = moviesToFilter.filter(movie => {
    const movieCollections = plexDb.parseCollections(movie.collections || '');
    const hasIgnoredCollection = movieCollections.some(collection => 
      ignoredMovieCollections.includes(collection)
    );
    if (hasIgnoredCollection) {
      console.log(`🚫 Excluding movie "${movie.title}" - found in ignored collection(s): ${movieCollections.filter(c => ignoredMovieCollections.includes(c)).join(', ')}`);
      return false;
    }
    return true;
  });
  
  console.log(`📊 Collection filtering: ${movies.length} total movies → ${filteredMovies.length} after removing ignored collections`);
  
  // Use filtered movies for further processing
  const moviesToProcess = filteredMovies.length > 0 ? filteredMovies : movies;
  if (filteredMovies.length === 0) {
    console.log('⚠️  All movies were in ignored collections, proceeding with original list');
  }
    // Filter out movies that exist in active custom orders
  const moviesNotInCustomOrders = await filterMoviesNotInCustomOrders(moviesToProcess);
  
  // Use movies not in custom orders for further processing
  const finalMoviesToProcess = moviesNotInCustomOrders.length > 0 ? moviesNotInCustomOrders : moviesToProcess;
  if (moviesNotInCustomOrders.length === 0) {
    console.log('⚠️  All movies were in custom orders, proceeding with original list');
  }
  
  // Analyze collection watch status
  const watchAnalysis = await analyzeCollectionWatchStatus(finalMoviesToProcess);    // Filter out watched movies first
  const unwatchedMovies = finalMoviesToProcess.filter(movie => !movie.viewCount || movie.viewCount === 0);
    if (unwatchedMovies.length === 0) {
    console.log('⚠️  All movies are watched, returning random selection from all movies');
    return finalMoviesToProcess[Math.floor(Math.random() * finalMoviesToProcess.length)];
  }
  
  console.log(`📋 Found ${unwatchedMovies.length} unwatched movies for selection`);
  
  // Filter out movies that have TV series in their collections
  const moviesWithoutTVCollections = [];
  const moviesWithTVCollections = [];
  
  for (const movie of unwatchedMovies) {
    const hasTVSeries = await movieHasTVSeriesInCollections(movie);
    if (hasTVSeries) {
      moviesWithTVCollections.push(movie);
    } else {
      moviesWithoutTVCollections.push(movie);
    }
  }
  
  console.log(`🔍 Collection filtering results:`);
  console.log(`   - Movies without TV series in collections: ${moviesWithoutTVCollections.length}`);
  console.log(`   - Movies with TV series in collections (excluded): ${moviesWithTVCollections.length}`);
  
  // Prefer movies that don't have TV series in their collections
  const moviesToConsider = moviesWithoutTVCollections.length > 0 ? moviesWithoutTVCollections : unwatchedMovies;
  
  if (moviesWithoutTVCollections.length === 0) {
    console.log('⚠️  All unwatched movies have TV series in their collections, proceeding with all unwatched movies');
  }
    // Categorize unwatched movies by collection watch status
  const partiallyWatchedCollectionMovies = [];
  const fullyUnwatchedCollectionMovies = [];
  const noCollectionMovies = [];
  
  for (const movie of moviesToConsider) {
    const collections = plexDb.parseCollections(movie.collections || '');
    
    if (collections.length === 0) {
      // Movie doesn't belong to any collection
      noCollectionMovies.push(movie);
    } else {
      // Check if any of the movie's collections are partially watched
      const hasPartiallyWatchedCollection = collections.some(collection => 
        watchAnalysis.partiallyWatchedCollections.has(collection)
      );
      
      if (hasPartiallyWatchedCollection) {
        partiallyWatchedCollectionMovies.push(movie);
      } else {
        fullyUnwatchedCollectionMovies.push(movie);
      }
    }
  }
  
  console.log(`🔢 Categorized movies:`);
  console.log(`   - Partially watched collections: ${partiallyWatchedCollectionMovies.length}`);
  console.log(`   - Fully unwatched collections: ${fullyUnwatchedCollectionMovies.length}`);
  console.log(`   - No collections: ${noCollectionMovies.length}`);
  
  // Apply prioritization logic
  const randomValue = Math.random() * 100;
  
  if (randomValue < partiallyWatchedPercent && partiallyWatchedCollectionMovies.length > 0) {
    // Select from partially watched collections
    const selectedMovie = partiallyWatchedCollectionMovies[Math.floor(Math.random() * partiallyWatchedCollectionMovies.length)];
    console.log(`🎯 Selected from partially watched collection: "${selectedMovie.title}"`);
    return selectedMovie;
  } else {
    // Select from the remaining pool (fully unwatched collections + no collections)
    const remainingMovies = [...fullyUnwatchedCollectionMovies, ...noCollectionMovies];
    
    if (remainingMovies.length > 0) {
      const selectedMovie = remainingMovies[Math.floor(Math.random() * remainingMovies.length)];
      console.log(`🎲 Selected from remaining pool: "${selectedMovie.title}"`);
      return selectedMovie;
    } else if (partiallyWatchedCollectionMovies.length > 0) {
      // Fallback to partially watched collections if no other options
      const selectedMovie = partiallyWatchedCollectionMovies[Math.floor(Math.random() * partiallyWatchedCollectionMovies.length)];
      console.log(`🔄 Fallback to partially watched collection: "${selectedMovie.title}"`);
      return selectedMovie;    } else {
      // This shouldn't happen, but fallback to random selection from filtered movies or all unwatched
      const fallbackMovies = moviesToConsider.length > 0 ? moviesToConsider : unwatchedMovies;
      const selectedMovie = fallbackMovies[Math.floor(Math.random() * fallbackMovies.length)];
      console.log(`⚠️  Unexpected fallback to random selection: "${selectedMovie.title}"`);
      return selectedMovie;
    }
  }
}

async function determineIfWatched(movie) {
  // For movies, check if it's watched (viewCount > 0)
  return movie.viewCount && movie.viewCount > 0;
}

async function movieHasTVSeriesInCollections(movie) {
  // Check if the movie's collections contain any TV series
  try {
    const movieCollections = plexDb.parseCollections(movie.collections || '');
    
    if (movieCollections.length === 0) {
      return false; // No collections, so no TV series
    }
    
    // Check each collection for TV series
    for (const collectionName of movieCollections) {      const searchVariants = [
        collectionName,
        collectionName.replace(/ Collection$/, '')
      ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
      
      for (const searchTerm of searchVariants) {
        try {
          const tvSeries = await plexDb.getTVShowsByCollection(searchTerm);
          if (tvSeries.length > 0) {
            console.log(`⚠️  Movie "${movie.title}" has TV series in collection "${collectionName}": ${tvSeries.length} series found`);
            return true; // Found TV series in this collection
          }
        } catch (error) {
          // Continue checking other variants/collections
        }
      }
    }
    
    return false; // No TV series found in any collection
  } catch (error) {
    console.warn(`Error checking TV series in collections for movie "${movie.title}":`, error.message);
    return false; // Assume no TV series if error
  }
}

async function analyzeCollectionWatchStatus(movies) {
  console.log('🔍 Analyzing collection watch status for movie prioritization...');
  
  const partiallyWatchedCollections = new Set();
  const fullyUnwatchedCollections = new Set();
  
  // Group movies by their collections
  const moviesByCollection = new Map();
  
  for (const movie of movies) {
    // Get all collections this movie belongs to
    const collections = plexDb.parseCollections(movie.collections || '');
    
    for (const collectionName of collections) {
      if (!moviesByCollection.has(collectionName)) {
        moviesByCollection.set(collectionName, []);
      }
      moviesByCollection.get(collectionName).push(movie);
    }
  }
  
  // Analyze each collection's watch status
  for (const [collectionName, collectionMovies] of moviesByCollection) {
    const watchedMovies = collectionMovies.filter(movie => movie.viewCount && movie.viewCount > 0);
    const unwatchedMovies = collectionMovies.filter(movie => !movie.viewCount || movie.viewCount === 0);
    
    if (watchedMovies.length > 0 && unwatchedMovies.length > 0) {
      // Collection has both watched and unwatched movies
      partiallyWatchedCollections.add(collectionName);
      console.log(`📊 "${collectionName}": ${watchedMovies.length} watched, ${unwatchedMovies.length} unwatched (PARTIALLY WATCHED)`);
    } else if (watchedMovies.length === 0) {
      // Collection has no watched movies
      fullyUnwatchedCollections.add(collectionName);
      console.log(`📊 "${collectionName}": 0 watched, ${unwatchedMovies.length} unwatched (FULLY UNWATCHED)`);
    } else {
      // Collection is fully watched
      console.log(`📊 "${collectionName}": ${watchedMovies.length} watched, 0 unwatched (FULLY WATCHED)`);
    }
  }
  
  return {
    partiallyWatchedCollections,
    fullyUnwatchedCollections,
    moviesByCollection
  };
}

async function selectEarliestUnplayedFromCollections(selectedMovie) {
  // If there are no other collections, return the original selection
  if (!selectedMovie.otherCollections || selectedMovie.otherCollections.length === 0) {
    console.log('No other collections found, returning original selection');
    return selectedMovie;
  }

  // Collect all items from all collections
  const allItems = [];
  
  // Add the original movie to the pool
  allItems.push({
    ...selectedMovie,
    fromCollection: 'original'
  });

  // Add all items from other collections
  for (const collection of selectedMovie.otherCollections) {
    for (const item of collection.items) {
      allItems.push({
        ...item,
        fromCollection: collection.title
      });
    }
  }
  console.log(`Found ${allItems.length} total items across all collections`);

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
    return selectedMovie;
  }
  // Sort by release/air date (earliest first) - Enhanced to consider episode air dates
  console.log('🔍 Performing enhanced date comparison including episode air dates...');
  
  // First, enhance TV series items with their next episode air dates for accurate sorting
  const enhancedItems = await Promise.all(unplayedItems.map(async (item) => {
    if (item.libraryType === 'tv') {
      try {
        const nextEpisode = await plexDb.getNextUnwatchedEpisode(item.ratingKey);
        if (nextEpisode && nextEpisode.originallyAvailableAt) {
          console.log(`📺 "${item.title}" next episode airs: ${nextEpisode.originallyAvailableAt}`);
          return {
            ...item,
            episodeAirDate: nextEpisode.originallyAvailableAt,
            nextEpisodeInfo: nextEpisode,
            sortDate: nextEpisode.originallyAvailableAt
          };
        } else {
          console.log(`📺 "${item.title}" next episode has no air date, using series date`);
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
      console.log(`🎬 "${item.title}" releases: ${item.originallyAvailableAt || item.year}`);
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
  });  const earliestItem = sortedItems[0];
  console.log(`✓ Selected earliest unplayed: "${earliestItem.title}" (${earliestItem.sortDate}) from collection: ${earliestItem.fromCollection}`);
  // If the earliest item is a TV series, we need to find the specific episode to play
  if (earliestItem.libraryType === 'tv') {
    console.log('Earliest item is a TV series, finding next unwatched episode...');
    
    try {
      const nextEpisode = await plexDb.getNextUnwatchedEpisode(earliestItem.ratingKey);
      
      if (nextEpisode) {
        console.log(`Found next unwatched episode: Season ${nextEpisode.seasonNumber}, Episode ${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
        
        // **ENHANCED LOGIC**: Compare episode air date with movie release dates
        console.log('🔍 Checking if episode air date should override movie selection...');
        
        // Get all movies from the sorted items for date comparison
        const movies = sortedItems.filter(item => item.libraryType === 'movie');
        
        if (movies.length > 0 && nextEpisode.originallyAvailableAt) {
          const episodeDate = new Date(nextEpisode.originallyAvailableAt);
          console.log(`📅 Episode air date: ${nextEpisode.originallyAvailableAt}`);
          
          // Find movies that aired after this episode
          const moviesAfterEpisode = movies.filter(movie => {
            const movieDate = new Date(movie.originallyAvailableAt || movie.year || '9999');
            return movieDate > episodeDate;
          });
          
          if (moviesAfterEpisode.length > 0) {
            // Sort movies by date to find the earliest one after the episode
            const earliestMovieAfterEpisode = moviesAfterEpisode.sort((a, b) => {
              const dateA = new Date(a.originallyAvailableAt || a.year || '9999');
              const dateB = new Date(b.originallyAvailableAt || b.year || '9999');
              return dateA - dateB;
            })[0];
            
            const movieDate = new Date(earliestMovieAfterEpisode.originallyAvailableAt || earliestMovieAfterEpisode.year);
            
            console.log(`📅 Earliest movie after episode: "${earliestMovieAfterEpisode.title}" (${earliestMovieAfterEpisode.originallyAvailableAt || earliestMovieAfterEpisode.year})`);
            console.log(`⏰ Episode (${nextEpisode.originallyAvailableAt}) comes before movie (${earliestMovieAfterEpisode.originallyAvailableAt || earliestMovieAfterEpisode.year})`);
            console.log(`🎯 Selecting episode as it aired earlier chronologically`);
          } else {
            console.log(`📅 No movies found after episode air date, episode is chronologically latest`);
          }
        } else if (!nextEpisode.originallyAvailableAt) {
          console.log(`⚠️  Episode has no air date, falling back to series comparison logic`);
        }
        
        // Return an episode object that includes both series and episode information
        return {
          ...earliestItem,
          type: 'episode',
          episodeRatingKey: nextEpisode.ratingKey,
          episodeTitle: nextEpisode.title,
          seasonNumber: nextEpisode.seasonNumber,
          episodeNumber: nextEpisode.episodeNumber,
          seasonTitle: nextEpisode.seasonTitle,
          totalEpisodesInSeason: nextEpisode.totalEpisodesInSeason,
          currentSeason: nextEpisode.seasonNumber,
          currentEpisode: nextEpisode.episodeNumber,
          nextEpisodeTitle: nextEpisode.title,
          orderType: 'TV_GENERAL'
        };
      } else {
        console.log(`No unwatched episodes found for "${earliestItem.title}", falling back to next earliest item`);
        
        // Remove this series from sortedItems and try the next one
        const remainingItems = sortedItems.slice(1);
        if (remainingItems.length > 0) {
          // Recursively call with remaining items
          return await selectEarliestUnplayedFromCollections({
            ...selectedMovie,
            otherCollections: [{ 
              title: 'filtered', 
              items: remainingItems.map(item => ({ ...item, fromCollection: 'filtered' }))
            }]
          });
        } else {
          // No more items, return original movie
          console.log('No more unplayed items available, returning original movie selection');
          return selectedMovie;
        }
      }
    } catch (error) {
      console.error('Error getting next unwatched episode:', error);
      // Fall back to returning the TV series object
      return earliestItem;
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

async function checkCollections(selectedMovie) {
  try {
    const currentCollection = await getCollectionName();
    
    // Get movie details from database to find all collections it belongs to
    const movieDetail = await plexDb.getMovieByRatingKey(selectedMovie.ratingKey);
    if (!movieDetail) {
      console.log(`Movie "${selectedMovie.title}" not found in database`);
      selectedMovie.otherCollections = [];
      return selectedMovie;
    }
    
    const movieCollections = plexDb.parseCollections(movieDetail.collections || '');
    
    if (movieCollections.length === 0) {
      console.log(`Movie "${selectedMovie.title}" is not in any collections`);
      selectedMovie.otherCollections = [];
      return selectedMovie;
    }
    
    console.log(`Movie "${selectedMovie.title}" belongs to ${movieCollections.length} collection(s):`, 
      movieCollections);
    
    // Filter out the current settings collection and keep the others
    const otherCollections = movieCollections.filter(collection => {
      const isNotCurrentCollection = collection.toLowerCase() !== currentCollection?.toLowerCase();
      return isNotCurrentCollection;
    });
    
    if (otherCollections.length > 0) {
      console.log(`Found ${otherCollections.length} other collection(s) for "${selectedMovie.title}":`, 
        otherCollections);
      
      // Get additional details for each collection to determine library type
      const enrichedCollections = [];
      
      for (const collectionName of otherCollections) {
        try {
          console.log(`Searching for collection "${collectionName}" (and variants) in database`);
          
          const collectionData = {
            title: collectionName,
            id: collectionName,
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
      
      selectedMovie.otherCollections = enrichedCollections;
    } else {
      console.log(`No other collections found for "${selectedMovie.title}" (excluding current settings collection)`);
      selectedMovie.otherCollections = [];
    }
    
    return selectedMovie;
    
  } catch (error) {
    console.error('Error checking collections:', error.message);
    // Return the movie unchanged if there's an error
    selectedMovie.otherCollections = [];
    return selectedMovie;
  }
}

// Function to check if a movie exists in any active custom order
async function movieExistsInCustomOrder(plexKey) {
  try {
    const result = await prisma.customOrderItem.findFirst({
      where: {
        plexKey: plexKey,
        mediaType: 'movie',
        customOrder: {
          isActive: true
        }
      }
    });
    
    return !!result;
  } catch (error) {
    console.warn(`Error checking if movie exists in custom order:`, error.message);
    return false; // If error, don't filter out the movie
  }
}

// Function to filter out movies that exist in active custom orders
async function filterMoviesNotInCustomOrders(movies) {
  try {
    console.log(`🎬 Filtering ${movies.length} movies to exclude those in active custom orders...`);
    
    const filteredMovies = [];
    let excludedCount = 0;
    
    for (const movie of movies) {
      const inCustomOrder = await movieExistsInCustomOrder(movie.ratingKey);
      if (inCustomOrder) {
        console.log(`🚫 Excluding movie "${movie.title}" - found in active custom order`);
        excludedCount++;
      } else {
        filteredMovies.push(movie);
      }
    }
    
    console.log(`🎬 Custom order filtering results:`);
    console.log(`   - Movies after filtering: ${filteredMovies.length}`);
    console.log(`   - Movies excluded (in custom orders): ${excludedCount}`);
    
    return filteredMovies;
  } catch (error) {
    console.error('Error filtering movies by custom orders:', error);
    return movies; // Return original list if error
  }
}

async function getNextMovie() {
  try {
    console.log('Starting movie selection process...');
    
    // Get collection name from settings (same as TV show logic)
    const collection = await getCollectionName();
    console.log('Collection:', collection);

    // Get movies from the specified collection
    const movies = await getMoviesFromCollection(collection);

    let selectedMovie = await selectInitialMovie(movies);
    
    // Check if selectInitialMovie returned an error
    if (selectedMovie.message) {
      return {
        message: selectedMovie.message,
        orderType: 'MOVIES_GENERAL'
      };
    }
    
    console.log('Initially selected movie for collection check:', selectedMovie?.title || 'Unknown');
    
    // Check for other collections this movie belongs to
    selectedMovie = await checkCollections(selectedMovie);
    console.log('Found collections for:', selectedMovie?.title || 'Unknown');
    
    // Now select the earliest unplayed item from all collections
    const finalSelection = await selectEarliestUnplayedFromCollections(selectedMovie);
    console.log('Final selection (earliest unplayed):', finalSelection?.title || 'Unknown');
    
    if (finalSelection && finalSelection.ratingKey) {
      console.log(`Selected movie: "${finalSelection.title}" (${finalSelection.ratingKey})`);
      
      // If the selected movie is a TV series, we need to find the next unwatched episode
      if (finalSelection.libraryType === 'tv') {
        console.log('Selected movie is a TV series, finding next unwatched episode...');
        
        try {
          const nextEpisode = await plexDb.getNextUnwatchedEpisode(finalSelection.ratingKey);
          
          if (nextEpisode) {
            console.log(`Found next unwatched episode: Season ${nextEpisode.seasonNumber}, Episode ${nextEpisode.episodeNumber} - "${nextEpisode.title}"`);
            
            // Return an episode object that includes both series and episode information
            return {
              ...finalSelection,
              type: 'episode',
              episodeRatingKey: nextEpisode.ratingKey,
              episodeTitle: nextEpisode.title,
              seasonNumber: nextEpisode.seasonNumber,
              episodeNumber: nextEpisode.episodeNumber,
              seasonTitle: nextEpisode.seasonTitle,
              totalEpisodesInSeason: nextEpisode.totalEpisodesInSeason,
              currentSeason: nextEpisode.seasonNumber,
              currentEpisode: nextEpisode.episodeNumber,
              nextEpisodeTitle: nextEpisode.title,
              orderType: 'TV_GENERAL'
            };
          } else {
            console.log(`No unwatched episodes found for "${finalSelection.title}"`);
          }
        } catch (error) {
          console.error('Error getting next unwatched episode:', error);
        }
      }      
      return {
        ...finalSelection,
        type: 'movie',
        orderType: 'MOVIES_GENERAL'
      };
    } else {
      return {
        message: "Movie selection failed",
        orderType: 'MOVIES_GENERAL'
      };
    }
  } catch (error) {
    console.error('Error in movie selection process:', error.message);
    return {
      message: "Error in movie selection process",
      orderType: 'MOVIES_GENERAL'
    };
  }
}

module.exports = getNextMovie;
