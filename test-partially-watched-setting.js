// Test script for the new partially watched collection percentage setting
const fetch = require('node-fetch');

async function testPartiallyWatchedSetting() {
  try {
    console.log('Testing partially watched collection setting...\n');
    
    // First, get current settings
    console.log('1. Fetching current settings...');
    const getResponse = await fetch('http://localhost:3001/api/settings');
    const currentSettings = await getResponse.json();
    console.log('Current partiallyWatchedCollectionPercent:', currentSettings.partiallyWatchedCollectionPercent);
    
    // Test updating the setting to 85%
    console.log('\n2. Updating setting to 85%...');
    const updateResponse = await fetch('http://localhost:3001/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partiallyWatchedCollectionPercent: 85
      })
    });
    
    const updateResult = await updateResponse.json();
    console.log('Update response:', updateResult);
    
    // Verify the setting was updated
    console.log('\n3. Verifying the update...');
    const verifyResponse = await fetch('http://localhost:3001/api/settings');
    const updatedSettings = await verifyResponse.json();
    console.log('Updated partiallyWatchedCollectionPercent:', updatedSettings.partiallyWatchedCollectionPercent);
    
    if (updatedSettings.partiallyWatchedCollectionPercent === 85) {
      console.log('✅ Setting update successful!');
    } else {
      console.log('❌ Setting update failed!');
    }
    
    // Test the movie selection API to see the new logic in action
    console.log('\n4. Testing movie selection with new logic...');
    const movieResponse = await fetch('http://localhost:3001/api/up_next');
    const movieResult = await movieResponse.json();
    console.log('Movie selection result:', {
      title: movieResult.title,
      orderType: movieResult.orderType,
      message: movieResult.message
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPartiallyWatchedSetting();
