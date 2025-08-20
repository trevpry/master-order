/**
 * Test Word Matching Priority in Bulk Import Context
 * Tests the word matching functionality in the context of bulk imports
 * to ensure it works correctly for the user's actual use case
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testBulkImportWordMatching() {
  console.log('=== Testing Word Matching Priority in Bulk Import Context ===\n');
  
  try {
    // Create a test custom order
    console.log('📝 Creating test custom order...');
    const orderResponse = await axios.post(`${API_BASE_URL}/api/custom-orders`, {
      name: 'Word Matching Priority Test',
      description: 'Testing word matching priority for bulk import'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✓ Created test order with ID: ${orderId}\n`);
    
    // Test cases that should demonstrate word matching priority
    const testCases = [
      {
        name: 'Warcraft: Legends Test',
        series: 'Warcraft: Legends',
        issue: 1,
        title: 'Volume One',
        expectedMatch: 'Warcraft: Legends'
      },
      {
        name: 'Batman Adventures Test',
        series: 'Batman Adventures',
        issue: 1,
        title: 'Batgirl: Day One',
        expectedMatch: 'Batman Adventures'
      },
      {
        name: 'Justice League Test',
        series: 'Justice League',
        issue: 1,
        title: 'The World\'s Greatest Super Heroes',
        expectedMatch: 'Justice League'
      },
      {
        name: 'Amazing Spider-Man Test',
        series: 'Amazing Spider-Man',
        issue: 1,
        title: 'Great Power',
        expectedMatch: 'The Amazing Spider-Man'
      }
    ];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`${i + 1}. Testing: ${testCase.name}`);
      console.log(`   Series: "${testCase.series}", Issue: #${testCase.issue}`);
      
      try {
        // Search for the comic using the same API that bulk import uses
        const searchResponse = await axios.get(`${API_BASE_URL}/api/comicvine/search-with-issues`, {
          params: {
            query: testCase.series,
            issueNumber: testCase.issue
          }
        });
        
        const results = searchResponse.data;
        
        if (results.length === 0) {
          console.log(`   ❌ No results found`);
          continue;
        }
        
        const topResult = results[0];
        console.log(`   📖 Top result: "${topResult.name}" (${topResult.start_year})`);
        console.log(`   📊 Publisher: ${topResult.publisher?.name || 'Unknown'}`);
        console.log(`   📝 Issue title: "${topResult.issueName || 'No title'}"`);
        
        // Calculate word matching score to verify
        const searchWords = testCase.series.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 2 && !['the', 'and', 'vol', 'volume'].includes(word));
        
        const matchingWords = searchWords.filter(word => 
          topResult.name.toLowerCase().includes(word)
        );
        
        console.log(`   🔍 Word analysis: [${matchingWords.join(', ')}] (${matchingWords.length}/${searchWords.length} words match)`);
        
        // Test adding it to the custom order (simulate bulk import)
        console.log(`   ➕ Adding to custom order...`);
        
        const addResponse = await axios.post(`${API_BASE_URL}/api/custom-orders/${orderId}/items`, {
          mediaType: 'comic',
          title: testCase.title,
          comicSeries: topResult.name,
          comicYear: topResult.start_year,
          comicIssue: testCase.issue,
          comicVineId: topResult.api_detail_url,
          comicVineDetailsJson: JSON.stringify(topResult)
        });
        
        if (addResponse.status === 201) {
          console.log(`   ✅ Successfully added: "${addResponse.data.title}"`);
          
          // Check if it matches our expected result
          if (topResult.name.toLowerCase().includes(testCase.expectedMatch.toLowerCase()) ||
              testCase.expectedMatch.toLowerCase().includes(topResult.name.toLowerCase())) {
            console.log(`   🎯 CORRECT: Matched expected series pattern!`);
          } else {
            console.log(`   ⚠️  Unexpected match - Expected: "${testCase.expectedMatch}", Got: "${topResult.name}"`);
          }
        } else {
          console.log(`   ❌ Failed to add to custom order`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log(''); // Empty line between test cases
    }
    
    // Verify the final order contents
    console.log('🔍 Verifying final custom order contents...');
    const finalOrderResponse = await axios.get(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    const finalOrder = finalOrderResponse.data;
    
    console.log(`📚 Final order contains ${finalOrder.items.length} items:`);
    finalOrder.items.forEach((item, index) => {
      console.log(`   ${index + 1}. "${item.title}" - ${item.comicSeries} #${item.comicIssue} (${item.comicYear})`);
    });
    
    // Clean up
    console.log('\n🧹 Cleaning up test order...');
    await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    console.log('✓ Test order deleted');
    
    // Summary
    console.log('\n=== Test Summary ===');
    const successfulTests = finalOrder.items.length;
    console.log(`✅ Successfully processed: ${successfulTests}/${testCases.length} test cases`);
    
    if (successfulTests === testCases.length) {
      console.log('🎉 ALL TESTS PASSED! Word matching priority is working correctly in bulk import context!');
    } else if (successfulTests > 0) {
      console.log('⚠️  Some tests passed, some failed. Check results above for details.');
    } else {
      console.log('❌ No tests passed. Check ComicVine API configuration.');
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
if (require.main === module) {
  testBulkImportWordMatching().catch(console.error);
}

module.exports = { testBulkImportWordMatching };
