const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWeatherSettings() {
  try {
    console.log('🔍 Testing Eddie Settings database access...');
    
    const settings = await prisma.eddieSettings.findFirst();
    console.log('📊 Current Eddie Settings:', settings);
    
    if (!settings) {
      console.log('🔧 Creating default Eddie settings...');
      const newSettings = await prisma.eddieSettings.create({
        data: {
          weatherEnabled: false,
          weatherUnits: 'metric'
        }
      });
      console.log('✅ Created default settings:', newSettings);
    } else {
      console.log('✅ Eddie settings exist');
      console.log('   Weather enabled:', settings.weatherEnabled);
      console.log('   Weather units:', settings.weatherUnits);
      console.log('   API key configured:', !!settings.weatherApiKey);
      console.log('   Location set:', !!settings.weatherLocation);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testWeatherSettings();
