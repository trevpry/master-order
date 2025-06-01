const { PrismaClient } = require('@prisma/client');
const comicVineService = require('./comicVineService');

const prisma = new PrismaClient();

async function testComicAddition() {
  console.log('=== Testing Comic Addition to Custom Order ===\n');
  
  try {
    // Get the Star Wars custom order
    const starWarsOrder = await prisma.customOrder.findFirst({
      where: { name: 'Star Wars' },
      include: { items: true }
    });
    
    if (!starWarsOrder) {
      console.log('❌ Star Wars order not found');
      return;
    }
    
    console.log(`✅ Found order: "${starWarsOrder.name}" with ${starWarsOrder.items.length} items`);
    
    // Test adding a new comic
    const testComic = 'Star Wars (2015) #1';
    console.log(`\n📖 Testing comic: "${testComic}"`);
    
    // Get comic details from ComicVine
    const comicDetails = await comicVineService.getComicCoverArt(testComic);
    
    if (comicDetails) {
      console.log(`✅ Found comic details:`);
      console.log(`   Series: ${comicDetails.seriesName}`);
      console.log(`   Issue: #${comicDetails.issueNumber}`);
      console.log(`   Publisher: ${comicDetails.publisher || 'Unknown'}`);
      console.log(`   Cover URL: ${comicDetails.coverUrl || 'None'}`);
      
      // Add to the order
      const newItem = await prisma.customOrderItem.create({
        data: {
          customOrderId: starWarsOrder.id,
          title: testComic,
          type: 'comic',
          completed: false,
          comicDetails: comicDetails
        }
      });
      
      console.log(`✅ Added comic to order (Item ID: ${newItem.id})`);
      
      // Verify it was added
      const updatedOrder = await prisma.customOrder.findUnique({
        where: { id: starWarsOrder.id },
        include: { items: true }
      });
      
      console.log(`✅ Order now has ${updatedOrder.items.length} items`);
      
    } else {
      console.log('❌ Could not retrieve comic details from ComicVine');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testComicAddition();
