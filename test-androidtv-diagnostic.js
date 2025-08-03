const plexPlayerService = require('./server/plexPlayerService');

async function testAndroidTVCommands() {
  console.log('🔍 Diagnostic: Testing AndroidTV Command Support...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Target player:', targetPlayer.name);
    console.log('Protocol capabilities:', targetPlayer.protocolCapabilities || 'Not specified');
    
    const headers = {
      'X-Plex-Client-Identifier': 'master-order-controller',
      'X-Plex-Device-Name': 'Master Order Controller'
    };
    
    // Test navigation commands (these should work according to capabilities)
    const commands = [
      { name: 'Navigation Home', endpoint: '/player/navigation/home', params: { commandID: 1 } },
      { name: 'Navigation Music', endpoint: '/player/navigation/music', params: { commandID: 2 } },
      { name: 'Set Volume', endpoint: '/player/playback/setParameters', params: { volume: 50, commandID: 3 } },
      { name: 'Subscribe Timeline', endpoint: '/player/timeline/subscribe', params: { protocol: 'http', port: 32400, commandID: 4 } }
    ];
    
    for (const cmd of commands) {
      console.log(`\n--- Testing: ${cmd.name} ---`);
      console.log('Endpoint:', cmd.endpoint);
      console.log('Params:', cmd.params);
      
      const result = await plexPlayerService.sendDirectPlayerCommand(
        targetPlayer, 
        cmd.endpoint, 
        cmd.params, 
        headers
      );
      
      console.log('Result:', result.success ? '✅ SUCCESS' : '❌ FAILED');
      if (!result.success) {
        console.log('Error:', result.error);
      } else {
        console.log('Response available:', !!result.details);
      }
    }
    
    // Check if we can get more detailed device information
    console.log('\n--- Device Information Check ---');
    console.log('Full player object:');
    Object.keys(targetPlayer).forEach(key => {
      console.log(`  ${key}: ${targetPlayer[key]}`);
    });
    
    // Final timeline check
    console.log('\n--- Final Timeline Check ---');
    const finalResult = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/poll', 
      { wait: 0, commandID: 99 }, 
      headers
    );
    
    if (finalResult.success) {
      const commandId = finalResult.details.MediaContainer.attributes.commandID;
      console.log('CommandID in response:', commandId);
      console.log('Our commands are being processed:', commandId !== '-1' ? 'YES' : 'NO');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

testAndroidTVCommands().then(() => {
  console.log('\n🔍 Diagnostic completed');
  process.exit(0);
}).catch(error => {
  console.error('Diagnostic failed:', error);
  process.exit(1);
});
