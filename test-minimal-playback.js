const plexPlayerService = require('./server/plexPlayerService');

async function testMinimalPlayback() {
  console.log('🎬 Testing Minimal Playback Parameters...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Target player:', targetPlayer.name);
    console.log('Player machine ID:', targetPlayer.machineIdentifier);
    
    // Get server info
    const serverInfo = await plexPlayerService.client.query('/');
    const serverMachineId = serverInfo?.MediaContainer?.machineIdentifier;
    console.log('Server machine ID:', serverMachineId);
    
    // Test 1: Minimal parameters with server machine ID
    console.log('\n--- Test 1: Minimal with server machine ID ---');
    const minimalParams1 = {
      key: '/library/metadata/22578',
      offset: 0,
      machineIdentifier: serverMachineId,
      commandID: 1
    };
    
    console.log('Params:', minimalParams1);
    const result1 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/playMedia', 
      minimalParams1, 
      plexPlayerService.getApiHeaders(targetPlayer.machineIdentifier)
    );
    console.log('Result 1:', result1.success ? 'SUCCESS' : 'FAILED:', result1.error || 'Unknown');
    
    // Test 2: Try with player's machine ID instead
    console.log('\n--- Test 2: With player machine ID ---');
    const minimalParams2 = {
      key: '/library/metadata/22578',
      offset: 0,
      machineIdentifier: targetPlayer.machineIdentifier,
      commandID: 2
    };
    
    console.log('Params:', minimalParams2);
    const result2 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/playMedia', 
      minimalParams2, 
      plexPlayerService.getApiHeaders(targetPlayer.machineIdentifier)
    );
    console.log('Result 2:', result2.success ? 'SUCCESS' : 'FAILED:', result2.error || 'Unknown');
    
    // Test 3: Try without machine ID at all
    console.log('\n--- Test 3: Without machine ID ---');
    const minimalParams3 = {
      key: '/library/metadata/22578',
      offset: 0,
      commandID: 3
    };
    
    console.log('Params:', minimalParams3);
    const result3 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/playMedia', 
      minimalParams3, 
      plexPlayerService.getApiHeaders(targetPlayer.machineIdentifier)
    );
    console.log('Result 3:', result3.success ? 'SUCCESS' : 'FAILED:', result3.error || 'Unknown');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMinimalPlayback().then(() => {
  console.log('All tests completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
