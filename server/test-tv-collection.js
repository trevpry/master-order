const prisma = require('./prismaClient');
const PlexDatabaseService = require('./plexDatabaseService');

const plexDb = new PlexDatabaseService();

async function testTVCollection() {
  try {
    console.log('=== Testing TV Collection Logic ===');
    
    // 1. Get the collection name from settings
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    const collectionName = settings?.collectionName || 'Now Playing';
    console.log('Collection Name from settings:', collectionName);
    
    // 2. Try to get TV shows from this collection
    console.log(`\nSearching for TV shows in "${collectionName}" collection...`);
    const tvShows = await plexDb.getTVShowsByCollection(collectionName);
    console.log(`Found ${tvShows.length} TV shows in collection`);
    
    if (tvShows.length > 0) {
      console.log('\nFirst few TV shows:');
      tvShows.slice(0, 3).forEach(show => {
        console.log(`- ${show.title} (${show.year}) - Watched: ${show.viewedLeafCount || 0}/${show.leafCount || 0}`);
      });
    }
    
    // 3. Also check if there are any TV shows at all
    const allTVShows = await plexDb.getAllTVShows();
    console.log(`\nTotal TV shows in database: ${allTVShows.length}`);
    
    if (allTVShows.length > 0) {
      console.log('First few TV shows from all:');
      allTVShows.slice(0, 3).forEach(show => {
        console.log(`- ${show.title} (${show.year}) - Collections: ${show.collections || 'None'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTVCollection();
