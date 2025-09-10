import config from '../../../config.js';

export const getSceneDisplayTitle = (scene) => {
  if (!scene) return 'Unknown Scene';
  
  // Try various title fields in order of preference
  if (scene.title) return scene.title;
  if (scene.name) return scene.name;
  if (scene.id) return `Scene ${scene.id}`;
  
  return 'Unknown Scene';
};

export const getSceneImageUrl = (scene) => {
  if (!scene) return null;
  
  try {
    // Check for direct image URL first (from API response)
    if (scene.image) {
      // If it's already a full URL, return as-is
      if (scene.image.startsWith('http')) {
        return scene.image;
      }
      // If it's a relative path, build the full URL
      return `${config.apiBaseUrl}${scene.image}`;
    }
    
    // Check for thumb URL
    if (scene.thumb) {
      if (scene.thumb.startsWith('http')) {
        return scene.thumb;
      }
      return `${config.apiBaseUrl}${scene.thumb}`;
    }
    
    // Check for preview URL
    if (scene.preview) {
      if (scene.preview.startsWith('http')) {
        return scene.preview;
      }
      return `${config.apiBaseUrl}${scene.preview}`;
    }
    
    // Check for paths object (legacy method)
    if (scene.paths) {
      if (scene.paths.screenshot) {
        // If it's already a full URL, return as-is
        if (scene.paths.screenshot.startsWith('http')) {
          return scene.paths.screenshot;
        }
        // If it's a relative path, build the proxy URL
        return `${config.apiBaseUrl}/api/stash/image-proxy/${scene.paths.screenshot}`;
      }
      if (scene.paths.image) {
        if (scene.paths.image.startsWith('http')) {
          return scene.paths.image;
        }
        return `${config.apiBaseUrl}/api/stash/image-proxy/${scene.paths.image}`;
      }
    }
    
    // Fallback to direct image path
    if (scene.image_path) {
      return `${config.apiBaseUrl}/api/stash/image-proxy/${encodeURIComponent(scene.image_path)}`;
    }
    
    // Fallback to screenshot field
    if (scene.screenshot) {
      return `${config.apiBaseUrl}/api/stash/image-proxy/${encodeURIComponent(scene.screenshot)}`;
    }
    
    // Fallback to cover field
    if (scene.cover) {
      return `${config.apiBaseUrl}/api/stash/image-proxy/${encodeURIComponent(scene.cover)}`;
    }
    
    return null;
  } catch (error) {
    console.error('Error generating scene image URL:', error);
    return null;
  }
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  } catch (error) {
    return dateString;
  }
};

export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  }
};

export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

export const isVideoFormatSupported = (filePath) => {
  if (!filePath) return false;
  
  const extension = filePath.split('.').pop()?.toLowerCase();
  
  // Supported formats in modern browsers
  const supportedFormats = [
    'mp4', 'webm', 'ogg', 'm4v',   // Fully supported
    'mov', 'mkv'                    // Partially supported
  ];
  
  // Unsupported formats
  const unsupportedFormats = [
    'wmv', 'avi', 'flv', 'divx', 'rmvb', 'asf'
  ];
  
  if (unsupportedFormats.includes(extension)) {
    return false;
  }
  
  return supportedFormats.includes(extension);
};

export default {
  getSceneDisplayTitle,
  getSceneImageUrl,
  formatDate,
  formatDuration,
  formatTime,
  isVideoFormatSupported
};
