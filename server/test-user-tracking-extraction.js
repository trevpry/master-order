const fs = require('fs');

function extractTableData(exportData, tableName) {
  const pattern = new RegExp(`COPY public\\.${tableName}[^\\n]*\\n([\\s\\S]*?)\\n\\\\\\.`, 'i');
  const match = exportData.match(pattern);
  
  if (!match || !match[1]) {
    return [];
  }
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'));
}

async function testUserTrackingExtraction() {
  try {
    const exportData = fs.readFileSync('C:\\Users\\Trevor\\AppData\\Local\\Temp\\master_order_export_20250912_115316.sql', 'utf8');
    
    console.log('🔍 Testing user tracking data extraction...\n');
    
    const videoWatches = extractTableData(exportData, 'user_video_watches');
    const bookReads = extractTableData(exportData, 'user_book_reads');
    const chapterReads = extractTableData(exportData, 'user_chapter_reads');
    const sectionReads = extractTableData(exportData, 'user_section_reads');
    const eventReviews = extractTableData(exportData, 'user_event_reviews');
    
    console.log(`🎬 Video Watches: ${videoWatches.length} records`);
    if (videoWatches.length > 0) {
      console.log('  Sample record:', videoWatches[0]);
    }
    
    console.log(`📚 Book Reads: ${bookReads.length} records`);
    if (bookReads.length > 0) {
      console.log('  Sample record:', bookReads[0]);
    }
    
    console.log(`📖 Chapter Reads: ${chapterReads.length} records`);
    if (chapterReads.length > 0) {
      console.log('  Sample record:', chapterReads[0]);
    }
    
    console.log(`📄 Section Reads: ${sectionReads.length} records`);
    if (sectionReads.length > 0) {
      console.log('  Sample record:', sectionReads[0]);
    }
    
    console.log(`📜 Event Reviews: ${eventReviews.length} records`);
    if (eventReviews.length > 0) {
      console.log('  Sample record:', eventReviews[0]);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

testUserTrackingExtraction();