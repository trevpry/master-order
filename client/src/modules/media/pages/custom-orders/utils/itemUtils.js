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
  
  // Check for linked unified book artwork first (highest priority)
  if (item.book && item.mediaType === 'book') {
    // Linked unified book has its own cached artwork
    if (item.book.localArtworkPath) {
      const filename = item.book.localArtworkPath.includes('\\') || item.book.localArtworkPath.includes('/') 
        ? item.book.localArtworkPath.split(/[\\\/]/).pop() 
        : item.book.localArtworkPath;
      
      const cacheBuster = item.book.artworkLastCached ? `?v=${encodeURIComponent(item.book.artworkLastCached)}` : '';
      return `${config.apiBaseUrl}/api/artwork/${filename}${cacheBuster}`;
    }
    
    // Linked book has cover URL
    if (item.book.coverUrl) {
      return `${config.apiBaseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(item.book.coverUrl)}`;
    }
    
    // Linked book has original artwork URL
    if (item.book.originalArtworkUrl) {
      return `${config.apiBaseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(item.book.originalArtworkUrl)}`;
    }
  }
  
  // Check if we have cached artwork (custom order item level)
  if (item.localArtworkPath) {
    // Extract just the filename from the full path
    const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
      ? item.localArtworkPath.split(/[\\\/]/).pop() 
      : item.localArtworkPath;
    
    // Add cache-busting parameter based on artworkLastCached timestamp
    const cacheBuster = item.artworkLastCached ? `?v=${encodeURIComponent(item.artworkLastCached)}` : '';
    const artworkUrl = `${config.apiBaseUrl}/api/artwork/${filename}${cacheBuster}`;
    
    return artworkUrl;
  }
  
  // If no cached artwork, check if we have a direct original artwork URL stored
  // This avoids making API calls to ComicVine/OpenLibrary every time
  if (item.originalArtworkUrl) {
    switch (item.mediaType) {
      case 'comic':
        return `${config.apiBaseUrl}/api/comicvine/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
      case 'book':
        return `${config.apiBaseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
      case 'game':
        // For games, use RAWG artwork proxy or direct URL
        if (item.originalArtworkUrl.startsWith('http')) {
          return `${config.apiBaseUrl}/api/rawg/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
        }
        return item.originalArtworkUrl;
      case 'shortstory':
        if (item.originalArtworkUrl.startsWith('http')) {
          return `${config.apiBaseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
        }
        return item.originalArtworkUrl;
      default:
        return item.originalArtworkUrl;
    }
  }
  
  // Only as a last resort for comics, try to construct artwork from ComicVine details
  // This should rarely be used if artwork caching is working properly
  if (item.mediaType === 'comic' && item.comicVineDetailsJson) {
    try {
      const comicVineDetails = JSON.parse(item.comicVineDetailsJson);
      if (comicVineDetails.image && comicVineDetails.image.medium_url) {
        console.warn(`Comic ${item.comicSeries} #${item.comicIssue}: Using ComicVine API fallback (cached artwork not available)`);
        return `${config.apiBaseUrl}/api/comicvine/artwork?url=${encodeURIComponent(comicVineDetails.image.medium_url)}`;
      }
    } catch (error) {
      console.warn('Failed to parse ComicVine details JSON:', error);
    }
  }
  
  // No artwork available
  return null;
};
