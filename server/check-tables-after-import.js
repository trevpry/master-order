const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTablesAfterImport() {
  try {
    const eventCount = await prisma.historicalEvent.count();
    const videoCount = await prisma.historyVideo.count();
    const bookCount = await prisma.historyBook.count();
    const chapterCount = await prisma.historyChapter.count();
    const sectionCount = await prisma.historySection.count();
    
    console.log('📊 Table counts after import:');
    console.log(`   Events: ${eventCount}`);
    console.log(`   Videos: ${videoCount}`);
    console.log(`   Books: ${bookCount}`);
    console.log(`   Chapters: ${chapterCount}`);
    console.log(`   Sections: ${sectionCount}`);
    
    if (eventCount > 0) {
      const sampleEvents = await prisma.historicalEvent.findMany({
        take: 5,
        select: { id: true, title: true }
      });
      console.log('\nSample events:');
      sampleEvents.forEach(event => {
        console.log(`   ${event.id}: ${event.title}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTablesAfterImport();