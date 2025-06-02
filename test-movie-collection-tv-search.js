const axios = require('axios');

async function testMovieCollectionTVSearch() {
  console.log('🔍 Testing Movie Collection TV Series Search Issue');
  console.log('=' .repeat(60));
  
  try {
    // Make requests to see what gets selected
    console.log('\n1️⃣  Testing Movie Selection from Partially Watched Collections...');
    
    for (let i = 1; i <= 5; i++) {
      console.log(`\nTest ${i}:`);
        const response = await axios.get('http://localhost:3001/api/up_next');
      const data = response.data;
      
      console.log(`  Selection Type: ${data.orderType}`);
      console.log(`  Title: "${data.title}"`);
      console.log(`  Type: ${data.type || 'movie'}`);
      
      if (data.collections) {
        const collections = JSON.parse(data.collections);
        console.log(`  Collections: [${collections.join(', ')}]`);
        
        // Check if this is a movie from a collection that should have TV series
        if (data.orderType === 'MOVIES_GENERAL' && data.type !== 'episode' && collections.length > 0) {
          console.log(`  🎬 Movie selected from collection(s): ${collections.join(', ')}`);
          
          // Check what the search variants would be
          collections.forEach(collection => {
            console.log(`    Collection: "${collection}"`);
            
            const searchVariants = [
              collection,
              `${collection} Collection`
            ];
            
            console.log(`    ❌ INCORRECT Search variants: ["${searchVariants.join('", "')}"]`);
            
            // What it should be:
            const correctedVariants = [
              collection,
              collection.replace(/ Collection$/, '')
            ].filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates
            
            console.log(`    ✅ CORRECT Search variants: ["${correctedVariants.join('", "')}"]`);
          });
        }
        
        if (data.type === 'episode') {
          console.log(`  📺 TV Episode selected! Series: "${data.title}"`);
          console.log(`  Episode: S${data.currentSeason}E${data.currentEpisode} - ${data.nextEpisodeTitle}`);
        }
      } else {
        console.log(`  Collections: None`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

testMovieCollectionTVSearch();
