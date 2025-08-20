const tvdbService = require('./server/tvdbCachedService.js');

async function testTVDBMatching() {
  try {
    console.log("Testing TVDB cached service matching for 'Doctor Who'...\n");
    
    const results = await tvdbService.searchSeries('Doctor Who');
    
    console.log("Results:");
    if (results && results.length > 0) {
      results.forEach((result, index) => {
        console.log(`${index + 1}. "${result.name}" (ID: ${result.tvdbId || result.id})`);
      });
    } else {
      console.log("No results found");
    }
    
  } catch (error) {
    console.error('Error testing TVDB matching:', error);
  }
}

testTVDBMatching();
