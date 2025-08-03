const plexPlayerService = require('./server/plexPlayerService');

async function testConnection() {
  console.log('🔗 Testing Plex Connection...');
  
  try {
    console.log('1. Testing basic connection...');
    const connectionResult = await plexPlayerService.testConnection();
    console.log('✅ Connection result:', connectionResult);
    
    console.log('2. Getting players with timeout...');
    const players = await plexPlayerService.getPlayers();
    console.log(`✅ Found ${players.length} players`);
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('Error details:', error);
  }
}

testConnection().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
