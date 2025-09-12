/**
 * Watch Status Check Script
 * Uses WatchStatusImportService following modular architecture patterns
 */

const WatchStatusImportService = require('./services/WatchStatusImportService');
const path = require('path');

async function main() {
  const importService = new WatchStatusImportService();
  
  try {
    console.log('🎬 Eddie Life Management - Watch Status Check\n');
    
    // Check current status
    console.log('📊 Current watch status statistics:');
    const stats = await importService.getWatchStatusStats();
    console.log(`   Total videos: ${stats.totalVideos}`);
    console.log(`   Watched videos: ${stats.watchedVideos}`);
    console.log(`   Missing watched videos: ${311 - stats.watchedVideos}`);
    console.log(`   Unwatched videos: ${stats.unwatchedVideos}\n`);
    
    // Show sample video URLs
    console.log('🔍 Sample video URLs in Eddie database:');
    const sampleUrls = await importService.getSampleVideoUrls(5);
    sampleUrls.forEach(video => {
      const status = video.watched ? '✅ Watched' : '⏳ Unwatched';
      console.log(`   ${status} | "${video.title}"`);
      console.log(`     URL: ${video.url}\n`);
    });
    
    console.log('📍 Ready to run watch status analysis.');
    console.log('🚀 Use the WatchStatusImportService to perform imports.\n');
    
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