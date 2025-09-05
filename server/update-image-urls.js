const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateImageUrls() {
  try {
    // Get current Stash URL from settings
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.stashUrl) {
      console.error('No Stash URL found in settings');
      return;
    }
    
    const currentStashUrl = settings.stashUrl.endsWith('/') 
      ? settings.stashUrl.slice(0, -1) 
      : settings.stashUrl;
    
    console.log('Current Stash URL from settings:', currentStashUrl);
    
    // Update performer images
    const performersResult = await prisma.stashPerformer.updateMany({
      where: {
        image: {
          not: null,
          contains: 'http://192.168.1.113:9999'
        }
      },
      data: {
        image: {
          // This won't work with updateMany, need to do individually
        }
      }
    });
    
    // Get all performers with old URLs
    const performersToUpdate = await prisma.stashPerformer.findMany({
      where: {
        image: {
          not: null,
          contains: 'http://192.168.1.113:9999'
        }
      }
    });
    
    console.log(`Found ${performersToUpdate.length} performers with old image URLs`);
    
    // Update each performer individually
    for (const performer of performersToUpdate) {
      const newImageUrl = performer.image.replace('http://192.168.1.113:9999', currentStashUrl);
      await prisma.stashPerformer.update({
        where: { id: performer.id },
        data: { image: newImageUrl }
      });
      console.log(`Updated performer ${performer.name}: ${performer.image} -> ${newImageUrl}`);
    }
    
    // Get all studios with old URLs
    const studiosToUpdate = await prisma.stashStudio.findMany({
      where: {
        image: {
          not: null,
          contains: 'http://192.168.1.113:9999'
        }
      }
    });
    
    console.log(`Found ${studiosToUpdate.length} studios with old image URLs`);
    
    // Update each studio individually
    for (const studio of studiosToUpdate) {
      const newImageUrl = studio.image.replace('http://192.168.1.113:9999', currentStashUrl);
      await prisma.stashStudio.update({
        where: { id: studio.id },
        data: { image: newImageUrl }
      });
      console.log(`Updated studio ${studio.name}: ${studio.image} -> ${newImageUrl}`);
    }
    
    // Get all scenes with old image URLs
    const scenesToUpdate = await prisma.stashScene.findMany({
      where: {
        screenshot: {
          not: null,
          contains: 'http://192.168.1.113:9999'
        }
      }
    });
    
    console.log(`Found ${scenesToUpdate.length} scenes with old screenshot URLs`);
    
    // Update each scene individually
    for (const scene of scenesToUpdate) {
      const newScreenshotUrl = scene.screenshot.replace('http://192.168.1.113:9999', currentStashUrl);
      await prisma.stashScene.update({
        where: { id: scene.id },
        data: { screenshot: newScreenshotUrl }
      });
      console.log(`Updated scene ${scene.title}: ${scene.screenshot} -> ${newScreenshotUrl}`);
    }
    
    console.log('✅ All image URLs updated successfully!');
    
  } catch (error) {
    console.error('Error updating image URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateImageUrls();
