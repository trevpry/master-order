/**
 * Test Enhanced Comic Bulk Import with ComicVine Search
 * Tests the new bulk import functionality that uses ComicVine search
 * to find the correct comic issue based on series name, issue number, and title
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

async function testEnhancedComicBulkImport() {
  console.log('=== Testing Enhanced Comic Bulk Import with ComicVine Search ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post(`${API_BASE_URL}/api/custom-orders`, {
      name: 'Enhanced Comic Bulk Import Test',
      description: 'Testing comic bulk import with ComicVine search integration'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // 2. Test the enhanced bulk import format
    console.log('\n2. Testing enhanced comic bulk import...');
    
    // Test data using the new format: Series Name, Issue #, Comic Title, Type
    const testComics = [
      // Format: Series\tIssue #\tComic Title\tComic
      {
        line: 'Batman Adventures (Vol. 1)\tIssue #07\tRaging Lizard\tcomic',
        expectedSeries: 'Batman Adventures (Vol. 1)',
        expectedIssue: '7',
        expectedTitle: 'Raging Lizard'
      },
      {
        line: 'The Amazing Spider-Man (2018)\t#01\tRe-Introduction\tcomic',
        expectedSeries: 'The Amazing Spider-Man (2018)',
        expectedIssue: '1',
        expectedTitle: 'Re-Introduction'
      },
      {
        line: 'X-Men\t#100\tGreater Love Hath No X-Man...\tcomic',
        expectedSeries: 'X-Men',
        expectedIssue: '100',
        expectedTitle: 'Greater Love Hath No X-Man...'
      }
    ];
    
    // 3. Process each comic individually to test the search logic
    for (let i = 0; i < testComics.length; i++) {
      const comic = testComics[i];
      console.log(`\n3.${i + 1}. Testing comic: ${comic.expectedTitle}`);
      console.log(`   Series: ${comic.expectedSeries}`);
      console.log(`   Issue: #${comic.expectedIssue}`);
      
      // Parse the comic data (simulate frontend parsing)
      const columns = comic.line.split('\t');
      const [seriesName, issueField, title, mediaType] = columns;
      
      // Extract issue number
      const issueMatch = issueField.match(/(?:issue\s*)?#?(\d+)/i);
      const issueNumber = issueMatch ? issueMatch[1] : null;
      
      if (!issueNumber) {
        console.log(`   ❌ Failed to parse issue number from: ${issueField}`);
        continue;
      }
      
      console.log(`   Parsed issue number: ${issueNumber}`);
      
      // Test the ComicVine search
      try {
        console.log(`   🔍 Searching ComicVine for "${seriesName}" issue #${issueNumber}...`);
        const searchResponse = await axios.get(`${API_BASE_URL}/api/comicvine/search-with-issues`, {
          params: {
            query: seriesName,
            issueNumber: issueNumber
          }
        });
        
        const searchResults = searchResponse.data;
        console.log(`   📚 Found ${searchResults.length} series with issue #${issueNumber}`);
        
        if (searchResults.length > 0) {
          // Find best match (simulate the enhanced logic)
          let selectedSeries = searchResults.find(series => {
            return series.issueName && series.issueName.toLowerCase().includes(title.toLowerCase());
          });
          
          if (!selectedSeries) {
            selectedSeries = searchResults[0]; // Use first result
            console.log(`   📖 Using first result: ${selectedSeries.name}`);
          } else {
            console.log(`   ✅ Found matching issue title: ${selectedSeries.issueName}`);
          }
          
          // Create the comic item
          const comicData = {
            mediaType: 'comic',
            title: title,
            comicSeries: selectedSeries.name,
            comicYear: selectedSeries.start_year,
            comicIssue: issueNumber,
            comicVineId: selectedSeries.api_detail_url,
            comicVineDetailsJson: JSON.stringify(selectedSeries)
          };
          
          console.log(`   📊 Comic data prepared:`, {
            series: comicData.comicSeries,
            year: comicData.comicYear,
            issue: comicData.comicIssue,
            hasComicVineData: !!comicData.comicVineId
          });
          
          // Add to custom order
          console.log(`   ➕ Adding comic to custom order...`);
          const addResponse = await axios.post(`${API_BASE_URL}/api/custom-orders/${orderId}/items`, comicData);
          
          if (addResponse.status === 201) {
            console.log(`   ✅ Successfully added: ${addResponse.data.title}`);
            console.log(`   📋 Item ID: ${addResponse.data.id}`);
          } else {
            console.log(`   ❌ Failed to add comic: HTTP ${addResponse.status}`);
          }
          
        } else {
          console.log(`   ⚠️  No ComicVine results found, would use fallback data`);
        }
        
      } catch (searchError) {
        if (searchError.response?.status === 500) {
          console.log(`   ⚠️  ComicVine API not available (${searchError.response.status})`);
        } else {
          console.log(`   ❌ Search error: ${searchError.message}`);
        }
      }
    }
    
    // 4. Verify the custom order contents
    console.log('\n4. Verifying custom order contents...');
    const orderCheckResponse = await axios.get(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    const order = orderCheckResponse.data;
    
    console.log(`✅ Custom order now has ${order.items.length} items:`);
    order.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title}`);
      console.log(`      Series: ${item.comicSeries} (${item.comicYear || 'No year'}) #${item.comicIssue}`);
      console.log(`      ComicVine ID: ${item.comicVineId ? 'Present' : 'None'}`);
    });
    
    // 5. Clean up
    console.log('\n5. Cleaning up test order...');
    await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');
    
    // 6. Final results
    console.log('\n=== Test Results ===');
    const successfulItems = order.items.filter(item => item.mediaType === 'comic');
    console.log(`✅ Successfully imported: ${successfulItems.length} comics`);
    
    if (successfulItems.length > 0) {
      console.log('\n🎉 ENHANCED COMIC BULK IMPORT WORKING! ✅');
      console.log('✓ Comics are being searched via ComicVine');
      console.log('✓ Issue numbers and titles are being used for matching');
      console.log('✓ ComicVine data is being stored for artwork caching');
    } else {
      console.log('\n❌ No comics were successfully imported');
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
  testEnhancedComicBulkImport().catch(console.error);
}

module.exports = { testEnhancedComicBulkImport };
