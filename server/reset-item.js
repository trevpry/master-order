const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetItem() {
  try {
    await prisma.customOrderItem.update({
      where: { id: 1 },
      data: { isWatched: false }
    });
    console.log('Reset Red Dawn to unwatched');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

resetItem();
