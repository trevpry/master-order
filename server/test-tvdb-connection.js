const TvdbCachedService = require('./tvdbCachedService');

async function testTvdbConnection() {
  console.log('=== TESTING TVDB CONNECTION ===\n');
  
  const tvdbService = new TvdbCachedService();
  
  try {
    // Check if token is available
    if (!tvdbService.isTokenAvailable()) {
      console.log('❌ TVDB token not available');
      return;
    }
    
    console.log('✅ TVDB token is available');
    
    // Test with South Park specifically since that's the one with wrong artwork
    console.log('\n--- Testing South Park Season 3 ---');
    
    const artwork = await tvdbService.getCurrentSeasonArtwork('South Park', 3, 1);
    
    if (artwork) {
      console.log('✅ SUCCESS: Found artwork for South Park Season 3');
      console.log(`Series: ${artwork.seriesName}`);
      console.log(`Season: ${artwork.seasonNumber}`);
      console.log(`URL: ${artwork.url}`);
      console.log(`Series ID: ${artwork.seriesId}`);
      console.log('\n🎯 This should fix the wrong artwork issue!');
    } else {
      console.log('❌ No artwork found for South Park Season 3');
    }
    
  } catch (error) {
    console.error('Error testing TVDB connection:', error.message);
  }
}

testTvdbConnection();
