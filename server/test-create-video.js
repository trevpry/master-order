const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCreateVideo() {
  try {
    console.log('🔍 Testing video creation with eventId...');
    
    // First check if event 620 exists
    const event = await prisma.historicalEvent.findUnique({
      where: { id: 620 }
    });
    
    console.log('Event 620 exists:', event ? 'YES' : 'NO');
    if (event) {
      console.log('Event title:', event.title);
    }
    
    // Check if video 4515 already exists
    const existingVideo = await prisma.historyVideo.findUnique({
      where: { id: 4515 }
    });
    
    console.log('Video 4515 exists:', existingVideo ? 'YES' : 'NO');
    if (existingVideo) {
      console.log('Current eventId:', existingVideo.eventId);
    }
    
    // Try to create a test video with eventId 620
    const testVideoData = {
      id: 99999,
      title: 'TEST VIDEO',
      eventId: 620,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    console.log('\n🔬 Attempting to create test video with eventId...');
    const testVideo = await prisma.historyVideo.create({
      data: testVideoData
    });
    
    console.log('✅ Test video created successfully!');
    console.log('Test video eventId:', testVideo.eventId);
    
    // Clean up - delete the test video
    await prisma.historyVideo.delete({
      where: { id: 99999 }
    });
    
    console.log('🧹 Test video cleaned up');
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error('Error code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateVideo();