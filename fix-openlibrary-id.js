const prisma = require('./server/prismaClient');

async function fixOpenLibraryId() {
  try {
    console.log('🔧 Fixing OpenLibrary ID format...');
    
    // First, check what we have
    const book = await prisma.customOrderItem.findFirst({
      where: { 
        mediaType: 'book',
        bookOpenLibraryId: 'OL27814516W' 
      }
    });
    
    if (!book) {
      console.log('❌ Book with ID OL27814516W not found');
      return;
    }
    
    console.log(`📖 Found book: "${book.title}"`);
    console.log(`   Current OpenLibrary ID: ${book.bookOpenLibraryId}`);
    
    const result = await prisma.customOrderItem.update({
      where: { 
        id: book.id
      },
      data: { 
        bookOpenLibraryId: '/works/OL27814516W' 
      }
    });
    
    console.log('✅ Updated OpenLibrary ID to correct format');
    console.log(`   Book: ${result.title}`);
    console.log(`   New ID: ${result.bookOpenLibraryId}`);
    
  } catch (error) {
    console.error('Error updating OpenLibrary ID:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOpenLibraryId();
