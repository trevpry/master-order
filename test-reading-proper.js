/**
 * Proper test - wait 65 seconds then stop with progress
 */

const baseUrl = 'http://localhost:3001';

async function testProperReadingSession() {
  console.log('🔍 Testing reading session with 65+ second duration...\n');
  
  try {
    // Step 1: Start a session
    console.log('1️⃣ Starting reading session...');
    const startResponse = await fetch(`${baseUrl}/api/android/reading/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'book',
        title: 'Test Book for Debug',
        customOrderItemId: 24 // Star Trek book (has bookId: 51)
      })
    });
    
    const startData = await startResponse.json();
    const sessionId = startData.data?.sessionId;
    console.log('✅ Session started:', sessionId);
    console.log(`   Full response: ${JSON.stringify(startData, null, 2)}`);
    
    // Wait MORE than 1 minute
    console.log('\n2️⃣ Waiting 65 seconds (to exceed 1 minute threshold)...');
    for (let i = 65; i > 0; i--) {
      process.stdout.write(`\r   ⏳ ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n   ✅ Wait complete!\n');
    
    // Step 3: Stop with progress
    console.log('3️⃣ Stopping with progress data...');
    console.log('   Progress to send: { currentPage: 50, totalPages: 100, readPercentage: 50 }');
    
    const stopResponse = await fetch(`${baseUrl}/api/android/reading/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        progress: {
          currentPage: 50,
          totalPages: 100,
          readPercentage: 50
        }
      })
    });
    
    const stopData = await stopResponse.json();
    console.log('\n📊 Stop Response:');
    console.log(JSON.stringify(stopData, null, 2));
    
    // Analyze the response
    console.log('\n🔍 Analysis:');
    console.log(`   Status: ${stopResponse.status} ${stopResponse.statusText}`);
    console.log(`   Success: ${stopData.success}`);
    
    if (stopData.success) {
      const data = stopData.data;
      console.log(`   - sessionId: ${data.sessionId}`);
      console.log(`   - duration: ${data.duration}s`);
      console.log(`   - totalActiveTime: ${data.totalActiveTime}s`);
      console.log(`   - progressUpdated: ${data.progressUpdated}`);
      console.log(`   - markedAsRead: ${data.markedAsRead}`);
      console.log(`   - progress: ${JSON.stringify(data.progress)}`);
      
      if (!data.progressUpdated) {
        console.log('\n❌ ISSUE FOUND: progressUpdated is FALSE');
        console.log('   This means the progress was NOT saved to the database!');
      } else {
        console.log('\n✅ Progress was successfully updated');
      }
      
      if (data.sessionDeleted) {
        console.log('\n⚠️  Session was deleted (under 1 minute)');
      }
    } else {
      console.log('\n❌ Request failed!');
      console.log(`   Error: ${stopData.error || 'Unknown error'}`);
      if (stopData.data?.error) {
        console.log(`   Details: ${stopData.data.error}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with exception:', error.message);
    console.error(error.stack);
    throw error;
  }
}

testProperReadingSession()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
