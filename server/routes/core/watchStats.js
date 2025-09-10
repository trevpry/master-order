/**
 * Core Watch Stats Routes
 * Handles watch statistics, logs, and activity tracking
 */

const express = require('express');
const { asyncHandler } = require('../../utils/responses');

/**
 * Create watch stats routes
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createWatchStatsRoutes(prisma, services) {
  const router = express.Router();
  
  // Initialize dependencies
  const { watchStatsRoutes } = services;
  const watchLogService = require('../../watchLogService');

  // ==================== WATCH STATISTICS ENDPOINTS ====================

  // Get watch statistics with flexible date filtering
  router.get('/api/watch-stats', watchStatsRoutes.getWatchStats.bind(watchStatsRoutes));

  // Get recent watch activity
  router.get('/api/watch-stats/recent', watchStatsRoutes.getRecentActivity.bind(watchStatsRoutes));

  // Get today's watch statistics
  router.get('/api/watch-stats/today', watchStatsRoutes.getTodayStats.bind(watchStatsRoutes));

  // Get custom order statistics
  router.get('/api/watch-stats/custom-orders', watchStatsRoutes.getCustomOrderStats.bind(watchStatsRoutes));

  // Get media type specific statistics
  router.get('/api/watch-stats/media-type/:mediaType', watchStatsRoutes.getMediaTypeStats.bind(watchStatsRoutes));

  // Get all activity across all media types
  router.get('/api/watch-stats/all-activity', watchStatsRoutes.getAllActivity.bind(watchStatsRoutes));

  // ==================== WATCH LOG ENDPOINTS ====================

  // Manual watch log entry (for items not automatically tracked)
  router.post('/api/watch-logs', asyncHandler(async (req, res) => {
    const watchLogData = req.body;
    const watchLog = await watchLogService.logWatched(watchLogData);
    res.json(watchLog);
  }));

  // Delete a watch log entry
  router.delete('/api/watch-logs/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deletedLog = await watchLogService.deleteWatchLog(id);
    res.json({ success: true, deletedLog, message: 'Watch log entry deleted successfully' });
  }));

  return router;
}

module.exports = createWatchStatsRoutes;
