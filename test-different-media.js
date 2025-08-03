const PlexPlayerService = require('./server/plexPlayerService');

async function testDifferentMedia() {
  try {
    console.log('🎬 Testing different media types...');
    
    const plexPlayer = new PlexPlayerService();
    
    // Test with different media
    const mediaTests = [
      { id: '22578', name: 'Bart the Murderer (Simpsons)' },
      { id: '44066', name: 'Rose Love Miles (different show)' },
      { id: '22579', name: 'Different Simpsons episode' }
    ];
    
    for (const media of mediaTests) {
      console.log(`\n📺 Testing: ${media.name} (ID: ${media.id})`);
      
      try {
        // Get media details first
        await plexPlayer.initializeClient();
        const mediaResponse = await plexPlayer.client.query(`/library/metadata/${media.id}`);
        const mediaDetails = mediaResponse?.MediaContainer?.Metadata?.[0];
        
        if (mediaDetails) {
          console.log('Media info:', {
            title: mediaDetails.title,
            year: mediaDetails.year,
            duration: mediaDetails.duration,
            container: mediaDetails.Media?.[0]?.container,
            videoCodec: mediaDetails.Media?.[0]?.Part?.[0]?.Stream?.find(s => s.streamType === 1)?.codec,
            audioCodec: mediaDetails.Media?.[0]?.Part?.[0]?.Stream?.find(s => s.streamType === 2)?.codec
          });
          
          // Try playback
          const result = await plexPlayer.playMedia('6f86f5a1bdf962a5-com-plexapp-android', media.id, 0);
          console.log('Result:', result.success ? '✅ Success' : '❌ Failed');
          
          // Brief pause between tests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log('❌ Media not found');
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDifferentMedia();
