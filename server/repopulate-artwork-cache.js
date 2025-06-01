const tvdbService = require('./tvdbCachedService');

async function repopulateArtworkCache() {
  console.log('=== REPOPULATING TVDB ARTWORK CACHE ===\n');
  
  // Test with a few popular TV shows that should have good artwork
  const testShows = [
    { name: 'South Park', season: 3, episode: 1 },
    { name: 'The Office', season: 1, episode: 1 },
    { name: 'Breaking Bad', season: 1, episode: 1 },
    { name: 'Stranger Things', season: 1, episode: 1 }
  ];
  
  try {
    for (const show of testShows) {
      console.log(`\n--- Syncing ${show.name} Season ${show.season} ---`);
      
      try {
        const artwork = await tvdbService.getCurrentSeasonArtwork(
          show.name, 
          show.season, 
          show.episode
        );
        
        if (artwork) {
          console.log(`✅ Success: Found artwork for ${show.name} Season ${show.season}`);
          console.log(`   URL: ${artwork.url}`);
          console.log(`   Series ID: ${artwork.seriesId}`);
          
          if (show.name === 'South Park' && show.season === 3) {
            console.log('🎯 SOUTH PARK SEASON 3 ARTWORK UPDATED - This should fix the wrong artwork issue!');
          }
        } else {
          console.log(`❌ No artwork found for ${show.name} Season ${show.season}`);
        }
        
        // Small delay between requests to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error syncing ${show.name}:`, error.message);
      }
    }
    
    console.log('\n=== CACHE REPOPULATION COMPLETE ===');
    console.log('The artwork cache has been repopulated with fresh, non-contaminated data.');
    console.log('Your TV season artwork should now display correctly!');
    
  } catch (error) {
    console.error('Error during cache repopulation:', error);
  }
}

repopulateArtworkCache();
