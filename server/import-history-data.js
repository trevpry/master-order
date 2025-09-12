// History Data Import Script - Following Eddie's modular architecture
// Executes the import using the service layer

const HistoryDataImportService = require('./services/historyDataImportService');
const path = require('path');

async function runImport() {
  const exportFile = process.env.TEMP + '\\master_order_export_20250912_115316.sql';
  
  console.log('🚀 Starting History Data Import Process');
  console.log('📁 Source file:', exportFile);
  console.log('🎯 Target: Eddie Life Management Database');
  console.log('');
  
  const importService = new HistoryDataImportService();
  
  try {
    const result = await importService.importFromPostgreSQL(exportFile);
    console.log('');
    console.log('✅ Import completed successfully!');
    console.log('📊 Final Summary:', result);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await importService.disconnect();
  }
}

// Execute the import
runImport();