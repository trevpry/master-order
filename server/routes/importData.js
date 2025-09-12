const express = require('express');
const router = express.Router();
const HistoryDataImportService = require('../services/historyDataImportService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

/**
 * History Data Import Routes - Following Eddie's modular architecture
 * Handles importing PostgreSQL history data to Eddie tables
 */

// POST /api/import/history-data
router.post('/history-data', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['sourceFile']);
  
  const { sourceFile } = req.body;
  const importService = new HistoryDataImportService();
  
  try {
    const result = await importService.importFromPostgreSQL(sourceFile);
    await importService.disconnect();
    
    sendSuccess(res, {
      message: 'History data import completed successfully',
      summary: result
    });
  } catch (error) {
    await importService.disconnect();
    throw error;
  }
}));

// GET /api/import/history-status
router.get('/history-status', asyncHandler(async (req, res) => {
  const importService = new HistoryDataImportService();
  
  try {
    const summary = await importService.getImportSummary();
    await importService.disconnect();
    
    sendSuccess(res, {
      message: 'History data status retrieved',
      data: summary
    });
  } catch (error) {
    await importService.disconnect();
    throw error;
  }
}));

module.exports = router;