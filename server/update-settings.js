const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSettings() {
  try {
    // Update settings to favor custom orders for testing
    await prisma.settings.upsert({
      where: { id: 1 },
      update: { 
        customOrderPercent: 80, 
        tvGeneralPercent: 10, 
        moviesGeneralPercent: 10 
      },
      create: { 
        id: 1, 
        customOrderPercent: 80, 
        tvGeneralPercent: 10, 
        moviesGeneralPercent: 10 
      }
    });
    console.log('Updated settings to favor custom orders');
    
    // Check existing custom orders
    const orders = await prisma.customOrder.findMany({
      include: { items: true }
    });
    
    console.log(`Custom orders: ${orders.length}`);
    orders.forEach(order => {
      console.log(`- ${order.name}: ${order.items.length} items, active: ${order.isActive}`);
      order.items.forEach(item => {
        console.log(`  * ${item.title} (${item.mediaType}) - watched: ${item.isWatched}`);
      });
    });
    
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

updateSettings();
