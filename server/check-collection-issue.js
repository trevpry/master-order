const prisma = require('./prismaClient');

async function checkCollectionIssue() {
  try {
    console.log('=== Checking Collection Selection Issue ===\n');
    
    // 1. Get current settings
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('Current Settings:');
    console.log('Collection Name:', settings?.collectionName || 'None');
    console.log('TV General Percent:', settings?.tvGeneralPercent || 0);
    console.log('Movies General Percent:', settings?.moviesGeneralPercent || 0);
    console.log('Custom Order Percent:', settings?.customOrderPercent || 0);
    console.log('');
    
    const collectionName = settings?.collectionName || 'Now Playing';
    
    // 2. Find TV shows in the collection
    console.log(`Searching for TV shows in "${collectionName}" collection:`);
    const tvShows = await prisma.PlexTVShow.findMany({
      where: {
        collections: {
          contains: collectionName
        }
      },
      select: {
        title: true,
        year: true,
        leafCount: true,
        viewedLeafCount: true,
        collections: true
      }
    });
    
    console.log(`Found ${tvShows.length} TV shows in "${collectionName}"`);
    if (tvShows.length > 0) {
      tvShows.slice(0, 5).forEach(show => {
        const watched = show.viewedLeafCount || 0;
        const total = show.leafCount || 0;
        const collections = show.collections ? JSON.parse(show.collections) : [];
        console.log(`- ${show.title} (${show.year}) - ${watched}/${total} watched`);
        console.log(`  Collections: ${collections.join(', ')}`);
      });
    } else {
      console.log('❌ No TV shows found in this collection!');
    }
    
    // 3. Check for "Now Watching" specifically
    console.log(`\nSearching for TV shows in "Now Watching" collection:`);
    const nowWatchingShows = await prisma.PlexTVShow.findMany({
      where: {
        collections: {
          contains: 'Now Watching'
        }
      },
      select: {
        title: true,
        year: true,
        leafCount: true,
        viewedLeafCount: true,
        collections: true
      }
    });
    
    console.log(`Found ${nowWatchingShows.length} TV shows in "Now Watching"`);
    if (nowWatchingShows.length > 0) {
      nowWatchingShows.slice(0, 5).forEach(show => {
        const watched = show.viewedLeafCount || 0;
        const total = show.leafCount || 0;
        const collections = show.collections ? JSON.parse(show.collections) : [];
        console.log(`- ${show.title} (${show.year}) - ${watched}/${total} watched`);
        console.log(`  Collections: ${collections.join(', ')}`);
      });
    } else {
      console.log('❌ No TV shows found in "Now Watching" collection either!');
    }
    
    // 4. Show all unique collection names that contain "Now"
    console.log('\n=== All Collections Containing "Now" ===');
    const allCollections = new Set();
    
    // Get all TV shows with collections
    const allTVShows = await prisma.PlexTVShow.findMany({
      where: {
        collections: { not: null }
      },
      select: { collections: true }
    });
    
    allTVShows.forEach(show => {
      if (show.collections) {
        try {
          const collections = JSON.parse(show.collections);
          collections.forEach(col => {
            if (col.toLowerCase().includes('now')) {
              allCollections.add(col);
            }
          });
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });
    
    console.log('Collections containing "Now":');
    Array.from(allCollections).forEach(col => {
      console.log(`- "${col}"`);
    });
    
    if (allCollections.size === 0) {
      console.log('❌ No collections found containing "Now"');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCollectionIssue();
