const prisma = require('./prismaClient');

async function checkCache() {
  try {
    const artworkCount = await prisma.tvdbArtwork.count();
    console.log('Artwork count:', artworkCount);
    
    const sampleArtworks = await prisma.tvdbArtwork.findMany({
      take: 5,
      select: {
        tvdbId: true,
        seriesTvdbId: true,
        seasonTvdbId: true,
        image: true
      }
    });
    
    console.log('Sample artworks:', JSON.stringify(sampleArtworks, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCache();
