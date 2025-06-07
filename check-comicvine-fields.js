const prisma = require('./server/prismaClient');

async function checkComicVineFields() {
  try {
    // Get a comic item to check the fields
    const comicItems = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'comic'
      },
      take: 1
    });
    
    if (comicItems.length === 0) {
      console.log('No comic items found');
      return;
    }
    
    const item = comicItems[0];
    console.log('Comic item found:');
    console.log(`ID: ${item.id}`);
    console.log(`Title: ${item.title}`);
    console.log(`ComicVineId: ${item.comicVineId}`);
    console.log(`ComicVineDetailsJson: ${item.comicVineDetailsJson ? 'Present' : 'Null'}`);
    
    // Test updating the item
    console.log('\nTesting update...');
    const updated = await prisma.customOrderItem.update({
      where: { id: item.id },
      data: {
        comicVineId: 'https://test.example.com',
        comicVineDetailsJson: '{"test": "data"}'
      }
    });
    
    console.log('✅ Update successful!');
    console.log(`Updated ComicVineId: ${updated.comicVineId}`);
    console.log(`Updated ComicVineDetailsJson: ${updated.comicVineDetailsJson}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkComicVineFields();
