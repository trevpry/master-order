const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function checkMovies() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking movie watch logs...');
    const movieWatchLogs = await prisma.watchLog.findMany({
      where: {
        mediaType: 'movie',
        totalWatchTime: { gt: 0 },
        plexKey: { not: null }
      },
      select: {
        id: true,
        title: true,
        plexKey: true,
        totalWatchTime: true
      }
    });
    console.log('Movie watch logs found:', movieWatchLogs.length);
    
    if (movieWatchLogs.length > 0) {
      console.log('Sample movie logs:', movieWatchLogs.slice(0, 3));
      
      const plexKeys = movieWatchLogs.map(log => log.plexKey);
      console.log('\nChecking movies with roles...');
      
      const moviesWithData = await prisma.plexMovie.findMany({
        where: {
          ratingKey: { in: plexKeys }
        },
        select: {
          id: true,
          title: true,
          ratingKey: true,
          collections: true,
          roles: {
            take: 3,
            select: {
              tag: true,
              role: true
            }
          }
        }
      });
      
      console.log('Movies found in database:', moviesWithData.length);
      if (moviesWithData.length > 0) {
        console.log('\nSample movies with data:');
        moviesWithData.forEach(movie => {
          console.log(`- ${movie.title} (${movie.ratingKey})`);
          console.log(`  Collections: ${movie.collections}`);
          console.log(`  Roles: ${movie.roles.length} actors`);
          if (movie.roles.length > 0) {
            console.log(`  Sample actors: ${movie.roles.map(r => r.tag).join(', ')}`);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMovies();
