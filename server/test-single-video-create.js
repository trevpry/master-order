const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSingleVideoCreate() {
  try {
    console.log('🔍 Testing single video creation...');
    
    // First verify event 620 exists
    const event = await prisma.historicalEvent.findUnique({
      where: { id: 620 }
    });
    console.log('Event 620 exists:', event ? 'YES' : 'NO');
    
    // Check if video 4515 exists and delete it if so
    const existingVideo = await prisma.historyVideo.findUnique({
      where: { id: 4515 }
    });
    
    if (existingVideo) {
      console.log('Deleting existing video 4515...');
      await prisma.historyVideo.delete({
        where: { id: 4515 }
      });
    }
    
    // Create the exact video record that should link to event 620
    const videoData = {
      id: 4515,
      title: '06:TutankhamenΓÇöA Murder Theory',
      url: 'https://www.thegreatcoursesplus.com/great-pharaohs-of-ancient-egypt/?lecplay=06',
      type: 'Great Courses',
      duration: null,
      description: null,
      thumbnailUrl: null,
      courseTitle: null,
      lectureNumber: null,
      publishedAt: null,
      createdAt: new Date('2025-06-23T16:09:12.309Z'),
      updatedAt: new Date('2025-06-23T16:23:38.448Z'),
      eventId: 620, // This should link to the event
      channelId: null,
      assignLater: false,
      status: null
    };
    
    console.log('Creating video with eventId:', videoData.eventId);
    
    const createdVideo = await prisma.historyVideo.create({
      data: videoData
    });
    
    console.log('✅ Video created successfully!');
    console.log('Video ID:', createdVideo.id);
    console.log('Video eventId:', createdVideo.eventId);
    
    // Fetch the video again to verify
    const fetchedVideo = await prisma.historyVideo.findUnique({
      where: { id: 4515 },
      include: {
        event: {
          select: { id: true, title: true }
        }
      }
    });
    
    console.log('\n🔍 Verification:');
    console.log('Fetched video eventId:', fetchedVideo.eventId);
    if (fetchedVideo.event) {
      console.log('Linked event:', fetchedVideo.event);
    } else {
      console.log('❌ NO EVENT LINKED!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
    if (error.meta) {
      console.error('Error meta:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testSingleVideoCreate();