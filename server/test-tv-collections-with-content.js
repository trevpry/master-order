const prisma = require('./prismaClient');
const PlexDatabaseService = require('./plexDatabaseService');

const plexDb = new PlexDatabaseService();

async function testTVCollectionsWithContent() {
  console.log('Starting test...');
  try {
    console.log('=== Testing TV Collections With Content ===\n');
    
    // 1. Find TV shows that actually have collections
    const tvShowsWithCollections = await prisma.plexTVShow.findMany({
      where: {
        collections: {
          not: null
        }
      },
      select: {
        title: true,
        year: true,
        collections: true,
        leafCount: true,
        viewedLeafCount: true
      },
      take: 20
    });
    
    console.log(`Found ${tvShowsWithCollections.length} TV shows with collections:`);
    tvShowsWithCollections.forEach(show => {
      const collections = show.collections ? JSON.parse(show.collections) : [];
      const watched = show.viewedLeafCount || 0;
      const total = show.leafCount || 0;
      const watchStatus = watched < total ? 'UNWATCHED' : 'FULLY WATCHED';
      console.log(`- ${show.title} (${show.year}) - ${watchStatus} ${watched}/${total}`);
      console.log(`  Collections: ${collections.join(', ')}`);
    });
    
    // 2. Get all unique collections from TV shows
    console.log('\n=== All TV Show Collections ===');
    const allTVCollections = await plexDb.getAllTVCollections();
    console.log(`Total unique TV collections: ${allTVCollections.length}`);
    allTVCollections.forEach(collection => {
      console.log(`- ${collection}`);
    });
    
    // 3. Test specific collections that have unwatched content
    console.log('\n=== Testing Specific Collections ===');
    
    const testCollections = ['The X Files', 'X-Men Animated', 'Now Watching', 'Dexter'];
    
    for (const collectionName of testCollections) {
      console.log(`\nTesting collection: "${collectionName}"`);
      const shows = await plexDb.getTVShowsByCollection(collectionName);
      console.log(`  Found ${shows.length} TV shows`);
      
      if (shows.length > 0) {
        shows.forEach(show => {
          const watched = show.viewedLeafCount || 0;
          const total = show.leafCount || 0;
          const watchStatus = watched < total ? 'HAS UNWATCHED' : 'FULLY WATCHED';
          console.log(`    - ${show.title} (${show.year}) - ${watchStatus} ${watched}/${total}`);
        });
      }
    }
      } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testTVCollectionsWithContent();
