const prisma = require('./prismaClient'); // Use the shared Prisma client
const tvdbService = require('./tvdbCachedService');
const comicVineService = require('./comicVineService');
const openLibraryService = require('./openLibraryService');
const PlexDatabaseService = require('./plexDatabaseService');
const ArtworkCacheService = require('./artworkCacheService');
const subOrderService = require('./subOrderService');

const plexDb = new PlexDatabaseService();
const artworkCache = new ArtworkCacheService();

// Check if a TVDB-only item now exists in Plex
async function checkIfTvdbItemExistsInPlex(customOrderItem) {
  try {
    if (customOrderItem.mediaType === 'episode') {
      // For TV episodes, search by series title, season, and episode number
      const episodes = await plexDb.searchTVEpisodes(
        customOrderItem.seriesTitle,
        customOrderItem.seasonNumber,
        customOrderItem.episodeNumber
      );
      
      if (episodes && episodes.length > 0) {
        console.log(`Found episode "${customOrderItem.title}" in Plex database`);
        return episodes[0];
      }
    } else if (customOrderItem.mediaType === 'movie') {
      // For movies, search by title and year
      const movies = await plexDb.searchMovies(
        customOrderItem.title,
        customOrderItem.bookYear
      );
      
      if (movies && movies.length > 0) {
        console.log(`Found movie "${customOrderItem.title}" in Plex database`);
        return movies[0];
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Error checking if TVDB item exists in Plex:`, error.message);
    return null;
  }
}

// Get all active custom orders
async function getActiveCustomOrders() {
  try {
    // Find all order IDs that are referenced as suborder entries in other orders' item lists.
    // These should only be traversed through their parent order, not selected directly.
    const subOrderEntries = await prisma.customOrderItem.findMany({
      where: { mediaType: 'suborder', referencedCustomOrderId: { not: null } },
      select: { referencedCustomOrderId: true }
    });
    const embeddedOrderIds = subOrderEntries.map(e => e.referencedCustomOrderId);

    const customOrders = await prisma.customOrder.findMany({
      where: { 
        isActive: true,
        parentOrderId: null, // Only get top-level orders (not hierarchy sub-orders)
        ...(embeddedOrderIds.length > 0 ? { id: { notIn: embeddedOrderIds } } : {}) // Exclude orders embedded as entries in other orders
      },
      include: {
        items: {
          where: { isWatched: false },
          // id breaks ties so items sharing a sortOrder never reorder between queries
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            book: true // Include unified book data for books
          }
        },
        subOrders: {
          where: { isActive: true },
          include: {
            plexPlaylist: true,
            customPlaylist: true,
            items: {
              where: { isWatched: false },
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                book: true // Include unified book data for books
              }
            }
          }
        },
        // Include playlist and gallery relationships
        plexPlaylist: true,
        customPlaylist: true,
        backgroundGallery: true
      }
    });

    // Filter out custom orders with no unwatched items (including sub-orders)
    const ordersWithItems = customOrders.filter(order => {
      const hasDirectItems = order.items.length > 0;
      const hasSubOrderItems = order.subOrders.some(subOrder => subOrder.items.length > 0);
      return hasDirectItems || hasSubOrderItems;
    });
    
    console.log(`Found ${ordersWithItems.length} active custom orders with unwatched items`);
    return ordersWithItems;
  } catch (error) {
    console.error('Error fetching active custom orders:', error);
    return [];
  }
}

// Select a random custom order
async function selectRandomCustomOrder(customOrders) {
  if (customOrders.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * customOrders.length);
  return customOrders[randomIndex];
}

// Get the next item from a custom order (first unwatched item from order or sub-orders)
async function getNextItemFromCustomOrder(customOrder) {
  try {
    // First check if the main order has items
    if (customOrder.items && customOrder.items.length > 0) {
      // Look for the first unwatched item
      for (const item of customOrder.items) {
        if (!item.isWatched) {
          // If this is a sub-order item, get the next item from the sub-order
          if (item.mediaType === 'suborder' && item.referencedCustomOrderId) {
            console.log(`Found sub-order item: "${item.title}", diving into sub-order...`);
            
            try {
              const subOrderResult = await subOrderService.getNextUnwatchedFromSubOrder(item.referencedCustomOrderId);
              if (subOrderResult && subOrderResult.item && subOrderResult.sourceOrder) {
                return {
                  item: subOrderResult.item,
                  sourceOrder: subOrderResult.sourceOrder,
                  isFromSubOrder: true,
                  parentOrder: customOrder,
                  subOrderItem: item // Reference to the sub-order item in parent
                };
              } else {
                // Sub-order has no unwatched items, mark the sub-order item as watched
                console.log(`Sub-order "${item.title}" has no unwatched items, marking as watched...`);
                await prisma.customOrderItem.update({
                  where: { id: item.id },
                  data: { isWatched: true }
                });
                continue; // Continue to next item in parent order
              }
            } catch (subOrderError) {
              console.error(`Error getting item from sub-order ${item.referencedCustomOrderId}:`, subOrderError);
              continue; // Continue to next item in parent order
            }
          } else {
            // Regular item, return it
            return {
              item: item,
              sourceOrder: customOrder,
              isFromSubOrder: false
            };
          }
        }
      }
    }

    // If no items in main order, check sub-orders (fallback for old hierarchy system)
    if (customOrder.subOrders && customOrder.subOrders.length > 0) {
      for (const subOrder of customOrder.subOrders) {
        if (subOrder.items && subOrder.items.length > 0) {
          for (const item of subOrder.items) {
            if (!item.isWatched) {
              return {
                item: item,
                sourceOrder: subOrder,
                isFromSubOrder: true,
                parentOrder: customOrder
              };
            }
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error in getNextItemFromCustomOrder for order ${customOrder.id}:`, error);
    return null;
  }
}

// Fetch full media details from Plex or generate for comics and books
async function fetchMediaDetailsFromPlex(plexKey, mediaType, customOrderItem, baseUrl = 'http://localhost:3001') {
  try {
    // Handle TVDB-only items - check if they now exist in Plex
    if (customOrderItem.isFromTvdbOnly) {
      console.log(`🔍 Checking if TVDB-only item "${customOrderItem.title}" now exists in Plex...`);
      
      const plexItem = await checkIfTvdbItemExistsInPlex(customOrderItem);
      if (plexItem) {
        console.log(`✅ TVDB item "${customOrderItem.title}" now exists in Plex! Updating custom order item...`);
        
        // Update the custom order item with Plex data
        await prisma.customOrderItem.update({
          where: { id: customOrderItem.id },
          data: {
            plexKey: plexItem.ratingKey,
            isFromTvdbOnly: false,
            // Update with Plex metadata
            title: plexItem.title,
            seasonNumber: plexItem.parentIndex || customOrderItem.seasonNumber,
            episodeNumber: plexItem.index || customOrderItem.episodeNumber,
            seriesTitle: plexItem.grandparentTitle || customOrderItem.seriesTitle
          }
        });
        
        // Return the Plex metadata
        plexItem.orderType = 'CUSTOM_ORDER';
        plexItem.customOrderMediaType = mediaType;
        return plexItem;
      } else {
        console.log(`❌ TVDB item "${customOrderItem.title}" still doesn't exist in Plex`);
        
        // Return mock metadata based on TVDB data stored in the custom order item
        const mockMetadata = {
          ratingKey: plexKey,
          title: customOrderItem.title,
          type: mediaType,
          year: customOrderItem.storyYear || customOrderItem.book?.publishYear || null,
          summary: customOrderItem.customTitle || '',
          thumb: null,
          art: null,
          // Episode-specific fields
          parentIndex: customOrderItem.seasonNumber,
          index: customOrderItem.episodeNumber,
          grandparentTitle: customOrderItem.seriesTitle,
          // Custom order context
          orderType: 'CUSTOM_ORDER',
          customOrderMediaType: mediaType,
          isFromTvdbOnly: true,
          tvdbSeriesId: customOrderItem.comicSeries?.replace('tvdb-series-', ''),
          tvdbSeasonId: customOrderItem.comicVolume?.replace('tvdb-season-', ''),
          tvdbEpisodeId: customOrderItem.comicIssue?.replace('tvdb-episode-', ''),
          tvdbMovieId: customOrderItem.book?.isbn?.replace('tvdb-movie-', '') || null
        };
        
        return mockMetadata;
      }
    }

    // Handle comics differently since they don't exist in Plex
    if (mediaType === 'comic') {
      // For comics, we generate mock Plex-like metadata
      const comicString = `${customOrderItem.comicSeries} (${customOrderItem.comicYear}) #${customOrderItem.comicIssue}`;
      
      // Get the cached artwork URL for this comic
      const artworkUrl = await artworkCache.getArtworkUrl(customOrderItem, baseUrl);
      console.log(`Comic item details:`, {
        id: customOrderItem.id,
        localArtworkPath: customOrderItem.localArtworkPath,
        originalArtworkUrl: customOrderItem.originalArtworkUrl,
        hasComicVineDetailsJson: !!customOrderItem.comicVineDetailsJson
      });
      console.log(`Using cached artwork URL for comic "${comicString}": ${artworkUrl}`);
      
      const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.customTitle || customOrderItem.title,
        type: 'comic',
        year: customOrderItem.comicYear,
        summary: customOrderItem.customTitle || '', // Use custom title as summary if available
        thumb: artworkUrl, // Use cached artwork URL
        art: artworkUrl,   // Use cached artwork URL for both thumb and art
        comicSeries: customOrderItem.comicSeries,
        comicYear: customOrderItem.comicYear,
        comicIssue: customOrderItem.comicIssue,
        comicVolume: customOrderItem.comicVolume,
        customTitle: customOrderItem.customTitle,
        localArtworkPath: customOrderItem.localArtworkPath, // Include for frontend cached artwork logic
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
      
      return mockMetadata;
    }
    
    // Handle books differently since they don't exist in Plex
    if (mediaType === 'book') {
      // For books, we generate mock Plex-like metadata
      let bookDetails = null;
      
      // Get unified book data if available
      const unifiedBook = customOrderItem.book;
      
      // Try to get additional details from OpenLibrary if we have an ID
      if (unifiedBook?.openLibraryId) {
        try {
          bookDetails = await openLibraryService.getBookDetails(unifiedBook.openLibraryId);
        } catch (error) {
          console.log(`Could not fetch OpenLibrary details for ${unifiedBook.openLibraryId}:`, error.message);
        }
      }
      
      // Get the cached artwork URL for this book
      const artworkUrl = await artworkCache.getArtworkUrl(customOrderItem, baseUrl);
      console.log(`Book item details:`, {
        id: customOrderItem.id,
        localArtworkPath: customOrderItem.localArtworkPath,
        originalArtworkUrl: customOrderItem.originalArtworkUrl,
        unifiedBookId: unifiedBook?.id,
        openLibraryId: unifiedBook?.openLibraryId
      });
      console.log(`Using cached artwork URL for book "${customOrderItem.title}": ${artworkUrl}`);
      
        const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.title,
        type: 'book',
        year: unifiedBook?.publishYear || null,
        summary: bookDetails?.description || unifiedBook?.description || '',
        thumb: artworkUrl, // Use cached artwork URL
        art: artworkUrl,   // Use cached artwork URL for both thumb and art
        bookDetails: bookDetails, // Store OpenLibrary details
        bookTitle: unifiedBook?.title || customOrderItem.title,
        bookAuthor: unifiedBook?.author || null,
        bookYear: unifiedBook?.publishYear || null,
        bookIsbn: unifiedBook?.isbn || null,
        bookPublisher: unifiedBook?.publisher || null,
        bookOpenLibraryId: unifiedBook?.openLibraryId || null,
        bookCoverUrl: bookDetails?.coverUrl || unifiedBook?.coverUrl || null,
        localArtworkPath: customOrderItem.localArtworkPath, // Include for frontend cached artwork logic
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
        return mockMetadata;
    }
      // Handle short stories differently since they don't exist in Plex
    if (mediaType === 'shortstory') {
      // For short stories, we generate mock Plex-like metadata
      let containedInBookDetails = null;
      
      // Try to get details about the containing book if specified
      if (customOrderItem.storyContainedInBookId) {
        try {
          const containingBook = await prisma.customOrderItem.findUnique({
            where: { id: customOrderItem.storyContainedInBookId }
          });
          
          if (containingBook && containingBook.bookOpenLibraryId) {
            containedInBookDetails = await openLibraryService.getBookDetails(containingBook.bookOpenLibraryId);
          }
        } catch (error) {
          console.log(`Could not fetch containing book details for ${customOrderItem.storyContainedInBookId}:`, error.message);
        }
      }
      
      const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.title,
        type: 'shortstory',
        year: customOrderItem.storyYear,
        summary: '', // Short stories typically don't have summaries
        thumb: null, // Short stories don't have Plex thumbs
        art: null,
        storyTitle: customOrderItem.storyTitle,
        storyAuthor: customOrderItem.storyAuthor,
        storyYear: customOrderItem.storyYear,
        storyUrl: customOrderItem.storyUrl,
        storyContainedInBookId: customOrderItem.storyContainedInBookId,
        storyCoverUrl: customOrderItem.storyCoverUrl || containedInBookDetails?.coverUrl || null,
        containedInBookDetails: containedInBookDetails, // Store containing book details if available
        localArtworkPath: customOrderItem.localArtworkPath, // Include for frontend cached artwork logic
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
      
      return mockMetadata;
    }
    
    // Handle web videos differently since they don't exist in Plex
    if (mediaType === 'webvideo') {
      // For web videos, we generate mock Plex-like metadata
      const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.title,
        type: 'webvideo',
        year: null, // Web videos don't typically have years
        summary: customOrderItem.webDescription || '',
        thumb: null, // Web videos don't have Plex thumbs
        art: null,
        webTitle: customOrderItem.webTitle,
        webUrl: customOrderItem.webUrl,
        webDescription: customOrderItem.webDescription,
        localArtworkPath: customOrderItem.localArtworkPath, // Include for frontend cached artwork logic
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
      
      return mockMetadata;
    }
    
    // ARR-linked custom order items can be served directly via the local stream service.
    if (mediaType === 'movie' && customOrderItem.movieId) {
      const movie = await prisma.movie.findUnique({ where: { id: customOrderItem.movieId } });
      if (movie) {
        return {
          ratingKey: `movie-${movie.id}`,
          title: movie.title,
          type: 'movie',
          year: movie.year,
          summary: movie.overview || '',
          thumb: movie.posterUrl || null,
          art: movie.fanartUrl || null,
          duration: Math.round(((movie.durationSeconds ?? (movie.runtime ? movie.runtime * 60 : 0)) || 0) * 1000),
          orderType: 'CUSTOM_ORDER',
          customOrderMediaType: mediaType,
          libraryProvider: 'arr',
          mediaId: movie.id,
          streamUrl: `${baseUrl}/api/stream/movie/${movie.id}/direct`
        };
      }
    }

    if (mediaType === 'episode' && customOrderItem.episodeId) {
      const episode = await prisma.episode.findUnique({
        where: { id: customOrderItem.episodeId },
        include: {
          season: {
            include: { show: true }
          }
        }
      });

      if (episode?.season?.show) {
        const show = episode.season.show;
        return {
          ratingKey: `episode-${episode.id}`,
          episodeRatingKey: `episode-${episode.id}`,
          title: show.title,
          type: 'episode',
          episodeTitle: episode.title || customOrderItem.title,
          summary: show.overview || '',
          episodeSummary: episode.overview || '',
          thumb: show.posterUrl || null,
          art: show.fanartUrl || null,
          grandparentTitle: show.title,
          seasonNumber: episode.season.seasonNumber,
          episodeNumber: episode.episodeNumber,
          currentSeason: episode.season.seasonNumber,
          currentEpisode: episode.episodeNumber,
          nextEpisodeTitle: episode.title || customOrderItem.title,
          duration: Math.round(((episode.durationSeconds ?? (episode.runtime ? episode.runtime * 60 : 0)) || 0) * 1000),
          orderType: 'CUSTOM_ORDER',
          customOrderMediaType: mediaType,
          libraryProvider: 'arr',
          mediaId: episode.id,
          streamUrl: `${baseUrl}/api/stream/episode/${episode.id}/direct`
        };
      }
    }

    // For Plex-backed movies and episodes, fetch metadata from the local Plex mirror.
    const metadata = await plexDb.getItemMetadata(plexKey, mediaType);
    
    if (!metadata) {
      throw new Error(`No metadata found for Plex key: ${plexKey}`);
    }

    // Add additional properties for consistency with other order types
    metadata.orderType = 'CUSTOM_ORDER';
    metadata.customOrderMediaType = mediaType;

    return metadata;
  } catch (error) {
    console.error(`Error fetching media details for key ${plexKey}:`, error.message);
    throw error;
  }
}

// Reconcile watched state for custom order items when Plex reports that an episode/movie is watched
async function reconcileCustomOrderWatchStateFromPlex(ratingKey, mediaType, isWatched) {
  try {
    if (!ratingKey || !isWatched) {
      return { updatedCount: 0 };
    }

    const normalizedRatingKey = String(ratingKey);
    const normalizedMediaType = mediaType === 'episode' ? 'episode' : mediaType === 'movie' ? 'movie' : null;

    const matchingItems = await prisma.customOrderItem.findMany({
      where: {
        plexKey: normalizedRatingKey,
        ...(normalizedMediaType ? { mediaType: normalizedMediaType } : {}),
        isWatched: false
      },
      select: { id: true }
    });

    if (!matchingItems.length) {
      return { updatedCount: 0 };
    }

    await Promise.all(matchingItems.map(item =>
      prisma.customOrderItem.update({
        where: { id: item.id },
        data: { isWatched: true }
      })
    ));

    console.log(`Reconciled ${matchingItems.length} custom order item(s) as watched for Plex ${normalizedMediaType || 'item'} ${normalizedRatingKey}`);
    return { updatedCount: matchingItems.length };
  } catch (error) {
    console.error(`Error reconciling custom order watch state for Plex key ${ratingKey}:`, error);
    return { updatedCount: 0 };
  }
}

// Mark a custom order item as watched
async function markCustomOrderItemAsWatched(itemIdentifier) {
  try {
    let actualItemId;
    
    // Handle both numeric IDs and non-numeric plexKeys
    if (!isNaN(itemIdentifier) && Number.isInteger(Number(itemIdentifier))) {
      // Numeric ID - use directly
      actualItemId = parseInt(itemIdentifier);
    } else {
      const arrMovieMatch = String(itemIdentifier).match(/^movie-(\d+)$/);
      const arrEpisodeMatch = String(itemIdentifier).match(/^episode-(\d+)$/);

      if (arrMovieMatch) {
        const movieId = parseInt(arrMovieMatch[1]);
        const item = await prisma.customOrderItem.findFirst({
          where: {
            mediaType: 'movie',
            movieId,
            isWatched: false
          },
          orderBy: { updatedAt: 'desc' }
        });

        if (item) {
          actualItemId = item.id;
        }
      } else if (arrEpisodeMatch) {
        const episodeId = parseInt(arrEpisodeMatch[1]);
        const item = await prisma.customOrderItem.findFirst({
          where: {
            mediaType: 'episode',
            episodeId,
            isWatched: false
          },
          orderBy: { updatedAt: 'desc' }
        });

        if (item) {
          actualItemId = item.id;
        }
      }

      if (!actualItemId) {
      // Non-numeric identifier - look up by plexKey
      const item = await prisma.customOrderItem.findFirst({
        where: { plexKey: String(itemIdentifier) }
      });
      
      if (!item) {
        console.error(`Could not find CustomOrderItem with plexKey: ${itemIdentifier}`);
        return;
      }
      
      actualItemId = item.id;
      console.log(`🔍 Resolved non-numeric itemId '${itemIdentifier}' to database ID ${actualItemId}`);
      }
    }
    
    await prisma.customOrderItem.update({
      where: { id: actualItemId },
      data: { isWatched: true }
    });
    console.log(`Marked custom order item ${actualItemId} as watched`);
  } catch (error) {
    console.error(`Error marking custom order item ${itemIdentifier} as watched:`, error);
  }
}

// Get next unwatched episode for TV series
async function getNextUnwatchedEpisode(selectedSeries) {
  try {
    console.log(`Getting episodes for ${selectedSeries.title} (${selectedSeries.ratingKey})`);
    
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

// Enhance TV series with TVDB artwork and episode details
async function enhanceWithTVDBArtwork(selectedSeries) {
  try {
    console.log(`Enhancing ${selectedSeries.title} with TVDB artwork`);
    
    // Get the actual next unwatched episode from Plex
    const nextEpisode = await getNextUnwatchedEpisode(selectedSeries);
    
    if (nextEpisode) {
      console.log(`Found next unwatched episode: Season ${nextEpisode.seasonNumber}, Episode ${nextEpisode.episodeNumber} - "${nextEpisode.episodeTitle}"`);
      selectedSeries.currentSeason = nextEpisode.seasonNumber;
      selectedSeries.currentEpisode = nextEpisode.episodeNumber;
      selectedSeries.nextEpisodeTitle = nextEpisode.episodeTitle;
      selectedSeries.seasonTitle = nextEpisode.seasonTitle;
      selectedSeries.totalEpisodesInSeason = nextEpisode.totalEpisodesInSeason;
      
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

// Main function to get next custom order item
async function getNextCustomOrder(req = null, mediaTypeLimiters = null) {
  try {
    console.log('Starting custom order selection...');

    // Extract base URL from request if available
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3001';
    console.log(`Using base URL for artwork: ${baseUrl}`);

    // Get all active custom orders with unwatched items
    const customOrders = await getActiveCustomOrders();
    
    if (customOrders.length === 0) {
      console.log('No active custom orders with unwatched items found');
      return {
        message: "No active custom orders with unwatched items found",
        orderType: 'CUSTOM_ORDER'
      };
    }

    // Determine allowed media types for custom order items
    const allEnabled = !mediaTypeLimiters || Object.values(mediaTypeLimiters).every(v => v);
    let allowedMediaTypes = null;
    if (!allEnabled) {
      allowedMediaTypes = [];
      if (mediaTypeLimiters.episode) allowedMediaTypes.push('episode');
      if (mediaTypeLimiters.movie) allowedMediaTypes.push('movie');
      if (mediaTypeLimiters.book) allowedMediaTypes.push('book', 'shortstory');
      if (mediaTypeLimiters.webvideo) allowedMediaTypes.push('webvideo');
      if (mediaTypeLimiters.videogame) allowedMediaTypes.push('game');
      if (mediaTypeLimiters.comic) allowedMediaTypes.push('comic');
      // Always allow suborder since we need to dive into them to find the actual item type
      allowedMediaTypes.push('suborder');
      console.log(`🎯 Custom order media type filter: ${allowedMediaTypes.join(', ')}`);
    }

    // Select a random custom order
    const selectedOrder = await selectRandomCustomOrder(customOrders);
    console.log(`Selected custom order: "${selectedOrder.name}"`);

    // Try to find a playable item from the custom orders
    let nextItem = null;
    let selectedOrderToUse = selectedOrder;
    let sourceOrder = null;
    let isFromSubOrder = false;
    let parentOrder = null;
    let attempts = 0;
    const triedOrderIds = new Set();
    const maxAttempts = allowedMediaTypes ? customOrders.length : Math.min(customOrders.length, 5); // Try all orders when filtering by media type

    while (!nextItem && attempts < maxAttempts) {
      attempts++;
      triedOrderIds.add(selectedOrderToUse.id);
      
      // Get the next item from the current custom order
      const candidateResult = await getNextItemFromCustomOrder(selectedOrderToUse);
      
      if (!candidateResult) {
        console.log(`No unwatched items in custom order: "${selectedOrderToUse.name}"`);
        
        // Try a different custom order
        if (attempts < maxAttempts) {
          const remainingOrders = customOrders.filter(o => !triedOrderIds.has(o.id));
          if (remainingOrders.length > 0) {
            selectedOrderToUse = await selectRandomCustomOrder(remainingOrders);
            console.log(`🔄 Trying different custom order: "${selectedOrderToUse.name}"`);
            continue;
          }
        }
        break;
      }

      // Validate candidateResult structure
      if (!candidateResult.item || !candidateResult.sourceOrder) {
        console.error('Invalid candidateResult structure:', candidateResult);
        console.log(`Trying different custom order due to invalid result structure`);
        
        // Try a different custom order
        if (attempts < maxAttempts) {
          const remainingOrders = customOrders.filter(o => !triedOrderIds.has(o.id));
          if (remainingOrders.length > 0) {
            selectedOrderToUse = await selectRandomCustomOrder(remainingOrders);
            console.log(`🔄 Trying different custom order: "${selectedOrderToUse.name}"`);
            continue;
          }
        }
        break;
      }

      const candidateItem = candidateResult.item;
      sourceOrder = candidateResult.sourceOrder;
      isFromSubOrder = candidateResult.isFromSubOrder;
      parentOrder = candidateResult.parentOrder;

      // Check if the candidate item's media type matches allowed types
      if (allowedMediaTypes && !allowedMediaTypes.includes(candidateItem.mediaType)) {
        console.log(`🎯 Skipping "${candidateItem.title}" (${candidateItem.mediaType}) - not in allowed media types`);
        
        // Try a different custom order
        if (attempts < maxAttempts) {
          const remainingOrders = customOrders.filter(o => !triedOrderIds.has(o.id));
          if (remainingOrders.length > 0) {
            selectedOrderToUse = await selectRandomCustomOrder(remainingOrders);
            console.log(`🔄 Trying different custom order: "${selectedOrderToUse.name}"`);
            continue;
          }
        }
        break;
      }

      // Check if this is a TVDB-only item that still doesn't exist in Plex
      if (candidateItem.isFromTvdbOnly) {
        console.log(`🔍 Checking TVDB-only item "${candidateItem.title}" availability...`);
        const plexItem = await checkIfTvdbItemExistsInPlex(candidateItem);
        
        if (!plexItem) {
          console.log(`❌ TVDB-only item "${candidateItem.title}" still not available in Plex`);
          
          // Try a different custom order
          if (attempts < maxAttempts) {
            const remainingOrders = customOrders.filter(o => !triedOrderIds.has(o.id));
            if (remainingOrders.length > 0) {
              selectedOrderToUse = await selectRandomCustomOrder(remainingOrders);
              console.log(`🔄 Trying different custom order: "${selectedOrderToUse.name}"`);
              continue;
            }
          }
          break;
        } else {
          console.log(`✅ TVDB-only item "${candidateItem.title}" now available in Plex!`);
          nextItem = candidateItem;
        }
      } else {
        // Regular item, use it
        nextItem = candidateItem;
      }
    }
    
    if (!nextItem) {
      console.log('No playable items found in any active custom orders');
      return {
        message: "No playable items found in any active custom orders",
        orderType: 'CUSTOM_ORDER'
      };
    }

    // Determine the final source order and parent for context
    const finalSourceOrder = sourceOrder || selectedOrderToUse;
    const finalParentOrder = isFromSubOrder ? (parentOrder || selectedOrderToUse) : null;

    console.log(`Next item: ${nextItem.title} (${nextItem.mediaType}) from order: ${finalSourceOrder.name}${isFromSubOrder ? ` (sub-order of "${finalParentOrder.name}")` : ''}`);

    // Fetch full media details from Plex (or generate for comics)
    const fullMediaDetails = await fetchMediaDetailsFromPlex(nextItem.plexKey, nextItem.mediaType, nextItem, baseUrl);

    // Add custom order context
    fullMediaDetails.customOrderName = finalSourceOrder.name;
    fullMediaDetails.customOrderDescription = finalSourceOrder.description;
    fullMediaDetails.customOrderIcon = finalSourceOrder.icon;
    fullMediaDetails.customOrderId = finalSourceOrder.id;
    fullMediaDetails.customOrderItemId = nextItem.id;
    
    // Add playlist information if available
    // For sub-order items: prefer the sub-order's own playlist, fall back to parent order's playlist
    const playlistSourceOrder = isFromSubOrder
      ? (finalSourceOrder.plexPlaylist || finalSourceOrder.customPlaylist ? finalSourceOrder : (finalParentOrder || finalSourceOrder))
      : finalSourceOrder;

    if (playlistSourceOrder.plexPlaylist) {
      fullMediaDetails.playlistName = playlistSourceOrder.plexPlaylist.title;
      fullMediaDetails.playlistType = 'plex';
      fullMediaDetails.playlistId = playlistSourceOrder.plexPlaylist.ratingKey;
    } else if (playlistSourceOrder.customPlaylist) {
      fullMediaDetails.playlistName = playlistSourceOrder.customPlaylist.title;
      fullMediaDetails.playlistType = 'custom';
      fullMediaDetails.playlistId = playlistSourceOrder.customPlaylist.id;
    }
    
    // Add background gallery information if available
    if (finalSourceOrder.backgroundGallery) {
      fullMediaDetails.backgroundGalleryName = finalSourceOrder.backgroundGallery.name;
      fullMediaDetails.backgroundGalleryId = finalSourceOrder.backgroundGallery.id;
    }
    
    // Add parent order context if this is from a sub-order
    if (isFromSubOrder && finalParentOrder) {
      fullMediaDetails.parentCustomOrderName = finalParentOrder.name;
      fullMediaDetails.parentCustomOrderDescription = finalParentOrder.description;
      fullMediaDetails.parentCustomOrderIcon = finalParentOrder.icon;
      fullMediaDetails.isFromSubOrder = true;
    }// If this is a TV episode, enhance with TVDB artwork and episode details
    if ((nextItem.mediaType === 'episode' || fullMediaDetails.type === 'episode') && fullMediaDetails.libraryProvider !== 'arr') {
      console.log(`Enhancing TV episode "${fullMediaDetails.title}" from series "${fullMediaDetails.grandparentTitle}" with TVDB data`);
      
      // For TV episodes, we need to get the series information to enhance with TVDB
      // The grandparentTitle contains the series name for episodes
      const seriesForEnhancement = {
        ...fullMediaDetails,
        title: fullMediaDetails.grandparentTitle || fullMediaDetails.title,
        ratingKey: fullMediaDetails.grandparentRatingKey || fullMediaDetails.ratingKey
      };
      
      const enhancedDetails = await enhanceWithTVDBArtwork(seriesForEnhancement);
      
      // Copy the enhanced fields back to the episode details
      fullMediaDetails.currentSeason = enhancedDetails.currentSeason;
      fullMediaDetails.currentEpisode = enhancedDetails.currentEpisode;
      fullMediaDetails.nextEpisodeTitle = enhancedDetails.nextEpisodeTitle;
      fullMediaDetails.seasonTitle = enhancedDetails.seasonTitle;
      fullMediaDetails.totalEpisodesInSeason = enhancedDetails.totalEpisodesInSeason;
      fullMediaDetails.tvdbArtwork = enhancedDetails.tvdbArtwork;
      fullMediaDetails.finaleType = enhancedDetails.finaleType;
      fullMediaDetails.isCurrentSeasonFinal = enhancedDetails.isCurrentSeasonFinal;
      fullMediaDetails.seriesStatus = enhancedDetails.seriesStatus;
        console.log(`Successfully selected enhanced TV episode: ${fullMediaDetails.title} from ${fullMediaDetails.grandparentTitle}`);
      return fullMediaDetails;
    } else {
      console.log(`Successfully selected: ${fullMediaDetails.title}`);
      return fullMediaDetails;
    }

  } catch (error) {
    console.error('Error in getNextCustomOrder:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      message: "Error getting next custom order item",
      orderType: 'CUSTOM_ORDER'
    };
  }
}

module.exports = { getNextCustomOrder, markCustomOrderItemAsWatched, reconcileCustomOrderWatchStateFromPlex };
