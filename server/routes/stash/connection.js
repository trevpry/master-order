/**
 * Stash Connection Testing Routes
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * Handles connection testing and health checks for Stash integration
 */

const express = require('express');
const { prisma, getActiveSyncService, initializeStashSyncService } = require('./shared');
const { asyncHandler } = require('../../utils/responses');

const router = express.Router();

// GET /test - Test Stash connection and configuration
router.get('/test', asyncHandler(async (req, res) => {
  console.log('🧪 Testing Stash connection...');
  
  let stashSyncService = getActiveSyncService();
  if (!stashSyncService) {
    console.log('⚠️ StashSyncService not initialized, initializing now...');
    await initializeStashSyncService();
    stashSyncService = getActiveSyncService();
  }
  
  if (!stashSyncService) {
    console.log('❌ StashSyncService still not available after initialization');
    return res.status(400).json({ 
      success: false, 
      message: 'Stash sync service not configured',
      configured: false
    });
  }

  console.log('🔍 Calling stashSyncService.testConnection()...');
  const version = await stashSyncService.testConnection();
  console.log('✅ Stash connection test successful:', version);
  
  // Get the Stash URL from settings
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    
    // Prioritize database settings for API response
    const finalStashUrl = (settings?.stashUrl || process.env.STASH_URL || process.env.STASH_URL_FALLBACK_1 || 
                          process.env.STASH_URL_FALLBACK_2 || process.env.STASH_URL_FALLBACK_3)?.replace(/\/+$/, '');

    console.log('📋 Stash connection test results:', {
      success: true,
      version: version,
      finalStashUrl,
      hasApiKey: !!(settings?.stashApiKey)
    });
    
    res.json({ 
      success: true, 
      message: 'Stash connection successful',
      configured: true,
      version: version,
    url: finalStashUrl,
    hasApiKey: !!(settings?.stashApiKey)
  });
}));module.exports = router;
