const PlexPlayerService = require('./server/plexPlayerService');

async function testPlaybackWithStatus() {
  try {
    console.log('🎬 Testing Playback with Status Check...');
    
    const plexPlayer = new PlexPlayerService();
    
    // Test AndroidTV playback
    const androidTVId = '6f86f5a1bdf962a5-com-plexapp-android';
    const ratingKey = '22578'; // Simpsons episode
    
    console.log(`Playing media ${ratingKey} on ${androidTVId}`);
    
    const result = await plexPlayer.playMedia(androidTVId, ratingKey, 0);
    console.log('✅ Playback result:', JSON.stringify(result, null, 2));
    
    // Wait a moment then check status
    console.log('⏳ Waiting 3 seconds then checking status...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const players = await plexPlayer.getPlayers();
    const targetPlayer = players.find(p => p.machineIdentifier === androidTVId);
    
    if (targetPlayer) {
      console.log('📊 Checking current player status...');
      const status = await plexPlayer.getPlayerStatus(targetPlayer);
      console.log('Player status:', status);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPlaybackWithStatus();
