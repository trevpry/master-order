const PlexPlayerService = require('./server/plexPlayerService');

async function testNavigationAndPlayback() {
  try {
    console.log('🎬 Testing Navigation + Playback...');
    
    const plexPlayer = new PlexPlayerService();
    
    // Get players
    const players = await plexPlayer.getPlayers();
    const androidTV = players.find(p => p.machineIdentifier === '6f86f5a1bdf962a5-com-plexapp-android');
    
    if (!androidTV) {
      throw new Error('AndroidTV not found');
    }
    
    console.log('Found AndroidTV:', androidTV.name);
    
    // First, navigate to home to ensure Plex is active
    console.log('📱 Navigating to home screen...');
    const homeResult = await plexPlayer.sendSimplePlayerCommand(androidTV, '/player/navigation/home', {});
    console.log('Home navigation result:', homeResult);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Now try playback
    console.log('▶️ Starting playback...');
    const playResult = await plexPlayer.playMedia('6f86f5a1bdf962a5-com-plexapp-android', '22578', 0);
    console.log('Play result:', JSON.stringify(playResult, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testNavigationAndPlayback();
