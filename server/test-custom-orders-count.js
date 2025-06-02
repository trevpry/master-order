const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCustomOrdersCount() {
  try {
    const count = await prisma.customOrder.count();
    console.log('Custom orders count:', count);
    
    // Also fetch all custom orders to see what we have
    const customOrders = await prisma.customOrder.findMany();
    console.log('Custom orders:', customOrders);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCustomOrdersCount();
