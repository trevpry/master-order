const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCustomOrders() {
  try {
    console.log('Checking custom orders...');
    
    const customOrders = await prisma.customOrder.findMany({
      include: {
        items: true
      }
    });
    
    console.log(`Found ${customOrders.length} custom orders`);
    
    for (const order of customOrders) {
      console.log(`\nOrder: "${order.name}" (Active: ${order.isActive})`);
      console.log(`Description: ${order.description}`);
      console.log(`Items: ${order.items.length}`);
      
      for (const item of order.items) {
        console.log(`  - ${item.title} (${item.mediaType}) - Watched: ${item.isWatched}`);
      }
    }
    
    // Also check settings
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (settings) {
      console.log(`\nOrder type percentages:`);
      console.log(`TV General: ${settings.tvGeneralPercent}%`);
      console.log(`Movies General: ${settings.moviesGeneralPercent}%`);
      console.log(`Custom Order: ${settings.customOrderPercent}%`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCustomOrders();
