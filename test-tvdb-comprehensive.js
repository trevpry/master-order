const tvdbService = require('./server/tvdbCachedService.js');

async function testTVDBSearch() {
  try {
    console.log("=== TVDB COMPREHENSIVE SEARCH TEST ===\n");
    
    // Test searches that should get different results
    const searches = [
      "Doctor Who",
      "Doctor Who (2005)", 
      "Doctor Who (2023)",
      "Sherlock"
    ];
    
    for (const searchTerm of searches) {
      console.log(`\n--- Searching for: "${searchTerm}" ---`);
      try {
        const results = await tvdbService.searchSeries(searchTerm);
        
        if (results && results.length > 0) {
          console.log("Results:");
          results.forEach((result, index) => {
            console.log(`  ${index + 1}. "${result.name}" (ID: ${result.tvdbId || result.id})`);
          });
        } else {
          console.log("No results found");
        }
      } catch (searchError) {
        console.error(`Error searching for "${searchTerm}":`, searchError.message);
      }
      
      console.log("-".repeat(50));
    }
    
  } catch (error) {
    console.error('Error in comprehensive test:', error);
  }
}

testTVDBSearch();
