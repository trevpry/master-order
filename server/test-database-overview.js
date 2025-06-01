const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function showDatabaseOverview() {
  try {
    console.log('=== DATABASE OVERVIEW ===\n');
    
    // 1. Count records
    const movieCount = await prisma.plexMovie.count();
    const tvShowCount = await prisma.plexTVShow.count();
    const episodeCount = await prisma.plexEpisode.count();
    
    console.log(`📊 Record Counts:`);
    console.log(`   Movies: ${movieCount}`);
    console.log(`   TV Shows: ${tvShowCount}`);
    console.log(`   Episodes: ${episodeCount}\n`);
    
    // 2. Show movies with collections
    const moviesWithCollections = await prisma.plexMovie.findMany({
      where: {
        collections: {
          not: null
        }
      },
      select: {
        title: true,
        year: true,
        collections: true,
        viewCount: true
      },
      take: 10
    });
    
    console.log(`🎬 Movies with Collections (first 10):`);
    moviesWithCollections.forEach(movie => {
      const collections = movie.collections ? JSON.parse(movie.collections) : [];
      const watchStatus = (movie.viewCount && movie.viewCount > 0) ? '👁️ Watched' : '⚪ Unplayed';
      console.log(`   ${watchStatus} ${movie.title} (${movie.year}) - ${collections.join(', ')}`);
    });
    console.log('');
    
    // 3. Show Indiana Jones collection specifically
    console.log(`🏺 Indiana Jones Collection:`);
    const indianaMovies = await prisma.plexMovie.findMany({
      where: {
        collections: {
          contains: "Indiana Jones"
        }
      },
      select: {
        title: true,
        year: true,
        viewCount: true,
        ratingKey: true
      },
      orderBy: {
        year: 'asc'
      }
    });
    
    if (indianaMovies.length > 0) {
      indianaMovies.forEach(movie => {
        const watchStatus = (movie.viewCount && movie.viewCount > 0) ? '👁️ Watched' : '⚪ Unplayed';
        console.log(`   ${watchStatus} ${movie.title} (${movie.year}) - Key: ${movie.ratingKey}`);
      });
    } else {
      console.log('   ❌ No Indiana Jones movies found');
    }
    console.log('');
    
    // 4. Show collection statistics
    const allMovies = await prisma.plexMovie.findMany({
      select: {
        collections: true
      }
    });
    
    const collectionStats = {};
    allMovies.forEach(movie => {
      if (movie.collections) {
        try {
          const collections = JSON.parse(movie.collections);
          collections.forEach(collection => {
            collectionStats[collection] = (collectionStats[collection] || 0) + 1;
          });
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });
    
    console.log(`📦 Top Collections by Movie Count:`);
    const sortedCollections = Object.entries(collectionStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    sortedCollections.forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count} movies`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showDatabaseOverview();
