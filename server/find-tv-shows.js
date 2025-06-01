const prisma = require('./prismaClient');

async function findTVShows() {
  try {
    // Get all TV shows with season counts
    const tvShows = await prisma.plexTVShow.findMany({
      include: {
        seasons: {
          orderBy: {
            index: 'asc'
          }
        }
      },
      orderBy: {
        title: 'asc'
      }
    });
    
    console.log('TV Shows in your library:');
    console.log('=========================');
    
    tvShows.forEach(show => {
      console.log(`\n${show.title} (${show.year || 'Unknown year'})`);
      console.log(`- Plex Key: ${show.ratingKey}`);
      console.log(`- Seasons: ${show.seasons.length}`);
      
      if (show.seasons.length > 0) {
        console.log('- Season details:');
        show.seasons.forEach(season => {
          console.log(`  * Season ${season.index}: ${season.title}`);
        });
      }
      
      const collections = show.collections ? JSON.parse(show.collections) : [];
      if (collections.length > 0) {
        console.log(`- Collections: ${collections.join(', ')}`);
      }
    });
    
    console.log(`\nTotal TV Shows: ${tvShows.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTVShows();
