// Test Frontend TVDB Integration
const axios = require('axios');

async function testFrontendIntegration() {
  console.log('=== Testing Frontend TVDB Artwork Integration ===\n');
  
  try {
    // 1. Test the main up_next API
    console.log('1. Testing /api/up_next endpoint...');
    const upNextResponse = await axios.get('http://localhost:3001/api/up_next');
    const mediaData = upNextResponse.data;
    
    console.log(`✓ Series: ${mediaData.title}`);
    console.log(`✓ Order Type: ${mediaData.orderType}`);
    console.log(`✓ Season: ${mediaData.currentSeason}, Episode: ${mediaData.currentEpisode}`);
    console.log(`✓ Next Episode: ${mediaData.nextEpisodeTitle}`);
    
    // 2. Check TVDB artwork data
    if (mediaData.tvdbArtwork && mediaData.tvdbArtwork.url) {
      console.log(`\n2. TVDB Artwork Found:`);
      console.log(`✓ URL: ${mediaData.tvdbArtwork.url}`);
      console.log(`✓ Series: ${mediaData.tvdbArtwork.seriesName}`);
      console.log(`✓ Season: ${mediaData.tvdbArtwork.seasonNumber}`);
      console.log(`✓ Series Status: ${mediaData.tvdbArtwork.seriesStatus}`);
      console.log(`✓ Is Final Season: ${mediaData.tvdbArtwork.isCurrentSeasonFinal}`);
      
      // 3. Test the frontend artwork URL construction
      console.log(`\n3. Testing Frontend Artwork URL Construction:`);
      const frontendArtworkUrl = `http://localhost:3001/api/tvdb-artwork?url=${encodeURIComponent(mediaData.tvdbArtwork.url)}`;
      console.log(`✓ Frontend URL: ${frontendArtworkUrl}`);
      
      // 4. Test the actual artwork loading
      console.log(`\n4. Testing Artwork Loading:`);
      try {
        const artworkResponse = await axios.get(frontendArtworkUrl, {
          responseType: 'stream',
          timeout: 10000
        });
        console.log(`✓ Artwork Status: ${artworkResponse.status}`);
        console.log(`✓ Content Type: ${artworkResponse.headers['content-type']}`);
        console.log(`✓ Content Length: ${artworkResponse.headers['content-length'] || 'Unknown'}`);
        console.log(`✓ Cache Control: ${artworkResponse.headers['cache-control']}`);
      } catch (artworkError) {
        console.error(`✗ Artwork Loading Failed: ${artworkError.message}`);
      }
      
    } else {
      console.log(`\n2. No TVDB Artwork Found`);
      if (mediaData.thumb) {
        console.log(`✓ Fallback Plex Artwork: ${mediaData.thumb}`);
      }
    }
    
    // 5. Test fallback scenarios
    console.log(`\n5. Frontend Artwork Priority Logic:`);
    if (mediaData.tvdbArtwork && mediaData.tvdbArtwork.url) {
      console.log(`✓ Priority 1: TVDB Artwork - SELECTED`);
      console.log(`  - Using: ${mediaData.tvdbArtwork.url}`);
    } else if (mediaData.thumb) {
      console.log(`✓ Priority 2: Plex Artwork - SELECTED`);
      console.log(`  - Using: ${mediaData.thumb}`);
    } else {
      console.log(`✗ No Artwork Available`);
    }
    
    // 6. Test finale and season detection
    console.log(`\n6. Episode & Season Status:`);
    if (mediaData.finaleType) {
      console.log(`✓ Finale Type: ${mediaData.finaleType}`);
    }
    if (mediaData.isCurrentSeasonFinal) {
      console.log(`✓ Final Season: Yes (${mediaData.seriesStatus})`);
    } else {
      console.log(`✓ Final Season: No`);
    }
    
    console.log(`\n✅ Frontend Integration Test Complete!`);
    
  } catch (error) {
    console.error(`✗ Frontend Integration Test Failed:`, error.message);
  }
}

testFrontendIntegration();
