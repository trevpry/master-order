const PlexPlayerService = require('./server/plexPlayerService');

async function testPlayback() {
  console.log('🎬 Testing Plex Playback...');
  
  try {
    const service = new PlexPlayerService();
    
    // First, get available players
    console.log('1. Getting available players...');
    const players = await service.getPlayers();
    console.log(`Found ${players.length} players:`);
    players.forEach(player => {
      console.log(`  - ${player.name} (${player.platform}) - ${player.machineIdentifier}`);
    });
    
    if (players.length === 0) {
      console.log('❌ No players found, cannot test playback');
      return;
    }
    
    // Find the Android player
    const androidPlayer = players.find(p => p.platform === 'Android');
    if (!androidPlayer) {
      console.log('❌ No Android player found, using first available player');
      return;
    }
    
    console.log(`\n2. Testing playback on ${androidPlayer.name}...`);
    
    // Use the currently playing media item from the session data
    const testRatingKey = '22578'; // The Simpsons episode currently active
    
    const result = await service.playMedia(androidPlayer.machineIdentifier, testRatingKey, 0);
    console.log('✅ Playback result:', result);
    
  } catch (error) {
    console.error('❌ Playback test failed:', error.message);
    console.error('Error details:', error);
  }
}

testPlayback();
