const prisma = require('./server/prismaClient');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database for book items...\n');
    
    // Check all custom orders
    const orders = await prisma.customOrder.findMany({
      include: {
        items: true
      }
    });
    
    console.log(`Found ${orders.length} custom orders:\n`);
    
    for (const order of orders) {
      console.log(`📋 Order: "${order.name}" (ID: ${order.id}, Active: ${order.isActive})`);
      console.log(`   Items: ${order.items.length}`);
      
      for (const item of order.items) {
        console.log(`   - ${item.title} (${item.mediaType})`);
        if (item.mediaType === 'book') {
          console.log(`     Book Author: ${item.bookAuthor}`);
          console.log(`     Book Year: ${item.bookYear}`);
          console.log(`     Book Cover URL: ${item.bookCoverUrl}`);
          console.log(`     OpenLibrary ID: ${item.bookOpenLibraryId}`);
          console.log(`     Watched: ${item.isWatched}`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
