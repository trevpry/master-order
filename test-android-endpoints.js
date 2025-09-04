const fetch = require('node-fetch');

async function testAndroidEndpoints() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing new Android API endpoints...\n');
  
  // Test 1: Random Gallery Image endpoint with a non-existent gallery
  console.log('1️⃣ Testing random gallery image endpoint with non-existent gallery...');
  try {
    const response = await fetch(`${baseUrl}/api/android/gallery/NonExistentGallery/random-image`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Random Playlist Track endpoint with a non-existent playlist
  console.log('2️⃣ Testing random playlist track endpoint with non-existent playlist...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/NonExistentPlaylist/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: List available background galleries to test with
  console.log('3️⃣ Checking available background galleries...');
  try {
    const response = await fetch(`${baseUrl}/api/background-galleries`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Available galleries:', data.map(g => g.name));
    
    // If galleries exist, test with first one
    if (data && data.length > 0) {
      const testGallery = data[0];
      console.log(`\n4️⃣ Testing random image from "${testGallery.name}" gallery...`);
      
      const imageResponse = await fetch(`${baseUrl}/api/android/gallery/${encodeURIComponent(testGallery.name)}/random-image`);
      const imageData = await imageResponse.json();
      console.log('Status:', imageResponse.status);
      console.log('Response:', JSON.stringify(imageData, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 4: List available playlists to test with
  console.log('5️⃣ Checking available playlists...');
  try {
    const response = await fetch(`${baseUrl}/api/playlists/available`);
    const data = await response.json();
    console.log('Status:', response.status);
    
    let testPlaylistName = null;
    
    // Check Plex playlists
    if (data.plexPlaylists && data.plexPlaylists.length > 0) {
      console.log('Available Plex playlists:', data.plexPlaylists.map(p => p.title));
      testPlaylistName = data.plexPlaylists[0].title;
    }
    
    // Check Custom playlists
    if (data.customPlaylists && data.customPlaylists.length > 0) {
      console.log('Available Custom playlists:', data.customPlaylists.map(p => p.title));
      if (!testPlaylistName) {
        testPlaylistName = data.customPlaylists[0].title;
      }
    }
    
    // If playlists exist, test with first one
    if (testPlaylistName) {
      console.log(`\n6️⃣ Testing random track from "${testPlaylistName}" playlist...`);
      
      const trackResponse = await fetch(`${baseUrl}/api/android/playlist/${encodeURIComponent(testPlaylistName)}/random-track`);
      const trackData = await trackResponse.json();
      console.log('Status:', trackResponse.status);
      console.log('Response:', JSON.stringify(trackData, null, 2));
    } else {
      console.log('No playlists available for testing');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n✅ Android endpoint testing complete!');
}

// Run the tests
testAndroidEndpoints().catch(console.error);
