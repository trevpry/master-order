/**
 * Custom Orders Stats and Utility Routes
 * Handles count operations and parent order lookups
 */

const express = require('express');

/**
 * Create stats and utility routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createStatsAndUtilsRoutes(prisma) {
  const router = express.Router();

  // Get count of all custom orders
  router.get('/count', async (req, res) => {
    try {
      const count = await prisma.customOrder.count();
      res.json({ count });
    } catch (error) {
      console.error('Error counting custom orders:', error);
      res.status(500).json({ error: 'Failed to count custom orders' });
    }
  });

  // Get available parent orders (excluding sub-orders and the specified order itself)
  router.get('/available-parents/:excludeId?', async (req, res) => {
    try {
      const { excludeId } = req.params;
      
      const whereCondition = {
        parentOrderId: null // Only top-level orders can be parents
      };
      
      // Exclude the specified order if provided (prevent self-reference)
      if (excludeId) {
        whereCondition.id = { not: parseInt(excludeId) };
      }
      
      const availableParents = await prisma.customOrder.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          description: true,
          icon: true
        },
        orderBy: { name: 'asc' }
      });
      
      res.json(availableParents);
    } catch (error) {
      console.error('Error fetching available parent orders:', error);
      res.status(500).json({ error: 'Failed to fetch available parent orders' });
    }
  });

  return router;
}

module.exports = createStatsAndUtilsRoutes;
