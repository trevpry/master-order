const { PrismaClient } = require('@prisma/client');

async function checkComicState() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking Avatar: Tsu\'tey\'s Path 3 state...\n');
    
    // Find the comic by series and issue
    const comic = await prisma.customOrderItem.findFirst({
      where: {
        comicSeries: 'Avatar: Tsu\'tey\'s Path',
        comicIssue: '3'
      },
      select: {
        id: true,
        title: true,
        comicSeries: true,
        comicIssue: true,
        bookCurrentPage: true,
        bookPageCount: true,
        bookPercentRead: true,
        isWatched: true,
        bookId: true
      }
    });
    
    if (comic) {
      console.log('Comic found:', JSON.stringify(comic, null, 2));
      
      // Check if there's a unified book entry
      if (comic.bookId) {
        const bookCompletion = await prisma.bookCompletion.findUnique({
          where: { bookId: comic.bookId },
          select: {
            currentPage: true,
            totalPages: true,
            percentRead: true,
            isCompleted: true
          }
        });
        console.log('\nUnified BookCompletion:', JSON.stringify(bookCompletion, null, 2));
      }
      
      // Check for any recent reading sessions
      const recentSessions = await prisma.watchLog.findMany({
        where: {
          customOrderItemId: comic.id,
          mediaType: 'comic',
          activityType: 'read'
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          startTime: true,
          endTime: true,
          duration: true,
          createdAt: true,
          currentPage: true
        }
      });
      
      console.log('\nRecent reading sessions:', JSON.stringify(recentSessions, null, 2));
    } else {
      console.log('❌ Comic not found');
      
      // Search for similar comics
      const similarComics = await prisma.customOrderItem.findMany({
        where: {
          OR: [
            { comicSeries: { contains: 'Avatar' } },
            { title: { contains: 'Tsu\'tey' } }
          ]
        },
        select: {
          id: true,
          title: true,
          comicSeries: true,
          comicIssue: true,
          isWatched: true
        }
      });
      
      console.log('Similar comics found:', JSON.stringify(similarComics, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkComicState().catch(console.error);