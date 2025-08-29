// Quick test script for reading API endpoints
const PORT = 3001;

async function testReadingAPI() {
  console.log('🧪 Testing Reading API endpoints...\n');

  // Test 1: Invalid customOrderItemId (should handle gracefully)
  console.log('Test 1: Invalid customOrderItemId');
  try {
    const response1 = await fetch(`http://localhost:${PORT}/api/android/reading/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'book',
        title: 'Test Book',
        seriesTitle: 'Test Series',
        customOrderItemId: 999999 // This ID should not exist
      })
    });

    const result1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log('Response:', JSON.stringify(result1, null, 2));
    console.log('✅ Test 1 completed\n');
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: Valid request without customOrderItemId
  console.log('Test 2: Valid request without customOrderItemId');
  try {
    const response2 = await fetch(`http://localhost:${PORT}/api/android/reading/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: 'book',
        title: 'Test Book 2',
        seriesTitle: 'Test Series 2'
      })
    });

    const result2 = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log('Response:', JSON.stringify(result2, null, 2));
    console.log('✅ Test 2 completed\n');
    
    // Store the session ID for cleanup
    if (result2.session && result2.session.id) {
      console.log('Test 3: Stopping the reading session');
      const stopResponse = await fetch(`http://localhost:${PORT}/api/android/reading/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readingLogId: result2.session.id
        })
      });
      
      const stopResult = await stopResponse.json();
      console.log(`Stop Status: ${stopResponse.status}`);
      console.log('Stop Response:', JSON.stringify(stopResult, null, 2));
      console.log('✅ Test 3 completed\n');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('🎉 API testing completed!');
}

testReadingAPI().catch(console.error);
