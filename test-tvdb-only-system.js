const { PrismaClient } = require('./server/node_modules/@prisma/client');
const PlexDatabaseService = require('./server/plexDatabaseService');

async function testTvdbOnlySystem() {
  const prisma = new PrismaClient();
  const plexDb = new PlexDatabaseService();
  
  try {
    console.log('🧪 Testing TVDB-only system...');
    
    // Check if we have PlexDatabaseService methods
    console.log('✅ PlexDatabaseService methods available:');
    console.log('- searchTVEpisodes:', typeof plexDb.searchTVEpisodes);
    console.log('- searchMovies:', typeof plexDb.searchMovies);
    
    // Test searching for a common TV episode
    console.log('\n🔍 Testing TV episode search...');
    const episodes = await plexDb.searchTVEpisodes('The Office', 1, 1);
    console.log(`Found ${episodes.length} episodes matching "The Office" S01E01`);
    
    // Test searching for a common movie
    console.log('\n🔍 Testing movie search...');
    const movies = await plexDb.searchMovies('The Matrix', 1999);
    console.log(`Found ${movies.length} movies matching "The Matrix" (1999)`);
    
    // Check if we have any TVDB-only items in custom orders
    console.log('\n📊 Checking for TVDB-only items in custom orders...');
    const tvdbOnlyItems = await prisma.customOrderItem.findMany({
      where: { isFromTvdbOnly: true },
      include: {
        customOrder: {
          select: { name: true }
        }
      }
    });
    
    console.log(`Found ${tvdbOnlyItems.length} TVDB-only items in custom orders:`);
    tvdbOnlyItems.forEach(item => {
      console.log(`- "${item.title}" (${item.mediaType}) in order "${item.customOrder.name}"`);
    });
    
    console.log('\n✅ TVDB-only system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testTvdbOnlySystem();
