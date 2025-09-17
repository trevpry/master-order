const { PrismaClient } = require('@prisma/client');

/**
 * Clean up redundant book fields in CustomOrderItems
 * Since books now reference the unified Book table, we can clear the old fields
 */
async function cleanupCustomOrderBookFields() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🧹 Cleaning up redundant book fields in CustomOrderItems...');
    
    // Find CustomOrderItems with book references that still have old book fields
    const itemsToClean = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'book',
        bookId: { not: null },
        OR: [
          { bookTitle: { not: null } },
          { bookAuthor: { not: null } },
          { bookYear: { not: null } },
          { bookIsbn: { not: null } },
          { bookPublisher: { not: null } },
          { bookOpenLibraryId: { not: null } },
          { bookCoverUrl: { not: null } },
          { bookPageCount: { not: null } }
        ]
      },
      include: {
        book: true,
        customOrder: { select: { name: true, id: true } }
      }
    });

    console.log(`Found ${itemsToClean.length} CustomOrderItems with redundant book fields`);

    for (const item of itemsToClean) {
      console.log(`📚 Cleaning CustomOrderItem ${item.id} in order "${item.customOrder.name}"`);
      console.log(`   Removing: ${item.bookTitle} by ${item.bookAuthor}`);
      console.log(`   Keeping reference to: "${item.book.title}" (ID: ${item.book.id})`);

      // Clear the redundant book fields
      await prisma.customOrderItem.update({
        where: { id: item.id },
        data: {
          bookTitle: null,
          bookAuthor: null,
          bookYear: null,
          bookIsbn: null,
          bookPublisher: null,
          bookOpenLibraryId: null,
          bookCoverUrl: null,
          bookPageCount: null,
          bookCurrentPage: null,  // This data is now in BookCompletion
          bookPercentRead: null   // This data is now in BookCompletion
        }
      });
    }

    console.log(`✅ Cleaned up ${itemsToClean.length} CustomOrderItems`);
    console.log('💡 CustomOrderItems now only reference unified Books via bookId');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupCustomOrderBookFields();