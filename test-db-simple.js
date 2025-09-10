const { PrismaClient } = require('@prisma/client');

async function simpleTest() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing basic database connection...');
    const count = await prisma.watchLog.count();
    console.log(`Total watch logs: ${count}`);
    
    const bookCount = await prisma.watchLog.count({
      where: { mediaType: 'book' }
    });
    console.log(`Book watch logs: ${bookCount}`);
    
    // Check if we have any with customOrderItem
    const withCustomOrder = await prisma.watchLog.count({
      where: { 
        mediaType: 'book',
        customOrderItemId: { not: null }
      }
    });
    console.log(`Book logs with custom order items: ${withCustomOrder}`);
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
  
  process.exit(0);
}

simpleTest();
