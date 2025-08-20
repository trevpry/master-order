const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function checkModels() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking available models...');
    
    // Test basic models first
    const watchLogs = await prisma.watchLog.findMany({ take: 1 });
    console.log('✅ watchLog model exists');
    
    const movies = await prisma.plexMovie.findMany({ take: 1 });
    console.log('✅ plexMovie model exists');
    
    const tvShows = await prisma.plexTVShow.findMany({ take: 1 });
    console.log('✅ plexTVShow model exists');
    
    const customOrders = await prisma.customOrderItem.findMany({ take: 1 });
    console.log('✅ customOrderItem model exists');
    
    // Try other models that might not exist
    try {
      const books = await prisma.plexBook.findMany({ take: 1 });
      console.log('✅ plexBook model exists');
    } catch (error) {
      console.log('❌ plexBook model does not exist');
    }
    
    try {
      const comics = await prisma.plexComic.findMany({ take: 1 });
      console.log('✅ plexComic model exists');
    } catch (error) {
      console.log('❌ plexComic model does not exist');
    }
    
    try {
      const stories = await prisma.plexStory.findMany({ take: 1 });
      console.log('✅ plexStory model exists');
    } catch (error) {
      console.log('❌ plexStory model does not exist');
    }
    
  } catch (error) {
    console.error('Error checking models:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkModels();
