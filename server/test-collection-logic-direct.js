const { PrismaClient } = require('@prisma/client');
const PlexDatabaseService = require('./plexDatabaseService');

const prisma = new PrismaClient();
const plexDb = new PlexDatabaseService(prisma);

// Import the specific functions we need to test
const getNextMovieModule = require('./getNextMovie');

async function testCollectionLogicDirectly() {
  try {
    console.log('=== Testing Collection Logic Directly ===\n');
    
    // 1. Get Crystal Skull as our test case
    const crystalSkull = await prisma.plexMovie.findFirst({
      where: { title: { contains: "Crystal Skull" } },
      include: { section: true }
    });
    
    if (!crystalSkull) {
      console.log('❌ Crystal Skull not found');
      return;
    }
    
    console.log(`1. Starting with: ${crystalSkull.title} (${crystalSkull.year})`);
    console.log(`   Collections: ${crystalSkull.collections}`);
    
    // 2. Manually test the checkCollections function
    // We need to simulate what happens in getNextMovie.js
    console.log('\n2. Testing collection processing...');
    
    const movieCollections = plexDb.parseCollections(crystalSkull.collections || '');
    console.log(`   Parsed collections: ${movieCollections.join(', ')}`);
    
    if (movieCollections.length === 0) {
      console.log('   ❌ No collections found');
      return;
    }
    
    // Filter out current settings collection (simulate checkCollections logic)
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    const currentCollection = settings?.collectionName;
    console.log(`   Current settings collection: ${currentCollection || 'None'}`);
    
    const otherCollections = movieCollections.filter(collection => {
      return collection.toLowerCase() !== currentCollection?.toLowerCase();
    });
    
    console.log(`   Other collections (excluding settings): ${otherCollections.join(', ')}`);
    
    if (otherCollections.length === 0) {
      console.log('   ❌ No other collections found after filtering');
      return;
    }
    
    // 3. Find all items in these collections
    console.log('\n3. Finding all items in collections...');
    const allItems = [];
    
    // Add the original movie
    allItems.push({
      ...crystalSkull,
      fromCollection: 'original',
      libraryType: 'movie'
    });
    
    // Add items from other collections
    for (const collectionName of otherCollections) {
      console.log(`   Searching for items in "${collectionName}"...`);
      
      // Search movies
      const movies = await plexDb.getMoviesByCollection(collectionName);
      console.log(`     Found ${movies.length} movies`);
      
      movies.forEach(movie => {
        allItems.push({
          ...movie,
          fromCollection: collectionName,
          libraryType: 'movie'
        });
      });
      
      // Search TV shows
      const tvShows = await plexDb.getTVShowsByCollection(collectionName);
      console.log(`     Found ${tvShows.length} TV shows`);
      
      tvShows.forEach(show => {
        allItems.push({
          ...show,
          fromCollection: collectionName,
          libraryType: 'tv'
        });
      });
    }
    
    console.log(`   Total items found: ${allItems.length}`);
    
    // 4. Filter to unplayed items
    console.log('\n4. Filtering to unplayed items...');
    const unplayedItems = allItems.filter(item => {
      if (item.libraryType === 'movie') {
        return !item.viewCount || item.viewCount === 0;
      } else {
        return item.leafCount > (item.viewedLeafCount || 0);
      }
    });
    
    console.log(`   Unplayed items: ${unplayedItems.length}`);
    unplayedItems.forEach(item => {
      const type = item.libraryType === 'movie' ? '🎬' : '📺';
      console.log(`     ${type} ${item.title} (${item.year || 'Unknown'}) from ${item.fromCollection}`);
    });
    
    if (unplayedItems.length === 0) {
      console.log('   ❌ No unplayed items found');
      return;
    }
    
    // 5. Sort by date and select earliest
    console.log('\n5. Selecting earliest unplayed item...');
    const sortedItems = unplayedItems.sort((a, b) => {
      const dateA = new Date(a.year || '9999');
      const dateB = new Date(b.year || '9999');
      return dateA - dateB;
    });
    
    const earliestItem = sortedItems[0];
    console.log(`\n🎯 FINAL SELECTION: ${earliestItem.title} (${earliestItem.year || 'Unknown'})`);
    console.log(`   Type: ${earliestItem.libraryType}`);
    console.log(`   From collection: ${earliestItem.fromCollection}`);
    console.log(`   This should be Raiders of the Lost Ark (1981) if the logic is working correctly!`);
    
    // Verify it's Raiders
    if (earliestItem.title.includes('Raiders')) {
      console.log('\n✅ SUCCESS: The logic correctly selected Raiders of the Lost Ark!');
    } else {
      console.log('\n❌ ISSUE: Expected Raiders of the Lost Ark, but got something else.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCollectionLogicDirectly();
