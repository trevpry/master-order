require('dotenv').config({ path: './server/.env' });
const getNextEpisode = require('./server/getNextEpisode');
const getNextMovie = require('./server/getNextMovie');

async function testEnhancedCollectionLogic() {
  console.log('🧪 Testing Enhanced Collection Selection Logic with originallyAvailableAt dates');
  console.log('=' .repeat(80));
  
  try {
    console.log('\n📺 Testing TV Episode Selection Logic...');
    console.log('-'.repeat(50));
    
    const episodeResult = await getNextEpisode();
    
    if (episodeResult.orderType === 'TV_GENERAL') {
      console.log('✅ Episode Selection Result:');
      console.log(`   Title: ${episodeResult.title}`);
      console.log(`   Type: ${episodeResult.libraryType || 'tv'}`);
      console.log(`   Originally Available At: ${episodeResult.originallyAvailableAt || 'N/A'}`);
      
      if (episodeResult.currentSeason && episodeResult.currentEpisode) {
        console.log(`   Next Episode: S${episodeResult.currentSeason}E${episodeResult.currentEpisode} - ${episodeResult.nextEpisodeTitle}`);
      }
      
      if (episodeResult.otherCollections && episodeResult.otherCollections.length > 0) {
        console.log(`   Other Collections Found: ${episodeResult.otherCollections.length}`);
        episodeResult.otherCollections.forEach(collection => {
          console.log(`     - ${collection.title} (${collection.items.length} items)`);
        });
      }
    } else {
      console.log(`🔀 Episode selection returned: ${episodeResult.orderType}`);
    }
    
    console.log('\n🎬 Testing Movie Selection Logic...');
    console.log('-'.repeat(50));
    
    const movieResult = await getNextMovie();
    
    if (movieResult.orderType === 'MOVIES_GENERAL' || movieResult.orderType === 'TV_GENERAL') {
      console.log('✅ Movie Selection Result:');
      console.log(`   Title: ${movieResult.title}`);
      console.log(`   Type: ${movieResult.libraryType || 'movie'}`);
      console.log(`   Originally Available At: ${movieResult.originallyAvailableAt || movieResult.year || 'N/A'}`);
      
      if (movieResult.type === 'episode') {
        console.log(`   Selected Episode: S${movieResult.seasonNumber}E${movieResult.episodeNumber} - ${movieResult.episodeTitle}`);
        console.log(`   Episode Originally Available At: ${movieResult.nextEpisodeInfo?.originallyAvailableAt || 'N/A'}`);
      }
      
      if (movieResult.otherCollections && movieResult.otherCollections.length > 0) {
        console.log(`   Other Collections Found: ${movieResult.otherCollections.length}`);
        movieResult.otherCollections.forEach(collection => {
          console.log(`     - ${collection.title} (${collection.items.length} items)`);
        });
      }
    }
    
    console.log('\n🔍 Date Comparison Analysis:');
    console.log('-'.repeat(50));
    
    if (episodeResult.orderType === 'TV_GENERAL' && movieResult.orderType !== 'TV_GENERAL') {
      const episodeDate = episodeResult.originallyAvailableAt || episodeResult.year;
      const movieDate = movieResult.originallyAvailableAt || movieResult.year;
      
      if (episodeDate && movieDate) {
        const epDate = new Date(episodeDate);
        const mvDate = new Date(movieDate);
        
        console.log(`📅 Episode Date: ${episodeDate}`);
        console.log(`📅 Movie Date: ${movieDate}`);
        
        if (epDate < mvDate) {
          console.log('✅ Episode is chronologically earlier than movie');
        } else if (epDate > mvDate) {
          console.log('✅ Movie is chronologically earlier than episode');
        } else {
          console.log('📅 Episode and movie have the same date');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing enhanced collection logic:', error);
  }
}

// Run the test
testEnhancedCollectionLogic().catch(console.error);
