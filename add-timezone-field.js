const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function addTimezoneField() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding timezone field to Settings table...');
    
    // Try to add the field using raw SQL
    await prisma.$executeRaw`ALTER TABLE Settings ADD COLUMN timezone TEXT DEFAULT 'UTC'`;
    
    console.log('✅ Timezone field added successfully!');
    
    // Verify the field was added
    const settings = await prisma.settings.findFirst();
    console.log('Current settings:', settings);
    
  } catch (error) {
    if (error.message.includes('duplicate column name')) {
      console.log('✅ Timezone field already exists!');
    } else {
      console.error('Error adding timezone field:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addTimezoneField();
