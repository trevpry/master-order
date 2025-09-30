const { PrismaClient } = require('@prisma/client');
const HistoryPlusService = require('./services/historyPlusService');

const prisma = new PrismaClient();
const historyPlusService = new HistoryPlusService();

async function testReviewStatus() {
  try {
    console.log('🔍 Testing review status logic...');
    
    // Search for very ancient events like -700000
    const ancientEvents = await prisma.historicalEvent.findMany({
      where: { 
        OR: [
          { startDate: { contains: '-700000' } },
          { startDate: { contains: '-4000' } },
          { startDate: { contains: '-3500' } },
          { title: { contains: 'Prehistoric Egypt' } }
        ]
      },
      include: {
        user_event_reviews: true,
        videos: {
          include: {
            user_video_watches: true
          }
        }
      }
    });

    console.log(`Found ${ancientEvents.length} ancient events`);
    
    // Also get the first few events when sorted chronologically 
    const events = await prisma.historicalEvent.findMany({
      where: { hidden: false },
      include: {
        user_event_reviews: true,
        videos: {
          include: {
            user_video_watches: true
          }
        }
      },
      take: 5
    });

    // Sort them using the same logic as the service
    const sortedEvents = events.sort((a, b) => {
      const dateA = historyPlusService.parseHistoricalDate(a.startDate);
      const dateB = historyPlusService.parseHistoricalDate(b.startDate);
      return dateA - dateB;
    });

    console.log('First 5 chronologically sorted events:');
    const allTestEvents = [...ancientEvents, ...sortedEvents];

    for (const event of allTestEvents) {
      console.log(`\n📅 Event: "${event.title}" (${event.startDate})`);
      console.log(`   user_event_reviews:`, event.user_event_reviews);
      
      const isEventReviewed = event.user_event_reviews && event.user_event_reviews.reviewed;
      console.log(`   isEventReviewed: ${isEventReviewed}`);
      
      // Check for actual unwatched content
      const hasUnwatchedContent = await historyPlusService.checkEventHasUnwatchedContent(event);
      console.log(`   hasUnwatchedContent: ${hasUnwatchedContent}`);
      
      // Check video details
      if (event.videos && event.videos.length > 0) {
        console.log(`   Videos (${event.videos.length}):`);
        for (const video of event.videos) {
          const watched = video.user_video_watches && video.user_video_watches.length > 0 && video.user_video_watches[0].watched;
          console.log(`     - "${video.title}": watched=${watched}`);
        }
      }
    }

  } catch (error) {
    console.error('Error testing review status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReviewStatus();