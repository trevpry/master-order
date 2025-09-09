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
  
  // Second priority: Use Plex artwork proxy for Plex content
  if (media?.thumb && (media?.type === 'episode' || media?.type === 'movie')) {
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
