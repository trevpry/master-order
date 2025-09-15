const { PrismaClient } = require('@prisma/client');

async function checkEventVideoLinks() {
  const prisma = new PrismaClient();
  
  try {
    // Check the specific events that should be linked
    const targetEvents = [620, 495, 649, 456];
    const events = await prisma.historicalEvent.findMany({
      where: { id: { in: targetEvents } },
      select: { id: true, title: true }
    });
    
    console.log('=== TARGET EVENTS ===');
    events.forEach(e => console.log(`  ID: ${e.id}, Title: ${e.title?.substring(0, 50)}...`));
    
    // Check if ANY videos have these eventIds
    const linkedVideos = await prisma.historyVideo.findMany({
      where: { eventId: { in: targetEvents } },
      select: { id: true, title: true, eventId: true }
    });
    
    console.log(`\n=== VIDEOS LINKED TO TARGET EVENTS ===`);
    if (linkedVideos.length > 0) {
      linkedVideos.forEach(v => console.log(`  Video ID: ${v.id}, Title: ${v.title?.substring(0, 40)}..., EventID: ${v.eventId}`));
    } else {
      console.log('  ❌ NO VIDEOS are linked to any of the target events!');
    }
    
    // Check if video 4515 specifically exists and what its eventId is
    const video4515 = await prisma.historyVideo.findUnique({
      where: { id: 4515 },
      select: { id: true, title: true, eventId: true }
    });
    
    console.log(`\n=== VIDEO 4515 DETAILS ===`);
    if (video4515) {
      console.log(`  Exists: YES`);
      console.log(`  Title: ${video4515.title}`);
      console.log(`  EventID: ${video4515.eventId} (should be 620)`);
    } else {
      console.log(`  Exists: NO`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEventVideoLinks();