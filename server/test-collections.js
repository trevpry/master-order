const prisma = require('./prismaClient');
const PlexDatabaseService = require('./plexDatabaseService');

const plexDb = new PlexDatabaseService();

async function testCollections() {
  try {
    console.log('=== Testing Collections ===');
    
    // 1. Get current collection setting
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('Current collection setting:', settings?.collectionName || 'None');
    
    // 2. Find collections that actually have content
    console.log('\n=== Collections with Movies ===');
    const allMovies = await plexDb.getAllMovies();
    const movieCollections = new Set();
    
    allMovies.forEach(movie => {
      if (movie.collections) {
        const collections = plexDb.parseCollections(movie.collections);
        collections.forEach(col => movieCollections.add(col));
      }
    });
    
    console.log(`Found ${movieCollections.size} unique movie collections:`);
    Array.from(movieCollections).slice(0, 10).forEach(col => {
      console.log(`- ${col}`);
    });
    
    // 3. Test a few collections that have movies
    if (movieCollections.size > 0) {
      const firstCollection = Array.from(movieCollections)[0];
      console.log(`\nTesting collection: "${firstCollection}"`);
      const moviesInCollection = await plexDb.getMoviesByCollection(firstCollection);
      console.log(`Movies in "${firstCollection}": ${moviesInCollection.length}`);
      
      if (moviesInCollection.length > 0) {
        console.log('Sample movies:');
        moviesInCollection.slice(0, 3).forEach(movie => {
          console.log(`- ${movie.title} (${movie.year}) - Watched: ${movie.viewCount || 0 > 0}`);
        });
      }
    }
    
    // 4. Check TV shows
    console.log('\n=== Collections with TV Shows ===');
    const allTVShows = await plexDb.getAllTVShows();
    const tvCollections = new Set();
    
    allTVShows.forEach(show => {
      if (show.collections) {
        const collections = plexDb.parseCollections(show.collections);
        collections.forEach(col => tvCollections.add(col));
      }
    });
    
    console.log(`Found ${tvCollections.size} unique TV collections:`);
    Array.from(tvCollections).slice(0, 10).forEach(col => {
      console.log(`- ${col}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCollections();
