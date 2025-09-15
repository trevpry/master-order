const { PrismaClient } = require('@prisma/client');

async function checkSpecificVideo() {
  const prisma = new PrismaClient();
  
  try {
    const video4515 = await prisma.historyVideo.findUnique({ 
      where: { id: 4515 } 
    });
    
    if (video4515) {
      console.log('✅ Video 4515 found in database:');
      console.log(`  ID: ${video4515.id}`);
      console.log(`  Title: ${video4515.title?.substring(0, 50)}...`);
      console.log(`  EventID: ${video4515.eventId} (type: ${typeof video4515.eventId})`);
      console.log(`  ChannelID: ${video4515.channelId}`);
    } else {
      console.log('❌ Video 4515 NOT FOUND in database');
    }
    
    // Also check if event 620 exists
    const event620 = await prisma.historicalEvent.findUnique({ 
      where: { id: 620 } 
    });
    
    if (event620) {
      console.log('\n✅ Event 620 found in database:');
      console.log(`  ID: ${event620.id}`);
      console.log(`  Title: ${event620.title?.substring(0, 50)}...`);
    } else {
      console.log('\n❌ Event 620 NOT FOUND in database');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificVideo();