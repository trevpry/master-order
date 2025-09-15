const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('Investigating Video Library display issues...');
  
  try {
    // Check video-event linkage
    const videosWithEvents = await prisma.historyVideo.findMany({
      where: { eventId: { not: null } },
      take: 5,
      select: { id: true, title: true, eventId: true }
    });
    console.log('\nVideos linked to events:');
    console.log(`Found ${videosWithEvents.length} videos with events (showing first 5):`);
    videosWithEvents.forEach(v => console.log(`  Video ${v.id}: ${v.title} -> Event ${v.eventId}`));
    
    // Check total videos with/without events
    const eventStats = {
      totalVideos: await prisma.historyVideo.count(),
      videosWithEvents: await prisma.historyVideo.count({ where: { eventId: { not: null } } }),
      videosWithoutEvents: await prisma.historyVideo.count({ where: { eventId: null } })
    };
    console.log('\nEvent assignment stats:');
    console.log(eventStats);
    
    // Check watch status
    const watchedVideos = await prisma.user_video_watches.findMany({
      where: { watched: true },
      take: 5,
      include: { video: { select: { title: true } } }
    });
    console.log('\nWatched videos:');
    console.log(`Found ${watchedVideos.length} watched videos (showing first 5):`);
    watchedVideos.forEach(w => console.log(`  ${w.video.title} - watched at ${w.watchedAt}`));
    
    // Check watch statistics
    const watchStats = {
      totalWatchRecords: await prisma.user_video_watches.count(),
      watchedCount: await prisma.user_video_watches.count({ where: { watched: true } }),
      unwatchedCount: await prisma.user_video_watches.count({ where: { watched: false } })
    };
    console.log('\nWatch status stats:');
    console.log(watchStats);
    
    // Check "assign later" videos (this might be a separate field or table)
    const sampleVideos = await prisma.historyVideo.findMany({
      take: 3,
      select: { id: true, title: true, eventId: true, assignLater: true }
    });
    console.log('\nSample video data:');
    sampleVideos.forEach(v => console.log(`  Video ${v.id}: eventId=${v.eventId}, assignLater=${v.assignLater}, title=${v.title}`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();