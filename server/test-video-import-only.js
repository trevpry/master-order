const HistoryPlusDataImporter = require('./import-history-plus-data');

async function testVideoImportOnly() {
  try {
    console.log('🔍 Testing video import only...');
    
    const importer = new HistoryPlusDataImporter({ clearExisting: false });
    await importer.initialize();
    
    // Import only videos (events should already exist)
    console.log('📥 Importing videos only...');
    await importer.importHistoryVideos();
    
    // Check results
    const videoCount = await importer.targetPrisma.historyVideo.count();
    console.log(`✅ Videos created: ${videoCount}`);
    
    if (videoCount > 0) {
      // Check for videos with eventId
      const videosWithEventId = await importer.targetPrisma.historyVideo.findMany({
        where: {
          eventId: { not: null }
        },
        take: 5,
        select: { id: true, title: true, eventId: true }
      });
      
      console.log('\nVideos with eventId:');
      videosWithEventId.forEach(video => {
        console.log(`   ${video.id}: ${video.title} (eventId: ${video.eventId})`);
      });
      
      // Check for our target video 4515
      const video4515 = await importer.targetPrisma.historyVideo.findUnique({
        where: { id: 4515 },
        select: { id: true, title: true, eventId: true }
      });
      
      console.log(`\nVideo 4515: ${video4515 ? `EXISTS (eventId: ${video4515.eventId})` : 'NOT FOUND'}`);
    }
    
    await importer.targetPrisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testVideoImportOnly();