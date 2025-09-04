const fetch = require('node-fetch');

async function testWithActualData() {
  const baseUrl = 'http://localhost:3001';
  
  console.log('🧪 Testing Android endpoints with actual data...\n');
  
  // Test with "Star Wars" gallery (gallery ID 1 based on our previous tests)
  console.log('1️⃣ Testing random image from "Star Wars" gallery...');
  try {
    const response = await fetch(`${baseUrl}/api/android/gallery/Star Wars/random-image`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test with "Star Trek" custom playlist
  console.log('2️⃣ Testing random track from "Star Trek" custom playlist...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/Star Trek/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test case-insensitive matching
  console.log('3️⃣ Testing case-insensitive gallery matching...');
  try {
    const response = await fetch(`${baseUrl}/api/android/gallery/star wars/random-image`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response type:', data.type);
    if (data.data && data.data.galleryName) {
      console.log('Found gallery:', data.data.galleryName);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n---\n');
  
  // Test case-insensitive matching for playlist
  console.log('4️⃣ Testing case-insensitive playlist matching...');
  try {
    const response = await fetch(`${baseUrl}/api/android/playlist/star trek/random-track`);
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response type:', data.type);
    if (data.data && data.data.playlistName) {
      console.log('Found playlist:', data.data.playlistName);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n✅ Testing complete!');
}

// Run the tests
testWithActualData().catch(console.error);
