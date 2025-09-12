const { PrismaClient } = require('@prisma/client');

async function checkHistoryPlusData() {
  const prisma = new PrismaClient();
  
  try {
    console.log('📚 Checking History Plus data in SQLite...\n');
    
    // Check main History Plus tables using Prisma methods
    const counts = {};
    
    try {
      counts.events = await prisma.historicalEvent.count();
    } catch (e) {
      counts.events = 'Error: ' + e.message;
    }
    
    try {
      counts.videos = await prisma.historyVideo.count();
    } catch (e) {
      counts.videos = 'Error: ' + e.message;
    }
    
    try {
      counts.books = await prisma.historyBook.count();
    } catch (e) {
      counts.books = 'Error: ' + e.message;
    }
    
    try {
      counts.channels = await prisma.historyChannel.count();
    } catch (e) {
      counts.channels = 'Error: ' + e.message;
    }
    
    try {
      counts.chapters = await prisma.historyChapter.count();
    } catch (e) {
      counts.chapters = 'Error: ' + e.message;
    }
    
    try {
      counts.sections = await prisma.historySection.count();
    } catch (e) {
      counts.sections = 'Error: ' + e.message;
    }
    
    console.log('📊 History Plus data counts:');
    Object.entries(counts).forEach(([key, count]) => {
      console.log(`   ${key}: ${count}`);
    });
    
    // If we have data, show some sample records
    const total = Object.values(counts).filter(c => typeof c === 'number').reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      console.log(`\n✅ Found ${total} total History Plus records in SQLite!`);
      console.log('✅ Your History Plus data is safe and ready for migration.');
      
      // Show a few sample events
      try {
        const sampleEvents = await prisma.historicalEvent.findMany({
          take: 3,
          select: {
            id: true,
            title: true,
            date: true,
            category: true
          }
        });
        
        if (sampleEvents.length > 0) {
          console.log('\n📝 Sample events:');
          sampleEvents.forEach(event => {
            console.log(`   - ${event.title} (${event.date}) [${event.category}]`);
          });
        }
      } catch (e) {
        console.log('Sample events error:', e.message);
      }
    } else {
      console.log('\n❌ No History Plus data found in SQLite database');
    }
    
  } catch (error) {
    console.error('Error checking History Plus data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkHistoryPlusData();