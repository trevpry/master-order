/**
 * Focused test to debug the reading session stop issue
 */

const baseUrl = 'http://localhost:3001';

async function testStopWithProgress() {
  console.log('🔍 Testing reading session stop with progress...\n');
  
  try {
    // Step 1: Start a session
    console.log('1️⃣ Starting reading session...');
    const startResponse = await fetch(`${baseUrl}/api/android/reading/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'book',
        title: 'Test Book for Debug',
        customOrderItemId: 24 // Star Trek book
      })
    });
    
    const startData = await startResponse.json();
    console.log('✅ Session started:', startData.data?.sessionId);
    
    // Wait a bit
    console.log('\n2️⃣ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: Stop with progress
    console.log('\n3️⃣ Stopping with progress...');
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
    
    // Check what went wrong
    console.log('\n🔍 Analysis:');
    console.log(`- progressUpdated: ${stopData.data?.progressUpdated}`);
    console.log(`- progress in response: ${JSON.stringify(stopData.data?.progress)}`);
    console.log(`- markedAsRead: ${stopData.data?.markedAsRead}`);
    
    if (!stopData.data?.progressUpdated) {
      console.log('\n❌ ISSUE: Progress was NOT updated!');
      console.log('This means either:');
      console.log('  1. No customOrderItemId in session');
      console.log('  2. No progress data sent');
      console.log('  3. Error in progress update try-catch');
      console.log('  4. finalProgressData never set');
    }
    
    // Check the database
    console.log('\n4️⃣ Checking database for custom order item 24...');
    const itemResponse = await fetch(`${baseUrl}/api/custom-orders`);
    const orders = await itemResponse.json();
    
    let found = false;
    for (const order of orders) {
      const item = order.items?.find(i => i.id === 24);
      if (item) {
        found = true;
        console.log(`✅ Found item ${item.id}:`);
        console.log(`  - title: ${item.title}`);
        console.log(`  - bookId: ${item.bookId}`);
        console.log(`  - mediaType: ${item.mediaType}`);
        
        if (item.bookId) {
          console.log(`\n📚 This is a unified book (bookId: ${item.bookId})`);
          console.log('   Progress should be in BookCompletion table');
        } else {
          console.log('\n📖 This is a comic/other media (no bookId)');
          console.log('   Progress should be in CustomOrderItem fields');
        }
      }
    }
    
    if (!found) {
      console.log('❌ Item not found in custom orders!');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  }
}

testStopWithProgress()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
