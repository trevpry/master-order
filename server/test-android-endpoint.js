const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./master_order.db'
    }
  }
});

async function testAndroidEndpoint() {
  try {
    console.log('🔍 Testing Android endpoint logic...');
    
    // Test the exact query used in the Android endpoint
    const galleryName = 'Star Warss';
    console.log(`Looking for gallery: "${galleryName}"`);
    
    const gallery = await prisma.backgroundGallery.findFirst({
      where: {
        name: galleryName
      },
      include: {
        backgrounds: true
      }
    });
    
    console.log('Gallery found:', gallery ? 'YES' : 'NO');
    if (gallery) {
      console.log('Gallery details:', {
        id: gallery.id,
        name: gallery.name,
        description: gallery.description,
        backgroundCount: gallery.backgrounds?.length || 0
      });
      
      if (gallery.backgrounds && gallery.backgrounds.length > 0) {
        const randomIndex = Math.floor(Math.random() * gallery.backgrounds.length);
        const randomImage = gallery.backgrounds[randomIndex];
        console.log('Random image:', {
          id: randomImage.id,
          filename: randomImage.filename,
          path: randomImage.path,
          url: randomImage.url
        });
      }
    }
    
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Error testing Android endpoint:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testAndroidEndpoint();
