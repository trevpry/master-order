const prisma = require('./prismaClient');

class SubOrderService {
  // Create sub-order items in parent orders when orders become sub-orders
  async createSubOrderItems(subOrderId, parentOrderId) {
    try {
      console.log(`Creating sub-order item for order ${subOrderId} in parent ${parentOrderId}`);
      
      // Get sub-order details
      const subOrder = await prisma.customOrder.findUnique({
        where: { id: subOrderId },
        include: { items: true }
      });
      
      if (!subOrder) {
        throw new Error('Sub-order not found');
      }
      
      // Check if sub-order item already exists in parent
      const existingSubOrderItem = await prisma.customOrderItem.findFirst({
        where: {
          customOrderId: parentOrderId,
          mediaType: 'suborder',
          referencedCustomOrderId: subOrderId
        }
      });
      
      if (existingSubOrderItem) {
        console.log('Sub-order item already exists in parent');
        return existingSubOrderItem;
      }
      
      // Get the highest sort order for the parent order
      const lastItem = await prisma.customOrderItem.findFirst({
        where: { customOrderId: parentOrderId },
        orderBy: { sortOrder: 'desc' }
      });
      
      const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 0;
      
      // Create the sub-order item
      const subOrderItem = await prisma.customOrderItem.create({
        data: {
          customOrderId: parentOrderId,
          mediaType: 'suborder',
          plexKey: `suborder-${subOrderId}`,
          title: subOrder.name,
          sortOrder: nextSortOrder,
          referencedCustomOrderId: subOrderId,
          isWatched: this.isSubOrderFullyWatched(subOrder)
        }
      });
      
      console.log(`Created sub-order item: ${subOrder.name} in parent order`);
      return subOrderItem;
    } catch (error) {
      console.error('Error creating sub-order item:', error);
      throw error;
    }
  }
  
  // Remove sub-order items when orders are no longer sub-orders
  async removeSubOrderItems(subOrderId) {
    try {
      console.log(`Removing sub-order items for order ${subOrderId}`);
      
      await prisma.customOrderItem.deleteMany({
        where: {
          mediaType: 'suborder',
          referencedCustomOrderId: subOrderId
        }
      });
      
      console.log(`Removed sub-order items for order ${subOrderId}`);
    } catch (error) {
      console.error('Error removing sub-order items:', error);
      throw error;
    }
  }
  
  // Update sub-order items when sub-order changes
  async updateSubOrderItems(subOrderId) {
    try {
      console.log(`Updating sub-order items for order ${subOrderId}`);
      
      // Get sub-order details
      const subOrder = await prisma.customOrder.findUnique({
        where: { id: subOrderId },
        include: { items: true }
      });
      
      if (!subOrder) {
        console.log('Sub-order not found, skipping update');
        return;
      }
      
      // Find all sub-order items that reference this order
      const subOrderItems = await prisma.customOrderItem.findMany({
        where: {
          mediaType: 'suborder',
          referencedCustomOrderId: subOrderId
        }
      });
      
      // Update each sub-order item
      for (const subOrderItem of subOrderItems) {
        await prisma.customOrderItem.update({
          where: { id: subOrderItem.id },
          data: {
            title: subOrder.name,
            isWatched: this.isSubOrderFullyWatched(subOrder)
          }
        });
      }
      
      console.log(`Updated ${subOrderItems.length} sub-order items`);
    } catch (error) {
      console.error('Error updating sub-order items:', error);
      throw error;
    }
  }
  
  // Check if a sub-order is fully watched
  isSubOrderFullyWatched(subOrder) {
    if (!subOrder.items || subOrder.items.length === 0) {
      return false; // Empty orders are not considered watched
    }
    
    // Only count non-reference items (exclude books that are just for containing stories)
    const nonReferenceItems = subOrder.items.filter(item => 
      !(item.mediaType === 'book' && item.containedStories && item.containedStories.length > 0)
    );
    
    if (nonReferenceItems.length === 0) {
      return false; // No countable items
    }
    
    return nonReferenceItems.every(item => item.isWatched);
  }
  
  // Get next unwatched item from a sub-order
  async getNextUnwatchedFromSubOrder(subOrderId) {
    try {
      const subOrder = await prisma.customOrder.findUnique({
        where: { id: subOrderId },
        include: {
          items: {
            where: { 
              isWatched: false,
              // Exclude reference books that only contain stories
              NOT: {
                AND: [
                  { mediaType: 'book' },
                  { containedStories: { some: {} } }
                ]
              }
            },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      
      if (!subOrder || !subOrder.items || subOrder.items.length === 0) {
        return null;
      }
      
      return {
        item: subOrder.items[0],
        sourceOrder: subOrder
      };
    } catch (error) {
      console.error('Error getting next unwatched from sub-order:', error);
      throw error;
    }
  }
  
  // Sync all sub-order items when a parent order is created or updated
  async syncSubOrderItems(parentOrderId) {
    try {
      console.log(`Syncing sub-order items for parent order ${parentOrderId}`);
      
      const parentOrder = await prisma.customOrder.findUnique({
        where: { id: parentOrderId },
        include: {
          subOrders: {
            include: { items: true }
          },
          items: {
            where: { mediaType: 'suborder' }
          }
        }
      });
      
      if (!parentOrder) {
        return;
      }
      
      // Get current sub-order items
      const currentSubOrderItems = parentOrder.items;
      
      // Create sub-order items for any missing sub-orders
      for (const subOrder of parentOrder.subOrders) {
        const existingItem = currentSubOrderItems.find(item => 
          item.referencedCustomOrderId === subOrder.id
        );
        
        if (!existingItem) {
          await this.createSubOrderItems(subOrder.id, parentOrderId);
        }
      }
      
      // Remove sub-order items for orders that are no longer sub-orders
      for (const subOrderItem of currentSubOrderItems) {
        const stillExists = parentOrder.subOrders.find(subOrder => 
          subOrder.id === subOrderItem.referencedCustomOrderId
        );
        
        if (!stillExists) {
          await prisma.customOrderItem.delete({
            where: { id: subOrderItem.id }
          });
        }
      }
      
      console.log(`Synced sub-order items for parent order ${parentOrderId}`);
    } catch (error) {
      console.error('Error syncing sub-order items:', error);
      throw error;
    }
  }
}

module.exports = new SubOrderService();
