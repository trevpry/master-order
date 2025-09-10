const { PrismaClient } = require('./server/node_modules/@prisma/client');

// Create a new client with debug middleware
const prisma = new PrismaClient();

// Add debug middleware 
prisma.$use(async (params, next) => {
  console.log('🔧 Middleware triggered:', params.model, params.action);
  
  if (params.model === 'CustomOrderItem' && params.action === 'update') {
    console.log('📝 Update data before processing:', params.args.data);
    const data = params.args.data;
    
    if (data.bookPercentRead !== undefined || data.bookCurrentPage !== undefined) {
      console.log('📊 Processing reading progress update...');
      
      const currentItem = await prisma.customOrderItem.findUnique({
        where: params.args.where,
        select: { bookPageCount: true, bookCurrentPage: true, bookPercentRead: true }
      });
      
      console.log('📖 Current item:', currentItem);
      
      const pageCount = data.bookPageCount !== undefined ? data.bookPageCount : currentItem?.bookPageCount;
      console.log('📖 Page count to use:', pageCount);
      
      if (pageCount && pageCount > 0) {
        console.log('🔍 Checking calculation conditions:');
        console.log('  - bookPercentRead !== undefined:', data.bookPercentRead !== undefined);
        console.log('  - bookCurrentPage === undefined:', data.bookCurrentPage === undefined);
        console.log('  - bookCurrentPage !== undefined:', data.bookCurrentPage !== undefined);
        console.log('  - bookPercentRead === undefined:', data.bookPercentRead === undefined);
        
        if (data.bookPercentRead !== undefined && data.bookCurrentPage === undefined) {
          const calculatedPage = Math.round((data.bookPercentRead / 100) * pageCount);
          data.bookCurrentPage = calculatedPage;
          console.log(`✅ Calculated bookCurrentPage from ${data.bookPercentRead}%: ${calculatedPage}`);
        }
        
        if (data.bookCurrentPage !== undefined && data.bookPercentRead === undefined) {
          const calculatedPercent = Math.min(100, Math.round((data.bookCurrentPage / pageCount) * 100));
          data.bookPercentRead = calculatedPercent;
          console.log(`✅ Calculated bookPercentRead from page ${data.bookCurrentPage}: ${calculatedPercent}%`);
        }
      }
      
      console.log('📝 Final update data:', data);
    }
  }
  
  return next(params);
});

async function testDebugUpdate() {
  try {
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
    
    console.log('Testing with book:', book.title);
    console.log('Current state:', book);
    
    // Test setting only percentage
    console.log('\n=== Testing: Setting only percentRead=50 ===');
    const result = await prisma.customOrderItem.update({
      where: { id: book.id },
      data: { 
        bookPercentRead: 50
      }
    });
    
    console.log('Result:', {
      currentPage: result.bookCurrentPage,
      percentRead: result.bookPercentRead
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDebugUpdate();
