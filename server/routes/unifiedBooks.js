const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');

// POST /api/unified-books/import
router.post('/import', asyncHandler(async (req, res) => {
  console.log('🔄 Starting unified books import via API...');
  
  const { force = false, useUploaded = false } = req.body;
  
  let exportDir;
  
  if (useUploaded) {
    // Use uploaded files from temp directory
    const tempDir = path.join(__dirname, '..', 'temp-uploads');
    const sessionFile = path.join(tempDir, 'upload-session.json');
    
    if (!fs.existsSync(sessionFile)) {
      return sendBadRequest(res, 'No uploaded files found. Please upload CSV files first.');
    }
    
    try {
      console.log('📖 Reading session file...');
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      exportDir = sessionData.directory;
      
      if (!sessionData.ready || sessionData.missingFiles.length > 0) {
        return sendBadRequest(res, `Cannot import: missing required files: ${sessionData.missingFiles.join(', ')}`);
      }
      
      console.log(`📂 Using uploaded files from: ${exportDir}`);
    } catch (error) {
      console.log('❌ Error reading session data:', error.message);
      return sendBadRequest(res, 'Failed to read upload session data.');
    }
  } else {
    // Use traditional mounted directory
    exportDir = path.join(__dirname, '..', '..', 'history-plus-export');
    
    if (!fs.existsSync(exportDir)) {
      return sendBadRequest(res, 'History Plus export directory not found. Please ensure CSV files are available or use file upload.');
    }
    
    console.log(`📂 Using mounted directory: ${exportDir}`);
  }
  
  // Check if CSV files exist
  const csvFiles = fs.readdirSync(exportDir).filter(file => file.endsWith('.csv'));
  if (csvFiles.length === 0) {
    return sendBadRequest(res, 'No CSV files found in directory.');
  }
  
  try {
    // Use the new unified books import service
    const UnifiedBooksImportService = require('../services/unifiedBooksImportService');
    const importService = new UnifiedBooksImportService({
      importDir: exportDir,
      force: force
    });
    
    console.log('🚀 Starting unified books import...');
    await importService.importAll();
    
    // Clean up uploaded files if this was an upload-based import
    if (useUploaded) {
      try {
        const tempDir = path.join(__dirname, '..', 'temp-uploads');
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          let cleanedCount = 0;
          files.forEach(file => {
            try {
              const filePath = path.join(tempDir, file);
              fs.unlinkSync(filePath);
              cleanedCount++;
            } catch (fileError) {
              console.warn(`⚠️ Failed to delete file ${file}:`, fileError.message);
            }
          });
          console.log(`🧹 Cleaned up ${cleanedCount} uploaded files`);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up uploaded files:', cleanupError.message);
      }
    }
    
    const result = {
      success: true,
      message: 'Books imported successfully to unified Books system',
      csvFiles: csvFiles.length,
      force: force,
      source: useUploaded ? 'uploaded' : 'mounted',
      statistics: {
        booksImported: importService.stats.booksImported,
        chaptersImported: importService.stats.chaptersImported,
        sectionsImported: importService.stats.sectionsImported,
        booksSkipped: importService.stats.booksSkipped,
        chaptersSkipped: importService.stats.chaptersSkipped,
        sectionsSkipped: importService.stats.sectionsSkipped,
        errors: importService.stats.errors.length
      },
      errors: importService.stats.errors,
      note: 'Books imported directly to unified Books system - no History Plus migration needed!'
    };
    
    console.log('✅ Unified books import completed successfully');
    sendSuccess(res, result);
    
  } catch (error) {
    console.error('❌ Import process error:', error);
    sendServerError(res, 'Import process failed', error.message);
  }
}));

module.exports = router;