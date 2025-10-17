import config from '../../../config.js';

export const getSceneDisplayTitle = (scene) => {
  if (!scene) return 'Unknown Scene';
  
  // Try various title fields in order of preference
  if (scene.title) return scene.title;
  if (scene.name) return scene.name;
  
  // If no title, try to extract filename from path
  if (scene.path) {
    // Extract filename from path (handles both Windows and Unix paths)
    const filename = scene.path.split(/[\\/]/).pop();
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    if (nameWithoutExt) return nameWithoutExt;
  }
  
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

/**
 * Extract file name from scene path
 * @param {Object} scene - Scene object
 * @returns {string|null} File name without extension, or null if not available
 */
export const getSceneFileName = (scene) => {
  if (!scene || !scene.path) return null;
  
  // Extract filename from path (handle both forward and back slashes)
  const fileName = scene.path.split(/[/\\]/).pop();
  if (!fileName) return null;
  
  // Remove file extension
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) return fileName; // No extension
  
  return fileName.substring(0, lastDotIndex);
};

/**
 * Get tags from scene object
 * @param {Object} scene - Scene object
 * @returns {Array} Array of tag objects with id and name
 */
export const getSceneTags = (scene) => {
  if (!scene || !scene.tags || !Array.isArray(scene.tags)) return [];
  
  return scene.tags.map(tag => ({
    id: tag.id || tag.tagId,
    name: tag.name || tag.tag?.name || 'Unknown Tag'
  }));
};

/**
 * Get tags from clip object
 * @param {Object} clip - Clip object with tags relation
 * @returns {Array} Array of tag objects
 */
export const getClipTags = (clip) => {
  if (!clip || !clip.tags || !Array.isArray(clip.tags)) return [];
  
  return clip.tags.map(tagRelation => {
    const tag = tagRelation.tag || tagRelation;
    return {
      id: tag.id,
      name: tag.name || 'Unknown Tag',
      description: tag.description,
      image: tag.image,
      favorite: tag.favorite,
      parentTags: tag.parentTags,
      childTags: tag.childTags
    };
  });
};

/**
 * Get studio from scene object
 * @param {Object} scene - Scene object
 * @returns {Object|null} Studio object with id and name, or null if not available
 */
export const getSceneStudio = (scene) => {
  if (!scene) return null;
  
  // Check for studio object (preferred format)
  if (scene.studio && typeof scene.studio === 'object') {
    return {
      id: scene.studio.id,
      name: scene.studio.name || 'Unknown Studio',
      url: scene.studio.url,
      image: scene.studio.image
    };
  }
  
  // Check for studioObject (alternative format)
  if (scene.studioObject) {
    return {
      id: scene.studioObject.id,
      name: scene.studioObject.name || 'Unknown Studio',
      url: scene.studioObject.url,
      image: scene.studioObject.image
    };
  }
  
  return null;
};

/**
 * Get performers from scene object
 * @param {Object} scene - Scene object
 * @returns {Array} Array of performer objects with id and name
 */
export const getScenePerformers = (scene) => {
  if (!scene || !scene.performers || !Array.isArray(scene.performers)) return [];
  
  return scene.performers.map(performer => {
    // Handle different performer object structures
    const performerData = performer.performer || performer;
    
    return {
      id: performerData.id,
      name: performerData.name || 'Unknown Performer',
      disambiguation: performerData.disambiguation,
      favorite: performerData.favorite,
      image: performerData.image,
      url: performerData.url
    };
  });
};

// ================================
// TAG HIERARCHY UTILITIES
// ================================

/**
 * Get aliases for a tag
 * @param {Object} tag - Tag object with aliases relation
 * @returns {Array} Array of alias strings
 */
export const getTagAliases = (tag) => {
  if (!tag) return [];
  
  // Handle direct aliases array
  if (Array.isArray(tag.aliases)) {
    return tag.aliases.map(alias => {
      // Handle both string and object formats
      if (typeof alias === 'string') return alias;
      if (alias.alias) return alias.alias;
      return null;
    }).filter(Boolean);
  }
  
  return [];
};

/**
 * Get parent tags (direct parents only)
 * @param {Object} tag - Tag object with parentTags relation
 * @returns {Array} Array of parent tag objects
 */
export const getTagParents = (tag) => {
  if (!tag || !tag.parentTags || !Array.isArray(tag.parentTags)) return [];
  
  return tag.parentTags.map(hierarchy => {
    // Handle hierarchy junction table structure
    const parentTag = hierarchy.parentTag || hierarchy;
    return {
      id: parentTag.id,
      name: parentTag.name || 'Unknown Tag',
      description: parentTag.description,
      image: parentTag.image,
      favorite: parentTag.favorite
    };
  }).filter(parent => parent.id);
};

/**
 * Get child tags (direct children only)
 * @param {Object} tag - Tag object with childTags relation
 * @returns {Array} Array of child tag objects
 */
export const getTagChildren = (tag) => {
  if (!tag || !tag.childTags || !Array.isArray(tag.childTags)) return [];
  
  return tag.childTags.map(hierarchy => {
    // Handle hierarchy junction table structure
    const childTag = hierarchy.childTag || hierarchy;
    return {
      id: childTag.id,
      name: childTag.name || 'Unknown Tag',
      description: childTag.description,
      image: childTag.image,
      favorite: childTag.favorite
    };
  }).filter(child => child.id);
};

/**
 * Get all ancestor tags recursively (parents, grandparents, etc.)
 * @param {Object} tag - Tag object with parentTags relation
 * @param {Set} visited - Set to track visited tags and prevent infinite loops
 * @returns {Array} Array of ancestor tag objects
 */
export const getTagAncestors = (tag, visited = new Set()) => {
  if (!tag || visited.has(tag.id)) return [];
  
  visited.add(tag.id);
  const ancestors = [];
  
  const parents = getTagParents(tag);
  for (const parent of parents) {
    ancestors.push(parent);
    // Recursively get parent's ancestors
    const parentAncestors = getTagAncestors(parent, visited);
    ancestors.push(...parentAncestors);
  }
  
  // Remove duplicates based on tag ID
  const uniqueAncestors = Array.from(
    new Map(ancestors.map(tag => [tag.id, tag])).values()
  );
  
  return uniqueAncestors;
};

/**
 * Get all descendant tags recursively (children, grandchildren, etc.)
 * @param {Object} tag - Tag object with childTags relation
 * @param {Set} visited - Set to track visited tags and prevent infinite loops
 * @returns {Array} Array of descendant tag objects
 */
export const getTagDescendants = (tag, visited = new Set()) => {
  if (!tag || visited.has(tag.id)) return [];
  
  visited.add(tag.id);
  const descendants = [];
  
  const children = getTagChildren(tag);
  for (const child of children) {
    descendants.push(child);
    // Recursively get child's descendants
    const childDescendants = getTagDescendants(child, visited);
    descendants.push(...childDescendants);
  }
  
  // Remove duplicates based on tag ID
  const uniqueDescendants = Array.from(
    new Map(descendants.map(tag => [tag.id, tag])).values()
  );
  
  return uniqueDescendants;
};

/**
 * Format tag hierarchy path (from root to current tag)
 * @param {Object} tag - Tag object with parentTags relation
 * @param {Array} path - Current path array (used for recursion)
 * @param {Set} visited - Set to track visited tags and prevent infinite loops
 * @returns {string} Formatted path like "Root > Parent > Current"
 */
export const formatTagPath = (tag, path = [], visited = new Set()) => {
  if (!tag || visited.has(tag.id)) return path.join(' > ');
  
  visited.add(tag.id);
  const parents = getTagParents(tag);
  
  // If no parents, this is a root tag
  if (parents.length === 0) {
    return [...path, tag.name].join(' > ');
  }
  
  // Get the path from the first parent (in case of multiple parents)
  const parentPath = formatTagPath(parents[0], path, visited);
  return `${parentPath} > ${tag.name}`;
};

/**
 * Check if a tag has any hierarchy (parents or children)
 * @param {Object} tag - Tag object
 * @returns {boolean} True if tag has parents or children
 */
export const hasTagHierarchy = (tag) => {
  if (!tag) return false;
  
  const hasParents = tag.parentTags && Array.isArray(tag.parentTags) && tag.parentTags.length > 0;
  const hasChildren = tag.childTags && Array.isArray(tag.childTags) && tag.childTags.length > 0;
  
  return hasParents || hasChildren;
};

/**
 * Get full tag hierarchy tree structure
 * @param {Object} tag - Tag object with parentTags and childTags relations
 * @returns {Object} Tree structure with ancestors, current tag, and descendants
 */
export const getTagHierarchyTree = (tag) => {
  if (!tag) return null;
  
  return {
    tag: {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      image: tag.image,
      favorite: tag.favorite,
      ignoreAutoTag: tag.ignoreAutoTag,
      aliases: getTagAliases(tag)
    },
    ancestors: getTagAncestors(tag),
    parents: getTagParents(tag),
    children: getTagChildren(tag),
    descendants: getTagDescendants(tag),
    path: formatTagPath(tag)
  };
};

export default {
  getSceneDisplayTitle,
  getSceneImageUrl,
  formatDate,
  formatDuration,
  formatTime,
  isVideoFormatSupported,
  getSceneFileName,
  getSceneTags,
  getClipTags,
  getSceneStudio,
  getScenePerformers,
  getTagAliases,
  getTagParents,
  getTagChildren,
  getTagAncestors,
  getTagDescendants,
  formatTagPath,
  hasTagHierarchy,
  getTagHierarchyTree
};

