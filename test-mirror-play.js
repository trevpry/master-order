const plexPlayerService = require('./server/plexPlayerService');
const prisma = require('./server/prismaClient');

async function testMirrorThenPlay() {
  console.log('🎬 Testing Mirror-then-Play approach...');
  
  try {
    await plexPlayerService.initializeClient();
    
    const players = await plexPlayerService.getPlayers();
    const targetPlayer = players[0]; // SHIELD Android TV
    
    console.log('Target player:', targetPlayer.name);
    
    // Get server info
    const serverInfo = await plexPlayerService.client.query('/');
    const serverMachineId = serverInfo?.MediaContainer?.machineIdentifier;
    
    // Get media details
    const mediaResponse = await plexPlayerService.client.query(`/library/metadata/22578`);
    const media = mediaResponse?.MediaContainer?.Metadata?.[0];
    
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const serverUrl = new URL(settings.plexUrl);
    
    console.log('Server address:', serverUrl.hostname + ':' + (serverUrl.port || 32400));
    
    const headers = {
      'X-Plex-Client-Identifier': 'master-order-controller',
      'X-Plex-Device-Name': 'Master Order Controller'
    };
    
    // Step 1: Try mirror/details to prepare the media
    console.log('\n--- Step 1: Mirror details ---');
    const mirrorParams = {
      key: media.key,
      machineIdentifier: serverMachineId,
      address: serverUrl.hostname,
      port: parseInt(serverUrl.port) || 32400,
      protocol: serverUrl.protocol.replace(':', ''),
      token: plexPlayerService.client.authToken
    };
    
    console.log('Mirror params:', mirrorParams);
    const mirrorResult = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/mirror/details', 
      mirrorParams, 
      headers
    );
    console.log('Mirror result:', mirrorResult.success ? 'SUCCESS' : 'FAILED:', mirrorResult.error || 'Unknown');
    
    // Step 2: Wait a moment, then try playMedia
    console.log('\n--- Step 2: PlayMedia after mirror ---');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
    const playParams = {
      key: media.key,
      offset: 0,
      machineIdentifier: serverMachineId,
      address: serverUrl.hostname,
      port: parseInt(serverUrl.port) || 32400,
      protocol: serverUrl.protocol.replace(':', ''),
      token: plexPlayerService.client.authToken,
      commandID: 1
    };
    
    console.log('Play params:', playParams);
    const playResult = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/playback/playMedia', 
      playParams, 
      headers
    );
    console.log('Play result:', playResult.success ? 'SUCCESS' : 'FAILED:', playResult.error || 'Unknown');
    
    // Step 3: Check timeline after attempt
    console.log('\n--- Step 3: Check timeline after attempt ---');
    const timelineResult = await plexPlayerService.sendDirectPlayerCommand(
      targetPlayer, 
      '/player/timeline/poll', 
      { wait: 0, commandID: 2 }, 
      headers
    );
    
    if (timelineResult.success && timelineResult.details.MediaContainer.Timeline) {
      const videoTimeline = timelineResult.details.MediaContainer.Timeline.find(t => t.attributes.type === 'video');
      console.log('Video timeline state:', videoTimeline.attributes.state);
      console.log('Video timeline controllable:', videoTimeline.attributes.controllable);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMirrorThenPlay().then(() => {
  console.log('Mirror-then-play test completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
