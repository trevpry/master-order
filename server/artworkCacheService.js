const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const prisma = require('./prismaClient');
const settingsService = require('./settingsService');

class ArtworkCacheService {
  constructor() {
    this.cacheDir = path.join(__dirname, 'artwork-cache');
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log('Artwork cache directory initialized:', this.cacheDir);
    } catch (error) {
      console.error('Failed to initialize artwork cache directory:', error);
    }
  }

  /**
   * Generate a unique filename for cached artwork
   */
  generateCacheFilename(url, mimeType) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const extension = this.getExtensionFromMimeType(mimeType) || '.jpg';
    return `${hash}${extension}`;
  }

  /**
   * Generate a season-based filename for TV episodes sharing season artwork
   */
  generateSeasonCacheFilename(seriesTitle, seasonNumber, mimeType) {
    const cleanSeriesTitle = seriesTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const seasonKey = `${cleanSeriesTitle}-season-${seasonNumber}`;
    const hash = crypto.createHash('md5').update(seasonKey).digest('hex');
    const extension = this.getExtensionFromMimeType(mimeType) || '.jpg';
    return `season-${hash}${extension}`;
  }

  /**
   * Get file extension from MIME type
   */
  getExtensionFromMimeType(mimeType) {
    const mimeMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
      'image/svg+xml': '.svg'
    };
    return mimeMap[mimeType] || '.jpg';
  }

  /**
   * Get MIME type from response headers or guess from URL
   */
  getMimeTypeFromResponse(response, url) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      return contentType.split(';')[0]; // Remove charset if present
    }
    
    // Fallback: guess from URL extension
    const extension = path.extname(url).toLowerCase();
    const extensionMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };
    return extensionMap[extension] || 'image/jpeg';
  }

  /**
   * Download and cache artwork from URL
   */
  async cacheArtwork(url, itemId, isSeasonArtwork = false, seasonInfo = null) {
    try {
      console.log(`Caching artwork for item ${itemId} from URL: ${url}`);
      
      // Make request with headers to appear like a browser
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        },
        timeout: 30000 // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get MIME type from response
      const mimeType = this.getMimeTypeFromResponse(response, url);
      
      // Generate filename - use season-based filename for TV episodes
      let filename, filePath;
      if (isSeasonArtwork && seasonInfo) {
        filename = this.generateSeasonCacheFilename(seasonInfo.seriesTitle, seasonInfo.seasonNumber, mimeType);
        filePath = path.join(this.cacheDir, filename);
        
        // Check if season artwork already exists
        try {
          await fs.access(filePath);
          console.log(`Season artwork already exists for ${seasonInfo.seriesTitle} Season ${seasonInfo.seasonNumber}, reusing: ${filename}`);
          
          // Update database with cached artwork info (pointing to shared season file)
          await prisma.customOrderItem.update({
            where: { id: itemId },
            data: {
              localArtworkPath: filePath,
              originalArtworkUrl: url,
              artworkLastCached: new Date(),
              artworkMimeType: mimeType
            }
          });

          return {
            success: true,
            localPath: filePath,
            filename: filename,
            mimeType: mimeType,
            shared: true
          };
        } catch (error) {
          // File doesn't exist, proceed with download
        }
      } else {
        filename = this.generateCacheFilename(url, mimeType);
        filePath = path.join(this.cacheDir, filename);
      }

      // Download and save the image
      const buffer = await response.buffer();
      await fs.writeFile(filePath, buffer);

      // Update database with cached artwork info
      await prisma.customOrderItem.update({
        where: { id: itemId },
        data: {
          localArtworkPath: filePath,
          originalArtworkUrl: url,
          artworkLastCached: new Date(),
          artworkMimeType: mimeType
        }
      });

      console.log(`Successfully cached artwork for item ${itemId}: ${filename}`);
      return {
        success: true,
        localPath: filePath,
        filename: filename,
        mimeType: mimeType,
        shared: isSeasonArtwork
      };

    } catch (error) {
      console.error(`Failed to cache artwork for item ${itemId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get artwork URL for a custom order item (cached if available, fallback to remote)
   */
  async getArtworkUrl(item, baseUrl = 'http://localhost:3001') {
    // If we have a locally cached file, return the local URL
    if (item.localArtworkPath) {
      try {
        // Check if the cached file still exists
        await fs.access(item.localArtworkPath);
        const filename = path.basename(item.localArtworkPath);
        return `${baseUrl}/api/artwork/${filename}`;
      } catch (error) {
        console.warn(`Cached artwork file missing for item ${item.id}: ${item.localArtworkPath}`);
        // File doesn't exist, we'll fall back to remote URL and try to re-cache
      }
    }

    // Fallback to original remote URL logic
    return this.getRemoteArtworkUrl(item);
  }
  /**
   * Get remote artwork URL (fallback method)
   */
  async getRemoteArtworkUrl(item) {
    switch (item.mediaType) {      case 'comic':
        if (item.comicSeries && item.comicYear) {
          const comicString = `${item.comicSeries} (${item.comicYear}) #${item.comicIssue || '1'}`;
          return `http://localhost:3001/api/comicvine-cover?comic=${encodeURIComponent(comicString)}`;
        }
        break;
      
      case 'book':
        if (item.bookCoverUrl) {
          return item.bookCoverUrl;
        } else if (item.bookOpenLibraryId) {
          return `https://covers.openlibrary.org/b/olid/${item.bookOpenLibraryId}-M.jpg`;
        }
        break;
      
      case 'shortstory':
        if (item.storyCoverUrl) {
          return item.storyCoverUrl;
        } else if (item.storyContainedInBook?.bookCoverUrl) {
          return item.storyContainedInBook.bookCoverUrl;
        } else if (item.storyContainedInBook?.bookOpenLibraryId) {
          return `https://covers.openlibrary.org/b/olid/${item.storyContainedInBook.bookOpenLibraryId}-M.jpg`;
        }
        break;
      
      case 'movie':
      case 'episode':
        // For Plex items, construct the Plex artwork URL using settings
        try {
          const settings = await settingsService.getSettings();
          if (!settings?.plexUrl || !settings?.plexToken) {
            console.warn('Plex settings not configured for artwork caching');
            return null;
          }

          // Get the full item details from database to access Plex metadata
          const fullItem = await prisma.customOrderItem.findUnique({
            where: { id: item.id }
          });
          
          if (!fullItem?.plexKey) {
            console.warn(`No Plex key found for item ${item.id}`);
            return null;
          }

          // For episodes, prioritize season artwork; for movies use movie artwork
          if (item.mediaType === 'episode') {
            // First try to get TVDB season artwork which is higher quality
            if (item.seriesTitle && item.seasonNumber) {
              const tvdbService = require('./tvdbCachedService');
              try {
                const tvdbArtwork = await tvdbService.getCurrentSeasonArtwork(item.seriesTitle, item.seasonNumber);
                if (tvdbArtwork?.url) {
                  console.log(`Using TVDB season artwork for ${item.seriesTitle} Season ${item.seasonNumber}`);
                  return tvdbArtwork.url;
                }
              } catch (error) {
                console.warn(`Failed to get TVDB artwork for ${item.seriesTitle}: ${error.message}`);
              }
            }
            
            // Fallback to Plex episode artwork (typically lower quality)
            return `${settings.plexUrl}/library/metadata/${fullItem.plexKey}/thumb?X-Plex-Token=${settings.plexToken}`;
          } else {
            // For movies, use Plex movie artwork
            return `${settings.plexUrl}/library/metadata/${fullItem.plexKey}/thumb?X-Plex-Token=${settings.plexToken}`;
          }
        } catch (error) {
          console.error(`Error constructing Plex artwork URL for item ${item.id}:`, error.message);
          return null;
        }
      
      default:
        return null;
    }
    
    return null;
  }
  /**
   * Cache artwork for a custom order item if not already cached
   */
  async ensureArtworkCached(item) {
    // Skip if already cached and file exists
    if (item.localArtworkPath) {
      try {
        await fs.access(item.localArtworkPath);
        console.log(`Artwork already cached for item ${item.id}`);
        return { success: true, cached: false, localPath: item.localArtworkPath };
      } catch (error) {
        console.log(`Cached artwork file missing for item ${item.id}, re-caching...`);
      }
    }

    // For TV episodes, check if we can share season artwork with other episodes
    if (item.mediaType === 'episode' && item.seriesTitle && item.seasonNumber) {
      const existingSeasonItem = await prisma.customOrderItem.findFirst({
        where: {
          mediaType: 'episode',
          seriesTitle: item.seriesTitle,
          seasonNumber: item.seasonNumber,
          localArtworkPath: {
            not: null
          },
          NOT: {
            id: item.id
          }
        }
      });

      if (existingSeasonItem?.localArtworkPath) {
        try {
          // Check if the existing season artwork file still exists
          await fs.access(existingSeasonItem.localArtworkPath);
          
          console.log(`Reusing existing season artwork for ${item.seriesTitle} Season ${item.seasonNumber}`);
          
          // Update this item to share the same artwork
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: {
              localArtworkPath: existingSeasonItem.localArtworkPath,
              originalArtworkUrl: existingSeasonItem.originalArtworkUrl,
              artworkLastCached: new Date(),
              artworkMimeType: existingSeasonItem.artworkMimeType
            }
          });

          return { 
            success: true, 
            cached: false, 
            localPath: existingSeasonItem.localArtworkPath,
            shared: true 
          };
        } catch (error) {
          console.log(`Existing season artwork file missing, will create new one`);
        }
      }
    }

    // Get the remote artwork URL
    const remoteUrl = await this.getRemoteArtworkUrl(item);
    
    if (!remoteUrl) {
      console.log(`No artwork URL available for item ${item.id}`);
      return { success: false, error: 'No artwork URL available' };
    }

    // Determine if this is season artwork that should be shared
    const isSeasonArtwork = item.mediaType === 'episode' && item.seriesTitle && item.seasonNumber;
    const seasonInfo = isSeasonArtwork ? {
      seriesTitle: item.seriesTitle,
      seasonNumber: item.seasonNumber
    } : null;

    // Cache the artwork
    const result = await this.cacheArtwork(remoteUrl, item.id, isSeasonArtwork, seasonInfo);
    return { ...result, cached: true };
  }
  /**
   * Clean up cached artwork for an item
   */
  async cleanupArtwork(itemId) {
    try {
      const item = await prisma.customOrderItem.findUnique({
        where: { id: itemId },
        select: { 
          localArtworkPath: true,
          mediaType: true,
          seriesTitle: true,
          seasonNumber: true
        }
      });

      if (item?.localArtworkPath) {
        // For TV episodes with season artwork, check if other episodes are using the same file
        if (item.mediaType === 'episode' && item.seriesTitle && item.seasonNumber) {
          const otherItemsUsingFile = await prisma.customOrderItem.count({
            where: {
              localArtworkPath: item.localArtworkPath,
              NOT: {
                id: itemId
              }
            }
          });

          if (otherItemsUsingFile > 0) {
            console.log(`Season artwork shared by ${otherItemsUsingFile} other episodes, not deleting file`);
          } else {
            // No other items using this file, safe to delete
            try {
              await fs.unlink(item.localArtworkPath);
              console.log(`Deleted cached artwork: ${item.localArtworkPath}`);
            } catch (error) {
              console.warn(`Failed to delete cached artwork file: ${error.message}`);
            }
          }
        } else {
          // For non-episode items, delete the file directly
          try {
            await fs.unlink(item.localArtworkPath);
            console.log(`Deleted cached artwork: ${item.localArtworkPath}`);
          } catch (error) {
            console.warn(`Failed to delete cached artwork file: ${error.message}`);
          }
        }
      }

      // Clear the database references
      await prisma.customOrderItem.update({
        where: { id: itemId },
        data: {
          localArtworkPath: null,
          originalArtworkUrl: null,
          artworkLastCached: null,
          artworkMimeType: null
        }
      });

    } catch (error) {
      console.error(`Failed to cleanup artwork for item ${itemId}:`, error.message);
    }
  }

  /**
   * Get cached artwork file path for serving via Express
   */
  getCachedFilePath(filename) {
    return path.join(this.cacheDir, filename);
  }
  /**
   * Cache artwork for all items in a custom order
   */
  async cacheArtworkForCustomOrder(customOrderId) {
    try {
      const items = await prisma.customOrderItem.findMany({
        where: { customOrderId: customOrderId },
        include: {
          storyContainedInBook: true
        }
      });

      const results = [];
      for (const item of items) {
        const result = await this.ensureArtworkCached(item);
        results.push({
          itemId: item.id,
          title: item.title,
          ...result
        });
      }

      return results;
    } catch (error) {
      console.error(`Failed to cache artwork for custom order ${customOrderId}:`, error.message);
      throw error;
    }
  }

  /**
   * Cache artwork for a single custom order item
   */
  async cacheArtworkForCustomOrderItem(itemId) {
    try {
      const item = await prisma.customOrderItem.findUnique({
        where: { id: itemId },
        include: {
          storyContainedInBook: true
        }
      });

      if (!item) {
        throw new Error(`Custom order item with ID ${itemId} not found`);
      }

      const result = await this.ensureArtworkCached(item);
      return {
        itemId: item.id,
        title: item.title,
        ...result
      };
    } catch (error) {
      console.error(`Failed to cache artwork for custom order item ${itemId}:`, error.message);
      throw error;
    }
  }
}

module.exports = ArtworkCacheService;
