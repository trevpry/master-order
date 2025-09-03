const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomOrderEpisodes() {
  try {
    const episodes = await prisma.customOrderItem.findMany({
      where: { mediaType: 'episode' },
      include: { customOrder: true },
      take: 5
    });
    
    console.log('Custom Order Episodes:');
    episodes.forEach(ep => {
      console.log('- ' + ep.title + ' (plexKey: ' + ep.plexKey + ', series: ' + ep.seriesTitle + ', S' + ep.seasonNumber + 'E' + ep.episodeNumber + ')');
    });
    
    // Also check if any episodes have episodeRatingKey field
    const plexDb = require('./server/plexDatabaseService');
    await plexDb.init();
    
    if (episodes.length > 0) {
      const firstEp = episodes[0];
      console.log('\nChecking Plex database for episode:', firstEp.plexKey);
      const plexData = await plexDb.getItemMetadata(firstEp.plexKey, 'episode');
      if (plexData) {
        console.log('Episode rating key from Plex:', plexData.ratingKey);
        console.log('Episode title from Plex:', plexData.title);
        console.log('Series title from Plex:', plexData.grandparentTitle);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomOrderEpisodes();
