const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function checkPagesReadCalculation() {
  try {
    // Check some books with pages and reading progress
    const books = await prisma.customOrderItem.findMany({
      where: { 
        mediaType: 'book',
        bookPageCount: { not: null },
        OR: [
          { bookCurrentPage: { not: null } },
          { bookPercentRead: { not: null } }
        ]
      },
      select: { 
        id: true, 
        title: true, 
        bookTitle: true,
        bookAuthor: true,
        bookPageCount: true,
        bookCurrentPage: true,
        bookPercentRead: true,
        isWatched: true
      },
      take: 10
    });
    
    console.log('Found', books.length, 'books with reading progress:');
    
    for (const book of books) {
      console.log('\n--- Book:', book.title || book.bookTitle);
      console.log('  Author:', book.bookAuthor);
      console.log('  Total Pages:', book.bookPageCount);
      console.log('  Current Page:', book.bookCurrentPage);
      console.log('  Percent Read:', book.bookPercentRead);
      console.log('  Is Watched:', book.isWatched);
      
      // Calculate what pages read should be
      let calculatedPagesRead = 0;
      if (book.bookCurrentPage && book.bookCurrentPage > 0) {
        calculatedPagesRead = book.bookCurrentPage;
      } else if (book.bookPercentRead && book.bookPageCount) {
        calculatedPagesRead = Math.round((book.bookPercentRead / 100) * book.bookPageCount);
      }
      
      console.log('  Calculated Pages Read:', calculatedPagesRead);
    }
    
    // Now check what watch logs exist for these books
    console.log('\n=== Checking WatchLogs ===');
    const bookIds = books.map(b => b.id);
    const watchLogs = await prisma.watchLog.findMany({
      where: {
        customOrderItemId: { in: bookIds },
        activityType: 'read'
      },
      select: {
        id: true,
        customOrderItemId: true,
        title: true,
        duration: true,
        totalWatchTime: true,
        customOrderItem: {
          select: {
            title: true,
            bookPageCount: true,
            bookCurrentPage: true,
            bookPercentRead: true
          }
        }
      },
      take: 10
    });
    
    console.log('Found', watchLogs.length, 'reading watch logs:');
    
    for (const log of watchLogs) {
      console.log('\n--- Log for:', log.title);
      console.log('  Duration:', log.duration);
      console.log('  Total Watch Time:', log.totalWatchTime);
      console.log('  Item Pages:', log.customOrderItem?.bookPageCount);
      console.log('  Item Current Page:', log.customOrderItem?.bookCurrentPage);
      console.log('  Item Percent:', log.customOrderItem?.bookPercentRead);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPagesReadCalculation();
