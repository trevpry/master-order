const axios = require('axios');

async function testAddingItemsNotInPlex() {
  const baseURL = 'http://localhost:3001';
  
  try {
    console.log('🧪 Testing adding movies and episodes not yet in Plex...');
    
    // First, get the list of custom orders
    console.log('\\n1. Getting custom orders...');
    const ordersResponse = await axios.get(`${baseURL}/api/custom-orders`);
    const customOrders = ordersResponse.data;
    
    if (customOrders.length === 0) {
      console.log('❌ No custom orders found. Please create a custom order first.');
      return;
    }
    
    const testOrder = customOrders[0];
    console.log(`Using custom order: "${testOrder.name}" (ID: ${testOrder.id})`);
    
    // Test 1: Add a movie that doesn't exist in Plex
    console.log('\\n2. Testing movie not in Plex...');
    const movieData = {
      mediaType: 'movie',
      title: 'Test Movie Not In Plex',
      bookYear: 2025 // Using bookYear as the year field
    };
    
    try {
      const movieResponse = await axios.post(`${baseURL}/api/custom-orders/${testOrder.id}/items`, movieData);
      console.log('✅ Successfully added movie not in Plex');
      console.log('Movie data:', {
        title: movieResponse.data.title,
        plexKey: movieResponse.data.plexKey,
        isFromTvdbOnly: movieResponse.data.isFromTvdbOnly
      });
    } catch (error) {
      console.log('❌ Failed to add movie:', error.response?.data?.error || error.message);
    }
    
    // Test 2: Add a TV episode that doesn't exist in Plex
    console.log('\\n3. Testing TV episode not in Plex...');
    const episodeData = {
      mediaType: 'episode',
      title: 'Test Episode Not In Plex',
      seriesTitle: 'Test Series Not In Plex',
      seasonNumber: 1,
      episodeNumber: 1
    };
    
    try {
      const episodeResponse = await axios.post(`${baseURL}/api/custom-orders/${testOrder.id}/items`, episodeData);
      console.log('✅ Successfully added episode not in Plex');
      console.log('Episode data:', {
        title: episodeResponse.data.title,
        seriesTitle: episodeResponse.data.seriesTitle,
        plexKey: episodeResponse.data.plexKey,
        isFromTvdbOnly: episodeResponse.data.isFromTvdbOnly
      });
    } catch (error) {
      console.log('❌ Failed to add episode:', error.response?.data?.error || error.message);
    }
    
    // Test 3: Try to add a movie with plexKey (should still work)
    console.log('\\n4. Testing movie with plexKey (existing Plex item)...');
    const existingMovieData = {
      mediaType: 'movie',
      plexKey: '12345',
      title: 'Existing Movie Title'
    };
    
    try {
      const existingMovieResponse = await axios.post(`${baseURL}/api/custom-orders/${testOrder.id}/items`, existingMovieData);
      console.log('✅ Successfully added movie with plexKey');
      console.log('Movie data:', {
        title: existingMovieResponse.data.title,
        plexKey: existingMovieResponse.data.plexKey,
        isFromTvdbOnly: existingMovieResponse.data.isFromTvdbOnly
      });
    } catch (error) {
      console.log('❌ Failed to add movie with plexKey:', error.response?.data?.error || error.message);
    }
    
    console.log('\\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAddingItemsNotInPlex();
