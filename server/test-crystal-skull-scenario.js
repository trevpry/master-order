const { PrismaClient } = require('@prisma/client');
const getNextMovie = require('./getNextMovie');

const prisma = new PrismaClient();

async function testCrystalSkullScenario() {
  try {
    console.log('=== Testing Crystal Skull → Raiders Selection ===\n');
    
    // 1. Simulate the scenario where Crystal Skull is initially selected
    console.log('1. Finding "Crystal Skull" movie in database:');
    const crystalSkull = await prisma.plexMovie.findFirst({
      where: { title: { contains: "Crystal Skull" } },
      include: { section: true }
    });
    
    if (!crystalSkull) {
      console.log('❌ Crystal Skull not found');
      return;
    }
    
    console.log(`✅ Found: ${crystalSkull.title} (${crystalSkull.year})`);
    console.log(`   Collections: ${crystalSkull.collections || 'None'}`);
    console.log(`   View Count: ${crystalSkull.viewCount || 0}`);
    
    // 2. Test collection processing
    const PlexDatabaseService = require('./plexDatabaseService');
    const plexDb = new PlexDatabaseService(prisma);
    
    console.log('\n2. Processing collections for Crystal Skull:');
    const collections = plexDb.parseCollections(crystalSkull.collections || '');
    console.log(`   Parsed collections: ${collections.join(', ')}`);
    
    // 3. Find all movies in the same collection
    console.log('\n3. Finding all movies in "Indiana Jones Collection":');
    const collectionMovies = await plexDb.getMoviesByCollection('Indiana Jones Collection');
    console.log(`   Found ${collectionMovies.length} movies in collection:`);
    collectionMovies.forEach(movie => {
      console.log(`   - ${movie.title} (${movie.year}) - Views: ${movie.viewCount || 0}`);
    });
    
    // 4. Test the earliest unplayed selection logic
    console.log('\n4. Testing earliest unplayed selection:');
    const unplayedMovies = collectionMovies.filter(movie => 
      !movie.viewCount || movie.viewCount === 0
    );
    
    if (unplayedMovies.length === 0) {
      console.log('   ❌ No unplayed movies found');
      return;
    }
    
    // Sort by year (earliest first)
    const sortedUnplayed = unplayedMovies.sort((a, b) => {
      const yearA = a.year || 9999;
      const yearB = b.year || 9999;
      return yearA - yearB;
    });
    
    console.log(`   Found ${unplayedMovies.length} unplayed movies:`);
    sortedUnplayed.forEach((movie, index) => {
      const indicator = index === 0 ? '🎯 EARLIEST' : '  ';
      console.log(`   ${indicator} ${movie.title} (${movie.year})`);
    });
    
    const earliestMovie = sortedUnplayed[0];
    console.log(`\n✅ Expected selection: "${earliestMovie.title}" (${earliestMovie.year})`);
    
    // 5. Test the actual getNextMovie function
    console.log('\n5. Testing actual getNextMovie() function:');
    console.log('   Running getNextMovie() 5 times to see selection patterns...');
    
    for (let i = 1; i <= 5; i++) {
      const result = await getNextMovie();
      console.log(`   Run ${i}: ${result.title} (${result.year || 'Unknown'}) - Order Type: ${result.orderType}`);
      
      // Check if it's an Indiana Jones movie
      const isIndyMovie = result.title && (
        result.title.includes('Indiana Jones') || 
        result.title.includes('Raiders')
      );
      
      if (isIndyMovie) {
        console.log(`       🎬 This is an Indiana Jones movie!`);
        
        // Check if collections logic was used
        if (result.otherCollections && result.otherCollections.length > 0) {
          console.log(`       📦 Found ${result.otherCollections.length} other collections`);
          result.otherCollections.forEach(col => {
            console.log(`          - ${col.title} (${col.items.length} items)`);
          });
        } else {
          console.log(`       ⚠️  No other collections found - this might be the issue!`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCrystalSkullScenario();
