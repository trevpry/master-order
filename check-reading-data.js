const { PrismaClient } = require('./server/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function checkWatchLogs() {
  try {
    console.log('=== ALL WATCH LOGS ===');
    const allLogs = await prisma.watchLog.findMany({
      orderBy: { startTime: 'desc' }
    });
    
    console.log(`Total logs found: ${allLogs.length}`);
    
    allLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. ID: ${log.id}`);
      console.log(`   Media Type: ${log.mediaType}`);
      console.log(`   Activity Type: ${log.activityType}`);
      console.log(`   Title: ${log.title}`);
      console.log(`   Start Time: ${log.startTime}`);
      console.log(`   End Time: ${log.endTime}`);
      console.log(`   Total Watch Time: ${log.totalWatchTime}`);
      console.log(`   Is Completed: ${log.isCompleted}`);
      console.log(`   Is Paused: ${log.isPaused}`);
    });
    
    console.log('\n=== READING LOGS ONLY ===');
    const readingLogs = allLogs.filter(log => log.activityType === 'read');
    console.log(`Total reading logs: ${readingLogs.length}`);
    
    let totalReadTime = 0;
    readingLogs.forEach(log => {
      totalReadTime += log.totalWatchTime || 0;
    });
    console.log(`Total reading time from DB: ${totalReadTime} minutes`);
    
    console.log('\n=== ACTIVE READING SESSIONS ===');
    const activeSessions = await prisma.watchLog.findMany({
      where: {
        activityType: 'read',
        OR: [
          { endTime: null },
          { AND: [{ endTime: { not: null } }, { isPaused: true }] }
        ]
      }
    });
    console.log(`Active reading sessions: ${activeSessions.length}`);
    activeSessions.forEach(session => {
      console.log(`- ${session.title} (${session.isPaused ? 'Paused' : 'Active'})`);
    });
    
  } catch (error) {
    console.error('Error checking watch logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWatchLogs();
