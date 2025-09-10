const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function checkMovieData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking movie data...');
    
    // Get movie watch logs with plexKey
    const movieWatchLogs = await prisma.watchLog.findMany({
      where: {
        mediaType: 'movie',
        plexKey: { not: null }
      },
      select: {
        id: true,
        title: true,
        plexKey: true,
        totalWatchTime: true
      }
    });
    console.log(`Found ${movieWatchLogs.length} movie watch logs with plexKey`);
    
    if (movieWatchLogs.length > 0) {
      console.log('Sample movie logs:', movieWatchLogs.slice(0, 3));
      
      // Check if movies have roles data using the plexKeys from watch logs
      const uniquePlexKeys = [...new Set(movieWatchLogs.map(log => log.plexKey))];
      console.log(`\nChecking ${uniquePlexKeys.length} unique plexKeys...`);
      
      const moviesWithRoles = await prisma.plexMovie.findMany({
        where: {
          ratingKey: { in: uniquePlexKeys }
        },
        include: {
          roles: {
            take: 3
          }
        }
      });
      
      console.log(`\nFound ${moviesWithRoles.length} movies with roles data`);
      moviesWithRoles.forEach(movie => {
        console.log(`- ${movie.title} (${movie.ratingKey}): ${movie.roles.length} roles`);
        if (movie.roles.length > 0) {
          console.log(`  Actors: ${movie.roles.map(r => r.tag).join(', ')}`);
        }
      });
    } else {
      console.log('No movie watch logs found with plexKey');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMovieData();
