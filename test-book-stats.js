const ActivityStatsService = require('./server/services/watchlog/activityStatsService');
const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function testBookStats() {
  try {
    const prisma = new PrismaClient();
    const statsService = new ActivityStatsService(prisma);
    
    console.log('Testing book statistics calculation...');
    
    const bookStats = await statsService.getMediaTypeStats('book', 'all', 'day');
    
    console.log('\n=== Book Statistics ===');
    console.log('Total Books:', bookStats.totalStats.totalBooks);
    console.log('Total Pages Read:', bookStats.totalStats.totalPagesRead);
    console.log('Total Book Read Time:', bookStats.totalStats.totalBookReadTimeFormatted);
    console.log('Total Completed Books:', bookStats.totalStats.totalCompletedBooks);
    
    if (bookStats.totalStats.authorBreakdown && bookStats.totalStats.authorBreakdown.byPagesRead) {
      console.log('\n=== Author Breakdown (by Pages Read) ===');
      const topAuthors = bookStats.totalStats.authorBreakdown.byPagesRead.slice(0, 3);
      for (const author of topAuthors) {
        console.log(`${author.name}: ${author.totalPagesRead} pages, ${author.bookCount} books, ${author.totalReadTimeFormatted}`);
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testBookStats();
