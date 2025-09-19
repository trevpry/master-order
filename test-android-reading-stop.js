/**
 * Test script for Android reading session stop functionality
 * This script tests the fixes for proper book completion marking
 */

const prisma = require('./server/prismaClient');
const BookCompletionService = require('./server/services/BookCompletionService');

async function testBookCompletionService() {
  const bookCompletionService = new BookCompletionService(prisma);
  
  try {
    console.log('🧪 Testing BookCompletionService.updateProgressFromSession...');
    
    // First, let's find a book to test with
    const book = await prisma.book.findFirst({
      include: {
        customOrderItems: {
          select: { id: true }
        }
      }
    });
    
    if (!book) {
      console.log('❌ No books found in database to test with');
      return;
    }
    
    console.log(`📚 Testing with book: ${book.title} (ID: ${book.id})`);
    
    // Test 1: Update progress to 50%
    console.log('\n🧪 Test 1: Update to 50% completion...');
    const sessionData1 = {
      currentPage: 100,
      totalPages: 200,
      percentRead: 50
    };
    
    const result1 = await bookCompletionService.updateProgressFromSession(book.id, sessionData1);
    console.log('📊 Result 1:', {
      currentPage: result1.currentPage,
      percentRead: result1.percentRead,
      isCompleted: result1.isCompleted
    });
    
    // Test 2: Update progress to 100% completion
    console.log('\n🧪 Test 2: Update to 100% completion...');
    const sessionData2 = {
      currentPage: 200,
      totalPages: 200,
      percentRead: 100,
      isCompleted: true
    };
    
    const result2 = await bookCompletionService.updateProgressFromSession(book.id, sessionData2);
    console.log('📊 Result 2:', {
      currentPage: result2.currentPage,
      percentRead: result2.percentRead,
      isCompleted: result2.isCompleted
    });
    
    if (result2.isCompleted && result2.percentRead === 100) {
      console.log('✅ Book completion service working correctly!');
    } else {
      console.log('❌ Book completion service not working as expected');
    }
    
    // Check if Book pageCount was updated
    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
      select: { pageCount: true }
    });
    console.log(`📖 Book pageCount after update: ${updatedBook.pageCount}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  testBookCompletionService()
    .then(() => {
      console.log('\n🧪 Testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testBookCompletionService };