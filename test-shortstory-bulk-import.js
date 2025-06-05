// Test script to verify short story bulk import fix
require('dotenv').config();
const axios = require('axios');

async function testShortStoryBulkImport() {
  console.log('=== Testing Short Story Bulk Import Fix ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Short Story Bulk Import Test',
      description: 'Testing short story bulk import functionality'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test short story data in the bulk import format
    console.log('\n2. Testing short story bulk import...');
    
    // This simulates what would happen in the frontend bulk import
    // Format: Series/Movie, Season/Episode (or Author), Title, Type
    const shortStoryData = [
      'Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory',
      'The Lost Stories\tUnknown Author (2024)\tAnother Test Story\tshortstory'
    ];
    
    console.log('Test data:');
    shortStoryData.forEach(line => console.log(`  ${line}`));
    
    // 3. Parse the data (same logic as frontend)
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (let i = 0; i < shortStoryData.length; i++) {
      const line = shortStoryData[i];
      const columns = line.split('\t');
      const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
      
      console.log(`\nProcessing line ${i + 1}: "${title}"`);
      
      const mediaType = rawMediaType.toLowerCase();
      
      if (mediaType === 'shortstory') {
        // Parse author and year from the seasonEpisode field (format: "Author (Year)")
        let bookAuthor = null;
        let bookYear = null;
        
        const bookMatch = seasonEpisode.match(/^(.+?)\s*\((\d{4})\)$/);
        if (bookMatch) {
          bookAuthor = bookMatch[1].trim();
          bookYear = parseInt(bookMatch[2]);
        } else {
          bookAuthor = seasonEpisode.trim();
        }
        
        // Create the short story media object (same as the frontend fix)
        const targetMedia = {
          title: title,
          type: 'shortstory',
          storyTitle: title,
          storyAuthor: bookAuthor,
          storyYear: bookYear,
          storyUrl: null,
          storyContainedInBookId: null,
          storyCoverUrl: null
        };
        
        console.log('  Created short story media object:', targetMedia);
        
        // 4. Add to custom order using the API
        try {
          const requestBody = {
            mediaType: targetMedia.type,
            title: targetMedia.title,
            storyTitle: targetMedia.storyTitle,
            storyAuthor: targetMedia.storyAuthor,
            storyYear: targetMedia.storyYear,
            storyUrl: targetMedia.storyUrl,
            storyContainedInBookId: targetMedia.storyContainedInBookId,
            storyCoverUrl: targetMedia.storyCoverUrl
          };
          
          console.log('  Sending request to add short story...');
          const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
          
          if (addResponse.status === 201) {
            console.log(`  ✅ Successfully added short story: ${title}`);
            successCount++;
            results.push({ success: true, title, author: bookAuthor, year: bookYear });
          } else {
            console.log(`  ❌ Failed to add short story: ${addResponse.status}`);
            errorCount++;
            results.push({ success: false, title, error: `HTTP ${addResponse.status}` });
          }
        } catch (error) {
          console.log(`  ❌ Error adding short story: ${error.message}`);
          errorCount++;
          results.push({ success: false, title, error: error.message });
        }
      } else {
        console.log(`  ⚠️  Skipping non-short-story item: ${mediaType}`);
      }
    }
    
    // 5. Verify the custom order has the short stories
    console.log('\n3. Verifying custom order contents...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Custom order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      if (item.mediaType === 'shortstory') {
        console.log(`   ${index + 1}. Short Story: ${item.storyTitle} by ${item.storyAuthor || 'Unknown'} (${item.storyYear || 'Unknown year'})`);
      } else {
        console.log(`   ${index + 1}. ${item.mediaType}: ${item.title}`);
      }
    });
    
    // 6. Clean up
    console.log('\n4. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 7. Final results
    console.log('\n=== Test Results ===');
    console.log(`✅ Successfully processed: ${successCount} short stories`);
    console.log(`❌ Errors: ${errorCount} items`);
    
    if (successCount > 0 && errorCount === 0) {
      console.log('\n🎉 SHORT STORY BULK IMPORT FIX WORKING! ✅');
      console.log('The fix successfully prevents the 500 error and properly handles short stories.');
    } else if (successCount > 0) {
      console.log('\n⚠️  Partially working - some items failed');
    } else {
      console.log('\n❌ Fix not working - all items failed');
    }
    
    console.log('\nDetailed results:');
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  ${index + 1}. ✅ ${result.title} - Added successfully`);
      } else {
        console.log(`  ${index + 1}. ❌ ${result.title} - ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testShortStoryBulkImport().catch(console.error);
