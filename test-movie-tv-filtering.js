const getNextMovie = require('./server/getNextMovie');

async function testMovieSelectionWithTVFiltering() {
  console.log('=== Testing Movie Selection with TV Series Filtering ===\n');
  
  try {
    // Test the movie selection multiple times to see the results
    for (let i = 1; i <= 5; i++) {
      console.log(`Test ${i}:`);
      const result = await getNextMovie();
      
      console.log(`  Title: ${result.title}`);
      console.log(`  Order Type: ${result.orderType}`);
      console.log(`  Type: ${result.type || 'movie'}`);
      
      if (result.collections) {
        const collections = JSON.parse(result.collections);
        console.log(`  Collections: ${collections.join(', ')}`);
      } else {
        console.log(`  Collections: None`);
      }
      
      if (result.type === 'episode') {
        console.log(`  🎯 TV EPISODE SELECTED FROM COLLECTION!`);
        console.log(`  Series: ${result.title}`);
        console.log(`  Episode: S${result.currentSeason}E${result.currentEpisode} - ${result.nextEpisodeTitle}`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMovieSelectionWithTVFiltering();
