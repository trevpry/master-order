const prisma = require('./server/prismaClient');

async function updateBookCover() {
  try {
    console.log('🔧 Updating book cover URL...');
    const result = await prisma.customOrderItem.update({
      where: { bookOpenLibraryId: 'OL27814516W' },
      data: { bookCoverUrl: 'https://covers.openlibrary.org/b/id/13311180-M.jpg' }
    });
    console.log('✅ Updated book cover URL');
    console.log('Updated item:', result.title);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

console.log('📚 Starting book cover update...');
updateBookCover();
