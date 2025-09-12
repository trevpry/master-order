const { PrismaClient } = require('@prisma/client');

async function testSQLite() {
  const prisma = new PrismaClient();
  
  try {
    const count = await prisma.customOrderItem.count();
    console.log('✅ SQLite database is working!');
    console.log(`✅ CustomOrderItems: ${count}`);
    
    const settingsCount = await prisma.settings.count();
    console.log(`✅ Settings: ${settingsCount}`);
    
    console.log('\n✅ Your development environment is restored and working!');
    
  } catch (error) {
    console.error('❌ SQLite test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSQLite();