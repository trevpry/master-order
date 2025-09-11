/**
 * Core Debug Routes
 * Handles debug utilities and system diagnostics
 */

const express = require('express');

/**
 * Create debug routes
 * @param {PrismaClient} prisma - Database client instance
 * @returns {express.Router} Configured router
 */
function createDebugRoutes(prisma) {
  const router = express.Router();
  
  // Initialize dependencies
  const plexDb = require('../../plexDatabaseService');

  // Debug endpoint to check Plex library sections
  router.get('/api/debug/sections', async (req, res) => {
    try {
      const sections = await plexDb.getLibrarySections();
      
      res.json({
        totalSections: sections.length,
        sections: sections.map(section => ({
          key: section.key,
          title: section.title,
          type: section.type,
          scanner: section.scanner
        }))
      });
    } catch (error) {
      console.error('Error getting Plex sections:', error);
      res.status(500).json({ error: 'Failed to get Plex sections' });
    }
  });

  // Debug endpoint to fix webvideo completion status
  router.post('/api/debug/fix-webvideo-completion', async (req, res) => {
    try {
      // Update webvideo sessions that have endTime but aren't marked as completed
      const result = await prisma.watchLog.updateMany({
        where: {
          mediaType: 'webvideo',
          endTime: { not: null },
          isCompleted: false
        },
        data: {
          isCompleted: true
        }
      });
      
      res.json({
        message: 'Fixed webvideo completion status',
        updated: result.count
      });
    } catch (error) {
      console.error('Error fixing webvideo completion:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Debug endpoint to check webvideo sessions
  router.get('/api/debug/webvideo-sessions', async (req, res) => {
    try {
      const sessions = await prisma.watchLog.findMany({
        where: {
          mediaType: 'webvideo'
        },
        orderBy: {
          startTime: 'desc'
        }
      });
      
      res.json({
        count: sessions.length,
        sessions: sessions
      });
    } catch (error) {
      console.error('Error getting webvideo sessions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = createDebugRoutes;
