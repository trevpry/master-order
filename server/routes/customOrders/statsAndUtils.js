/**
 * Custom Orders Stats and Utility Routes
 * Handles count operations and parent order lookups
 */

const express = require('express');
const { asyncHandler } = require('../../utils/responses');

/**
 * Create stats and utility routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createStatsAndUtilsRoutes(prisma) {
  const router = express.Router();

  // Get count of all custom orders
  router.get('/count', asyncHandler(async (req, res) => {
    const count = await prisma.customOrder.count();
    res.json({ count });
  }));

  // Get available parent orders (excluding sub-orders and the specified order itself)
  router.get('/available-parents/:excludeId?', asyncHandler(async (req, res) => {
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
  }));

  return router;
}

module.exports = createStatsAndUtilsRoutes;
