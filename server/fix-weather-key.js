const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateWeatherApiKey() {
  try {
    console.log('Updating weather API key...');
    
    // Note: You'll need to get a valid API key from https://openweathermap.org/api
    // For testing, I'll clear the invalid key and disable weather
    const updatedSettings = await prisma.eddieSettings.update({
      where: { id: 1 },
      data: {
        weatherApiKey: null,
        weatherEnabled: false
      }
    });
    
    console.log('Updated settings (disabled weather due to invalid API key):', updatedSettings);
    console.log('\nTo re-enable weather:');
    console.log('1. Sign up at https://openweathermap.org/api');
    console.log('2. Get a free API key');
    console.log('3. Update settings in the Eddie Settings page');
    
  } catch (error) {
    console.error('Error updating weather API key:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateWeatherApiKey();
