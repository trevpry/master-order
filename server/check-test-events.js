const { PrismaClient } = require('@prisma/client');

async function checkTestEvents() {
  const prisma = new PrismaClient();
  
  try {
    // Check for Test Events
    const testEvents = await prisma.historicalEvent.findMany({
      where: { title: 'Test Event' },
      orderBy: { createdAt: 'desc' },
      include: {
        videos: true
      }
    });
    
    console.log(`Found ${testEvents.length} "Test Event" events:`);
    testEvents.forEach(event => {
      console.log(`- ID: ${event.id}, Title: ${event.title}`);
      console.log(`  Created: ${event.createdAt}`);
      console.log(`  Videos: ${event.videos.length}`);
      if (event.videos.length > 0) {
        event.videos.forEach(video => {
          console.log(`    - Video ID: ${video.id}, Title: ${video.title}`);
        });
      }
      console.log('');
    });
    
    // Check the video that was assigned
    const video1 = await prisma.historyVideo.findUnique({
      where: { id: 1 },
      include: { event: true }
    });
    
    if (video1) {
      console.log(`Video 1 details:`);
      console.log(`- Title: ${video1.title}`);
      console.log(`- Event ID: ${video1.eventId}`);
      console.log(`- Event Title: ${video1.event?.title || 'No event'}`);
    } else {
      console.log('Video 1 not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestEvents();