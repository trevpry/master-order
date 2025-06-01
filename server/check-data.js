const prisma = require('./prismaClient');

async function checkData() {
  try {
    const episodes = await prisma.PlexEpisode.count();
    const movies = await prisma.PlexMovie.count();
    const series = await prisma.PlexTVShow.count();
    const librarySections = await prisma.PlexLibrarySection.count();
    
    console.log('=== Database Counts ===');
    console.log('Episodes:', episodes);
    console.log('Movies:', movies);
    console.log('TV Shows:', series);
    console.log('Library Sections:', librarySections);
    
    // Check for unplayed episodes
    const unplayedEpisodes = await prisma.PlexEpisode.count({
      where: { 
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      }
    });
    console.log('Unplayed episodes:', unplayedEpisodes);
    
    // Check for unplayed movies
    const unplayedMovies = await prisma.PlexMovie.count({
      where: { 
        OR: [
          { viewCount: null },
          { viewCount: 0 }
        ]
      }
    });
    console.log('Unplayed movies:', unplayedMovies);
    
    // Check settings
    const settings = await prisma.Settings.findMany();
    console.log('\n=== Settings ===');
    if (settings.length > 0) {
      settings.forEach(setting => {
        console.log(`ID: ${setting.id}`);
        console.log(`Collection Name: ${setting.collectionName}`);
        console.log(`TV General %: ${setting.tvGeneralPercent}`);
        console.log(`Movies General %: ${setting.moviesGeneralPercent}`);
        console.log(`Custom Order %: ${setting.customOrderPercent}`);
        console.log('---');
      });
    } else {
      console.log('No settings found');
    }
    
    // Sample some TV shows
    const sampleShows = await prisma.PlexTVShow.findMany({
      take: 3,
      include: {
        seasons: {
          take: 1,
          include: {
            episodes: {
              take: 1
            }
          }
        }
      }
    });
    
    console.log('\n=== Sample TV Shows ===');
    sampleShows.forEach(show => {
      console.log(`Title: ${show.title}`);
      console.log(`Leaf Count: ${show.leafCount}, Viewed: ${show.viewedLeafCount}`);
      console.log(`Collections: ${show.collections}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
