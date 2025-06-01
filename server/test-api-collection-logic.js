const fetch = require('node-fetch');

async function testMovieCollectionSelection() {
  console.log('=== Testing Movie Collection Selection via API ===\n');
  
  try {
    // Make multiple requests to the up_next endpoint to see if collection logic works
    console.log('Making 10 requests to /up_next to test collection selection...\n');
    
    for (let i = 1; i <= 10; i++) {
      console.log(`Request ${i}:`);
      
      const response = await fetch('http://localhost:5555/up_next');
      const data = await response.json();
      
      console.log(`  Type: ${data.orderType}`);
      console.log(`  Title: ${data.title}`);
      
      if (data.orderType === 'MOVIES_GENERAL') {
        console.log(`  Year: ${data.year}`);
        console.log(`  Collections: ${data.collections || 'None'}`);
        
        // Check if this is actually an episode (indicating TV series was selected from collection)
        if (data.type === 'episode') {
          console.log(`  🎯 TV EPISODE SELECTED FROM COLLECTION!`);
          console.log(`  Series: ${data.title}`);
          console.log(`  Episode: S${data.currentSeason}E${data.currentEpisode} - ${data.nextEpisodeTitle}`);
        }
      } else if (data.orderType === 'TV_GENERAL') {
        console.log(`  Series: ${data.title}`);
        if (data.currentSeason && data.currentEpisode) {
          console.log(`  Episode: S${data.currentSeason}E${data.currentEpisode} - ${data.nextEpisodeTitle}`);
        }
      }
      
      console.log('');
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMovieCollectionSelection();
