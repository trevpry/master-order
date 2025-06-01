const axios = require('axios');

async function testUpNextAPI() {
  console.log('=== TESTING UP NEXT API ===\n');
  
  try {
    // Force TV content by temporarily updating settings
    console.log('1. Setting TV content to 100% for testing...');
    
    const settingsResponse = await axios.post('http://localhost:3001/api/settings', {
      tvGeneralPercent: 100,
      moviesGeneralPercent: 0,
      customOrderPercent: 0
    });
    
    console.log('Settings updated:', settingsResponse.status === 200 ? 'Success' : 'Failed');
    
    // Test up_next API multiple times to see what content we get
    console.log('\n2. Testing up_next API (should return TV content)...');
    
    for (let i = 1; i <= 3; i++) {
      try {
        console.log(`\n--- Test ${i} ---`);
        
        const response = await axios.get('http://localhost:3001/api/up_next');
        const data = response.data;
        
        console.log(`Media Type: ${data.mediaType}`);
        console.log(`Title: ${data.title}`);
        
        if (data.mediaType === 'episode') {
          console.log(`Series: ${data.seriesTitle}`);
          console.log(`Season: ${data.currentSeason}`);
          console.log(`Episode: ${data.currentEpisode} - "${data.nextEpisodeTitle}"`);
          
          // Check artwork sources
          if (data.tvdbArtwork && data.tvdbArtwork.url) {
            console.log(`TVDB Artwork: ${data.tvdbArtwork.url}`);
          } else {
            console.log(`Plex Artwork: ${data.thumb || 'None'}`);
          }
          
          // If this is South Park Season 3, highlight it
          if (data.seriesTitle && data.seriesTitle.includes('South Park') && data.currentSeason === 3) {
            console.log('🎯 FOUND SOUTH PARK SEASON 3 - Check if artwork is correct!');
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Test ${i} failed:`, error.message);
      }
    }
    
    // Reset settings to balanced
    console.log('\n3. Resetting settings to balanced...');
    await axios.post('http://localhost:3001/api/settings', {
      tvGeneralPercent: 50,
      moviesGeneralPercent: 50,
      customOrderPercent: 0
    });
    console.log('Settings reset to balanced');
    
  } catch (error) {
    console.error('Error testing up_next API:', error.message);
  }
}

testUpNextAPI();
