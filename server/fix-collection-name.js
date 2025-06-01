const prisma = require('./prismaClient');

async function fixCollectionName() {
  try {
    console.log('=== Fixing Collection Name Setting ===');
    
    // Update the collection name to match what's actually in the database
    const updated = await prisma.Settings.upsert({
      where: { id: 1 },
      update: {
        collectionName: 'Now Watching'  // Changed from "Now Playing" to "Now Watching"
      },
      create: {
        id: 1,
        collectionName: 'Now Watching',
        tvGeneralPercent: 100,  // Keep 100% TV selection
        moviesGeneralPercent: 0,
        customOrderPercent: 0
      }
    });
    
    console.log('Updated settings:');
    console.log('Collection Name:', updated.collectionName);
    console.log('TV General Percent:', updated.tvGeneralPercent);
    console.log('Movies General Percent:', updated.moviesGeneralPercent);
    console.log('');
    
    // Verify TV shows are now found
    const tvShows = await prisma.PlexTVShow.findMany({
      where: {
        collections: {
          contains: 'Now Watching'
        }
      },
      select: {
        title: true,
        year: true,
        leafCount: true,
        viewedLeafCount: true
      }
    });
    
    console.log(`✅ Found ${tvShows.length} TV shows in "Now Watching" collection`);
    if (tvShows.length > 0) {
      console.log('First few shows:');
      tvShows.slice(0, 5).forEach(show => {
        const watched = show.viewedLeafCount || 0;
        const total = show.leafCount || 0;
        const status = watched < total ? 'HAS UNPLAYED' : 'FULLY WATCHED';
        console.log(`- ${show.title} (${show.year}) - ${status} ${watched}/${total}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCollectionName();
