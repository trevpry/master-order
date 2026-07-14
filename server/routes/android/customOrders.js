/**
 * Android Custom Orders Routes
 * Endpoints for browsing and playing custom order items from the Android app
 */

const express = require('express');

/**
 * Create custom orders routes for Android
 * @param {object} prisma - Prisma client instance
 * @returns {express.Router} Custom orders router
 */
function createCustomOrdersRoutes(prisma) {
  const router = express.Router();
  
  // Import required services
  const getArtworkUrl = (item, baseUrl) => {
    // Check if we have cached artwork
    if (item.localArtworkPath) {
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
        ? item.localArtworkPath.split(/[\\\/]/).pop() 
        : item.localArtworkPath;
      
      const cacheBuster = item.artworkLastCached ? `?v=${encodeURIComponent(item.artworkLastCached)}` : '';
      return `${baseUrl}/api/artwork/${filename}${cacheBuster}`;
    }
    
    // Check if we have a direct original artwork URL
    if (item.originalArtworkUrl) {
      switch (item.mediaType) {
        case 'comic':
          return `${baseUrl}/api/comicvine/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
        case 'book':
        case 'shortstory':
          return `${baseUrl}/api/openlibrary/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
        case 'game':
          if (item.originalArtworkUrl.startsWith('http')) {
            return `${baseUrl}/api/rawg/artwork?url=${encodeURIComponent(item.originalArtworkUrl)}`;
          }
          return item.originalArtworkUrl;
        default:
          return item.originalArtworkUrl;
      }
    }
    
    // For episodes and movies with Plex keys, we'd need Plex settings
    // For now, return null and let the Android app use a fallback
    return null;
  };

  /**
   * GET /api/android/custom-orders
   * Get all custom orders with basic information
   */
  router.get('/custom-orders', async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const customOrders = await prisma.customOrder.findMany({
        include: {
          items: {
            select: {
              id: true,
              isWatched: true,
              mediaType: true
            }
          },
          plexPlaylist: {
            select: {
              title: true
            }
          },
          customPlaylist: {
            select: {
              name: true,
              _count: {
                select: { tracks: true }
              }
            }
          },
          backgroundGallery: {
            select: {
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Calculate statistics and format response
      const formattedOrders = customOrders.map(order => {
        const totalItems = order.items.filter(item => {
          // Exclude reference books (books that contain short stories)
          if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
            return false;
          }
          return true;
        }).length;
        
        const watchedItems = order.items.filter(item => {
          if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
            return false;
          }
          return item.isWatched;
        }).length;
        
        const unwatchedItems = totalItems - watchedItems;
        
        return {
          id: order.id,
          name: order.name,
          description: order.description,
          icon: order.icon,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          totalItems,
          watchedItems,
          unwatchedItems,
          playlistName: order.plexPlaylist?.title || order.customPlaylist?.name || null,
          playlistType: order.plexPlaylist ? 'plex' : (order.customPlaylist ? 'custom' : null),
          backgroundGalleryName: order.backgroundGallery?.name || null
        };
      });
      
      res.json({
        type: 'CUSTOM_ORDERS_LIST',
        data: {
          orders: formattedOrders,
          totalOrders: formattedOrders.length
        }
      });
    } catch (error) {
      console.error('Error fetching custom orders for Android:', error);
      res.status(500).json({ 
        type: 'ERROR',
        data: { 
          error: 'Failed to fetch custom orders',
          message: error.message 
        } 
      });
    }
  });

  /**
   * GET /api/android/custom-orders/:id/items
   * Get all items for a specific custom order with full details for playback
   */
  router.get('/custom-orders/:id/items', async (req, res) => {
    try {
      const { id } = req.params;
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      const customOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: {
              storyContainedInBook: true,
              containedStories: true,
              referencedCustomOrder: {
                include: {
                  items: {
                    include: {
                      containedStories: true,
                      storyContainedInBook: true,
                      book: {
                        include: {
                          bookCompletions: true,
                          chapters: {
                            include: {
                              chapterCompletions: true,
                              sections: {
                                include: {
                                  sectionCompletions: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              book: {
                include: {
                  bookCompletions: true,
                  chapters: {
                    include: {
                      chapterCompletions: true,
                      sections: {
                        include: {
                          sectionCompletions: true
                        }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { sortOrder: 'asc' }
          },
          plexPlaylist: true,
          customPlaylist: true,
          backgroundGallery: true
        }
      });
      
      if (!customOrder) {
        return res.status(404).json({ 
          type: 'ERROR',
          data: { error: 'Custom order not found' } 
        });
      }
      
      // Filter out reference books and format items for Android
      const items = customOrder.items
        .filter(item => {
          // Filter out reference books (books that contain short stories)
          if (item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0) {
            return false;
          }
          return true;
        })
        .map(item => {
          const formattedItem = {
            id: item.id,
            customOrderId: customOrder.id,
            customOrderName: customOrder.name,
            mediaType: item.mediaType,
            title: item.title,
            sortOrder: item.sortOrder,
            isWatched: item.isWatched,
            watchedAt: item.watchedAt,
            plexKey: item.plexKey,
            
            // Artwork
            artworkUrl: getArtworkUrl(item, baseUrl),
            localArtworkPath: item.localArtworkPath,
            originalArtworkUrl: item.originalArtworkUrl,
            
            // Episode-specific fields
            seriesTitle: item.seriesTitle,
            seasonNumber: item.seasonNumber,
            episodeNumber: item.episodeNumber,
            
            // Comic-specific fields
            comicSeries: item.comicSeries,
            comicYear: item.comicYear,
            comicIssue: item.comicIssue,
            comicPublisher: item.comicPublisher,
            comicIssueName: item.comicIssueName,
            comicDescription: item.comicDescription,
            comicWriter: item.comicWriter,
            comicCoverDate: item.comicCoverDate,
            
            // Book-specific fields
            bookTitle: item.bookTitle,
            bookAuthor: item.bookAuthor,
            bookYear: item.bookYear,
            bookPublisher: item.bookPublisher,
            bookPageCount: item.bookPageCount,
            bookCurrentPage: item.bookCurrentPage,
            bookPercentRead: item.bookPercentRead,
            
            // Short story-specific fields
            storyTitle: item.storyTitle,
            storyAuthor: item.storyAuthor,
            storyYear: item.storyYear,
            storyUrl: item.storyUrl,
            
            // Web video-specific fields
            webTitle: item.webTitle,
            webUrl: item.webUrl,
            webDescription: item.webDescription,
            
            // Sub-order reference
            referencedCustomOrderId: item.referencedCustomOrderId,
            referencedCustomOrder: item.referencedCustomOrder ? {
              id: item.referencedCustomOrder.id,
              name: item.referencedCustomOrder.name,
              icon: item.referencedCustomOrder.icon
            } : null
          };
          
          // Add unified book progress if available
          if (item.book) {
            try {
              const BookCompletionService = require('../../services/BookCompletionService');
              const completionService = new BookCompletionService(prisma);
              
              // Note: This is async but we'll handle it synchronously for now
              // In production, consider pre-calculating this or making the route handler fully async
              formattedItem.bookId = item.book.id;
              formattedItem.hasUnifiedProgress = true;
            } catch (error) {
              console.warn(`Error checking unified progress for item ${item.id}:`, error.message);
            }
          }
          
          return formattedItem;
        });
      
      // Calculate statistics
      const totalItems = items.length;
      const watchedItems = items.filter(item => item.isWatched).length;
      const unwatchedItems = totalItems - watchedItems;
      
      res.json({
        type: 'CUSTOM_ORDER_ITEMS',
        data: {
          customOrder: {
            id: customOrder.id,
            name: customOrder.name,
            description: customOrder.description,
            icon: customOrder.icon,
            createdAt: customOrder.createdAt,
            updatedAt: customOrder.updatedAt,
            playlistName: customOrder.plexPlaylist?.title || customOrder.customPlaylist?.name || null,
            playlistType: customOrder.plexPlaylist ? 'plex' : (customOrder.customPlaylist ? 'custom' : null),
            backgroundGalleryName: customOrder.backgroundGallery?.name || null
          },
          items,
          statistics: {
            totalItems,
            watchedItems,
            unwatchedItems,
            progressPercentage: totalItems > 0 ? Math.round((watchedItems / totalItems) * 100) : 0
          }
        }
      });
    } catch (error) {
      console.error('Error fetching custom order items for Android:', error);
      res.status(500).json({ 
        type: 'ERROR',
        data: { 
          error: 'Failed to fetch custom order items',
          message: error.message 
        } 
      });
    }
  });

  return router;
}

module.exports = createCustomOrdersRoutes;
