const axios = require('axios');

async function testSpiderManWebVideo() {
  console.log('=== Testing Marvel\'s Spider-Man 2 Web Video Bulk Import ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Spider-Man Web Video Test',
      description: 'Testing the specific web video that was causing duplicate errors'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test the exact data format that was failing
    console.log('\n2. Testing the specific failing line...');
    const bulkImportData = {
      data: `Marvel's Spider-Man 2\tWeb\tMarvel's Spider-Man 2\tWeb\t0\thttps://www.youtube.com/watch?v=2iz-5-nKW1g`
    };
    
    console.log('Bulk import data:');
    console.log('  ' + bulkImportData.data);
    console.log('\nParsed columns:');
    
    const columns = bulkImportData.data.split('\t');
    columns.forEach((col, index) => {
      console.log(`  Column ${index + 1}: "${col}"`);
    });
    
    // 3. Simulate the frontend bulk import process
    console.log('\n3. Processing bulk import...');
    const lines = bulkImportData.data.trim().split('\n');
    const items = [];
    const errors = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split('\t');
      
      if (columns.length < 4) {
        errors.push(`Line ${i + 1}: Not enough columns`);
        continue;
      }
      
      const [seriesOrMovie, seasonEpisode, title, rawMediaType, yearColumn, urlColumn] = columns.map(col => col.trim());
      
      console.log(`\nProcessing line ${i + 1}:`);
      console.log(`  - Series/Movie: "${seriesOrMovie}"`);
      console.log(`  - Season/Episode: "${seasonEpisode}"`);
      console.log(`  - Title: "${title}"`);
      console.log(`  - Raw Media Type: "${rawMediaType}"`);
      console.log(`  - Year Column: "${yearColumn}"`);
      console.log(`  - URL Column: "${urlColumn}"`);
      
      // Normalize media type like the frontend
      let mediaType = rawMediaType.toLowerCase();
      if (mediaType === 'web') {
        mediaType = 'webvideo';
        console.log(`  - Normalized Media Type: "${mediaType}"`);
      }
      
      // Validate the web video format
      if (mediaType === 'webvideo') {
        if (!urlColumn || !urlColumn.trim()) {
          errors.push(`Line ${i + 1}: Web videos require a URL in the 6th column`);
          continue;
        }
        if (!urlColumn.match(/^https?:\/\/.+/)) {
          errors.push(`Line ${i + 1}: Invalid URL format for web video`);
          continue;
        }
      }
      
      items.push({
        seriesOrMovie,
        title,
        mediaType: mediaType,
        lineNumber: i + 1,
        url: urlColumn
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Parsing errors:', errors);
      return;
    }
    
    console.log(`\n✅ Successfully parsed ${items.length} items`);
    
    // 4. Process each item
    let successCount = 0;
    let failCount = 0;
    const failedItems = [];
    
    for (const item of items) {
      console.log(`\nProcessing item: ${item.title} (${item.mediaType})`);
      
      try {
        if (item.mediaType === 'webvideo') {
          const targetMedia = {
            title: item.title,
            type: 'webvideo',
            webTitle: item.title,
            webUrl: item.url,
            webDescription: null
          };
          
          console.log('  Created targetMedia:', JSON.stringify(targetMedia, null, 2));
          
          // Add to custom order
          console.log('  Adding to custom order...');
          
          const requestBody = {
            mediaType: targetMedia.type,
            title: targetMedia.title,
            webTitle: targetMedia.webTitle,
            webUrl: targetMedia.webUrl,
            webDescription: targetMedia.webDescription
          };
          
          console.log('  Request body:', JSON.stringify(requestBody, null, 2));
          
          const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
          
          if (addResponse.status === 201) {
            console.log(`  ✅ Successfully added: ${item.title}`);
            console.log(`  Response data:`, JSON.stringify(addResponse.data, null, 2));
            successCount++;
          } else {
            console.log(`  ❌ Failed to add: ${addResponse.status}`);
            failedItems.push(`Line ${item.lineNumber}: ${item.title} (HTTP ${addResponse.status})`);
            failCount++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing item: ${error.message}`);
        if (error.response) {
          console.error(`  Response status: ${error.response.status}`);
          console.error(`  Response data:`, error.response.data);
        }
        failedItems.push(`Line ${item.lineNumber}: ${item.title} (${error.message})`);
        failCount++;
      }
    }
    
    // 5. Try adding the same item again to test for duplicates
    console.log('\n4. Testing duplicate detection...');
    try {
      const duplicateRequestBody = {
        mediaType: 'webvideo',
        title: 'Marvel\'s Spider-Man 2',
        webTitle: 'Marvel\'s Spider-Man 2',
        webUrl: 'https://www.youtube.com/watch?v=2iz-5-nKW1g',
        webDescription: null
      };
      
      console.log('  Attempting to add duplicate item...');
      const duplicateResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, duplicateRequestBody);
      
      console.log('  ❌ Duplicate was allowed (this should not happen)');
    } catch (duplicateError) {
      if (duplicateError.response && duplicateError.response.status === 409) {
        console.log('  ✅ Duplicate correctly detected and blocked');
        console.log('  Response:', duplicateError.response.data);
      } else {
        console.log('  ❌ Unexpected error on duplicate test:', duplicateError.message);
      }
    }
    
    // 6. Show results
    console.log('\n=== Results ===');
    console.log(`✅ Successfully added: ${successCount} items`);
    console.log(`❌ Failed: ${failCount} items`);
    
    if (failedItems.length > 0) {
      console.log('\nFailed items:');
      failedItems.forEach(item => console.log(`  ${item}`));
    }
    
    // 7. Verify the custom order has the web video
    console.log('\n5. Verifying custom order contents...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Custom order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      if (item.mediaType === 'webvideo') {
        console.log(`   ${index + 1}. Web Video: ${item.webTitle}`);
        console.log(`      URL: ${item.webUrl}`);
        console.log(`      PlexKey: ${item.plexKey}`);
      } else {
        console.log(`   ${index + 1}. ${item.mediaType}: ${item.title}`);
      }
    });
    
    // 8. Clean up
    console.log('\n6. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 9. Final results
    console.log('\n=== Test Results ===');
    if (successCount > 0 && failCount === 0) {
      console.log('🎉 SPIDER-MAN WEB VIDEO IMPORT WORKING! ✅');
      console.log('The plexKey fix successfully prevents duplicate errors.');
    } else if (successCount > 0) {
      console.log('⚠️  Partially working - some items failed');
    } else {
      console.log('❌ Fix not working - all items failed');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSpiderManWebVideo();
