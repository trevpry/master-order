const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    // Create a test order
    const newOrder = await prisma.order.create({
      data: {
        customerName: 'Test Customer',
        status: 'New',
      }
    });
    
    console.log('Created order:', newOrder);
    
    // Retrieve all orders
    const orders = await prisma.order.findMany();
    console.log('All orders:', orders);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
