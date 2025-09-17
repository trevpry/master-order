const { PrismaClient } = require('@prisma/client');

async function checkCustomOrderItems() {
  const prisma = new PrismaClient();
  
  try {
    // Check CustomOrderItems with book mediaType
    const bookItems = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'book'
      },
      include: {
        book: true, // Include the referenced book
        customOrder: {
          select: {
            name: true,
            id: true
          }
        }
      }
    });

    console.log('📚 CustomOrderItems with mediaType=book:');
    console.log(`Found ${bookItems.length} book items\n`);

    bookItems.forEach((item, index) => {
      console.log(`${index + 1}. CustomOrderItem ID: ${item.id}`);
      console.log(`   Custom Order: "${item.customOrder?.name}" (ID: ${item.customOrder?.id})`);
      console.log(`   Sort Order: ${item.sortOrder}`);
      console.log(`   Book Title (old): ${item.bookTitle || 'null'}`);
      console.log(`   Book Author (old): ${item.bookAuthor || 'null'}`);
      console.log(`   Book ID (new): ${item.bookId || 'null'}`);
      console.log(`   Referenced Book: ${item.book ? `"${item.book.title}" by ${item.book.author || 'Unknown'}` : 'None'}`);
      console.log(`   Is Watched: ${item.isWatched}`);
      console.log('');
    });

    // Also check if there are any orphaned books (books not referenced by anything)
    const orphanedBooks = await prisma.book.findMany({
      where: {
        AND: [
          {
            customOrderItems: {
              none: {}
            }
          },
          {
            historyBookLinks: {
              none: {}
            }
          }
        ]
      }
    });

    console.log(`📖 Orphaned books (not referenced by custom orders or history): ${orphanedBooks.length}`);
    orphanedBooks.forEach(book => {
      console.log(`   - "${book.title}" (ID: ${book.id})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomOrderItems();