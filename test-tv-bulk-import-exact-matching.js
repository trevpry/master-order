/**
 * Test TV Series Bulk Import with Exact Matching
 * Tests the complete bulk import flow to ensure exact series matches are selected
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testTVSeriesBulkImportMatching() {
  console.log('=== Testing TV Series Bulk Import with Exact Matching ===\n');
  
  try {
    // Create a test custom order
    console.log('📝 Creating test custom order...');
    const orderResponse = await axios.post(`${API_BASE_URL}/api/custom-orders`, {
      name: 'TV Series Bulk Import Test',
      description: 'Testing exact series matching in bulk import'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✓ Created test order with ID: ${orderId}\n`);
    
    // Test data that should demonstrate exact matching preference
    const bulkImportData = `Doctor Who\tS1E1\tAn Unearthly Child\tepisode
Star Trek\tS1E1\tThe Man Trap\tepisode
The Office\tS1E1\tPilot\tepisode`;

    console.log('📋 Test bulk import data:');
    console.log(bulkImportData);
    console.log('');
    
    // Send the bulk import request
    console.log('📤 Processing bulk import...');
    
    const bulkImportResponse = await axios.post(`${API_BASE_URL}/api/custom-orders/${orderId}/bulk-import`, {
      data: bulkImportData
    });
    
    if (bulkImportResponse.status === 200) {
      const result = bulkImportResponse.data;
      console.log(`✅ Bulk import completed!`);
      console.log(`📊 Results: ${result.successCount} successful, ${result.failCount} failed`);
      
      if (result.failedItems && result.failedItems.length > 0) {
        console.log('❌ Failed items:');
        result.failedItems.forEach(item => console.log(`   - ${item}`));
      }
    } else {
      console.log('❌ Bulk import failed with status:', bulkImportResponse.status);
    }
    
    // Verify the imported items
    console.log('\n🔍 Verifying imported items...');
    const orderDetailsResponse = await axios.get(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    const order = orderDetailsResponse.data;
    
    console.log(`📺 Order contains ${order.items.length} items:`);
    
    const expectedMatches = {
      'An Unearthly Child': 'Doctor Who',
      'The Man Trap': 'Star Trek',
      'Pilot': /The Office/  // Could be "The Office" or "The Office (US)"
    };
    
    let correctMatches = 0;
    let totalTests = Object.keys(expectedMatches).length;
    
    order.items.forEach((item, index) => {
      console.log(`\n   ${index + 1}. "${item.title}"`);
      console.log(`      Series: "${item.seriesTitle}"`);
      console.log(`      Season: ${item.seasonNumber}, Episode: ${item.episodeNumber}`);
      
      // Check if this matches our expected behavior
      const expectedSeries = expectedMatches[item.title];
      if (expectedSeries) {
        const isCorrectMatch = typeof expectedSeries === 'string' 
          ? item.seriesTitle === expectedSeries
          : expectedSeries.test(item.seriesTitle);
          
        if (isCorrectMatch) {
          console.log(`      ✅ CORRECT: Matched expected series!`);
          correctMatches++;
        } else {
          console.log(`      ❌ ISSUE: Expected "${expectedSeries}", got "${item.seriesTitle}"`);
        }
      }
      
      // Additional check for exact match preference
      if (item.title === 'An Unearthly Child') {
        if (item.seriesTitle === 'Doctor Who') {
          console.log(`      🎯 Perfect! Selected "Doctor Who" over "Doctor Who (2005)"`);
        } else if (item.seriesTitle.includes('Doctor Who')) {
          console.log(`      ⚠️  Selected "${item.seriesTitle}" instead of exact "Doctor Who"`);
        }
      }
      
      if (item.title === 'The Man Trap') {
        if (item.seriesTitle === 'Star Trek') {
          console.log(`      🎯 Perfect! Selected "Star Trek" over specific variants`);
        } else if (item.seriesTitle.includes('Star Trek')) {
          console.log(`      ⚠️  Selected "${item.seriesTitle}" instead of exact "Star Trek"`);
        }
      }
    });
    
    // Summary
    console.log('\n=== Test Results ===');
    console.log(`📊 Correct matches: ${correctMatches}/${totalTests}`);
    
    if (correctMatches === totalTests) {
      console.log('🎉 ALL TESTS PASSED! TV series exact matching is working correctly!');
      console.log('✓ "Doctor Who" selected exact match over year-specific versions');
      console.log('✓ "Star Trek" selected exact match over specific series variants');
      console.log('✓ Bulk import successfully processed all items');
    } else if (correctMatches > 0) {
      console.log('⚠️  Some tests passed, but there may be issues with exact matching');
    } else {
      console.log('❌ Tests failed - exact matching may not be working correctly');
    }
    
    // Clean up
    console.log('\n🧹 Cleaning up test order...');
    await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    console.log('✓ Test order deleted');
    
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
  testTVSeriesBulkImportMatching().catch(console.error);
}

module.exports = { testTVSeriesBulkImportMatching };
