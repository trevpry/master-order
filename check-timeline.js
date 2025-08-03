const PlexPlayerService = require('./server/plexPlayerService');

async function checkFullTimeline() {
  try {
    console.log('⏰ Getting full AndroidTV timeline...');
    
    const plexPlayer = new PlexPlayerService();
    const players = await plexPlayer.getPlayers();
    const androidTV = players.find(p => p.machineIdentifier === '6f86f5a1bdf962a5-com-plexapp-android');
    
    if (!androidTV) {
      throw new Error('AndroidTV not found');
    }
    
    // Get full timeline
    const response = await fetch(`http://${androidTV.address}:${androidTV.port}/player/timeline/poll?wait=0`, {
      headers: {
        'X-Plex-Client-Identifier': 'master-order-app'
      }
    });
    
    const timeline = await response.text();
    console.log('Full timeline response:');
    console.log(timeline);
    
    // Now send a playback command and check timeline again
    console.log('\n▶️ Sending playback command...');
    await plexPlayer.playMedia('6f86f5a1bdf962a5-com-plexapp-android', '22578', 0);
    
    // Wait and check timeline again
    console.log('\n⏳ Waiting 3 seconds then checking timeline again...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response2 = await fetch(`http://${androidTV.address}:${androidTV.port}/player/timeline/poll?wait=0`, {
      headers: {
        'X-Plex-Client-Identifier': 'master-order-app'
      }
    });
    
    const timeline2 = await response2.text();
    console.log('Timeline after playback command:');
    console.log(timeline2);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkFullTimeline();
