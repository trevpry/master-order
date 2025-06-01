const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testIndianaJones() {
  try {
    console.log('=== Testing Indiana Jones Collection Logic ===\n');
    
    // 1. Find all Indiana Jones movies in the database
    console.log('1. Finding all Indiana Jones movies:');
    const indianaJonesMovies = await prisma.plexMovie.findMany({
      where: {
        OR: [
          { title: { contains: "Indiana Jones" } },
          { title: { contains: "Raiders of the Lost Ark" } }
        ]
      },
      select: {
        title: true,
        ratingKey: true,
        collections: true,
        year: true,
        viewCount: true
      },
      orderBy: {
        year: "asc"
      }
    });
    
    if (indianaJonesMovies.length === 0) {
      console.log('❌ No Indiana Jones movies found in database');
      return;
    }
    
    console.log(`Found ${indianaJonesMovies.length} Indiana Jones movies:`);
    indianaJonesMovies.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`- ${movie.title} (${movie.year}) - Collections: ${collections.join(', ') || 'None'}`);
    });
    
    // 2. Test collection matching logic
    console.log('\n2. Testing collection matching logic:');
    
    const crystalSkull = indianaJonesMovies.find(m => m.title.includes("Crystal Skull"));
    const raiders = indianaJonesMovies.find(m => m.title.includes("Raiders"));
    
    if (crystalSkull && raiders) {
      console.log('Comparing collections between:');
      console.log(`- "${crystalSkull.title}"`);
      console.log(`- "${raiders.title}"`);
      
      const crystalCollections = crystalSkull.collections ? JSON.parse(crystalSkull.collections) : [];
      const raidersCollections = raiders.collections ? JSON.parse(raiders.collections) : [];
      
      console.log('Crystal Skull collections:', crystalCollections);
      console.log('Raiders collections:', raidersCollections);
      
      // Clean collection names (remove " Collection" suffix)
      const crystalNames = crystalCollections.map(c => c.replace(/ Collection$/, '').trim());
      const raidersNames = raidersCollections.map(c => c.replace(/ Collection$/, '').trim());
      
      const matching = crystalNames.some(crystalCol => 
        raidersNames.some(raidersCol => 
          crystalCol.toLowerCase() === raidersCol.toLowerCase()
        )
      );
      
      console.log(`Should they match? ${matching ? '✅ YES' : '❌ NO'}`);
      
      // 3. Check which is earliest unplayed
      console.log('\n3. Checking which should be selected:');
      const unplayedMovies = indianaJonesMovies.filter(movie => 
        !movie.viewCount || movie.viewCount === 0
      );
      
      console.log(`Unplayed Indiana Jones movies: ${unplayedMovies.length}`);
      unplayedMovies.forEach(movie => {
        console.log(`- ${movie.title} (${movie.year}) - Release: ${movie.year}`);
      });
      
      if (unplayedMovies.length > 0) {
        // Sort by date
        const sortedUnplayed = unplayedMovies.sort((a, b) => {
          const dateA = new Date(a.year || '9999');
          const dateB = new Date(b.year || '9999');
          return dateA - dateB;
        });
        
        console.log(`\n🎯 Earliest unplayed should be: "${sortedUnplayed[0].title}" (${sortedUnplayed[0].year})`);
      } else {
        console.log('❌ No unplayed movies found');
      }
      
    } else {
      console.log('❌ Could not find both Crystal Skull and Raiders movies');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testIndianaJones();
