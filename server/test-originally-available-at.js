require('dotenv').config();
const PlexSyncService = require('./plexSyncService');
const prisma = require('./prismaClient');

async function testOriginallyAvailableAt() {
  console.log('=== Testing originallyAvailableAt Field Capture ===\n');
  
  try {
    const plexSync = new PlexSyncService();
    
    console.log('1. Testing movie originallyAvailableAt capture...');
    
    // Get existing movies from database to test
    const existingMovies = await prisma.plexMovie.findMany({
      take: 3,
      select: {
        ratingKey: true,
        title: true,
        originallyAvailableAt: true
      }
    });
    
    console.log(`Found ${existingMovies.length} existing movies in database:`);
    existingMovies.forEach(movie => {
      console.log(`- ${movie.title}: originallyAvailableAt = ${movie.originallyAvailableAt || 'NULL'}`);
    });
    
    if (existingMovies.length > 0 && !existingMovies[0].originallyAvailableAt) {
      console.log('\n2. Running a quick movie sync to capture originallyAvailableAt...');
      
      const movieSections = await prisma.plexLibrarySection.findMany({
        where: { type: 'movie' }
      });
      
      if (movieSections.length > 0) {
        console.log(`Syncing movie section: ${movieSections[0].title}`);
        await plexSync.syncMovies(movieSections[0].sectionKey);
        
        // Check the first movie again
        const updatedMovie = await prisma.plexMovie.findUnique({
          where: { ratingKey: existingMovies[0].ratingKey },
          select: {
            title: true,
            originallyAvailableAt: true
          }
        });
        
        console.log(`Updated movie ${updatedMovie.title}: originallyAvailableAt = ${updatedMovie.originallyAvailableAt || 'NULL'}`);
        
        if (updatedMovie.originallyAvailableAt) {
          console.log('✅ Movie originallyAvailableAt field successfully captured!');
        } else {
          console.log('❌ Movie originallyAvailableAt field still NULL');
        }
      }
    } else {
      console.log('✅ Movies already have originallyAvailableAt data');
    }
    
    console.log('\n3. Testing episode originallyAvailableAt capture...');
    
    // Get existing episodes from database to test
    const existingEpisodes = await prisma.plexEpisode.findMany({
      take: 3,
      select: {
        ratingKey: true,
        title: true,
        showTitle: true,
        originallyAvailableAt: true
      }
    });
    
    console.log(`Found ${existingEpisodes.length} existing episodes in database:`);
    existingEpisodes.forEach(episode => {
      console.log(`- ${episode.showTitle} - ${episode.title}: originallyAvailableAt = ${episode.originallyAvailableAt || 'NULL'}`);
    });
    
    if (existingEpisodes.length > 0 && !existingEpisodes[0].originallyAvailableAt) {
      console.log('\n4. Running a quick TV sync to capture originallyAvailableAt...');
      
      const tvSections = await prisma.plexLibrarySection.findMany({
        where: { type: 'show' }
      });
      
      if (tvSections.length > 0) {
        // Get one show to sync
        const shows = await prisma.plexTVShow.findMany({ take: 1 });
        if (shows.length > 0) {
          console.log(`Syncing show: ${shows[0].title}`);
          await plexSync.syncSeasons(shows[0].ratingKey);
          
          // Check the first episode again
          const updatedEpisode = await prisma.plexEpisode.findUnique({
            where: { ratingKey: existingEpisodes[0].ratingKey },
            select: {
              title: true,
              showTitle: true,
              originallyAvailableAt: true
            }
          });
          
          console.log(`Updated episode ${updatedEpisode.showTitle} - ${updatedEpisode.title}: originallyAvailableAt = ${updatedEpisode.originallyAvailableAt || 'NULL'}`);
          
          if (updatedEpisode.originallyAvailableAt) {
            console.log('✅ Episode originallyAvailableAt field successfully captured!');
          } else {
            console.log('❌ Episode originallyAvailableAt field still NULL');
          }
        }
      }
    } else {
      console.log('✅ Episodes already have originallyAvailableAt data');
    }
    
  } catch (error) {
    console.error('Error testing originallyAvailableAt:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testOriginallyAvailableAt().catch(console.error);
