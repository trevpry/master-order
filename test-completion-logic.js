const { PrismaClient } = require('@prisma/client');
const WatchLogService = require('./server/watchLogService');

const prisma = new PrismaClient();
const watchLogService = new WatchLogService(prisma);

async function testCompletionLogic() {
  try {
    console.log('🧪 Testing completion logic...\n');

    // Find a book or comic to test with
    const testItem = await prisma.customOrderItem.findFirst({
      where: {
        mediaType: { in: ['book', 'comic'] }
      }
    });

    if (!testItem) {
      console.log('No test books/comics found. Creating a test book...');
      const testBook = await prisma.customOrderItem.create({
        data: {
          title: 'Test Book for Completion',
          mediaType: 'book',
          bookAuthor: 'Test Author',
          bookPageCount: 200,
          customOrder: {
            connectOrCreate: {
              where: { name: 'Test Order for Completion' },
              create: { name: 'Test Order for Completion', orderType: 'custom' }
            }
          }
        }
      });
      console.log('✅ Created test book:', testBook.title);
      return testBook;
    }

    console.log('📚 Found test item:', testItem.title, `(${testItem.mediaType})`);
    console.log('🔍 Current status:');
    console.log(`   - isWatched: ${testItem.isWatched}`);
    console.log(`   - bookPercentRead: ${testItem.bookPercentRead}`);
    console.log(`   - webvideoPercentWatched: ${testItem.webvideoPercentWatched}`);

    return testItem;

  } catch (error) {
    console.error('❌ Error testing completion logic:', error);
  }
}

async function simulateReadingSession(customOrderItemId, readPercentage) {
  try {
    console.log(`\n🎬 Simulating reading session with ${readPercentage}% completion...`);

    // Start a reading session
    const readingSession = await watchLogService.startReading({
      mediaType: 'book',
      title: 'Test Book for Completion',
      customOrderItemId: customOrderItemId
    });

    console.log('✅ Started reading session:', readingSession.id);

    // Wait a moment (simulate reading time)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Stop the reading session with progress
    const completedSession = await watchLogService.stopReading(readingSession.id);

    console.log('✅ Stopped reading session');

    // Now simulate the progress update (this is what the API endpoint does)
    if (readPercentage !== undefined && customOrderItemId) {
      console.log('📊 Updating progress...');
      
      const updateData = {
        bookPercentRead: readPercentage
      };

      // If read percentage is 100%, mark as read/watched
      if (readPercentage === 100) {
        updateData.isWatched = true;
        console.log('🎯 Marking item as read/watched (100% completion)');
      }

      await prisma.customOrderItem.update({
        where: { id: customOrderItemId },
        data: updateData
      });

      console.log('✅ Progress updated successfully:', updateData);

      // Check the final state
      const updatedItem = await prisma.customOrderItem.findUnique({
        where: { id: customOrderItemId }
      });

      console.log('📋 Final state:');
      console.log(`   - isWatched: ${updatedItem.isWatched}`);
      console.log(`   - bookPercentRead: ${updatedItem.bookPercentRead}`);
      
      if (readPercentage === 100 && updatedItem.isWatched) {
        console.log('🎉 SUCCESS: Item correctly marked as watched at 100% completion!');
      } else if (readPercentage === 100 && !updatedItem.isWatched) {
        console.log('❌ FAILURE: Item should be marked as watched at 100% completion!');
      } else {
        console.log('✅ CORRECT: Item not marked as watched (not 100% complete)');
      }
    }

  } catch (error) {
    console.error('❌ Error simulating reading session:', error);
  }
}

async function runTests() {
  try {
    const testItem = await testCompletionLogic();
    
    if (testItem) {
      // Test with 50% completion (should not mark as watched)
      await simulateReadingSession(testItem.id, 50);
      
      // Test with 100% completion (should mark as watched)
      await simulateReadingSession(testItem.id, 100);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
