const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBooks() {
  try {
    console.log('📚 Checking existing books...');
    
    const books = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'book'
      },
      select: {
        id: true,
        title: true,
        customOrderId: true,
        bookOpenLibraryId: true,
        bookTitle: true,
        bookAuthor: true
      },
      take: 10
    });
    
    console.log(`Found ${books.length} books:`);
    books.forEach(book => {
      console.log(`- ID: ${book.id}, Title: ${book.title}, CustomOrderId: ${book.customOrderId}, OpenLibraryId: ${book.bookOpenLibraryId}`);
    });
    
    // Check for any short stories that reference books
    const storiesWithBooks = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'shortstory',
        storyContainedInBookId: {
          not: null
        }
      },
      include: {
        storyContainedInBook: true
      },
      take: 5
    });
    
    console.log(`\n📖 Found ${storiesWithBooks.length} stories linked to books:`);
    storiesWithBooks.forEach(story => {
      console.log(`- Story: "${story.storyTitle}" linked to book: "${story.storyContainedInBook?.bookTitle}" (Book CustomOrderId: ${story.storyContainedInBook?.customOrderId})`);
    });
    
  } catch (error) {
    console.error('Error checking books:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBooks();
