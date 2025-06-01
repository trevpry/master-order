const prisma = require('./prismaClient');

async function checkArtworkCache() {
  try {
    const artworkCount = await prisma.tvdbArtwork.count();
    console.log('TVDB artwork count:', artworkCount);
    
    const seriesCount = await prisma.tvdbSeries.count();
    console.log('TVDB series count:', seriesCount);
    
    const seasonCount = await prisma.tvdbSeason.count();
    console.log('TVDB season count:', seasonCount);
    
    // Check if we have any South Park data
    const southPark = await prisma.tvdbSeries.findFirst({
      where: {
        name: {
          contains: 'South Park'
        }
      },
      include: {
        seasons: true,
        artworks: true
      }
    });
    
    if (southPark) {
      console.log('\nSouth Park series found:');
      console.log('- Series ID:', southPark.tvdbId);
      console.log('- Seasons:', southPark.seasons.length);
      console.log('- Artworks:', southPark.artworks.length);
    } else {
      console.log('\nNo South Park series found in TVDB cache');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkArtworkCache();
