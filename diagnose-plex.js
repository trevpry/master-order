const PlexPlayerService = require('./server/plexPlayerService');

async function diagnosePlex() {
  try {
    console.log('🔍 Diagnosing Plex AndroidTV Issues...');
    
    const plexPlayer = new PlexPlayerService();
    
    // Get players
    const players = await plexPlayer.getPlayers();
    const androidTV = players.find(p => p.machineIdentifier === '6f86f5a1bdf962a5-com-plexapp-android');
    
    if (!androidTV) {
      throw new Error('AndroidTV not found');
    }
    
    console.log('AndroidTV Details:', androidTV);
    
    // Test basic connectivity
    console.log('\n📡 Testing basic connectivity...');
    try {
      const response = await fetch(`http://${androidTV.address}:${androidTV.port}/`);
      console.log('Basic connection status:', response.status);
      const text = await response.text();
      console.log('Response length:', text.length, 'characters');
    } catch (error) {
      console.log('Basic connection failed:', error.message);
    }
    
    // Test timeline/status endpoint
    console.log('\n⏰ Testing timeline endpoint...');
    try {
      const response = await fetch(`http://${androidTV.address}:${androidTV.port}/player/timeline/poll?wait=0`, {
        headers: {
          'X-Plex-Client-Identifier': 'master-order-app'
        }
      });
      console.log('Timeline status:', response.status);
      const text = await response.text();
      console.log('Timeline response:', text.substring(0, 200) + '...');
    } catch (error) {
      console.log('Timeline check failed:', error.message);
    }
    
    // Try simple playback test
    console.log('\n▶️ Testing playback (simple)...');
    const result = await plexPlayer.playMedia('6f86f5a1bdf962a5-com-plexapp-android', '22578', 0);
    console.log('Playback result:', result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

diagnosePlex();
