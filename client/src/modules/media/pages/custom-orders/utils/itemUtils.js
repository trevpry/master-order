import config from '../../../../../config';

/**
 * Helper function to filter items based on preferences
 * @param {Array} items - Array of items to filter
 * @param {boolean} showWatchedItems - Whether to show watched items
 * @returns {Array} Filtered array of items
 */
export const getFilteredItems = (items, showWatchedItems) => {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  return items.filter(item => {
    // Filter out reference books (books that contain short stories)
    if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
      return false;
    }
    
    // Filter based on watched status toggle
    if (!showWatchedItems && item.isWatched) {
      return false;
    }
    
    return true;
  });
};

/**
 * Helper function to get all items excluding reference books (for stats)
 * @param {Array} items - Array of items to process
 * @returns {Array} Filtered array excluding reference books
 */
export const getAllNonReferenceItems = (items) => {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  return items.filter(item => {
    // Filter out reference books (books that contain short stories)
    if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
      return false;
    }
    return true;
  });
};

/**
 * Helper function to get unwatched items excluding reference books (for stats)
 * @param {Array} items - Array of items to process
 * @returns {Array} Filtered array of unwatched items excluding reference books
 */
export const getUnwatchedNonReferenceItems = (items) => {
  if (!items || !Array.isArray(items)) {
    return [];
  }
  return items.filter(item => {
    // Filter out reference books (books that contain short stories)
    if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
      return false;
    }
    return !item.isWatched;
  });
};

/**
 * Helper function to generate artwork URLs for custom order items
 * @param {Object} item - The item to generate artwork URL for
 * @returns {string|null} Artwork URL or null if no artwork available
 */
export const getItemArtworkUrl = (item) => {
  // Handle sub-order items - they don't have artwork, use icon fallback
  if (item.mediaType === 'suborder') {
    return null;
  }
  
  // Check if we have cached artwork
  if (item.localArtworkPath) {
    // Extract just the filename from the full path
    const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
      ? item.localArtworkPath.split(/[\\\/]/).pop() 
      : item.localArtworkPath;
    
    // Add cache-busting parameter based on artworkLastCached timestamp
    const cacheBuster = item.artworkLastCached ? `?v=${encodeURIComponent(item.artworkLastCached)}` : '';
    const artworkUrl = `${config.apiBaseUrl}/api/artwork/${filename}${cacheBuster}`;
    
    // Debug logging for comics with same artwork issue
    if (item.mediaType === 'comic') {
      console.log(`Comic artwork - ${item.comicSeries} #${item.comicIssue}: ${filename} -> ${artworkUrl}`);
    }
    
    return artworkUrl;
  }
  
  // For items without cached artwork, try to get remote artwork URLs
  // This matches the logic from the artworkCacheService
  switch (item.mediaType) {
    case 'comic':
      // First, check if we have ComicVine details with a direct cover URL
      if (item.comicVineDetailsJson) {
        try {
          const comicVineDetails = JSON.parse(item.comicVineDetailsJson);
          if (comicVineDetails.image && comicVineDetails.image.medium_url) {
            // Use ComicVine's direct cover URL through our proxy
            return `${config.apiBaseUrl}/api/comicvine-artwork?url=${encodeURIComponent(comicVineDetails.image.medium_url)}`;
          }
        } catch (error) {
          console.warn('Failed to parse ComicVine details JSON:', error);
        }
      }
      
      // Fallback to the comic string search method
      if (item.comicSeries && item.comicIssue) {
        let comicString;
        if (item.comicYear) {
          comicString = `${item.comicSeries} (${item.comicYear}) #${item.comicIssue}`;
        } else {
          comicString = `${item.comicSeries} #${item.comicIssue}`;
        }
        return `${config.apiBaseUrl}/api/comicvine-artwork?url=${encodeURIComponent(`${config.apiBaseUrl}/api/comicvine-cover?comic=${encodeURIComponent(comicString)}`)}`;
      }
      break;
    
    case 'book':
      if (item.bookCoverUrl) {
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(item.bookCoverUrl)}`;
      } else if (item.bookOpenLibraryId) {
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(`https://covers.openlibrary.org/b/olid/${item.bookOpenLibraryId}-M.jpg`)}`;
      }
      break;
    
    case 'shortstory':
      if (item.storyCoverUrl) {
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(item.storyCoverUrl)}`;
      } else if (item.storyContainedInBook?.bookCoverUrl) {
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(item.storyContainedInBook.bookCoverUrl)}`;
      }
      break;
    
    case 'episode':
    case 'movie':
      // For Plex items, we would need the plexKey and settings, which requires backend call
      // Fall back to null for now - the artwork caching service will handle this
      break;
  }
  
  // For items without cached artwork, return null to show fallback
  return null;
};
