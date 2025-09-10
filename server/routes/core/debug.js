/**
 * Core Debug Routes
 * Handles debug utilities and system diagnostics
 */

const express = require('express');
const { asyncHandler } = require('../../utils/responses');

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
  router.get('/api/debug/sections', asyncHandler(async (req, res) => {
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
  }));

  // Debug endpoint to fix webvideo completion status
  router.post('/api/debug/fix-webvideo-completion', asyncHandler(async (req, res) => {
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
  }));

  // Debug endpoint to check webvideo sessions
  router.get('/api/debug/webvideo-sessions', asyncHandler(async (req, res) => {
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
  }));

  return router;
}

module.exports = createDebugRoutes;
