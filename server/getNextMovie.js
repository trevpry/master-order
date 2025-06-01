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
  if (Array.isArray(movies) && movies.length > 0) {
    // Pick an initial movie (will be replaced by earliest-date selection if collections found)
    const initialMovie = movies[Math.floor(Math.random() * movies.length)];
    console.log('Selected initial movie for collection check:', initialMovie.title);

    const watched = await determineIfWatched(initialMovie);
    if (watched) {
      const newInitialMovie = await selectInitialMovie(movies);
      return newInitialMovie;
    } else {
      return initialMovie;
    }
  } else {
    // If movies is not an array or is empty, return error message
    if (typeof movies === 'object' && movies.message) {
      return movies; // Return the error object from getMoviesFromCollection
    } else {
      return { message: "No movies found" };
    }
  }
}

async function determineIfWatched(movie) {
  // For movies, check if it's watched (viewCount > 0)
  return movie.viewCount && movie.viewCount > 0;
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
  });
    const earliestItem = sortedItems[0];
  console.log(`✓ Selected earliest unplayed: "${earliestItem.title}" (${earliestItem.originallyAvailableAt || earliestItem.year}) from collection: ${earliestItem.fromCollection}`);
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
          
          // Create collection search variants (original name and with " Collection" appended)
          const searchVariants = [
            collectionName,
            `${collectionName} Collection`
          ];
          
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
