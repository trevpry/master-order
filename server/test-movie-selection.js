const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMovieSelection() {
  try {
    console.log('=== Testing Movie Selection Logic ===\n');
    
    // 1. Find all X-Files related media
    console.log('1. All X-Files related movies:');
    const xFilesMovies = await prisma.plexMovie.findMany({
      where: {
        title: {
          contains: "X Files"
        }
      },
      select: {
        title: true,
        collections: true,
        ratingKey: true
      }
    });
    
    xFilesMovies.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`- ${movie.title} (${movie.ratingKey}): ${collections.join(', ') || 'No collections'}`);
    });
    
    console.log('\n2. All X-Files related TV shows:');
    const xFilesSeries = await prisma.plexTVShow.findMany({
      where: {
        OR: [
          { title: { contains: "X-Files" } },
          { collections: { contains: "X-Files" } }
        ]
      },
      select: {
        title: true,
        collections: true,
        ratingKey: true
      }
    });
    
    xFilesSeries.forEach(series => {
      const collections = series.collections ? JSON.parse(series.collections) : [];
      console.log(`- ${series.title} (${series.ratingKey}): ${collections.join(', ') || 'No collections'}`);
    });
    
    // 3. Test what happens if we manually assign the collection
    console.log('\n3. What collections should "The X Files: I Want to Believe" have?');
    console.log('Expected: It should be in "The X-Files" collection');
    console.log('Actual: No collections assigned');
    console.log('Solution: The movie needs to be added to "The X-Files" collection in Plex');
    
    // 4. Check what the current getNextMovie logic would do with this movie
    const xFilesMovie = await prisma.plexMovie.findFirst({
      where: {
        title: { contains: "X Files: I Want to Believe" }
      }
    });
    
    if (xFilesMovie) {
      console.log('\n4. Current movie selection logic for "The X Files: I Want to Believe":');
      console.log('Collections:', xFilesMovie.collections || 'null');
      
      if (!xFilesMovie.collections || xFilesMovie.collections === 'null') {
        console.log('❌ Movie has no collections, so checkCollections() will return the movie itself');
        console.log('This is why it\'s not finding The X-Files episodes!');
      } else {
        const collections = JSON.parse(xFilesMovie.collections);
        console.log('Movie collections:', collections);
        
        // Test collection name cleaning
        const cleanedCollections = collections.map(c => c.replace(/ Collection$/, '').trim());
        console.log('Cleaned collection names:', cleanedCollections);
        
        // Find matching series
        const matchingSeries = await prisma.plexTVShow.findMany({
          where: {
            collections: {
              contains: cleanedCollections[0] // Test with first collection
            }
          }
        });
        console.log('Matching series found:', matchingSeries.length);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMovieSelection();
