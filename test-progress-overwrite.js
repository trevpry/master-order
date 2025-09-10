const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testProgressUpdate() {
  try {
    // Find a book with current progress
    const book = await prisma.customOrderItem.findFirst({
      where: { 
        mediaType: 'book',
        bookPageCount: { not: null }
      },
      select: { 
        id: true, 
        title: true, 
        bookPageCount: true,
        bookCurrentPage: true,
        bookPercentRead: true 
      }
    });
    
    if (!book) {
      console.log('No books found');
      return;
    }
    
    console.log('Testing with book:', book.title);
    console.log('Before update:', {
      pageCount: book.bookPageCount,
      currentPage: book.bookCurrentPage,
      percentRead: book.bookPercentRead
    });
    
    // Simulate stopping a reading session at page 50 with 10% progress
    console.log('\n--- Testing: Setting both currentPage=50 and percentRead=10 (simulating session stop) ---');
    const result = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { 
        bookCurrentPage: 50,
        bookPercentRead: 10
      }
    });
    
    console.log('After update:', {
      currentPage: result.bookCurrentPage,
      percentRead: result.bookPercentRead
    });
    
    // Test setting just percentage (should calculate page)
    console.log('\n--- Testing: Setting only percentRead=25 ---');
    const result2 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { 
        bookPercentRead: 25
      }
    });
    
    console.log('After percentage-only update:', {
      currentPage: result2.bookCurrentPage,
      percentRead: result2.bookPercentRead
    });
    
    // Test setting just current page (should calculate percentage)
    console.log('\n--- Testing: Setting only currentPage=200 ---');
    const result3 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { 
        bookCurrentPage: 200
      }
    });
    
    console.log('After page-only update:', {
      currentPage: result3.bookCurrentPage,
      percentRead: result3.bookPercentRead
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProgressUpdate();
