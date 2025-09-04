const fetch = require('node-fetch');

async function testEnhancedTrackEndpoint() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing enhanced Android track endpoint...\n');
  
  // Test with "Star Trek" custom playlist
  console.log('1️⃣ Testing random track from "Star Trek" custom playlist with Plex metadata...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/Star Trek/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    
    if (data.type === 'RANDOM_TRACK_SUCCESS') {
      console.log('✅ Success! Track data:');
      console.log('- Title:', data.data.track.title);
      console.log('- Artist:', data.data.track.artist);
      console.log('- Album:', data.data.track.album);
      console.log('- Duration:', data.data.track.duration);
      console.log('- Rating Key:', data.data.track.ratingKey);
      console.log('- Stream URL:', data.data.track.streamUrl ? '✅ Present' : '❌ Missing');
      console.log('- Artwork URL:', data.data.track.artworkUrl ? '✅ Present' : '❌ Missing');
      console.log('- Plex URL:', data.data.track.plexUrl ? '✅ Present' : '❌ Missing');
      
      if (data.data.track.streamUrl) {
        console.log('- Full Stream URL:', data.data.track.streamUrl);
      }
      if (data.data.track.artworkUrl) {
        console.log('- Full Artwork URL:', data.data.track.artworkUrl);
      }
      
      // Additional metadata
      console.log('- Year:', data.data.track.year || 'N/A');
      console.log('- Track Number:', data.data.track.index || 'N/A');
      console.log('- Disc Number:', data.data.track.parentIndex || 'N/A');
      console.log('- Rating:', data.data.track.rating || 'N/A');
    } else {
      console.log('❌ Error response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test with "❤️ Tracks" Plex playlist
  console.log('2️⃣ Testing random track from "❤️ Tracks" Plex playlist with Plex metadata...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/${encodeURIComponent('❤️ Tracks')}/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    
    if (data.type === 'RANDOM_TRACK_SUCCESS') {
      console.log('✅ Success! Track data:');
      console.log('- Title:', data.data.track.title);
      console.log('- Artist:', data.data.track.artist);
      console.log('- Album:', data.data.track.album);
      console.log('- Duration:', data.data.track.duration);
      console.log('- Rating Key:', data.data.track.ratingKey);
      console.log('- Stream URL:', data.data.track.streamUrl ? '✅ Present' : '❌ Missing');
      console.log('- Artwork URL:', data.data.track.artworkUrl ? '✅ Present' : '❌ Missing');
      console.log('- Plex URL:', data.data.track.plexUrl ? '✅ Present' : '❌ Missing');
      
      if (data.data.track.streamUrl) {
        console.log('- Full Stream URL:', data.data.track.streamUrl);
      }
      if (data.data.track.artworkUrl) {
        console.log('- Full Artwork URL:', data.data.track.artworkUrl);
      }
    } else if (data.type === 'RANDOM_TRACK_ERROR') {
      console.log('ℹ️ Expected error (no tracks):', data.data.message);
    } else {
      console.log('❌ Unexpected response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test multiple calls to verify randomness and consistency
  console.log('3️⃣ Testing multiple calls for consistency...');
  const trackIds = new Set();
  for (let i = 1; i <= 3; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/android/playlist/Star Trek/random-track`);
      const data = await response.json();
      if (data.data && data.data.track) {
        trackIds.add(data.data.track.ratingKey);
        console.log(`Call ${i}: Track ${data.data.track.ratingKey} - "${data.data.track.title}"`);
        console.log(`  - Stream URL: ${data.data.track.streamUrl ? 'Present' : 'Missing'}`);
        console.log(`  - Artwork URL: ${data.data.track.artworkUrl ? 'Present' : 'Missing'}`);
      }
    } catch (error) {
      console.error(`Call ${i} Error:`, error.message);
    }
  }
  console.log(`Got ${trackIds.size} unique tracks out of 3 calls`);
  
  console.log('\n✅ Enhanced track endpoint testing complete!');
}

// Run the tests
testEnhancedTrackEndpoint().catch(console.error);
