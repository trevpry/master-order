// Test Christmas Filter Functionality
const axios = require('axios');

async function testChristmasFilter() {
  console.log('Testing Christmas Filter Functionality...\n');
  
  try {
    // First, let's get the current settings to see the filter status
    console.log('1. Checking current Christmas filter status');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings');
    console.log(`Christmas Filter Enabled: ${settingsResponse.data.christmasFilterEnabled}`);
    console.log('');

    // Test movie selection with filter enabled (should exclude Christmas movies in June)
    console.log('2. Testing movie selection with Christmas filter enabled (June - should exclude Christmas movies)');
    const movieResponse = await axios.get('http://localhost:3001/api/up_next');
    
    if (movieResponse.data.orderType === 'MOVIES_GENERAL') {
      console.log(`Selected movie: "${movieResponse.data.title}"`);
      console.log(`Movie collections: ${movieResponse.data.collections || 'None'}`);
      console.log(`Movie genre: ${movieResponse.data.genre || 'None'}`);
      
      // Check if it's a Christmas movie
      const isChristmasMovie = 
        (movieResponse.data.collections || '').toLowerCase().includes('christmas') ||
        (movieResponse.data.genre || '').toLowerCase().includes('christmas') ||
        (movieResponse.data.title || '').toLowerCase().includes('christmas');
      
      if (isChristmasMovie) {
        console.log('❌ ISSUE: Christmas movie was selected despite filter being enabled in June');
      } else {
        console.log('✅ SUCCESS: Non-Christmas movie selected as expected');
      }
    } else {
      console.log(`Order type: ${movieResponse.data.orderType} (not movies)`);
    }
    console.log('');

    // Test disabling the filter
    console.log('3. Disabling Christmas filter');
    await axios.post('http://localhost:3001/api/settings', {
      christmasFilterEnabled: false
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Christmas filter disabled');
    console.log('');

    // Test movie selection with filter disabled
    console.log('4. Testing movie selection with Christmas filter disabled');
    const movieResponse2 = await axios.get('http://localhost:3001/api/up_next');
    
    if (movieResponse2.data.orderType === 'MOVIES_GENERAL') {
      console.log(`Selected movie: "${movieResponse2.data.title}"`);
      console.log('✅ Filter disabled - Christmas movies should be available in selection pool');
    } else {
      console.log(`Order type: ${movieResponse2.data.orderType} (not movies)`);
    }
    console.log('');

    // Re-enable the filter for future testing
    console.log('5. Re-enabling Christmas filter for future testing');
    await axios.post('http://localhost:3001/api/settings', {
      christmasFilterEnabled: true
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Christmas filter re-enabled');
    console.log('');

    console.log('✅ Christmas filter test completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testChristmasFilter();
