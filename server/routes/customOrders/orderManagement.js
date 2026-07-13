/**
 * Custom Orders Management Routes
 * Handles core order CRUD operations: create, read, update, delete
 */

const express = require('express');

/**
 * Create order management routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createOrderManagementRoutes(prisma, services) {
  const router = express.Router();
  const { subOrderService } = services;

  // Get all custom orders
  router.get('/', async (req, res) => {
    try {
      const customOrders = await prisma.customOrder.findMany({
        include: {
          items: {
            include: {
              storyContainedInBook: true,
              containedStories: true,
              referencedCustomOrder: true, // Include referenced custom order for sub-order items
              book: { // Include unified book data
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
          parentOrder: true,
          plexPlaylist: true,
          customPlaylist: {
            include: {
              _count: {
                select: { tracks: true }
              }
            }
          },
          backgroundGallery: true,
          listScrapeConfig: {
            select: { id: true, name: true, isActive: true, url: true, parserType: true }
          },
          subOrders: {
            include: {
              items: {
                include: {
                  storyContainedInBook: true,
                  containedStories: true
                },
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      // Sync sub-order items for all parent orders (ensure consistency)
      for (const order of customOrders) {
        if (order.subOrders.length > 0) {
          await subOrderService.syncSubOrderItems(order.id);
        }
        
        // Transform custom playlist to include trackCount
        if (order.customPlaylist) {
          order.customPlaylist.trackCount = order.customPlaylist._count?.tracks || 0;
        }

        // Add unified progress data for book items
        for (const item of order.items) {
          if (item.book && (item.mediaType === 'book' || item.mediaType === 'comic' || item.mediaType === 'shortstory')) {
            try {
              // Import BookCompletionService to calculate progress
              const BookCompletionService = require('../../services/BookCompletionService');
              const completionService = new BookCompletionService();
              
              const progressReport = await completionService.getBookProgressReport(item.book.id);
              item.unifiedProgress = progressReport;
              
              console.log(`📊 Added unified progress for "${item.title}": ${progressReport?.percentageComplete || 0}%`);
            } catch (error) {
              console.error(`Error calculating progress for book item ${item.id}:`, error);
              item.unifiedProgress = { percentageComplete: 0 };
            }
          }
        }
      }
      
      res.json(customOrders);
    } catch (error) {
      console.error('Error fetching custom orders:', error);
      res.status(500).json({ error: 'Failed to fetch custom orders' });
    }
  });

  // Create a new custom order
  router.post('/', async (req, res) => {
    try {
      const { name, description, icon, parentOrderId, playlistRatingKey, customPlaylistId, backgroundGalleryId } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Custom order name is required' });
      }
      
      // Validate parent order exists if specified
      if (parentOrderId) {
        const parentOrder = await prisma.customOrder.findUnique({
          where: { id: parseInt(parentOrderId) }
        });
        if (!parentOrder) {
          return res.status(400).json({ error: 'Parent custom order not found' });
        }
      }
      
      // Validate playlist exists if specified
      if (playlistRatingKey) {
        const playlist = await prisma.plexPlaylist.findUnique({
          where: { ratingKey: playlistRatingKey }
        });
        if (!playlist) {
          return res.status(400).json({ error: 'Plex playlist not found' });
        }
      }
      
      if (customPlaylistId) {
        const playlist = await prisma.customPlaylist.findUnique({
          where: { id: parseInt(customPlaylistId) }
        });
        if (!playlist) {
          return res.status(400).json({ error: 'Custom playlist not found' });
        }
      }

      // Validate background gallery exists if specified
      if (backgroundGalleryId) {
        const gallery = await prisma.BackgroundGallery.findUnique({
          where: { id: parseInt(backgroundGalleryId) }
        });
        if (!gallery) {
          return res.status(400).json({ error: 'Background gallery not found' });
        }
      }
      
      const customOrder = await prisma.customOrder.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          icon: icon?.trim() || null,
          parentOrderId: parentOrderId ? parseInt(parentOrderId) : null,
          playlistRatingKey: playlistRatingKey?.trim() || null,
          customPlaylistId: customPlaylistId ? parseInt(customPlaylistId) : null,
          backgroundGalleryId: backgroundGalleryId ? parseInt(backgroundGalleryId) : null
        },
        include: {
          parentOrder: true,
          subOrders: true,
          plexPlaylist: true,
          customPlaylist: true,
          backgroundGallery: true
        }
      });
      
      // If this order has a parent, create a sub-order item in the parent
      if (parentOrderId) {
        await subOrderService.createSubOrderItems(customOrder.id, parseInt(parentOrderId));
      }
      
      res.status(201).json(customOrder);
    } catch (error) {
      console.error('Error creating custom order:', error);
      res.status(500).json({ error: 'Failed to create custom order' });
    }
  });

  // Get a specific custom order
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const itemInclude = {
        storyContainedInBook: true,
        containedStories: true,
        referencedCustomOrder: true, // Include referenced custom order for sub-order items
        book: { // Include unified book data for cover and details
          include: {
            bookCompletions: true
          }
        }
      };

      const customOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: itemInclude,
            orderBy: { sortOrder: 'asc' }
          },
          plexPlaylist: true,
          customPlaylist: true,
          backgroundGallery: true
        }
      });
      
      if (!customOrder) {
        return res.status(404).json({ error: 'Custom order not found' });
      }
      
      // Sync sub-order items if this is a parent order
      const hasSubOrders = await prisma.customOrder.count({
        where: { parentOrderId: parseInt(id) }
      });
      
      if (hasSubOrders > 0) {
        await subOrderService.syncSubOrderItems(parseInt(id));
        
        // Re-fetch the order with updated sub-order items
        const updatedOrder = await prisma.customOrder.findUnique({
          where: { id: parseInt(id) },
          include: {
            items: {
              include: itemInclude,
              orderBy: { sortOrder: 'asc' }
            },
            backgroundGallery: true
          }
        });
        
        res.json(updatedOrder);
      } else {
        res.json(customOrder);
      }
    } catch (error) {
      console.error('Error fetching custom order:', error);
      res.status(500).json({ error: 'Failed to fetch custom order' });
    }
  });

  // Update a custom order
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, isActive, icon, parentOrderId, playlistRatingKey, customPlaylistId, backgroundGalleryId } = req.body;
      
      // Get current order to check for parent changes
      const currentOrder = await prisma.customOrder.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!currentOrder) {
        return res.status(404).json({ error: 'Custom order not found' });
      }
      
      // Validate parent order exists if specified
      if (parentOrderId !== undefined && parentOrderId !== null) {
        // Prevent circular references
        if (parseInt(parentOrderId) === parseInt(id)) {
          return res.status(400).json({ error: 'A custom order cannot be its own parent' });
        }
        
        const parentOrder = await prisma.customOrder.findUnique({
          where: { id: parseInt(parentOrderId) }
        });
        if (!parentOrder) {
          return res.status(400).json({ error: 'Parent custom order not found' });
        }
        
        // Check for circular reference (if parent has this order as its parent)
        if (parentOrder.parentOrderId === parseInt(id)) {
          return res.status(400).json({ error: 'Cannot create circular parent-child relationship' });
        }
      }
      
      // Validate playlist exists if specified
      if (playlistRatingKey !== undefined && playlistRatingKey !== null) {
        const playlist = await prisma.plexPlaylist.findUnique({
          where: { ratingKey: playlistRatingKey }
        });
        if (!playlist) {
          return res.status(400).json({ error: 'Plex playlist not found' });
        }
      }
      
      if (customPlaylistId !== undefined && customPlaylistId !== null) {
        const playlist = await prisma.customPlaylist.findUnique({
          where: { id: parseInt(customPlaylistId) }
        });
        if (!playlist) {
          return res.status(400).json({ error: 'Custom playlist not found' });
        }
      }

      // Validate background gallery exists if specified
      if (backgroundGalleryId !== undefined && backgroundGalleryId !== null) {
        const gallery = await prisma.BackgroundGallery.findUnique({
          where: { id: parseInt(backgroundGalleryId) }
        });
        if (!gallery) {
          return res.status(400).json({ error: 'Background gallery not found' });
        }
      }
      
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (icon !== undefined) updateData.icon = icon?.trim() || null;
      if (parentOrderId !== undefined) updateData.parentOrderId = parentOrderId ? parseInt(parentOrderId) : null;
      if (playlistRatingKey !== undefined) updateData.playlistRatingKey = playlistRatingKey?.trim() || null;
      if (customPlaylistId !== undefined) updateData.customPlaylistId = customPlaylistId ? parseInt(customPlaylistId) : null;
      if (backgroundGalleryId !== undefined) updateData.backgroundGalleryId = backgroundGalleryId ? parseInt(backgroundGalleryId) : null;

      const customOrder = await prisma.customOrder.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          items: {
            include: {
              storyContainedInBook: true,
              containedStories: true,
              referencedCustomOrder: true // Include referenced custom order for sub-order items
            },
            orderBy: { sortOrder: 'asc' }
          },
          parentOrder: true,
          plexPlaylist: true,
          customPlaylist: true,
          backgroundGallery: true,
          subOrders: {
            include: {
              items: {
                include: {
                  storyContainedInBook: true,
                  containedStories: true
                },
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });
      
      // Handle parent order changes
      const oldParentId = currentOrder.parentOrderId;
      const newParentId = parentOrderId !== undefined ? (parentOrderId ? parseInt(parentOrderId) : null) : oldParentId;
      
      if (oldParentId !== newParentId) {
        // Remove from old parent if it had one
        if (oldParentId) {
          await subOrderService.removeSubOrderItems(parseInt(id));
        }
        
        // Add to new parent if it has one
        if (newParentId) {
          await subOrderService.createSubOrderItems(parseInt(id), newParentId);
        }
      } else if (newParentId) {
        // If parent didn't change but we have a parent, update the sub-order item
        await subOrderService.updateSubOrderItems(parseInt(id));
      }
      
      res.json(customOrder);
    } catch (error) {
      console.error('Error updating custom order:', error);
      res.status(500).json({ error: 'Failed to update custom order' });
    }
  });

  // Delete a custom order
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Remove any sub-order items that reference this order
      await subOrderService.removeSubOrderItems(parseInt(id));
      
      await prisma.customOrder.delete({
        where: { id: parseInt(id) }
      });
      res.json({ message: 'Custom order deleted successfully' });
    } catch (error) {
      console.error('Error deleting custom order:', error);
      res.status(500).json({ error: 'Failed to delete custom order' });
    }
  });

  return router;
}

module.exports = createOrderManagementRoutes;
