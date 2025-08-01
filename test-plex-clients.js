const PlexPlayerService = require('./server/plexPlayerService');

async function testPlexClients() {
  console.log('🔍 Testing Plex Client Detection...\n');
  
  const plexPlayer = new PlexPlayerService();
  
  try {
    // Test basic connection first
    console.log('1. Testing Plex connection...');
    const connectionTest = await plexPlayer.testConnection();
    console.log('Connection result:', connectionTest);
    console.log('');
    
    if (!connectionTest.success) {
      console.log('❌ Connection failed. Check your Plex URL and token in the database.');
      return;
    }
    
    // Test client detection
    console.log('2. Testing client detection...');
    const players = await plexPlayer.getPlayers();
    console.log(`Found ${players.length} players:`, players);
    console.log('');
    
    // Test alternative detection methods
    console.log('3. Testing alternative detection methods...');
    const altPlayers = await plexPlayer.getPlayersAlternative();
    console.log(`Found ${altPlayers.length} alternative players:`, altPlayers);
    console.log('');
    
    // Show fallback options
    console.log('4. Testing fallback options...');
    const fallbackPlayers = plexPlayer.getFallbackPlayers();
    console.log(`Generated ${fallbackPlayers.length} fallback players:`, fallbackPlayers);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testPlexClients().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
