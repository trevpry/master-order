const { PrismaClient } = require('./server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function cleanupTestData() {
  try {
    console.log('Deleting test reading sessions...');
    
    // Delete all reading sessions (test data)
    const result = await prisma.watchLog.deleteMany({
      where: {
        activityType: 'read'
      }
    });
    
    console.log(`Deleted ${result.count} reading sessions`);
    
    // Check remaining logs
    const remaining = await prisma.watchLog.findMany({
      where: {
        activityType: 'read'
      }
    });
    
    console.log(`Remaining reading sessions: ${remaining.length}`);
    
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupTestData();
