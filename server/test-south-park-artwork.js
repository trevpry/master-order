const axios = require('axios');

async function testSouthParkArtwork() {
  console.log('=== TESTING SOUTH PARK ARTWORK FIX ===\n');
  
  try {
    // Set to 100% TV to increase chances of getting South Park
    console.log('Setting TV content to 100%...');
    await axios.post('http://localhost:3001/api/settings', {
      tvGeneralPercent: 100,
      moviesGeneralPercent: 0,
      customOrderPercent: 0
    });
    
    console.log('Testing multiple API calls to find South Park...');
    
    let southParkFound = false;
    let attempts = 0;
    const maxAttempts = 20;
    
    while (!southParkFound && attempts < maxAttempts) {
      attempts++;
      console.log(`\n--- Attempt ${attempts} ---`);
      
      try {
        const response = await axios.get('http://localhost:3001/api/up_next');
        const data = response.data;
        
        if (data.mediaType === 'episode') {
          console.log(`Found: ${data.seriesTitle} Season ${data.currentSeason}, Episode ${data.currentEpisode}`);
          
          // Check if this is South Park
          if (data.seriesTitle && data.seriesTitle.toLowerCase().includes('south park')) {
            console.log('\n🎯 FOUND SOUTH PARK! 🎯');
            console.log(`Series: ${data.seriesTitle}`);
            console.log(`Season: ${data.currentSeason}`);
            console.log(`Episode: ${data.currentEpisode} - "${data.nextEpisodeTitle}"`);
            
            if (data.tvdbArtwork && data.tvdbArtwork.url) {
              console.log(`\n✅ TVDB Artwork URL: ${data.tvdbArtwork.url}`);
              console.log(`Series ID: ${data.tvdbArtwork.seriesId}`);
              console.log(`Season Number: ${data.tvdbArtwork.seasonNumber}`);
              
              if (data.currentSeason === 3) {
                console.log('\n🎯 THIS IS SEASON 3 - THE ARTWORK ISSUE SHOULD BE FIXED!');
                console.log('Check if this artwork URL shows the correct South Park Season 3 artwork.');
              }
            } else {
              console.log(`\n⚠️ Using Plex artwork: ${data.thumb || 'None'}`);
            }
            
            southParkFound = true;
            break;
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`API call ${attempts} failed:`, error.message);
      }
    }
    
    if (!southParkFound) {
      console.log(`\n❌ South Park not found after ${maxAttempts} attempts`);
      console.log('You may need to mark some South Park episodes as unwatched to test.');
    }
    
    // Reset settings
    console.log('\nResetting settings to balanced...');
    await axios.post('http://localhost:3001/api/settings', {
      tvGeneralPercent: 50,
      moviesGeneralPercent: 50,
      customOrderPercent: 0
    });
    console.log('Settings reset to balanced');
    
  } catch (error) {
    console.error('Error testing South Park artwork:', error.message);
  }
}

testSouthParkArtwork();
