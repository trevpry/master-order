const plexPlayerService = require('./server/plexPlayerService');

async function checkTimelineStatus() {
  console.log('🎬 Checking AndroidTV Timeline Status...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Getting timeline status from:', targetPlayer.name);
    
    const headers = {
      'X-Plex-Client-Identifier': 'master-order-controller',
      'X-Plex-Device-Name': 'Master Order Controller'
    };
    
    const result = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/poll', 
      { wait: 0, commandID: 1 }, 
      headers
    );
    
    if (result.success) {
      console.log('✅ Timeline data received');
      console.log('Full timeline:', JSON.stringify(result.details, null, 2));
      
      if (result.details.MediaContainer && result.details.MediaContainer.Timeline) {
        console.log('\n📊 Timeline Analysis:');
        result.details.MediaContainer.Timeline.forEach((timeline, index) => {
          console.log(`\nTimeline ${index + 1}:`, timeline);
        });
      }
    } else {
      console.log('❌ Timeline failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

checkTimelineStatus().then(() => {
  console.log('Timeline check completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
