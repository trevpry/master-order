const prisma = require('./prismaClient');

async function checkCollections() {
  try {
    // Check shows with collections
    const showsWithCollections = await prisma.PlexTVShow.findMany({
      where: { 
        collections: { not: null }
      },
      take: 10
    });
    
    console.log('=== TV Shows with Collections ===');
    showsWithCollections.forEach(show => {
      console.log(`Title: ${show.title}`);
      console.log(`Collections: ${show.collections}`);
      console.log('---');
    });
    
    // Check movies with collections
    const moviesWithCollections = await prisma.PlexMovie.findMany({
      where: { 
        collections: { not: null }
      },
      take: 10
    });
    
    console.log('\n=== Movies with Collections ===');
    moviesWithCollections.forEach(movie => {
      console.log(`Title: ${movie.title}`);
      console.log(`Collections: ${movie.collections}`);
      console.log('---');
    });
    
    // Check the collection name setting
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('\n=== Collection Setting ===');
    console.log('Collection Name:', settings?.collectionName);
    
    // Search for content in "Now Playing" collection
    if (settings?.collectionName) {
      const collectionShows = await prisma.PlexTVShow.findMany({
        where: {
          collections: {
            contains: settings.collectionName
          }
        },
        take: 5
      });
      
      console.log(`\n=== Shows in "${settings.collectionName}" Collection ===`);
      collectionShows.forEach(show => {
        console.log(`Title: ${show.title}`);
        console.log(`Collections: ${show.collections}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCollections();
