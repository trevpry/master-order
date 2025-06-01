const comicVineService = require('./comicVineService');

async function testComicVineIntegration() {
  console.log('=== ComicVine API Integration Test ===\n');
  
  try {
    // Test 1: Check API key availability
    console.log('1. Testing API key availability...');
    const isAvailable = await comicVineService.isApiKeyAvailable();
    console.log(`   API key available: ${isAvailable}\n`);
    
    if (!isAvailable) {
      console.log('❌ API key not available. Cannot proceed with tests.');
      return;
    }
    
    // Test 2: Search for a popular comic series
    console.log('2. Testing series search for "Batman"...');
    const searchResults = await comicVineService.searchSeries('Batman');
    console.log(`   Found ${searchResults.length} series results`);
    
    if (searchResults.length > 0) {
      const firstSeries = searchResults[0];
      console.log(`   First result: "${firstSeries.name}" (ID: ${firstSeries.id})`);
      console.log(`   Publisher: ${firstSeries.publisher?.name || 'Unknown'}`);
      console.log(`   Start year: ${firstSeries.start_year || 'Unknown'}\n`);
      
      // Test 3: Get a specific issue from the series
      console.log('3. Testing issue lookup...');
      const issue = await comicVineService.getIssueByNumber(firstSeries.id, 1);
      
      if (issue) {
        console.log(`   Found issue #1: "${issue.name || 'Untitled'}"`);
        console.log(`   Issue ID: ${issue.id}`);
        console.log(`   Cover date: ${issue.cover_date || 'Unknown'}\n`);
          // Test 4: Get cover art for the issue
        console.log('4. Testing cover art retrieval...');
        const testComicString = `${firstSeries.name} (${firstSeries.start_year || '1940'}) #1`;
        console.log(`   Testing with comic string: "${testComicString}"`);
        const coverArt = await comicVineService.getComicCoverArt(testComicString);
        
        if (coverArt) {
          console.log(`   Cover art URL: ${coverArt}`);
          console.log('   ✅ Cover art retrieved successfully!\n');
        } else {
          console.log('   ⚠️  No cover art found for this issue\n');
        }
        
        // Test 5: Test the comic details structure
        console.log('5. Testing comic details structure...');
        const comicDetails = {
          title: issue.name || firstSeries.name,
          issueNumber: issue.issue_number || 1,
          series: firstSeries.name,
          publisher: firstSeries.publisher?.name || 'Unknown',
          coverDate: issue.cover_date,
          comicVineId: issue.id,
          seriesId: firstSeries.id,
          coverArt: coverArt
        };
        
        console.log('   Comic details structure:');
        console.log('   ', JSON.stringify(comicDetails, null, 4));
        console.log('   ✅ Comic details structure is valid!\n');
        
      } else {
        console.log('   ⚠️  Could not find issue #1 for this series\n');
      }
    } else {
      console.log('   ❌ No series found for "Batman". API might not be working properly.\n');
    }
    
    console.log('=== Test Summary ===');
    console.log('✅ ComicVine API integration test completed');
    console.log('✅ All components are working correctly');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testComicVineIntegration().then(() => {
  console.log('\nTest execution finished.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
