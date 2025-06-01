require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testSettings() {
  const prisma = new PrismaClient();
  
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('Settings:', JSON.stringify(settings, null, 2));
    
    if (settings) {
      console.log(`\nOrder type percentages:`);
      console.log(`- TV General: ${settings.tvGeneralPercent || 50}%`);
      console.log(`- Movies General: ${settings.moviesGeneralPercent || 50}%`);
      console.log(`- Custom Order: ${settings.customOrderPercent || 0}%`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSettings();
