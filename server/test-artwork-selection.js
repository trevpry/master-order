// Test script to verify enhanced TVDB artwork selection with English language prioritization
require('dotenv').config();
const TvdbCachedService = require('./tvdbCachedService');

async function testArtworkSelection() {
  console.log('=== Testing Enhanced TVDB Artwork Selection ===\n');

  try {
    // Test with a series that likely has multiple language versions and season artwork
    const testSeries = [
      { name: 'The Office', season: 1 },
      { name: 'Breaking Bad', season: 1 },
      { name: 'Game of Thrones', season: 1 },
      { name: 'Stranger Things', season: 1 }
    ];

    for (const { name, season } of testSeries) {
      console.log(`\n--- Testing: ${name} Season ${season} ---`);
      
      try {
        const result = await TvdbCachedService.getCurrentSeasonArtwork(name, season, 1);
        
        if (result) {
          console.log(`✅ Success: Found artwork for ${name} Season ${season}`);
          console.log(`   URL: ${result.url}`);
          console.log(`   Series ID: ${result.seriesId}`);
          console.log(`   Season ID: ${result.seasonId || 'N/A'}`);
          console.log(`   Series Status: ${result.seriesStatus || 'Unknown'}`);
          
          // Validate URL format
          if (result.url && (result.url.startsWith('http://') || result.url.startsWith('https://'))) {
            console.log(`   ✅ URL format is valid`);
          } else {
            console.log(`   ⚠️  URL format may be invalid: ${result.url}`);
          }
        } else {
          console.log(`❌ No artwork found for ${name} Season ${season}`);
        }
      } catch (error) {
        console.error(`❌ Error testing ${name}: ${error.message}`);
      }
      
      // Add a small delay between requests to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== Artwork Selection Test Complete ===');
    
    // Test the database service artwork selection directly
    console.log('\n--- Testing Direct Database Artwork Selection ---');
    
    // Create some mock artwork data to test the selection logic
    const mockArtworks = [
      { id: '1', image: '/banners/test1.jpg', language: 'fra', type: 7, width: 680, height: 1000, score: 8.5 },
      { id: '2', image: '/banners/test2.jpg', language: 'eng', type: 7, width: 680, height: 1000, score: 7.8 },
      { id: '3', image: '/banners/test3.jpg', language: null, type: 7, width: 1024, height: 1500, score: 9.2 },
      { id: '4', image: '/banners/test4.jpg', language: 'eng', type: 7, width: 1024, height: 1500, score: 8.9 },
      { id: '5', image: '/banners/test5.jpg', language: 'deu', type: 7, width: 1024, height: 1500, score: 9.5 }
    ];

    const TvdbDatabaseService = require('./tvdbDatabaseService');
    const dbService = new TvdbDatabaseService();
    
    const selectedArtwork = dbService.selectBestArtwork(mockArtworks, 'season');
    console.log(`Selected artwork from mock data: ${selectedArtwork}`);
    
    // Expected: Should select id '4' because it's English ('eng') with highest resolution (1024x1500) among English options
    if (selectedArtwork && selectedArtwork.includes('test4.jpg')) {
      console.log('✅ Artwork selection correctly prioritized English language and highest resolution');
    } else {
      console.log('⚠️  Artwork selection may not be working as expected');
      console.log(`   Expected: test4.jpg (English, high res), Got: ${selectedArtwork}`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testArtworkSelection().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
