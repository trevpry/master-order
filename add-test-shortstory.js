const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestShortStory() {
  try {
    // First, create a custom order if one doesn't exist
    let customOrder = await prisma.customOrder.findFirst();
    
    if (!customOrder) {
      customOrder = await prisma.customOrder.create({
        data: {
          name: 'Test Order',
          description: 'Test order for short story'
        }
      });
      console.log('Created test custom order:', customOrder.name);
    }
    
    // Check if we already have a test short story
    const existingStory = await prisma.customOrderItem.findFirst({
      where: {
        mediaType: 'shortstory',
        storyTitle: 'The Test Story'
      }
    });
    
    if (existingStory) {
      console.log('Test short story already exists:', existingStory.storyTitle);
      return;
    }
    
    // Create a test short story
    const shortStory = await prisma.customOrderItem.create({
      data: {
        customOrderId: customOrder.id,
        mediaType: 'shortstory',
        title: 'The Test Story',
        plexKey: 'shortstory-the-test-story',
        storyTitle: 'The Test Story',
        storyAuthor: 'Test Author',
        storyYear: '2024',
        storyUrl: 'https://example.com/test-story',
        sortOrder: 0,
        isWatched: false
      }
    });
    
    console.log('Created test short story:');
    console.log('- Title:', shortStory.storyTitle);
    console.log('- Author:', shortStory.storyAuthor);
    console.log('- Year:', shortStory.storyYear);
    console.log('- URL:', shortStory.storyUrl);
    
    console.log('\nYou can now test the short story display on the home page!');
    
  } catch (error) {
    console.error('Error creating test short story:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestShortStory();
