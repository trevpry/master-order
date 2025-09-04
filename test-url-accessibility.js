const fetch = require('node-fetch');

async function testUrlAccessibility() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing URL accessibility...\n');
  
  // Get a track with URLs
  console.log('1️⃣ Getting track data...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/Star Trek/random-track`);
    const data = await response.json();
    
    if (data.type === 'RANDOM_TRACK_SUCCESS' && data.data.track) {
      const track = data.data.track;
      console.log('✅ Got track:', track.title);
      
      // Test stream URL accessibility
      if (track.streamUrl) {
        console.log('\n2️⃣ Testing stream URL accessibility...');
        try {
          const streamResponse = await fetch(track.streamUrl, { method: 'HEAD' });
          console.log('Stream URL Status:', streamResponse.status);
          console.log('Content-Type:', streamResponse.headers.get('content-type') || 'N/A');
          console.log('Content-Length:', streamResponse.headers.get('content-length') || 'N/A');
          
          if (streamResponse.status === 200) {
            console.log('✅ Stream URL is accessible!');
          } else {
            console.log('❌ Stream URL returned status:', streamResponse.status);
          }
        } catch (error) {
          console.error('❌ Stream URL test failed:', error.message);
        }
      }
      
      // Test artwork URL accessibility
      if (track.artworkUrl) {
        console.log('\n3️⃣ Testing artwork URL accessibility...');
        try {
          const artworkResponse = await fetch(track.artworkUrl, { method: 'HEAD' });
          console.log('Artwork URL Status:', artworkResponse.status);
          console.log('Content-Type:', artworkResponse.headers.get('content-type') || 'N/A');
          console.log('Content-Length:', artworkResponse.headers.get('content-length') || 'N/A');
          
          if (artworkResponse.status === 200) {
            console.log('✅ Artwork URL is accessible!');
          } else {
            console.log('❌ Artwork URL returned status:', artworkResponse.status);
          }
        } catch (error) {
          console.error('❌ Artwork URL test failed:', error.message);
        }
      }
      
      // Show example usage for Android
      console.log('\n4️⃣ Example Android usage:');
      console.log('```java');
      console.log('// Play audio track');
      console.log(`String streamUrl = "${track.streamUrl}";`);
      console.log('MediaPlayer player = new MediaPlayer();');
      console.log('player.setDataSource(streamUrl);');
      console.log('player.prepare();');
      console.log('player.start();');
      console.log('');
      console.log('// Load album artwork');
      console.log(`String artworkUrl = "${track.artworkUrl}";`);
      console.log('Picasso.get().load(artworkUrl).into(albumArtImageView);');
      console.log('```');
      
    } else {
      console.log('❌ Failed to get track data:', data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n✅ URL accessibility testing complete!');
}

// Run the tests
testUrlAccessibility().catch(console.error);
