const { PrismaClient } = require('@prisma/client');

async function addColumns() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding bookPageCount column...');
    await prisma.$executeRaw`ALTER TABLE CustomOrderItem ADD COLUMN bookPageCount INTEGER;`;
    console.log('✅ Added bookPageCount column');
  } catch (error) {
    console.log('bookPageCount column already exists or error:', error.message);
  }
  
  try {
    console.log('Adding bookCurrentPage column...');
    await prisma.$executeRaw`ALTER TABLE CustomOrderItem ADD COLUMN bookCurrentPage INTEGER;`;
    console.log('✅ Added bookCurrentPage column');
  } catch (error) {
    console.log('bookCurrentPage column already exists or error:', error.message);
  }
  
  try {
    console.log('Adding bookPercentRead column...');
    await prisma.$executeRaw`ALTER TABLE CustomOrderItem ADD COLUMN bookPercentRead REAL;`;
    console.log('✅ Added bookPercentRead column');
  } catch (error) {
    console.log('bookPercentRead column already exists or error:', error.message);
  }
  
  await prisma.$disconnect();
  console.log('✅ Database columns added successfully!');
}

addColumns().catch(console.error);
