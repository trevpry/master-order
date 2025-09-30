const HistoryPlusService = require('./services/historyPlusService');

const historyPlusService = new HistoryPlusService();

async function testGetNextUnreviewedEvent() {
  try {
    console.log('🔍 Testing getNextUnreviewedEvent...');
    
    const nextEvent = await historyPlusService.getNextUnreviewedEvent();
    
    if (nextEvent) {
      console.log(`\n✅ Selected event: "${nextEvent.title}" (${nextEvent.startDate})`);
      console.log(`   Event ID: ${nextEvent.id}`);
      console.log(`   Review status: ${nextEvent.user_event_reviews?.reviewed || 'null'}`);
      
      // Check its content
      if (nextEvent.videos && nextEvent.videos.length > 0) {
        console.log(`   Videos (${nextEvent.videos.length}):`);
        for (const video of nextEvent.videos) {
          const watchRecord = video.user_video_watches;
          const watched = watchRecord && watchRecord.length > 0 && watchRecord[0]?.watched;
          console.log(`     - "${video.title}": watched=${watched}`);
        }
      }
    } else {
      console.log('❌ No event returned');
    }
    
  } catch (error) {
    console.error('Error testing getNextUnreviewedEvent:', error);
  }
}

testGetNextUnreviewedEvent();