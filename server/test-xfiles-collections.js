const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testXFilesCollections() {
  try {
    console.log('=== Testing X-Files Collection Matching ===\n');
      // 1. Find "The X Files: I Want to Believe" movie
    const movie = await prisma.plexMovie.findFirst({
      where: {
        title: {
          contains: "X Files: I Want to Believe"
        }
      }
    });
      console.log('Movie found:');
    console.log('Title:', movie?.title);
    console.log('Collections:', movie?.collections ? JSON.parse(movie.collections) : 'None');
    console.log('');
    
    // 2. Find "The X-Files" TV series
    const series = await prisma.plexTVShow.findFirst({
      where: {
        title: {
          contains: "X-Files"
        }
      }
    });
    
    console.log('Series found:');
    console.log('Title:', series?.title);
    console.log('Collections:', series?.collections ? JSON.parse(series.collections) : 'None');
    console.log('');
      // 3. Show all collections that contain "X"
    const xCollections = await prisma.plexMovie.findMany({
      where: {
        collections: {
          contains: "X"
        }
      },
      select: {
        title: true,
        collections: true
      }
    });
    
    console.log('Movies with collections containing "X":');
    xCollections.forEach(m => {
      const collections = m.collections ? JSON.parse(m.collections) : [];
      console.log(`- ${m.title}: ${collections.join(', ')}`);
    });
    
    const xCollectionsSeries = await prisma.plexTVShow.findMany({
      where: {
        collections: {
          contains: "X"
        }
      },
      select: {
        title: true,
        collections: true
      }
    });
    
    console.log('TV Shows with collections containing "X":');
    xCollectionsSeries.forEach(s => {
      const collections = s.collections ? JSON.parse(s.collections) : [];
      console.log(`- ${s.title}: ${collections.join(', ')}`);
    });
    console.log('');
      // 4. Test collection name matching logic (removing " Collection")
    if (movie?.collections && series?.collections) {
      console.log('=== Testing Collection Name Matching ===');
      
      const movieCollections = JSON.parse(movie.collections);
      const seriesCollections = JSON.parse(series.collections);
      
      const movieCollectionNames = movieCollections.map(c => 
        c.replace(/ Collection$/, '').trim()
      );
      const seriesCollectionNames = seriesCollections.map(c => 
        c.replace(/ Collection$/, '').trim()
      );
      
      console.log('Movie collection names (cleaned):', movieCollectionNames);
      console.log('Series collection names (cleaned):', seriesCollectionNames);
      
      const matchingCollections = movieCollectionNames.filter(movieCol => 
        seriesCollectionNames.some(seriesCol => 
          movieCol.toLowerCase() === seriesCol.toLowerCase()
        )
      );
      
      console.log('Matching collections:', matchingCollections);
      
      if (matchingCollections.length > 0) {
        console.log('✅ Collections should match!');
        
        // 5. Find the earliest unplayed episode in the series
        const episodes = await prisma.plexEpisode.findMany({
          where: {
            showTitle: series.title,
            viewCount: {
              lte: 0
            }
          },
          orderBy: [
            { seasonIndex: 'asc' },
            { index: 'asc' }
          ],
          take: 1
        });
        
        if (episodes.length > 0) {
          console.log('Earliest unplayed episode:');
          console.log(`- S${episodes[0].seasonIndex}E${episodes[0].index}: ${episodes[0].title}`);
        } else {
          console.log('No unplayed episodes found');
        }
      } else {
        console.log('❌ Collections do not match');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testXFilesCollections();
