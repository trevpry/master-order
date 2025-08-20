const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function checkTVActorData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking TV actor data...');
    
    // Get TV watch logs with plexKey
    const tvWatchLogs = await prisma.watchLog.findMany({
      where: {
        mediaType: 'tv',
        totalWatchTime: { gt: 0 },
        plexKey: { not: null }
      },
      select: {
        id: true,
        title: true,
        seriesTitle: true,
        plexKey: true,
        totalWatchTime: true
      }
    });
    console.log(`Found ${tvWatchLogs.length} TV watch logs with plexKey`);
    
    if (tvWatchLogs.length > 0) {
      console.log('Sample TV logs:', tvWatchLogs.slice(0, 3));
      
      // Get unique series titles
      const seriesTitles = [...new Set(tvWatchLogs.map(log => log.seriesTitle))];
      console.log(`\nUnique series: ${seriesTitles.length}`);
      console.log('Series titles:', seriesTitles.slice(0, 5));
      
      // Check if episodes have roles data using the plexKeys from watch logs
      const uniquePlexKeys = [...new Set(tvWatchLogs.map(log => log.plexKey))];
      console.log(`\nChecking ${uniquePlexKeys.length} unique plexKeys...`);
      console.log('Sample plexKeys:', uniquePlexKeys.slice(0, 5));
      
      const episodesWithRoles = await prisma.plexEpisode.findMany({
        where: {
          ratingKey: { in: uniquePlexKeys }
        },
        include: {
          roles: {
            take: 3
          },
          season: {
            include: {
              show: true
            }
          }
        }
      });
      
      console.log(`\nFound ${episodesWithRoles.length} episodes with roles data`);
      episodesWithRoles.forEach(episode => {
        console.log(`- ${episode.title} (${episode.ratingKey}): ${episode.roles.length} roles`);
        if (episode.roles.length > 0) {
          console.log(`  Actors: ${episode.roles.map(r => r.tag).join(', ')}`);
        }
        console.log(`  Series: ${episode.season?.show?.title || 'Unknown'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTVActorData();
