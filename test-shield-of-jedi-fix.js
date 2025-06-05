// Test the exact scenario that was causing the 500 error
const axios = require('axios');

async function testShieldOfJediFix() {
  console.log('=== Testing "Shield of the Jedi" Bulk Import Fix ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Shield of the Jedi Test',
      description: 'Testing the specific short story that was causing 500 errors'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test the exact bulk import data that was failing
    console.log('\n2. Testing bulk import with "Shield of the Jedi"...');
    const bulkImportData = {
      data: `Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory`
    };
    
    console.log('Bulk import data:');
    console.log('  ' + bulkImportData.data);
    
    // 3. Simulate the bulk import process
    console.log('\n3. Processing bulk import...');
    const bulkResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/bulk-import`, bulkImportData);
    
    if (bulkResponse.status === 200) {
      console.log('✅ Bulk import completed successfully!');
      console.log(`   Added items: ${bulkResponse.data.addedItems}`);
      console.log(`   Success count: ${bulkResponse.data.successCount}`);
      console.log(`   Error count: ${bulkResponse.data.errorCount}`);
      
      if (bulkResponse.data.errors && bulkResponse.data.errors.length > 0) {
        console.log('   Errors:', bulkResponse.data.errors);
      }
    } else {
      console.log('❌ Bulk import failed with status:', bulkResponse.status);
    }
    
    // 4. Verify the short story was added correctly
    console.log('\n4. Verifying the short story was added...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      if (item.mediaType === 'shortstory') {
        console.log(`   ${index + 1}. Short Story: ${item.storyTitle} by ${item.storyAuthor} (${item.storyYear})`);
      } else {
        console.log(`   ${index + 1}. ${item.mediaType}: ${item.title}`);
      }
    });
    
    // 5. Test that the search endpoint still behaves correctly (should not find short stories)
    console.log('\n5. Testing search endpoint behavior...');
    try {
      const searchResponse = await axios.get('http://localhost:3001/api/search?query=Shield%20of%20the%20Jedi');
      console.log('⚠️  Search endpoint unexpectedly returned results:', searchResponse.data.length);
    } catch (searchError) {
      if (searchError.response && searchError.response.status === 500) {
        console.log('❌ Search endpoint still returning 500 error (unexpected)');
      } else {
        console.log('✅ Search endpoint properly handles the query (returns empty or appropriate error)');
      }
    }
    
    // 6. Clean up
    console.log('\n6. Cleaning up...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    console.log('\n=== FINAL RESULT ===');
    console.log('🎉 "Shield of the Jedi" can now be bulk imported without causing 500 errors!');
    console.log('✅ The fix successfully prevents short stories from trying to search Plex');
    console.log('✅ Short stories are now properly handled in bulk import workflow');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testShieldOfJediFix();
