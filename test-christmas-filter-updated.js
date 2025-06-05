const axios = require('axios');

async function testChristmasFilter() {
  try {
    console.log('🎄 Testing Christmas Movie Filter with Plex Labels...\n');
    
    // Test 1: Check if Christmas labels exist in database
    console.log('1. Checking for Christmas labels in database...');
    const labelsResponse = await axios.get('http://localhost:3001/api/debug/christmas-labels');
    console.log(`Found ${labelsResponse.data.christmasLabels.length} Christmas labels:`);
    labelsResponse.data.christmasLabels.forEach(label => {
      console.log(`   - Movie: "${label.movie.title}" has label: "${label.tag}"`);
    });
    console.log();
    
    // Test 2: Get current Christmas filter setting
    console.log('2. Checking current Christmas filter setting...');
    const settingsResponse = await axios.get('http://localhost:3001/api/settings');
    const christmasFilterEnabled = settingsResponse.data.christmasFilterEnabled;
    console.log(`Christmas filter is currently: ${christmasFilterEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log();
    
    // Test 3: Enable Christmas filter if not already enabled
    if (!christmasFilterEnabled) {
      console.log('3. Enabling Christmas filter...');
      await axios.post('http://localhost:3001/api/settings', {
        christmasFilterEnabled: true
      });
      console.log('✅ Christmas filter enabled');
    } else {
      console.log('3. Christmas filter already enabled');
    }
    console.log();
    
    // Test 4: Test movie selection with filter (simulate non-December)
    console.log('4. Testing movie selection with Christmas filter (simulating non-December month)...');
    // Since it's currently June (non-December), the filter should exclude Christmas movies
    const movieResponse = await axios.get('http://localhost:3001/api/movie');
    if (movieResponse.data.title) {
      console.log(`✅ Movie selected: "${movieResponse.data.title}"`);
      console.log(`   Year: ${movieResponse.data.year || 'Unknown'}`);
      console.log(`   Collections: ${movieResponse.data.collections ? JSON.parse(movieResponse.data.collections).join(', ') : 'None'}`);
      
      // Check if this movie has Christmas labels (it shouldn't if filter is working)
      const movieLabels = await axios.get(`http://localhost:3001/api/debug/movie-labels/${movieResponse.data.ratingKey}`);
      const hasChristmasLabel = movieLabels.data.labels.some(label => 
        label.tag.toLowerCase().includes('christmas')
      );
      
      if (hasChristmasLabel) {
        console.log('❌ WARNING: Selected movie has Christmas labels (filter may not be working)');
        movieLabels.data.labels.forEach(label => {
          if (label.tag.toLowerCase().includes('christmas')) {
            console.log(`   - Christmas label found: "${label.tag}"`);
          }
        });
      } else {
        console.log('✅ Selected movie does not have Christmas labels (filter working correctly)');
      }
    } else {
      console.log('❌ No movie selected');
    }
    console.log();
    
    console.log('🎄 Christmas filter test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
  }
}

// Run the test
testChristmasFilter();
