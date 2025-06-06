const axios = require('axios');

async function testWebVideoBulkImport() {
  console.log('=== Testing Web Video Bulk Import ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Web Video Bulk Import Test',
      description: 'Testing web video bulk import functionality'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test web video data
    console.log('\n2. Testing web video import...');
    
    // Test the exact data format from the conversation summary
    const testData = 'The Keene Act & YOU (1977)\tWeb\tThe Keene Act & YOU (1977)\tWeb\t0\thttps://www.youtube.com/watch?v=n5WsciNVS0';
    console.log('Test data:', testData);
    
    // Parse exactly like the frontend does
    const columns = testData.split('\t');
    const [seriesOrMovie, seasonEpisode, title, rawMediaType, yearColumn, urlColumn] = columns.map(col => col.trim());
    
    console.log('Parsed columns:');
    console.log('  - Series/Movie:', seriesOrMovie);
    console.log('  - Season/Episode:', seasonEpisode);  
    console.log('  - Title:', title);
    console.log('  - Media Type:', rawMediaType);
    console.log('  - Year:', yearColumn);
    console.log('  - URL:', urlColumn);
    
    // Normalize media type like the frontend now does
    const mediaType = rawMediaType.toLowerCase();
    let normalizedMediaType = mediaType;
    if (mediaType === 'web') {
      normalizedMediaType = 'webvideo';
    }
    
    console.log('  - Normalized Media Type:', normalizedMediaType);
    
    // Create the web video request like the frontend does
    const requestBody = {
      mediaType: normalizedMediaType,
      title: title,
      webTitle: title,
      webUrl: urlColumn,
      webDescription: null
    };
    
    console.log('\n3. Sending request to add web video...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
    
    if (addResponse.status === 201) {
      console.log('✅ Successfully added web video!');
      console.log('Response:', addResponse.data);
    } else {
      console.log('❌ Failed to add web video, status:', addResponse.status);
    }
    
    // 4. Verify the custom order has the web video
    console.log('\n4. Verifying custom order contents...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Custom order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      if (item.mediaType === 'webvideo') {
        console.log(`   ${index + 1}. Web Video: ${item.webTitle}`);
        console.log(`      URL: ${item.webUrl}`);
        console.log(`      Description: ${item.webDescription || 'None'}`);
      } else {
        console.log(`   ${index + 1}. ${item.mediaType}: ${item.title}`);
      }
    });
    
    // 5. Clean up
    console.log('\n5. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 6. Final results
    console.log('\n=== Test Results ===');
    if (order.items.some(item => item.mediaType === 'webvideo')) {
      console.log('🎉 WEB VIDEO BULK IMPORT WORKING! ✅');
      console.log('Web videos are being processed correctly through the bulk import.');
    } else {
      console.log('❌ Web video was not found in the order');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testWebVideoBulkImport();
