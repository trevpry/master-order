const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testXFilesMovies() {
  try {
    console.log('=== Testing All X Files Movies ===\n');
    
    // Find all X Files movies
    const xFilesMovies = await prisma.plexMovie.findMany({
      where: {
        OR: [
          { title: { contains: "X Files" } },
          { title: { contains: "X-Files" } }
        ]
      },
      select: {
        title: true,
        ratingKey: true,
        collections: true,
        year: true
      },
      orderBy: {
        year: 'asc'
      }
    });
    
    console.log(`Found ${xFilesMovies.length} X Files movies:`);
    xFilesMovies.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`- ${movie.title} (${movie.year}) - ${movie.ratingKey}`);
      console.log(`  Collections: ${collections.join(', ') || 'none'}`);
    });
    console.log('');
    
    // Find The X-Files TV series
    const xFilesSeries = await prisma.plexTVShow.findFirst({
      where: {
        title: {
          contains: "X-Files"
        }
      },
      select: {
        title: true,
        ratingKey: true,
        collections: true
      }
    });
    
    if (xFilesSeries) {
      const seriesCollections = xFilesSeries.collections ? JSON.parse(xFilesSeries.collections) : [];
      console.log('X-Files TV Series:');
      console.log(`- ${xFilesSeries.title} - ${xFilesSeries.ratingKey}`);
      console.log(`  Collections: ${seriesCollections.join(', ') || 'none'}`);
      console.log('');
      
      // Test collection matching logic
      console.log('=== Testing Collection Matching ===');
      
      xFilesMovies.forEach(movie => {
        const movieCollections = movie.collections ? JSON.parse(movie.collections) : [];
        const movieCollectionNames = movieCollections.map(c => 
          c.replace(/ Collection$/, '').trim()
        );
        const seriesCollectionNames = seriesCollections.map(c => 
          c.replace(/ Collection$/, '').trim()
        );
        
        const matchingCollections = movieCollectionNames.filter(movieCol => 
          seriesCollectionNames.some(seriesCol => 
            movieCol.toLowerCase() === seriesCol.toLowerCase()
          )
        );
        
        console.log(`${movie.title}:`);
        console.log(`  Movie collections (cleaned): ${movieCollectionNames.join(', ')}`);
        console.log(`  Series collections (cleaned): ${seriesCollectionNames.join(', ')}`);
        console.log(`  Matching: ${matchingCollections.length > 0 ? '✅ YES' : '❌ NO'} (${matchingCollections.join(', ') || 'none'})`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testXFilesMovies();
