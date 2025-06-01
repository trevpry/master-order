const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMediaTypes() {
  try {
    const items = await prisma.customOrderItem.findMany();
    console.log('Custom order items:');
    items.forEach(item => {
      console.log(`- ${item.title}: "${item.mediaType}"`);
    });
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkMediaTypes();
