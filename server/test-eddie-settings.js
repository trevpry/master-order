const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEddieSettings() {
  try {
    console.log('Testing EddieSettings table...');
    
    // Try to find existing settings
    const settings = await prisma.eddieSettings.findFirst();
    console.log('Existing settings:', settings);
    
    // Try to create default settings if none exist
    if (!settings) {
      console.log('No settings found, creating default settings...');
      const newSettings = await prisma.eddieSettings.create({
        data: {
          weatherEnabled: false,
          weatherUnits: 'metric'
        }
      });
      console.log('Created default settings:', newSettings);
    }
    
  } catch (error) {
    console.error('Error testing EddieSettings:', error.message);
    console.error('Error code:', error.code);
    console.error('Error meta:', error.meta);
  } finally {
    await prisma.$disconnect();
  }
}

testEddieSettings();
