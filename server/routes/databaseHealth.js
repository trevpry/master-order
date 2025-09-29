const express = require('express');
const router = express.Router();
const VideoScraperService = require('../services/VideoScraperService');

const scraperService = new VideoScraperService();

/**
 * SAFE endpoint to check database sequence health
 * READ-ONLY operation - guaranteed zero data loss risk
 */
router.get('/sequence-health', async (req, res) => {
  try {
    console.log('🔍 Database sequence health check requested via API');
    
    const healthCheck = await scraperService.checkDatabaseSequenceHealth();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...healthCheck
    });
    
  } catch (error) {
    console.error('❌ Database health check API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * MANUAL sequence repair endpoint - requires explicit confirmation
 * Only use after verifying the health check results
 */
router.post('/repair-sequence', async (req, res) => {
  try {
    const { confirmSafeToFix } = req.body;
    
    if (!confirmSafeToFix) {
      return res.status(400).json({
        success: false,
        error: 'Safety confirmation required',
        message: 'Set confirmSafeToFix=true in request body to proceed with repair',
        recommendation: 'First check /api/database-health/sequence-health to verify repair is needed'
      });
    }
    
    console.log('🔧 Manual sequence repair requested via API');
    
    const repairResult = await scraperService.repairDatabaseSequence(true);
    
    const statusCode = repairResult.success ? 200 : 400;
    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      ...repairResult
    });
    
  } catch (error) {
    console.error('❌ Database repair API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * EMERGENCY sequence reset - for immediate production issues
 * Use this when normal repair fails and you need immediate results
 */
router.post('/emergency-reset', async (req, res) => {
  try {
    const { confirmEmergency } = req.body;
    
    if (!confirmEmergency) {
      return res.status(400).json({
        success: false,
        error: 'Emergency confirmation required',
        message: 'Set confirmEmergency=true in request body to proceed with emergency reset',
        warning: 'This bypasses safety checks and directly resets the sequence'
      });
    }
    
    console.log('🚨 EMERGENCY sequence reset requested via API');
    
    const resetResult = await scraperService.emergencySequenceReset();
    
    const statusCode = resetResult.success ? 200 : 500;
    res.status(statusCode).json({
      timestamp: new Date().toISOString(),
      emergency: true,
      ...resetResult
    });
    
  } catch (error) {
    console.error('❌ Emergency reset API error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      emergency: true
    });
  }
});

/**
 * DIRECT fix for production - bypasses all analysis and just fixes the sequence
 */
router.post('/direct-fix', async (req, res) => {
  try {
    console.log('🔧 DIRECT sequence fix requested - bypassing analysis');
    
    const prisma = require('../prismaClient');
    
    // Get max ID directly
    const maxIdResult = await prisma.historyVideo.aggregate({
      _max: { id: true }
    });
    
    const maxId = maxIdResult._max.id || 0;
    const safeNextValue = maxId + 1;
    
    console.log(`📊 Direct fix: Max ID = ${maxId}, Setting sequence to ${safeNextValue}`);
    
    // PostgreSQL direct sequence fix
    await prisma.$executeRaw`
      SELECT setval(pg_get_serial_sequence('"HistoryVideo"', 'id'), ${safeNextValue}, false)
    `;
    
    console.log('✅ Direct sequence fix completed');
    
    res.json({
      success: true,
      method: 'direct-fix',
      maxId,
      nextValue: safeNextValue,
      message: `Sequence fixed directly. Next ID will be: ${safeNextValue}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Direct fix failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      method: 'direct-fix',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;