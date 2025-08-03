const PlexPlayerService = require('./server/plexPlayerService');

async function testDirectPlayback() {
  console.log('🎬 Testing Direct Playback to AndroidTV...');
  
  try {
    const plexPlayerService = new PlexPlayerService();
    
    // Test with known working values
    const machineIdentifier = '6f86f5a1bdf962a5-com-plexapp-android';
    const testRatingKey = '22578'; // The Simpsons episode
    
    console.log(`Playing media ${testRatingKey} on ${machineIdentifier}`);
    
    const result = await plexPlayerService.playMedia(machineIdentifier, testRatingKey, 0);
    console.log('✅ Playback result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n🎉 SUCCESS! AndroidTV playback is now working!');
      console.log('The video should now be playing on your AndroidTV device.');
      
      // Test playback controls
      console.log('\n🎮 Testing playback controls...');
      
      setTimeout(async () => {
        console.log('Attempting to pause...');
        const pauseResult = await plexPlayerService.controlPlayback(machineIdentifier, 'pause');
        console.log('Pause result:', pauseResult);
        
        setTimeout(async () => {
          console.log('Attempting to play...');
          const playResult = await plexPlayerService.controlPlayback(machineIdentifier, 'play');
          console.log('Play result:', playResult);
        }, 3000);
      }, 5000);
    }
    
  } catch (error) {
    console.error('❌ Playback test failed:', error.message);
    console.error('Error details:', error);
  }
}

testDirectPlayback().then(() => {
  console.log('Playback test completed');
  process.exit(0);
}).catch(error => {
  console.error('Playback test failed:', error);
  process.exit(1);
});
