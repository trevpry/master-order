const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function checkRoles() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking PlexRole entries...');
    const roleCount = await prisma.plexRole.count();
    console.log('Total PlexRole entries:', roleCount);
    
    if (roleCount > 0) {
      const sampleRoles = await prisma.plexRole.findMany({ 
        take: 5,
        select: {
          id: true,
          tag: true,
          role: true,
          episodeRatingKey: true,
          movieRatingKey: true
        }
      });
      console.log('Sample roles:', sampleRoles);
    }
    
    console.log('\nChecking episodes with roles...');
    const episodesWithRoles = await prisma.plexEpisode.findMany({
      where: { 
        roles: { 
          some: {} 
        } 
      },
      take: 5,
      select: {
        id: true,
        title: true,
        ratingKey: true,
        roles: {
          take: 3,
          select: {
            tag: true,
            role: true
          }
        }
      }
    });
    console.log('Episodes with roles count:', episodesWithRoles.length);
    if (episodesWithRoles.length > 0) {
      console.log('Sample episodes with roles:', JSON.stringify(episodesWithRoles, null, 2));
    }
    
    // Check watch logs with episode IDs
    console.log('\nChecking watch logs with episode IDs...');
    const watchLogsWithEpisodes = await prisma.watchLog.findMany({
      where: {
        episodeId: { not: null }
      },
      take: 5,
      select: {
        id: true,
        title: true,
        episodeId: true,
        totalWatchTime: true
      }
    });
    console.log('Watch logs with episode IDs count:', watchLogsWithEpisodes.length);
    if (watchLogsWithEpisodes.length > 0) {
      console.log('Sample watch logs:', watchLogsWithEpisodes);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoles();
