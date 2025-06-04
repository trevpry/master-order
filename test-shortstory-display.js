const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testShortStoryDisplay() {
  try {
    console.log('Testing short story display functionality...');
    
    // Check if there are any short story items in the database
    const shortStories = await prisma.customOrderItem.findMany({
      where: {
        mediaType: 'shortstory'
      },
      include: {
        storyContainedInBook: {
          select: {
            title: true,
            bookTitle: true,
            bookCoverUrl: true
          }
        }
      }
    });
    
    console.log(`Found ${shortStories.length} short stories in the database:`);
    
    shortStories.forEach((story, index) => {
      console.log(`\n${index + 1}. ${story.storyTitle || story.title}`);
      console.log(`   Author: ${story.storyAuthor || 'Unknown'}`);
      console.log(`   Year: ${story.storyYear || 'Unknown'}`);
      console.log(`   URL: ${story.storyUrl || 'None'}`);
      console.log(`   Cover URL: ${story.storyCoverUrl || 'None'}`);
      
      if (story.storyContainedInBook) {
        console.log(`   Contained in book: "${story.storyContainedInBook.bookTitle || story.storyContainedInBook.title}"`);
        console.log(`   Parent book cover: ${story.storyContainedInBook.bookCoverUrl || 'None'}`);
      }
    });
    
    if (shortStories.length === 0) {
      console.log('\nNo short stories found. The display functionality is ready for when short stories are added.');
    }
    
  } catch (error) {
    console.error('Error testing short story display:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testShortStoryDisplay();
