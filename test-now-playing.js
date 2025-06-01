const prisma = require('./server/prismaClient');

async function checkNowPlaying() {
  try {
    console.log('=== Checking Now Playing Collection ===\n');
    
    // 1. Get current settings
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('Current Settings:');
    console.log('Collection Name:', settings?.collectionName || 'None');
    console.log('TV General Percent:', settings?.tvGeneralPercent || 0);
    console.log('Movies General Percent:', settings?.moviesGeneralPercent || 0);
    console.log('');
    
    const collectionName = settings?.collectionName || 'Now Playing';
    
    // 2. Find TV shows in this collection
    console.log(`TV Shows in "${collectionName}" collection:`);
    const tvShows = await prisma.PlexTVShow.findMany({
      where: {
        collections: {
          contains: collectionName
        }
      },
      select: {
        title: true,
        year: true,
        leafCount: true,
        viewedLeafCount: true,
        collections: true
      }
    });
    
    console.log(`Found ${tvShows.length} TV shows`);
    tvShows.forEach(show => {
      const watched = show.viewedLeafCount || 0;
      const total = show.leafCount || 0;
      const collections = show.collections ? JSON.parse(show.collections) : [];
      console.log(`- ${show.title} (${show.year}) - ${watched}/${total} watched - Collections: ${collections.join(', ')}`);
    });
    
    // 3. Find movies in this collection
    console.log(`\nMovies in "${collectionName}" collection:`);
    const movies = await prisma.PlexMovie.findMany({
      where: {
        collections: {
          contains: collectionName
        }
      },
      select: {
        title: true,
        year: true,
        viewCount: true,
        collections: true
      }
    });
    
    console.log(`Found ${movies.length} movies`);
    movies.forEach(movie => {
      const watched = movie.viewCount > 0 ? 'WATCHED' : 'UNPLAYED';
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      console.log(`- ${movie.title} (${movie.year}) - ${watched} - Collections: ${collections.join(', ')}`);
    });
    
    // 4. Check if "Now Watching" exists instead
    if (collectionName !== 'Now Watching') {
      console.log('\n=== Checking "Now Watching" Collection ===');
      
      const nowWatchingTVShows = await prisma.PlexTVShow.findMany({
        where: {
          collections: {
            contains: 'Now Watching'
          }
        },
        select: {
          title: true,
          year: true,
          leafCount: true,
          viewedLeafCount: true
        }
      });
      
      console.log(`Found ${nowWatchingTVShows.length} TV shows in "Now Watching"`);
      nowWatchingTVShows.forEach(show => {
        const watched = show.viewedLeafCount || 0;
        const total = show.leafCount || 0;
        console.log(`- ${show.title} (${show.year}) - ${watched}/${total} watched`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNowPlaying();
