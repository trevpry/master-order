const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPrehistoricEgypt() {
  try {
    console.log('🔍 Checking Prehistoric Egypt event details...');
    
    const event = await prisma.historicalEvent.findFirst({
      where: { 
        title: { contains: 'Prehistoric Egypt' }
      },
      include: {
        user_event_reviews: true,
        videos: {
          include: {
            user_video_watches: true,
            channel: true
          }
        },
        bookLinks: {
          include: {
            book: {
              include: {
                bookCompletions: true
              }
            }
          }
        }
      }
    });

    if (!event) {
      console.log('❌ Event not found');
      return;
    }

    console.log(`\n📅 Event: "${event.title}" (${event.startDate})`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Hidden: ${event.hidden}`);
    console.log(`   Review status:`, event.user_event_reviews);
    
    console.log(`\n   Videos (${event.videos.length}):`);
    for (const video of event.videos) {
      console.log(`     - "${video.title}"`);
      console.log(`       Channel: ${video.channel?.name || 'Unknown'}`);
      console.log(`       Watch records:`, video.user_video_watches);
      
      const watchRecord = video.user_video_watches;
      const watched = watchRecord && watchRecord.length > 0 && watchRecord[0]?.watched;
      console.log(`       Computed watched status: ${watched}`);
    }
    
    console.log(`\n   Book Links (${event.bookLinks.length}):`);
    for (const bookLink of event.bookLinks) {
      console.log(`     - "${bookLink.book.title}"`);
      console.log(`       Completions:`, bookLink.book.bookCompletions);
    }

  } catch (error) {
    console.error('Error checking Prehistoric Egypt:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrehistoricEgypt();