const plexPlayerService = require('./server/plexPlayerService');

async function testSimplePlayCommand() {
  console.log('🎬 Testing Simple Play Command...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Target player:', targetPlayer.name);
    console.log('Player is idle and ready for commands\n');
    
    const headers = {
      'X-Plex-Client-Identifier': 'master-order-controller',
      'X-Plex-Device-Name': 'Master Order Controller'
    };
    
    // Test 1: Try the absolute minimal playMedia command
    console.log('--- Test 1: Minimal playMedia ---');
    const minimalParams = {
      key: '/library/metadata/22578',
      commandID: 1
    };
    
    console.log('Minimal params:', minimalParams);
    const result1 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/playMedia', 
      minimalParams, 
      headers
    );
    console.log('Minimal result:', result1.success ? 'SUCCESS' : 'FAILED:', result1.error || 'Unknown');
    
    // Test 2: Try starting something that's already in the Plex interface
    // Let's check what the current timeline shows and see if there's anything loaded
    console.log('\n--- Test 2: Check current timeline state ---');
    const timelineResult = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/poll', 
      { wait: 0, commandID: 2 }, 
      headers
    );
    
    if (timelineResult.success) {
      console.log('Current timeline state:');
      const timelines = timelineResult.details.MediaContainer.Timeline;
      timelines.forEach((timeline, index) => {
        console.log(`  ${timeline.attributes.type}: ${timeline.attributes.state}`);
        if (timeline.attributes.ratingKey) {
          console.log(`    Playing: ${timeline.attributes.ratingKey}`);
        }
        if (timeline.attributes.key) {
          console.log(`    Key: ${timeline.attributes.key}`);
        }
      });
    }
    
    // Test 3: Try a basic play command (no media specified, just resume if anything is loaded)
    console.log('\n--- Test 3: Basic play command ---');
    const playParams = {
      type: 'video',
      commandID: 3
    };
    
    console.log('Play params:', playParams);
    const result3 = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/play', 
      playParams, 
      headers
    );
    console.log('Play result:', result3.success ? 'SUCCESS' : 'FAILED:', result3.error || 'Unknown');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimplePlayCommand().then(() => {
  console.log('Simple play command tests completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
