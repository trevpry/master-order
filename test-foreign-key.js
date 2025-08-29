// Test foreign key validation more thoroughly
const PORT = 3001;

async function testForeignKeyValidation() {
  console.log('🧪 Testing Foreign Key Validation...\n');

  // Test 1: Create sessions with different invalid customOrderItemId values
  const testCases = [
    { customOrderItemId: 999999, title: 'Test Book A' },
    { customOrderItemId: 888888, title: 'Test Book B' },
    { customOrderItemId: 777777, title: 'Test Book C' }
  ];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`Test ${index + 1}: customOrderItemId ${testCase.customOrderItemId}`);
    
    try {
      const response = await fetch(`http://localhost:${PORT}/api/android/reading/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaType: 'book',
          title: testCase.title,
          seriesTitle: 'Test Series',
          customOrderItemId: testCase.customOrderItemId
        })
      });

      const result = await response.json();
      console.log(`Status: ${response.status}`);
      console.log(`Response sessionId: ${result.data?.sessionId}`);
      console.log(`Response customOrderItemId: ${result.data?.customOrderItemId}`);
      
      // Clean up the session
      if (result.data?.sessionId) {
        await fetch(`http://localhost:${PORT}/api/android/reading/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readingLogId: result.data.sessionId })
        });
      }
    } catch (error) {
      console.error(`❌ Test ${index + 1} failed:`, error.message);
    }
    console.log('');
  }

  // Test 4: Check the database to see what was actually stored
  console.log('Test 4: Verify database entries');
  try {
    const response = await fetch(`http://localhost:${PORT}/api/reading/active`);
    const activeReading = await response.json();
    console.log('Active reading sessions:', JSON.stringify(activeReading, null, 2));
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
  
  console.log('\n🎉 Foreign key validation testing completed!');
}

testForeignKeyValidation().catch(console.error);
