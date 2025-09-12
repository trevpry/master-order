/**
 * Import Watch Status - Final Script
 * Uses WatchStatusImportService to import missing watched video statuses
 */

const WatchStatusImportService = require('./services/WatchStatusImportService');
const path = require('path');

async function main() {
  const importService = new WatchStatusImportService();
  
  try {
    console.log('🎬 Eddie Life Management - Watch Status Import\n');
    
    // Check current status
    console.log('📊 BEFORE Import - Current watch status:');
    const beforeStats = await importService.getWatchStatusStats();
    console.log(`   Total videos: ${beforeStats.totalVideos}`);
    console.log(`   Watched videos: ${beforeStats.watchedVideos}`);
    console.log(`   Missing watched videos: ${311 - beforeStats.watchedVideos}`);
    console.log(`   Target: 311 watched videos\n`);
    
    // Perform import
    const exportPath = path.join(__dirname, '..', 'history_plus_export.sql');
    console.log('🚀 Starting import from PostgreSQL export...');
    console.log(`📂 Export file: ${exportPath}\n`);
    
    const importResult = await importService.importFromPostgreSQLExport(exportPath);
    
    console.log('\n📊 Import Results:');
    console.log(`   Total URLs processed: ${importResult.totalUrls}`);
    console.log(`   Videos matched in Eddie: ${importResult.matched}`);
    console.log(`   New watch records created: ${importResult.created}`);
    console.log(`   Existing records updated: ${importResult.updated}`);
    console.log(`   URLs not found in Eddie: ${importResult.notFound}`);
    
    // Check final status
    console.log('\n📊 AFTER Import - Final watch status:');
    const afterStats = await importService.getWatchStatusStats();
    console.log(`   Total videos: ${afterStats.totalVideos}`);
    console.log(`   Watched videos: ${afterStats.watchedVideos}`);
    console.log(`   Improvement: +${afterStats.watchedVideos - beforeStats.watchedVideos} watched videos`);
    console.log(`   Remaining missing: ${311 - afterStats.watchedVideos}`);
    
    if (afterStats.watchedVideos >= 311) {
      console.log('\n🎉 SUCCESS! Reached target of 311+ watched videos!');
    } else {
      console.log(`\n⚠️  Still ${311 - afterStats.watchedVideos} videos short of target (311)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await importService.disconnect();
  }
}

// Run the script
if (require.main === module) {
  main();
}