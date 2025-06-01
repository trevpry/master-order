// Test shared Prisma client
require('dotenv').config();
const prisma = require('./prismaClient');

async function testConnection() {
  try {
    console.log('Testing shared Prisma client connection...');
    
    // Test a simple query
    const count = await prisma.plexTVShow.count();
    console.log(`✅ Successfully connected! Found ${count} TV shows`);
    
    // Test custom orders
    const customOrders = await prisma.customOrder.findMany();
    console.log(`✅ Found ${customOrders.length} custom orders`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('Disconnected from database');
  }
}

testConnection();
