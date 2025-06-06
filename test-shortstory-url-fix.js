// Test script to verify short story URL saving fix
require('dotenv').config();
const axios = require('axios');

async function testShortStoryUrlFix() {
  console.log('=== Testing Short Story URL Saving Fix ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Short Story URL Fix Test',
      description: 'Testing that URLs from 6th column are saved for short stories'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test short story bulk import with URL in 6th column
    console.log('\n2. Testing short story bulk import with URL...');
    
    const bulkImportData = {
      data: `Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory\t\thttps://example.com/shield-of-the-jedi`
    };
    
    console.log('Bulk import data:');
    console.log(`  ${bulkImportData.data}`);
    
    // 3. Use the bulk import API endpoint
    console.log('\n3. Sending bulk import request...');
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
    
    // 4. Verify the short story was added with the URL
    console.log('\n4. Verifying the short story was added with URL...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    if (order.items && order.items.length > 0) {
      const shortStoryItem = order.items.find(item => item.mediaType === 'shortstory');
      
      if (shortStoryItem) {
        console.log('✅ Short story found in order:');
        console.log(`   Title: ${shortStoryItem.storyTitle}`);
        console.log(`   Author: ${shortStoryItem.storyAuthor}`);
        console.log(`   Year: ${shortStoryItem.storyYear}`);
        console.log(`   URL: ${shortStoryItem.storyUrl}`);
        
        if (shortStoryItem.storyUrl === 'https://example.com/shield-of-the-jedi') {
          console.log('\n🎉 SUCCESS! URL is properly saved! ✅');
          console.log('The fix works - URLs from the 6th column are now being saved for short stories.');
        } else {
          console.log('\n❌ URL was not saved correctly');
          console.log(`   Expected: https://example.com/shield-of-the-jedi`);
          console.log(`   Actual: ${shortStoryItem.storyUrl}`);
        }
      } else {
        console.log('❌ No short story found in the order');
      }
    } else {
      console.log('❌ No items found in the order');
    }
    
    // 5. Test a second short story without URL to ensure null handling works
    console.log('\n5. Testing short story without URL...');
    
    const bulkImportData2 = {
      data: `Another Story\tJohn Doe (2024)\tAnother Test Story\tshortstory`
    };
    
    console.log('Bulk import data (no URL):');
    console.log(`  ${bulkImportData2.data}`);
    
    const bulkResponse2 = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/bulk-import`, bulkImportData2);
    
    if (bulkResponse2.status === 200) {
      console.log('✅ Second bulk import completed successfully!');
    }
    
    // Verify the second story has null URL
    const orderCheckResponse2 = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order2 = orderCheckResponse2.data;
    
    const secondStory = order2.items.find(item => item.storyTitle === 'Another Test Story');
    if (secondStory) {
      console.log(`   Second story URL: ${secondStory.storyUrl}`);
      
      if (secondStory.storyUrl === null) {
        console.log('✅ Null URL handling works correctly');
      } else {
        console.log('❌ Null URL handling not working correctly');
      }
    }
    
    // 6. Clean up
    console.log('\n6. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testShortStoryUrlFix().catch(console.error);
