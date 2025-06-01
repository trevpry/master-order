const prisma = require('./prismaClient');

async function checkSettings() {
  try {
    const settings = await prisma.Settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('=== Current Settings ===');
    if (settings) {
      console.log('TV General Percent:', settings.tvGeneralPercent);
      console.log('Movies General Percent:', settings.moviesGeneralPercent);
      console.log('Custom Order Percent:', settings.customOrderPercent);
      console.log('Collection Name:', settings.collectionName);
    } else {
      console.log('No settings found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
