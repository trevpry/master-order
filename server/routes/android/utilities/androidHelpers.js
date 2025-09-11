/**
 * Android Companion App Utilities
 * Shared helper functions for Android app integration
 */

/**
 * Helper function to get Android API base URL
 */
function getAndroidApiBaseUrl() {
  const PORT = process.env.PORT || 3001;
  const externalIp = process.env.EXTERNAL_IP;
  return externalIp ? `http://${externalIp}:${PORT}` : `http://localhost:${PORT}`;
}

/**
 * Helper function to generate artwork URL for Android app
 * Matches exactly the getArtworkUrl function from web app
 */
function getAndroidArtworkUrl(media, baseUrl) {
  // Web videos don't have artwork
  if (media?.type === 'webvideo') {
    return null;
  }

  // First priority: Check for cached artwork (works for all media types)
  if (media?.localArtworkPath) {
    const filename = media.localArtworkPath.includes('\\') || media.localArtworkPath.includes('/')
      ? media.localArtworkPath.split(/[\\\/]/).pop()
      : media.localArtworkPath;
    console.log('📱 Using cached artwork:', filename);
    return `${baseUrl}/api/artwork/${filename}`;
  }

  // For comics, fallback to ComicVine artwork if no cached artwork
  if (media?.type === 'comic' && media?.comicDetails?.coverUrl) {
    console.log('📱 Using ComicVine artwork (fallback):', media.comicDetails.coverUrl);
    return `${baseUrl}/api/comicvine-artwork?url=${encodeURIComponent(media.comicDetails.coverUrl)}`;
  }

  // For books, use OpenLibrary artwork
  if (media?.type === 'book' && media?.bookCoverUrl) {
    console.log('📱 Using OpenLibrary artwork:', media.bookCoverUrl);
    return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.bookCoverUrl)}`;
  }

  // For short stories, use story cover or fallback to containing book's cover
  if (media?.type === 'shortstory') {
    if (media?.storyCoverUrl) {
      console.log('📱 Using short story cover artwork:', media.storyCoverUrl);
      return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.storyCoverUrl)}`;
    } else if (media?.containedInBookDetails?.coverUrl) {
      console.log('📱 Using containing book cover artwork for short story:', media.containedInBookDetails.coverUrl);
      return `${baseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(media.containedInBookDetails.coverUrl)}`;
    }
  }

  // Prioritize TVDB artwork if available for TV content
  if (media?.tvdbArtwork?.url) {
    console.log('📱 Using TVDB artwork:', media.tvdbArtwork.url);
    return `${baseUrl}/api/tvdb-artwork?url=${encodeURIComponent(media.tvdbArtwork.url)}`;
  }

  // Fall back to Plex artwork
  const thumb = media?.thumb || media?.art;
  if (!thumb) return null;

  // Check if thumb is already a full URL (starts with http)
  if (thumb.startsWith('http')) {
    console.log('📱 Using full artwork URL:', thumb);
    return thumb;
  }

  // Otherwise, it's a relative path, so add the base URL
  console.log('📱 Using Plex artwork:', thumb);
  return `${baseUrl}/api/artwork${thumb}`;
}

/**
 * Create standardized Android API response format
 */
function createAndroidResponse(type, data) {
  return {
    type,
    data: {
      ...data,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Create standardized Android error response
 */
function createAndroidErrorResponse(type, error, message) {
  return {
    type,
    data: {
      success: false,
      error,
      message,
      timestamp: new Date().toISOString()
    }
  };
}

module.exports = {
  getAndroidApiBaseUrl,
  getAndroidArtworkUrl,
  createAndroidResponse,
  createAndroidErrorResponse
};
