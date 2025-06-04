const openLibraryService = require('./server/openLibraryService');
const prisma = require('./server/prismaClient');

async function fixBookCoverUrl() {
  try {
    console.log('🔧 Fixing book cover URL...\n');
    
    // Get the book with OpenLibrary ID
    const book = await prisma.customOrderItem.findFirst({
      where: {
        mediaType: 'book',
        bookOpenLibraryId: 'OL27814516W'
      }
    });
    
    if (!book) {
      console.log('❌ Book not found');
      return;
    }
    
    console.log(`📖 Found book: "${book.title}" by ${book.bookAuthor}`);
    console.log(`   OpenLibrary ID: ${book.bookOpenLibraryId}`);
    console.log(`   Current Cover URL: ${book.bookCoverUrl}`);
    
    // Fetch book details from OpenLibrary
    console.log('\n🔍 Fetching from OpenLibrary...');
    const bookDetails = await openLibraryService.getBookDetails(book.bookOpenLibraryId);
    
    if (bookDetails && bookDetails.coverUrl) {
      console.log(`✅ Found cover URL: ${bookDetails.coverUrl}`);
      
      // Update the book with the cover URL
      await prisma.customOrderItem.update({
        where: { id: book.id },
        data: { bookCoverUrl: bookDetails.coverUrl }
      });
      
      console.log('✅ Updated book with cover URL');
    } else {
      console.log('❌ No cover URL found in OpenLibrary response');
      console.log('Response:', bookDetails);
    }
    
  } catch (error) {
    console.error('Error fixing book cover URL:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBookCoverUrl();
