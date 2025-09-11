const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPlexData() {
  try {
    console.log('🔍 Checking existing Plex data...');
    
    const seasons = await prisma.plexSeason.findMany({
      select: { ratingKey: true, title: true, showRatingKey: true }
    });
    console.log('Seasons:', seasons.length, seasons);
    
    const episodes = await prisma.plexEpisode.findMany({
      select: { ratingKey: true, title: true, seasonRatingKey: true }
    });
    console.log('Episodes:', episodes.length, episodes);
    
    const shows = await prisma.plexTVShow.findMany({
      select: { ratingKey: true, title: true }
    });
    console.log('TV Shows:', shows.length, shows);
    
    const movies = await prisma.plexMovie.findMany({
      select: { ratingKey: true, title: true }
    });
    console.log('Movies:', movies.length, movies);
    
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPlexData();
