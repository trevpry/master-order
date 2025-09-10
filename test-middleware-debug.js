const { PrismaClient } = require('./server/node_modules/@prisma/client');

// Create a new client to test the middleware
const prisma = new PrismaClient();

// Add middleware to this test client
prisma.$use(async (params, next) => {
  console.log('🔧 Prisma middleware triggered:', params.model, params.action);
  
  // Only intercept customOrderItem updates
  if (params.model === 'CustomOrderItem' && params.action === 'update') {
    console.log('📝 Intercepting CustomOrderItem update');
    console.log('📝 Update data:', params.args.data);
    
    const data = params.args.data;
    
    // If we're updating reading progress, calculate the missing value
    if (data.bookPercentRead !== undefined || data.bookCurrentPage !== undefined) {
      console.log('📊 Processing reading progress update...');
      
      // Get the current item data to access bookPageCount
      const currentItem = await prisma.customOrderItem.findUnique({
        where: params.args.where,
        select: { bookPageCount: true, bookCurrentPage: true, bookPercentRead: true }
      });
      
      console.log('📖 Current item data:', currentItem);
      
      const pageCount = data.bookPageCount !== undefined ? data.bookPageCount : currentItem?.bookPageCount;
      console.log('📖 Page count to use:', pageCount);
      
      if (pageCount && pageCount > 0) {
        // If percentage was updated but not current page, calculate current page
        if (data.bookPercentRead !== undefined && data.bookCurrentPage === undefined) {
          const calculatedPage = Math.round((data.bookPercentRead / 100) * pageCount);
          data.bookCurrentPage = calculatedPage;
          console.log(`✅ Calculated bookCurrentPage from ${data.bookPercentRead}%: ${calculatedPage}`);
        }
        
        // If current page was updated but not percentage, calculate percentage
        if (data.bookCurrentPage !== undefined && data.bookPercentRead === undefined) {
          const calculatedPercent = Math.min(100, Math.round((data.bookCurrentPage / pageCount) * 100));
          data.bookPercentRead = calculatedPercent;
          console.log(`✅ Calculated bookPercentRead from page ${data.bookCurrentPage}: ${calculatedPercent}%`);
        }
      } else {
        console.log('❌ No page count available for calculation');
      }
      
      console.log('📝 Final update data:', data);
    }
  }
  
  return next(params);
});

async function testWithDebugMiddleware() {
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
    
    // Test setting percentage to 75% - should calculate current page
    console.log('\n--- Testing: Setting 75% progress ---');
    const updateResult1 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { bookPercentRead: 75 }
    });
    
    console.log('Result after setting 75%:', {
      currentPage: updateResult1.bookCurrentPage,
      percentRead: updateResult1.bookPercentRead
    });
    
    // Test setting current page to 100 - should calculate percentage
    console.log('\n--- Testing: Setting current page to 100 ---');
    const updateResult2 = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { bookCurrentPage: 100 }
    });
    
    console.log('Result after setting page 100:', {
      currentPage: updateResult2.bookCurrentPage,
      percentRead: updateResult2.bookPercentRead
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWithDebugMiddleware();
