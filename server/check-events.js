const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEventReviews() {
  // Check a few events and their reviews
  const events = await prisma.historicalEvent.findMany({
    take: 3,
    include: {
      user_event_reviews: true
    }
  });
  
  console.log('=== SAMPLE EVENTS WITH REVIEWS ===');
  events.forEach(event => {
    console.log(`Event ${event.id}: ${event.title}`);
    console.log(`  Reviewed field: ${event.reviewed}`);
    if (event.user_event_reviews) {
      console.log(`  User review: reviewed=${event.user_event_reviews.reviewed}`);
    } else {
      console.log(`  User review: none`);
    }
    console.log('');
  });
  
  // Check video-event linkage
  const videosWithEvents = await prisma.historyVideo.count({
    where: { eventId: { not: null } }
  });
  
  const totalVideos = await prisma.historyVideo.count();
  
  console.log(`=== VIDEO-EVENT LINKAGE ===`);
  console.log(`Videos linked to events: ${videosWithEvents}`);
  console.log(`Total videos: ${totalVideos}`);
  
  await prisma.$disconnect();
}

checkEventReviews().catch(console.error);