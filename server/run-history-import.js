const fs = require('fs');
const path = require('path');
const HistoryDataImportService = require('./services/historyDataImportService');

async function runHistoryImport() {
  try {
    console.log('🚀 Starting History Data Import Process...\n');
    
    // PostgreSQL export file path (we already have this from earlier analysis)
    const exportFilePath = 'C:\\Users\\Trevor\\AppData\\Local\\Temp\\master_order_export_20250912_115316.sql';
    
    if (!fs.existsSync(exportFilePath)) {
      console.error('❌ Export file not found at:', exportFilePath);
      process.exit(1);
    }
    
    console.log('📂 Using export file:', exportFilePath);
    
    // Initialize the import service
    const importService = new HistoryDataImportService();
    
    // Run the complete import process with the file path
    await importService.importFromPostgreSQL(exportFilePath);
    
    console.log('\n🎉 History data import completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
runHistoryImport();