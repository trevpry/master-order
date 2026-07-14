import config from '../../../../../config';

const SUBORDER_ARTWORK_DEBUG_FLAG = 'debugSubOrderArtwork';
let hasShownSubOrderDebugHint = false;

const isSubOrderArtworkDebugEnabled = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const fromStorage = window.localStorage?.getItem(SUBORDER_ARTWORK_DEBUG_FLAG) === '1';
    const fromQuery = new URLSearchParams(window.location.search).get(SUBORDER_ARTWORK_DEBUG_FLAG) === '1';
    return fromStorage || fromQuery;
  } catch (error) {
    return false;
  }
};

const hasArtworkHints = (item) => {
  if (!item) {
    return false;
  }

  return Boolean(
    item.localArtworkPath ||
    item.originalArtworkUrl ||
    item.thumb ||
    item.art ||
    item.book?.localArtworkPath ||
    item.book?.coverUrl ||
    item.book?.originalArtworkUrl
  );
};

const normalizePlexArtworkPath = (path) => {
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const prefixedPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiBaseUrl}/api/artwork${prefixedPath}`;
};

const logSubOrderArtworkDebug = (message, details = {}) => {
  if (!isSubOrderArtworkDebugEnabled()) {
    return;
  }

  console.log(`[SubOrderArtworkDebug] ${message}`, details);
};

const logSubOrderArtworkHintIfNeeded = () => {
  if (hasShownSubOrderDebugHint || isSubOrderArtworkDebugEnabled()) {
    return;
  }

  hasShownSubOrderDebugHint = true;
  console.info(
    '[SubOrderArtworkDebug] Verbose sub-order artwork logs are disabled. Enable with ?debugSubOrderArtwork=1 or localStorage.setItem("debugSubOrderArtwork", "1").'
  );
};

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
 * Helper function to count total items including sub-order items (for stats)
 * @param {Array} items - Array of items to process
 * @returns {number} Total item count including sub-order items
 */
export const getTotalItemsWithSubOrders = (items) => {
  if (!items || !Array.isArray(items)) {
    return 0;
  }
  
  let count = 0;
  items.forEach(item => {
    // Filter out reference books
    if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
      return;
    }
    
    // For sub-orders, count items from the referenced order
    if (item.mediaType === 'suborder' && item.referencedCustomOrder) {
      const subOrderItems = (item.referencedCustomOrder.items || []).filter(subItem => {
        if (subItem.mediaType === 'book' && subItem.containedStories && subItem.containedStories.length > 0) {
          return false;
        }
        return true;
      });
      count += subOrderItems.length;
    } else {
      // Regular item
      count += 1;
    }
  });
  
  return count;
};

/**
 * Helper function to count unwatched items including sub-order items (for stats)
 * @param {Array} items - Array of items to process
 * @returns {number} Total unwatched item count including sub-order items
 */
export const getUnwatchedItemsWithSubOrders = (items) => {
  if (!items || !Array.isArray(items)) {
    return 0;
  }
  
  let count = 0;
  items.forEach(item => {
    // Filter out reference books
    if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
      return;
    }
    
    // For sub-orders, count unwatched items from the referenced order
    if (item.mediaType === 'suborder' && item.referencedCustomOrder) {
      const subOrderItems = (item.referencedCustomOrder.items || []).filter(subItem => {
        if (subItem.mediaType === 'book' && subItem.containedStories && subItem.containedStories.length > 0) {
          return false;
        }
        return !subItem.isWatched;
      });
      count += subOrderItems.length;
    } else if (!item.isWatched) {
      // Regular item - count if unwatched
      count += 1;
    }
  });
  
  return count;
};

/**
 * Helper function to generate artwork URLs for custom order items
 * @param {Object} item - The item to generate artwork URL for
 * @returns {string|null} Artwork URL or null if no artwork available
 */
export const getItemArtworkUrl = (item) => {
  // Handle sub-order items - get artwork from the first unwatched item in the referenced order
  if (item.mediaType === 'suborder') {
    logSubOrderArtworkHintIfNeeded();

    logSubOrderArtworkDebug('Resolving sub-order artwork', {
      subOrderItemId: item.id,
      subOrderItemTitle: item.title,
      referencedCustomOrderId: item.referencedCustomOrderId || item.referencedCustomOrder?.id || null,
      hasReferencedCustomOrder: Boolean(item.referencedCustomOrder),
      loadedItemsCount: item.referencedCustomOrder?.items?.length || 0
    });

    if (item.referencedCustomOrder && item.referencedCustomOrder.items && item.referencedCustomOrder.items.length > 0) {
      const sortedSubOrderItems = [...item.referencedCustomOrder.items].sort((a, b) => {
        const aSort = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
        const bSort = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;
        return (a.id || 0) - (b.id || 0);
      });

      logSubOrderArtworkDebug('Loaded referenced order items', {
        referencedCustomOrderId: item.referencedCustomOrder.id,
        items: sortedSubOrderItems.map(subItem => ({
          id: subItem.id,
          title: subItem.title,
          mediaType: subItem.mediaType,
          isWatched: subItem.isWatched,
          sortOrder: subItem.sortOrder,
          hasArtworkHints: hasArtworkHints(subItem)
        }))
      });

      // Pick the first unwatched item in sort order that can actually resolve artwork.
      const unwatchedCandidates = sortedSubOrderItems.filter(subItem => !subItem.isWatched);
      for (const nextUnwatchedItem of unwatchedCandidates) {
        const artwork = getItemArtworkUrl(nextUnwatchedItem);
        logSubOrderArtworkDebug('Tried next unwatched sub-order item for artwork', {
          subOrderItemId: item.id,
          referencedCustomOrderId: item.referencedCustomOrder.id,
          nextUnwatchedItemId: nextUnwatchedItem.id,
          nextUnwatchedTitle: nextUnwatchedItem.title,
          nextUnwatchedSortOrder: nextUnwatchedItem.sortOrder,
          resolvedArtwork: artwork || null
        });

        if (artwork) {
          return artwork;
        }
      }

      // Fallback: use first sorted item that can resolve artwork.
      for (const fallbackItem of sortedSubOrderItems) {
        const artwork = getItemArtworkUrl(fallbackItem);
        logSubOrderArtworkDebug('Falling back to first referenced sub-order item for artwork', {
          subOrderItemId: item.id,
          referencedCustomOrderId: item.referencedCustomOrder.id,
          fallbackItemId: fallbackItem.id,
          fallbackTitle: fallbackItem.title,
          fallbackSortOrder: fallbackItem.sortOrder,
          resolvedArtwork: artwork || null
        });

        if (artwork) {
          return artwork;
        }
      }
    }

    // If still no artwork found, check if referencedCustomOrder exists but no items loaded
    if (item.referencedCustomOrder && (!item.referencedCustomOrder.items || item.referencedCustomOrder.items.length === 0)) {
      console.warn(`Sub-order "${item.title}" (id=${item.id}) has no items loaded. ReferencedOrder id: ${item.referencedCustomOrderId || item.referencedCustomOrder?.id}`);
    }

    logSubOrderArtworkDebug('No artwork resolved for sub-order item', {
      subOrderItemId: item.id,
      subOrderItemTitle: item.title,
      referencedCustomOrderId: item.referencedCustomOrderId || item.referencedCustomOrder?.id || null
    });

    console.warn('[SubOrderArtworkDebug] No artwork resolved for sub-order item', {
      subOrderItemId: item.id,
      subOrderItemTitle: item.title,
      referencedCustomOrderId: item.referencedCustomOrderId || item.referencedCustomOrder?.id || null,
      hasReferencedCustomOrder: Boolean(item.referencedCustomOrder),
      loadedItemsCount: item.referencedCustomOrder?.items?.length || 0
    });

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

  // Plex-backed fallback for episodes/movies when no cached/original artwork fields exist.
  if (item.thumb) {
    const thumbUrl = normalizePlexArtworkPath(item.thumb);
    if (thumbUrl) {
      return thumbUrl;
    }
  }

  if (item.art) {
    const artUrl = normalizePlexArtworkPath(item.art);
    if (artUrl) {
      return artUrl;
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
