const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const artist = await prisma.plexArtist.findFirst({
      where: { title: { contains: '65daysofstatic' } },
      include: { albums: true }
    });
    
    console.log('🎵 65daysofstatic Albums:');
    if (artist && artist.albums.length > 0) {
      artist.albums.forEach((album, index) => {
        console.log(`${index + 1}. ${album.title}`);
      });
      
      // Check specifically for No Man's Sky
      const noMansSkylAlbum = artist.albums.find(a => 
        a.title.toLowerCase().includes('no man') || 
        a.title.toLowerCase().includes('infinite universe')
      );
      
      if (noMansSkylAlbum) {
        console.log(`\n✅ Found the album: "${noMansSkylAlbum.title}"`);
      } else {
        console.log('\n⚠️  No Man\'s Sky album not found in the current list');
      }
    } else {
      console.log('No albums found for 65daysofstatic');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
