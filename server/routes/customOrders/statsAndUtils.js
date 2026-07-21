/**
 * Custom Orders Stats and Utility Routes
 * Handles count operations and parent order lookups
 */

const express = require('express');
const CustomOrderArrBackfillService = require('../../services/customOrderArrBackfillService');

/**
 * Create stats and utility routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createStatsAndUtilsRoutes(prisma) {
  const router = express.Router();
  const backfillService = new CustomOrderArrBackfillService();

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

  // Backfill existing custom-order movie/episode items with ARR linkage.
  // Defaults to dry-run mode unless dryRun=false is explicitly provided.
  router.post('/arr-backfill', async (req, res) => {
    try {
      const parsedCustomOrderId = req.body?.customOrderId != null
        ? parseInt(req.body.customOrderId, 10)
        : null;
      const parsedLimit = req.body?.limit != null ? parseInt(req.body.limit, 10) : 1000;
      const dryRun = req.body?.dryRun !== false;
      const includeAlreadyLinked = req.body?.includeAlreadyLinked === true;

      const result = await backfillService.backfill({
        dryRun,
        customOrderId: Number.isInteger(parsedCustomOrderId) ? parsedCustomOrderId : null,
        limit: Number.isInteger(parsedLimit) ? parsedLimit : 1000,
        includeAlreadyLinked,
      });

      res.json({
        success: true,
        message: dryRun
          ? 'ARR backfill dry-run completed'
          : 'ARR backfill completed and updates applied',
        ...result,
      });
    } catch (error) {
      console.error('Error running ARR backfill for custom-order items:', error);
      res.status(500).json({ error: 'Failed to run ARR backfill' });
    }
  });

  return router;
}

module.exports = createStatsAndUtilsRoutes;
