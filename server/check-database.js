// Direct database query to check WatchLog entries
const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  console.log('🔍 Checking database entries...\n');
  
  const prisma = new PrismaClient();

  try {
    // Get all WatchLog entries
    const watchLogs = await prisma.watchLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        mediaType: true,
        activityType: true,
        title: true,
        customOrderItemId: true,
        startTime: true,
        endTime: true,
        isCompleted: true,
        isPaused: true,
        createdAt: true
      }
    });

    console.log('📊 Recent WatchLog entries:');
    watchLogs.forEach((log, index) => {
      console.log(`${index + 1}. ID: ${log.id}`);
      console.log(`   Title: ${log.title}`);
      console.log(`   CustomOrderItemId: ${log.customOrderItemId}`);
      console.log(`   Activity: ${log.activityType}`);
      console.log(`   Started: ${log.startTime.toISOString()}`);
      console.log(`   Ended: ${log.endTime ? log.endTime.toISOString() : 'Active'}`);
      console.log(`   Completed: ${log.isCompleted}, Paused: ${log.isPaused}`);
      console.log('');
    });

    // Check if any customOrderItems exist
    const customOrderItems = await prisma.customOrderItem.findMany({
      take: 5,
      select: { id: true, title: true }
    });

    console.log('📋 Sample CustomOrderItems:');
    if (customOrderItems.length > 0) {
      customOrderItems.forEach(item => {
        console.log(`- ID: ${item.id}, Title: ${item.title}`);
      });
    } else {
      console.log('No CustomOrderItems found in database');
    }

  } catch (error) {
    console.error('❌ Database query failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase().catch(console.error);
