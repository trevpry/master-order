const prisma = require('./server/prismaClient');

async function checkCustomOrders() {
  try {
    console.log('Checking for TV episodes in active custom orders...');
    
    const episodesInCustomOrders = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'episode',
        customOrder: {
          isActive: true
        }
      },
      select: {
        seriesTitle: true,
        title: true,
        seasonNumber: true,
        episodeNumber: true,
        customOrder: {
          select: { name: true }
        }
      }
    });
    
    console.log(`Found ${episodesInCustomOrders.length} episodes in active custom orders`);
    
    // Group by series title
    const seriesMap = {};
    episodesInCustomOrders.forEach(episode => {
      const series = episode.seriesTitle || 'Unknown Series';
      if (!seriesMap[series]) {
        seriesMap[series] = [];
      }
      seriesMap[series].push(episode);
    });
    
    Object.keys(seriesMap).forEach(series => {
      const episodes = seriesMap[series];
      console.log(`\nSeries: ${series}`);
      console.log(`Episodes: ${episodes.length}`);
      console.log(`Custom Order: ${episodes[0].customOrder.name}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomOrders();
