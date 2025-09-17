const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

async function testComic3Session() {
  console.log('🧪 Testing reading session for Avatar: Tsu\'tey\'s Path 3...\n');
  
  const prisma = new PrismaClient();
  
  try {
    // Start a reading session for comic ID 3
    console.log('1. Starting reading session for comic 3...');
    const startResponse = await fetch('http://localhost:3001/api/reading/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'comic',
        title: 'Avatar: Tsu\'tey\'s Path 3',
        seriesTitle: null,
        customOrderItemId: 3,
        comicSeries: 'Avatar: Tsu\'tey\'s Path',
        comicIssue: '3'
      })
    });
    
    const startResult = await startResponse.json();
    console.log('Start response:', JSON.stringify(startResult, null, 2));
    
    if (startResult.success) {
      const sessionId = startResult.data.id;
      console.log(`\nSession started with ID: ${sessionId}`);
      
      // Backdate the session to make it appear longer than 1 minute
      console.log('\n2. Backdating session to meet duration requirement...');
      await prisma.watchLog.update({
        where: { id: sessionId },
        data: { startTime: new Date(Date.now() - 70000) }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('\n3. Stopping session with 100% progress...');
      const stopResponse = await fetch('http://localhost:3001/api/reading/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progress: {
            readPercentage: 100,
            currentPage: 200,
            totalPages: 200
          }
        })
      });
      
      const stopResult = await stopResponse.json();
      console.log('Stop response:', JSON.stringify(stopResult, null, 2));
      
      console.log('\n4. Checking updated comic state...');
      const updatedComic = await prisma.customOrderItem.findUnique({
        where: { id: 3 },
        select: {
          bookCurrentPage: true,
          bookPageCount: true,
          bookPercentRead: true,
          isWatched: true
        }
      });
      console.log('Updated comic state:', JSON.stringify(updatedComic, null, 2));
      
      if (updatedComic.isWatched === true && updatedComic.bookPercentRead === 100) {
        console.log('\n✅ SUCCESS: Comic marked as read at 100%!');
      } else {
        console.log('\n❌ FAILED: Comic not marked as read');
        
        // Let's check what went wrong
        const session = await prisma.watchLog.findUnique({
          where: { id: sessionId }
        });
        
        if (session) {
          console.log('Session still exists:', JSON.stringify(session, null, 2));
        } else {
          console.log('Session was deleted (probably due to duration)');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testComic3Session().catch(console.error);