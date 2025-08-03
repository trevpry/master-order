const PlexPlayerService = require('./server/plexPlayerService');

async function wakeUpAndTest() {
  try {
    console.log('🔥 Attempting to wake up AndroidTV and test...');
    
    const plexPlayer = new PlexPlayerService();
    const players = await plexPlayer.getPlayers();
    const androidTV = players.find(p => p.machineIdentifier === '6f86f5a1bdf962a5-com-plexapp-android');
    
    if (!androidTV) {
      throw new Error('AndroidTV not found');
    }
    
    console.log('📱 Found AndroidTV:', androidTV.name);
    
    // Try a simple wake-up command (key press)
    console.log('⚡ Sending wake-up signal...');
    try {
      const wakeResponse = await fetch(`http://${androidTV.address}:${androidTV.port}/player/navigation/select`, {
        method: 'GET',
        headers: {
          'X-Plex-Client-Identifier': 'master-order-app',
          'X-Plex-Target-Client-Identifier': androidTV.machineIdentifier
        }
      });
      console.log('Wake response:', wakeResponse.status);
    } catch (error) {
      console.log('Wake command failed:', error.message);
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check timeline after wake
    console.log('📊 Checking timeline after wake...');
    const timelineResponse = await fetch(`http://${androidTV.address}:${androidTV.port}/player/timeline/poll?wait=0`, {
      headers: {
        'X-Plex-Client-Identifier': 'master-order-app'
      }
    });
    
    const timeline = await timelineResponse.text();
    console.log('Timeline:', timeline);
    
    // Try the simplest possible playback command
    console.log('▶️ Trying simplest playback...');
    const simpleParams = new URLSearchParams({
      commandID: Date.now(),
      key: '/library/metadata/22578',
      address: '192.168.1.113',
      port: '32400',
      machineIdentifier: 'a184c4479e3fd964b765907bbcc5727839a224be'
    });
    
    const playResponse = await fetch(`http://${androidTV.address}:${androidTV.port}/player/playback/playMedia`, {
      method: 'POST',
      headers: {
        'X-Plex-Client-Identifier': 'master-order-app',
        'X-Plex-Target-Client-Identifier': androidTV.machineIdentifier,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: simpleParams.toString()
    });
    
    console.log('Play response:', playResponse.status);
    const playBody = await playResponse.text();
    console.log('Play body:', playBody);
    
    console.log('\n🔍 IMPORTANT: Please check your AndroidTV screen now!');
    console.log('Is the Plex app open? Did anything change on the screen?');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

wakeUpAndTest();
