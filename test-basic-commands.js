const plexPlayerService = require('./server/plexPlayerService');

async function testBasicCommands() {
  console.log('🎬 Testing Basic AndroidTV Commands...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Target player:', targetPlayer.name);
    console.log('Protocol capabilities:', targetPlayer.provides);
    
    // Test 1: Timeline subscription (should work according to docs)
    console.log('\n--- Test 1: Timeline subscription ---');
    const subscribeParams = {
      protocol: 'http',
      port: 32400,
      commandID: 1
    };
    
    const headers = {
      'X-Plex-Client-Identifier': 'master-order-controller',
      'X-Plex-Device-Name': 'Master Order Controller'
    };
    
    console.log('Attempting timeline subscribe...');
    const result1 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/subscribe', 
      subscribeParams, 
      headers
    );
    console.log('Subscribe result:', result1.success ? 'SUCCESS' : 'FAILED:', result1.error || 'Unknown');
    
    // Test 2: Timeline poll (alternative to subscribe)
    console.log('\n--- Test 2: Timeline poll ---');
    const pollParams = {
      wait: 0,
      commandID: 2
    };
    
    console.log('Attempting timeline poll...');
    const result2 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/poll', 
      pollParams, 
      headers
    );
    console.log('Poll result:', result2.success ? 'SUCCESS' : 'FAILED:', result2.error || 'Unknown');
    
    // Test 3: Basic playback control (pause - should be safe)
    console.log('\n--- Test 3: Pause command ---');
    const pauseParams = {
      type: 'video',
      commandID: 3
    };
    
    console.log('Attempting pause command...');
    const result3 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/pause', 
      pauseParams, 
      headers
    );
    console.log('Pause result:', result3.success ? 'SUCCESS' : 'FAILED:', result3.error || 'Unknown');
    
    // Test 4: Check what endpoints are available
    console.log('\n--- Test 4: Check root endpoints ---');
    const result4 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/', 
      {}, 
      headers
    );
    console.log('Root result:', result4.success ? 'SUCCESS' : 'FAILED:', result4.error || 'Unknown');
    if (result4.success && result4.details) {
      console.log('Root response details available');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBasicCommands().then(() => {
  console.log('All basic command tests completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
