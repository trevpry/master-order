const { PrismaClient } = require('./server/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function testPageCalculation() {
  try {
    // Find a book with page count
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
      console.log('No books with page count found');
      return;
    }
    
    console.log('Testing with book:', book.title);
    console.log('Current state:', {
      pageCount: book.bookPageCount,
      currentPage: book.bookCurrentPage,
      percentRead: book.bookPercentRead
    });
    
    // Test setting percentage to 25% - should calculate current page
    console.log('\n--- Testing: Setting 25% progress ---');
    const updateResult1 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { bookPercentRead: 25 }
    });
    
    console.log('After setting 25%:', {
      currentPage: updateResult1.bookCurrentPage,
      percentRead: updateResult1.bookPercentRead
    });
    
    // Test setting current page to 400 - should calculate percentage
    console.log('\n--- Testing: Setting current page to 400 ---');
    const updateResult2 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { bookCurrentPage: 400 }
    });
    
    console.log('After setting current page to 400:', {
      currentPage: updateResult2.bookCurrentPage,
      percentRead: updateResult2.bookPercentRead
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPageCalculation();
