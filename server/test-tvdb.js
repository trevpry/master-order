const tvdbService = require('./tvdbService');

async function testTVDB() {
  console.log('Testing TVDB service with detailed logging...\n');
  
  try {
    // Check if token is available first
    console.log('TVDB token available:', tvdbService.isTokenAvailable());
    
    // Test with a popular show that should have multiple language options
    const seriesName = 'The Office';
    const seasonNumber = 1;
    
    console.log(`Testing: ${seriesName}, Season ${seasonNumber}\n`);
    
    const result = await tvdbService.getCurrentSeasonArtwork(seriesName, seasonNumber);
    
    console.log('\n--- FINAL RESULT ---');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  }
}

testTVDB();
