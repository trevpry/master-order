const { PlexControl } = require('plex-control');

async function testPlexControl() {
  try {
    console.log('🎬 Testing plex-control library...');
    
    // Initialize plex-control with server details
    const plexControl = new PlexControl({
      hostname: '192.168.1.113',
      port: 32400,
      token: 'Bazf-s9L36e4roJGMhHs' // Your Plex token
    });
    
    console.log('📱 Getting clients...');
    const clients = await plexControl.getClients();
    console.log('Found clients:', clients.length);
    
    clients.forEach((client, index) => {
      console.log(`Client ${index + 1}:`, {
        name: client.name,
        address: client.address,
        port: client.port,
        machineIdentifier: client.machineIdentifier,
        product: client.product
      });
    });
    
    // Find AndroidTV
    const androidTV = clients.find(c => c.machineIdentifier === '6f86f5a1bdf962a5-com-plexapp-android');
    
    if (androidTV) {
      console.log('\n🤖 Found AndroidTV:', androidTV.name);
      
      // Try to play media using plex-control
      console.log('▶️ Attempting playback with plex-control...');
      
      const playOptions = {
        machineIdentifier: androidTV.machineIdentifier,
        ratingKey: '22578', // Simpsons episode
        offset: 0
      };
      
      console.log('Play options:', playOptions);
      
      const playResult = await plexControl.playMedia(playOptions);
      console.log('✅ Play result:', playResult);
      
    } else {
      console.log('❌ AndroidTV not found in clients');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPlexControl();
