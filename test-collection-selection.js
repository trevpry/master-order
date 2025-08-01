const { PrismaClient } = require('./server/node_modules/@prisma/client');
const PlexDatabaseService = require('./server/plexDatabaseService');

async function testCollectionSelection() {
  const prisma = new PrismaClient();
  const plexDb = new PlexDatabaseService();
  
  try {
    console.log('🧪 Testing collection selection for Big Bang Theory and Young Sheldon...');
    
    // Search for both shows by looking at all TV shows
    const allTVShows = await plexDb.getAllTVShows();
    console.log(`Found ${allTVShows.length} total TV shows`);
    
    const bigBangTheory = allTVShows.find(show => show.title.includes('Big Bang Theory'));
    const youngSheldon = allTVShows.find(show => show.title.includes('Young Sheldon'));
    
    if (bigBangTheory) {
      console.log('\\nFound The Big Bang Theory:');
      console.log('- Title:', bigBangTheory.title);
      console.log('- RatingKey:', bigBangTheory.ratingKey);
      console.log('- Collections:', bigBangTheory.collections);
      console.log('- Unwatched episodes:', bigBangTheory.leafCount - (bigBangTheory.viewedLeafCount || 0));
      
      // Get next unwatched episode
      try {
        const nextEpisode = await plexDb.getNextUnwatchedEpisode(bigBangTheory.ratingKey);
        if (nextEpisode) {
          console.log('- Next Episode:', nextEpisode.title);
          console.log('- Season:', nextEpisode.parentIndex);
          console.log('- Episode:', nextEpisode.index);
          console.log('- Air Date:', nextEpisode.originallyAvailableAt);
        } else {
          console.log('- No unwatched episodes');
        }
      } catch (error) {
        console.log('- Error getting next episode:', error.message);
      }
    } else {
      console.log('The Big Bang Theory not found');
    }
    
    if (youngSheldon) {
      console.log('\\nFound Young Sheldon:');
      console.log('- Title:', youngSheldon.title);
      console.log('- RatingKey:', youngSheldon.ratingKey);
      console.log('- Collections:', youngSheldon.collections);
      console.log('- Unwatched episodes:', youngSheldon.leafCount - (youngSheldon.viewedLeafCount || 0));
      
      // Get next unwatched episode
      try {
        const nextEpisode = await plexDb.getNextUnwatchedEpisode(youngSheldon.ratingKey);
        if (nextEpisode) {
          console.log('- Next Episode:', nextEpisode.title);
          console.log('- Season:', nextEpisode.parentIndex);
          console.log('- Episode:', nextEpisode.index);
          console.log('- Air Date:', nextEpisode.originallyAvailableAt);
        } else {
          console.log('- No unwatched episodes');
        }
      } catch (error) {
        console.log('- Error getting next episode:', error.message);
      }
    } else {
      console.log('Young Sheldon not found');
    }
    
    // Check if they share collections
    if (bigBangTheory && youngSheldon) {
      const bbCollections = plexDb.parseCollections(bigBangTheory.collections || '');
      const ysCollections = plexDb.parseCollections(youngSheldon.collections || '');
      
      console.log('\\nCollection Analysis:');
      console.log('Big Bang Theory collections:', bbCollections);
      console.log('Young Sheldon collections:', ysCollections);
      
      const sharedCollections = bbCollections.filter(col => ysCollections.includes(col));
      console.log('Shared collections:', sharedCollections);
      
      if (sharedCollections.length > 0) {
        console.log('\\n✅ Shows share collections - they should be considered together for chronological selection');
      } else {
        console.log('\\n❌ Shows do not share collections - this could be the issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCollectionSelection();
