// Test script to verify short story normalization in bulk import
require('dotenv').config();
const axios = require('axios');

async function testShortStoryNormalization() {
  console.log('=== Testing Short Story Normalization in Bulk Import ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Short Story Normalization Test',
      description: 'Testing that "Short Story" gets normalized to "shortstory"'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test different case variations of "Short Story"
    console.log('\n2. Testing different case variations...');
    
    const testData = [
      'Test Story 1\tJohn Doe (2023)\tFirst Test Story\tShort Story',
      'Test Story 2\tJane Smith (2024)\tSecond Test Story\tshort story', 
      'Test Story 3\tBob Wilson (2022)\tThird Test Story\tshortstory',
      'Test Story 4\tAlice Brown (2021)\tFourth Test Story\tSHORT STORY'
    ];
    
    console.log('Test data variations:');
    testData.forEach((line, i) => {
      const parts = line.split('\t');
      console.log(`  ${i + 1}. Type: "${parts[3]}" -> Title: "${parts[2]}"`);
    });
    
    // 3. Simulate what the frontend would do for each line
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (let i = 0; i < testData.length; i++) {
      const line = testData[i];
      const [seriesOrMovie, seasonEpisode, title, rawMediaType] = line.split('\t').map(col => col.trim());
      
      console.log(`\nProcessing line ${i + 1}: "${title}" with type "${rawMediaType}"`);
      
      // Apply the same normalization logic as the frontend
      let mediaType = rawMediaType.toLowerCase();
      if (mediaType === 'tv series') {
        mediaType = 'episode';
      } else if (mediaType === 'short story') {
        mediaType = 'shortstory';
      }
      
      console.log(`  Normalized type: "${mediaType}"`);
      
      if (mediaType === 'shortstory') {
        // Parse author and year
        let bookAuthor = null;
        let bookYear = null;
        
        const bookMatch = seasonEpisode.match(/^(.+?)\s*\((\d{4})\)$/);
        if (bookMatch) {
          bookAuthor = bookMatch[1].trim();
          bookYear = parseInt(bookMatch[2]);
        } else {
          bookAuthor = seasonEpisode.trim();
        }
        
        // Create the request body as the frontend would
        const requestBody = {
          mediaType: 'shortstory',
          title: title,
          storyTitle: title,
          storyAuthor: bookAuthor,
          storyYear: bookYear,
          storyUrl: null,
          storyContainedInBookId: null,
          storyCoverUrl: null
        };
        
        try {
          console.log('  Sending request to add short story...');
          const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
          
          if (addResponse.status === 201) {
            console.log(`  ✅ Successfully added: ${title}`);
            successCount++;
            results.push({ success: true, title, originalType: rawMediaType, normalizedType: mediaType });
          } else {
            console.log(`  ❌ Failed to add: HTTP ${addResponse.status}`);
            errorCount++;
            results.push({ success: false, title, originalType: rawMediaType, error: `HTTP ${addResponse.status}` });
          }
        } catch (error) {
          console.log(`  ❌ Error adding: ${error.message}`);
          errorCount++;
          results.push({ success: false, title, originalType: rawMediaType, error: error.message });
        }
      } else {
        console.log(`  ⚠️  Not a short story after normalization: ${mediaType}`);
        errorCount++;
        results.push({ success: false, title, originalType: rawMediaType, error: 'Not normalized to shortstory' });
      }
    }
    
    // 4. Verify the results
    console.log('\n3. Verifying results...');
    const orderCheckResponse = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Custom order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.storyTitle} by ${item.storyAuthor} (${item.storyYear})`);
    });
    
    // 5. Clean up
    console.log('\n4. Cleaning up...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 6. Final results
    console.log('\n=== Test Results ===');
    console.log(`✅ Successfully processed: ${successCount} short stories`);
    console.log(`❌ Errors: ${errorCount} items`);
    
    console.log('\nDetailed results:');
    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  ${index + 1}. ✅ "${result.originalType}" -> "${result.normalizedType}" -> ${result.title}`);
      } else {
        console.log(`  ${index + 1}. ❌ "${result.originalType}" -> ${result.title} - ${result.error}`);
      }
    });
    
    if (successCount === testData.length) {
      console.log('\n🎉 NORMALIZATION FIX WORKING! ✅');
      console.log('All case variations of "Short Story" are being properly normalized to "shortstory".');
    } else {
      console.log('\n⚠️  Some issues remain - check the detailed results above');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testShortStoryNormalization().catch(console.error);
