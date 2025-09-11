const express = require('express');
const router = express.Router();

/**
 * SETTINGS LEGACY REDIRECTS
 * 
 * This module handles backward compatibility redirects for settings endpoints
 * that have been reorganized or moved to new URL structures.
 */

// ============================================================================
// 🔄 EDDIE SETTINGS LEGACY REDIRECTS
// ============================================================================

// Legacy redirect for eddie-settings GET endpoint
// OLD: /api/eddie-settings
// NEW: /api/settings/eddie
router.get('/eddie-settings', (req, res) => {
  console.log('🔄 [LEGACY REDIRECT] GET /api/eddie-settings -> /api/settings/eddie');
  res.redirect('/api/settings/eddie');
});

// Legacy redirect for eddie-settings PUT endpoint  
// OLD: /api/eddie-settings
// NEW: /api/settings/eddie
// Note: 307 status preserves the PUT method
router.put('/eddie-settings', (req, res) => {
  console.log('🔄 [LEGACY REDIRECT] PUT /api/eddie-settings -> /api/settings/eddie');
  res.redirect(307, '/api/settings/eddie'); // 307 preserves the PUT method
});

module.exports = router;
