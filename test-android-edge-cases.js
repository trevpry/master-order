const fetch = require('node-fetch');

async function testEdgeCases() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing Android endpoints edge cases...\n');
  
  // Test 1: Missing gallery name
  console.log('1️⃣ Testing missing gallery name...');
  try {
    const response = await fetch(`${baseUrl}/api/android/gallery//random-image`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Missing playlist name
  console.log('2️⃣ Testing missing playlist name...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist//random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Special characters in gallery name
  console.log('3️⃣ Testing special characters in gallery name...');
  try {
    const specialGalleryName = "❤️ Test Gallery"; 
    const response = await fetch(`${baseUrl}/api/android/gallery/${encodeURIComponent(specialGalleryName)}/random-image`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response type:', data.type);
    console.log('Error message:', data.data?.message || 'No error');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 4: Special characters in playlist name (test with actual playlist that has special chars)
  console.log('4️⃣ Testing special characters in playlist name...');
  try {
    const specialPlaylistName = "❤️ Tracks"; 
    const response = await fetch(`${baseUrl}/api/android/playlist/${encodeURIComponent(specialPlaylistName)}/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response type:', data.type);
    if (data.data && data.data.playlistName) {
      console.log('Found playlist:', data.data.playlistName);
    } else if (data.data && data.data.message) {
      console.log('Message:', data.data.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test 5: Test multiple calls to ensure randomness
  console.log('5️⃣ Testing randomness - making 3 calls to Star Wars gallery...');
  const imageIds = new Set();
  for (let i = 1; i <= 3; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/android/gallery/Star Wars/random-image`);
      const data = await response.json();
      if (data.data && data.data.image) {
        imageIds.add(data.data.image.id);
        console.log(`Call ${i}: Image ID ${data.data.image.id} - "${data.data.image.originalName}"`);
      }
    } catch (error) {
      console.error(`Call ${i} Error:`, error.message);
    }
  }
  console.log(`Got ${imageIds.size} unique images out of 3 calls`);
  
  console.log('\n---\n');
  
  // Test 6: Test multiple calls to playlist for randomness
  console.log('6️⃣ Testing randomness - making 3 calls to Star Trek playlist...');
  const trackIds = new Set();
  for (let i = 1; i <= 3; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/android/playlist/Star Trek/random-track`);
      const data = await response.json();
      if (data.data && data.data.track) {
        trackIds.add(data.data.track.ratingKey);
        console.log(`Call ${i}: Track ${data.data.track.ratingKey} - "${data.data.track.title}"`);
      }
    } catch (error) {
      console.error(`Call ${i} Error:`, error.message);
    }
  }
  console.log(`Got ${trackIds.size} unique tracks out of 3 calls`);
  
  console.log('\n✅ Edge case testing complete!');
}

// Run the tests
testEdgeCases().catch(console.error);
