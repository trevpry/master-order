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
  
  // Second priority: For episodes, use episode-specific artwork if available
  if (media?.type === 'episode') {
    // Try episode-specific thumb first
    if (media?.episodeThumb) {
      console.log('📱 Using episode-specific artwork proxy:', media.episodeThumb);
      return `${baseUrl}/api/artwork${media.episodeThumb}`;
    }
    // Check if we have episode rating key to construct episode artwork
    if (media?.episodeRatingKey || media?.currentEpisodeRatingKey || media?.nextEpisodeRatingKey) {
      const episodeKey = media.episodeRatingKey || media.currentEpisodeRatingKey || media.nextEpisodeRatingKey;
      const episodeThumb = `/library/metadata/${episodeKey}/thumb`;
      console.log('📱 Using constructed episode artwork proxy:', episodeThumb);
      return `${baseUrl}/api/artwork${episodeThumb}`;
    }
    // Fallback to series thumb for episodes
    if (media?.thumb) {
      console.log('📱 Using series artwork proxy for episode (fallback):', media.thumb);
      return `${baseUrl}/api/artwork${media.thumb}`;
    }
  }
  
  // Third priority: Use Plex artwork proxy for other Plex content (movies, etc.)
  if (media?.thumb && (media?.type === 'movie' || !media?.type)) {
    console.log('📱 Using Plex artwork proxy:', media.thumb);
    return `${baseUrl}/api/artwork${media.thumb}`;
  }
  
  return null;
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
