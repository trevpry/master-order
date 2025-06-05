// Test script to simulate frontend bulk import behavior
require('dotenv').config();
const axios = require('axios');

async function testFrontendBulkImport() {
  console.log('=== Testing Frontend-Style Bulk Import for Short Stories ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Frontend Bulk Import Test',
      description: 'Testing frontend-style bulk import for short stories'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test bulk import data (same format as frontend)
    console.log('\n2. Testing bulk import data processing...');
    
    const bulkImportData = `Shield of the Jedi\tTibet Ergül (2023)\tShield of the Jedi\tshortstory
The Lost Stories\tUnknown Author (2024)\tAnother Test Story\tshortstory`;
    
    console.log('Bulk import data:');
    bulkImportData.split('\n').forEach(line => console.log(`  ${line}`));
    
    // 3. Parse the data (same logic as frontend)
    console.log('\n3. Processing bulk import data...');
    const lines = bulkImportData.trim().split('\n');
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
      
      const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
      
      if (!seriesOrMovie || !title || !rawMediaType) {
        errors.push(`Line ${i + 1}: Missing required data`);
        continue;
      }
      
      const mediaType = rawMediaType.toLowerCase();
      
      let bookAuthor = null;
      let bookYear = null;
      
      if (mediaType === 'shortstory') {
        // Parse short story format: "Author Name (Year)" in the season/episode field
        if (seasonEpisode) {
          const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
          if (bookMatch) {
            bookAuthor = bookMatch[1].trim();
            if (bookMatch[2]) {
              bookYear = parseInt(bookMatch[2]);
            }
          } else {
            bookAuthor = seasonEpisode.trim();
          }
        }
      }
      
      items.push({
        seriesOrMovie,
        bookAuthor,
        bookYear,
        title,
        mediaType: mediaType,
        lineNumber: i + 1
      });
    }
    
    if (errors.length > 0) {
      console.log('❌ Parsing errors:', errors);
      return;
    }
    
    console.log(`✅ Parsed ${items.length} items successfully`);
    
    // 4. Process each item (same logic as frontend)
    let successCount = 0;
    let failCount = 0;
    const failedItems = [];
    
    for (const item of items) {
      console.log(`\nProcessing item: ${item.title} (${item.mediaType})`);
      
      try {
        let targetMedia = null;
        
        if (item.mediaType === 'shortstory') {
          // Create the media object directly (same as frontend fix)
          targetMedia = {
            title: item.title,
            type: 'shortstory',
            storyTitle: item.title,
            storyAuthor: item.bookAuthor,
            storyYear: item.bookYear,
            storyUrl: null,
            storyContainedInBookId: null,
            storyCoverUrl: null
          };
          
          console.log('  Created targetMedia:', targetMedia);
        }
        
        if (targetMedia) {
          // Add to custom order (same API call as frontend)
          console.log('  Adding to custom order...');
          
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
          
          const addResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
          
          if (addResponse.status === 201) {
            console.log(`  ✅ Successfully added: ${item.title}`);
            successCount++;
          } else {
            console.log(`  ❌ Failed to add: ${addResponse.status}`);
            failedItems.push(`Line ${item.lineNumber}: ${item.title} (HTTP ${addResponse.status})`);
            failCount++;
          }
        } else {
          console.log(`  ❌ No targetMedia created for: ${item.title}`);
          failedItems.push(`Line ${item.lineNumber}: ${item.title} (no targetMedia)`);
          failCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`  ❌ Error processing item: ${error.message}`);
        failedItems.push(`Line ${item.lineNumber}: ${item.title} (${error.message})`);
        failCount++;
      }
    }
    
    // 5. Show results
    console.log('\n=== Results ===');
    console.log(`✅ Successfully added: ${successCount} items`);
    console.log(`❌ Failed: ${failCount} items`);
    
    if (failedItems.length > 0) {
      console.log('\nFailed items:');
      failedItems.forEach(item => console.log(`  ${item}`));
    }
    
    // 6. Verify the custom order has the short stories
    console.log('\n4. Verifying custom order contents...');
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
    
    // 7. Clean up
    console.log('\n5. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 8. Final results
    console.log('\n=== Final Test Results ===');
    if (successCount > 0 && failCount === 0) {
      console.log('🎉 FRONTEND-STYLE BULK IMPORT WORKING! ✅');
      console.log('Short stories are being processed correctly without Plex search errors.');
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

testFrontendBulkImport().catch(console.error);
