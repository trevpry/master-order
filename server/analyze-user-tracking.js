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

async function analyzeUserTrackingData() {
  try {
    const exportData = fs.readFileSync('C:\\Users\\Trevor\\AppData\\Local\\Temp\\master_order_export_20250912_115316.sql', 'utf8');
    
    const videoWatches = extractTableData(exportData, 'user_video_watches');
    const bookReads = extractTableData(exportData, 'user_book_reads');
    const chapterReads = extractTableData(exportData, 'user_chapter_reads');
    const sectionReads = extractTableData(exportData, 'user_section_reads');
    const eventReviews = extractTableData(exportData, 'user_event_reviews');
    
    console.log('📊 User Tracking Data Available:');
    console.log(`🎬 Video Watches: ${videoWatches.length}`);
    console.log(`📚 Book Reads: ${bookReads.length}`);
    console.log(`📖 Chapter Reads: ${chapterReads.length}`);
    console.log(`📄 Section Reads: ${sectionReads.length}`);
    console.log(`📜 Event Reviews: ${eventReviews.length}`);
    
    // Find the admin user ID from the data
    console.log('\n🔍 Sample User IDs:');
    if (videoWatches.length > 0) {
      const [id, userId] = videoWatches[0].split('\t');
      console.log(`  Admin User ID (from video watches): ${userId}`);
    }
    
    // Sample some tracking data
    if (videoWatches.length > 0) {
      console.log('\n🎬 Sample Video Watches:');
      for (let i = 0; i < Math.min(3, videoWatches.length); i++) {
        const [id, userId, videoId, watched, watchedAt] = videoWatches[i].split('\t');
        console.log(`  VideoID: ${videoId}, Watched: ${watched}, WatchedAt: ${watchedAt}`);
      }
    }
    
    if (bookReads.length > 0) {
      console.log('\n📚 Sample Book Reads:');
      for (let i = 0; i < Math.min(3, bookReads.length); i++) {
        const [id, userId, bookId, read, readAt] = bookReads[i].split('\t');
        console.log(`  BookID: ${bookId}, Read: ${read}, ReadAt: ${readAt}`);
      }
    }
    
    if (eventReviews.length > 0) {
      console.log('\n📜 Sample Event Reviews:');
      for (let i = 0; i < Math.min(3, eventReviews.length); i++) {
        const [id, userId, eventId, reviewed, reviewedAt] = eventReviews[i].split('\t');
        console.log(`  EventID: ${eventId}, Reviewed: ${reviewed}, ReviewedAt: ${reviewedAt}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeUserTrackingData();