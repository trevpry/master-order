const prisma = require('./prismaClient'); // Use the shared Prisma client
const tvdbService = require('./tvdbCachedService');
const comicVineService = require('./comicVineService');
const openLibraryService = require('./openLibraryService');
const PlexDatabaseService = require('./plexDatabaseService');

const plexDb = new PlexDatabaseService();

// Get all active custom orders
async function getActiveCustomOrders() {
  try {
    const customOrders = await prisma.customOrder.findMany({
      where: { isActive: true },
      include: {
        items: {
          where: { isWatched: false },
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    // Filter out custom orders with no unwatched items
    const ordersWithItems = customOrders.filter(order => order.items.length > 0);
    
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

// Get the next item from a custom order (first unwatched item)
async function getNextItemFromCustomOrder(customOrder) {
  if (!customOrder.items || customOrder.items.length === 0) {
    return null;
  }

  // Return the first unwatched item (they're already sorted by sortOrder)
  return customOrder.items[0];
}

// Fetch full media details from Plex or generate for comics and books
async function fetchMediaDetailsFromPlex(plexKey, mediaType, customOrderItem) {
  try {
    // Handle comics differently since they don't exist in Plex
    if (mediaType === 'comic') {
      // For comics, we generate mock Plex-like metadata
      const comicString = `${customOrderItem.comicSeries} (${customOrderItem.comicYear}) #${customOrderItem.comicIssue}`;
      
      // Get cover art from ComicVine
      const comicDetails = await comicVineService.getComicCoverArt(comicString);
        const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.customTitle || customOrderItem.title,
        type: 'comic',
        year: customOrderItem.comicYear,
        summary: comicDetails?.description || '',
        thumb: null, // Comics don't have Plex thumbs
        art: null,
        comicDetails: comicDetails, // Store ComicVine details
        comicSeries: customOrderItem.comicSeries,
        comicYear: customOrderItem.comicYear,
        comicIssue: customOrderItem.comicIssue,
        comicVolume: customOrderItem.comicVolume,
        customTitle: customOrderItem.customTitle,
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
      
      return mockMetadata;
    }
    
    // Handle books differently since they don't exist in Plex
    if (mediaType === 'book') {
      // For books, we generate mock Plex-like metadata
      let bookDetails = null;
      
      // Try to get additional details from OpenLibrary if we have an ID
      if (customOrderItem.bookOpenLibraryId) {
        try {
          bookDetails = await openLibraryService.getBookDetails(customOrderItem.bookOpenLibraryId);
        } catch (error) {
          console.log(`Could not fetch OpenLibrary details for ${customOrderItem.bookOpenLibraryId}:`, error.message);
        }
      }
        const mockMetadata = {
        ratingKey: plexKey,
        title: customOrderItem.title,
        type: 'book',
        year: customOrderItem.bookYear,
        summary: bookDetails?.description || '',
        thumb: null, // Books don't have Plex thumbs
        art: null,
        bookDetails: bookDetails, // Store OpenLibrary details
        bookTitle: customOrderItem.bookTitle,
        bookAuthor: customOrderItem.bookAuthor,
        bookYear: customOrderItem.bookYear,
        bookIsbn: customOrderItem.bookIsbn,
        bookPublisher: customOrderItem.bookPublisher,
        bookOpenLibraryId: customOrderItem.bookOpenLibraryId,
        bookCoverUrl: bookDetails?.coverUrl || customOrderItem.bookCoverUrl || null,
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
        orderType: 'CUSTOM_ORDER',
        customOrderMediaType: mediaType
      };
      
      return mockMetadata;
    }
    
    // For movies and episodes, fetch from database instead of Plex API
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

// Mark a custom order item as watched
async function markCustomOrderItemAsWatched(itemId) {
  try {
    await prisma.customOrderItem.update({
      where: { id: parseInt(itemId) },
      data: { isWatched: true }
    });
    console.log(`Marked custom order item ${itemId} as watched`);
  } catch (error) {
    console.error(`Error marking custom order item ${itemId} as watched:`, error);
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
async function getNextCustomOrder() {
  try {
    console.log('Starting custom order selection...');

    // Get all active custom orders with unwatched items
    const customOrders = await getActiveCustomOrders();
    
    if (customOrders.length === 0) {
      console.log('No active custom orders with unwatched items found');
      return {
        message: "No active custom orders with unwatched items found",
        orderType: 'CUSTOM_ORDER'
      };
    }

    // Select a random custom order
    const selectedOrder = await selectRandomCustomOrder(customOrders);
    console.log(`Selected custom order: "${selectedOrder.name}"`);

    // Get the next item from the selected custom order
    const nextItem = await getNextItemFromCustomOrder(selectedOrder);
    
    if (!nextItem) {
      console.log(`No unwatched items in custom order: "${selectedOrder.name}"`);
      return {
        message: `No unwatched items in custom order: "${selectedOrder.name}"`,
        orderType: 'CUSTOM_ORDER'
      };
    }    console.log(`Next item: ${nextItem.title} (${nextItem.mediaType})`);    // Fetch full media details from Plex (or generate for comics)
    const fullMediaDetails = await fetchMediaDetailsFromPlex(nextItem.plexKey, nextItem.mediaType, nextItem);    // Add custom order context
    fullMediaDetails.customOrderName = selectedOrder.name;
    fullMediaDetails.customOrderDescription = selectedOrder.description;
    fullMediaDetails.customOrderIcon = selectedOrder.icon;
    fullMediaDetails.customOrderItemId = nextItem.id;// If this is a TV episode, enhance with TVDB artwork and episode details
    if (nextItem.mediaType === 'episode' || fullMediaDetails.type === 'episode') {
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
    return {
      message: "Error getting next custom order item",
      orderType: 'CUSTOM_ORDER'
    };
  }
}

module.exports = { getNextCustomOrder, markCustomOrderItemAsWatched };
