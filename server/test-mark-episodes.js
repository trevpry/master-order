const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function markEpisodesAsWatched() {
  console.log('=== Marking Episodes as Watched to Get to Comics ===\n');
  
  try {
    // Get the X-Men order and mark all episodes as watched
    const xmenOrder = await prisma.customOrder.findFirst({
      where: { name: 'X-Men Animated' },
      include: { items: true }
    });
    
    if (!xmenOrder) {
      console.log('❌ X-Men order not found');
      return;
    }
    
    console.log(`Found order: "${xmenOrder.name}" with ${xmenOrder.items.length} items`);
    
    // Mark all episodes as watched
    const episodes = xmenOrder.items.filter(item => item.type === 'episode');
    console.log(`Marking ${episodes.length} episodes as watched...`);
    
    for (const episode of episodes) {
      await prisma.customOrderItem.update({
        where: { id: episode.id },
        data: { completed: true }
      });
    }
    
    console.log('✅ All episodes marked as watched');
    
    // Check what's next
    const { getNextCustomOrder } = require('./getNextCustomOrder');
    const nextItem = await getNextCustomOrder();
    
    if (nextItem) {
      console.log(`\n📺 Next item: "${nextItem.title}"`);
      console.log(`📺 Type: ${nextItem.type}`);
      console.log(`📺 Order: ${nextItem.customOrderName}`);
      
      if (nextItem.type === 'comic' && nextItem.comicDetails) {
        console.log('\n🎨 Comic Details:');
        console.log(`   Series: ${nextItem.comicDetails.seriesName}`);
        console.log(`   Issue: #${nextItem.comicDetails.issueNumber}`);
        console.log(`   Publisher: ${nextItem.comicDetails.publisher || 'Unknown'}`);
        console.log(`   Cover URL: ${nextItem.comicDetails.coverUrl || 'None'}`);
      }
    } else {
      console.log('\n⚠️  No next item found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

markEpisodesAsWatched();
