const axios = require('axios');

async function testDeleteWatchLog() {
  try {
    console.log('🧪 Testing Delete Watch Log Endpoint...\n');

    // First, let's get a list of watch logs to see what we can delete
    console.log('1. Fetching recent watch logs...');
    const recentLogsResponse = await axios.get('http://localhost:3001/api/watch-stats/recent?limit=5');
    const recentLogs = recentLogsResponse.data;

    if (recentLogs.length === 0) {
      console.log('❌ No watch logs found to test with. Create some activity first.');
      return;
    }

    console.log(`✅ Found ${recentLogs.length} recent logs:`);
    recentLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ID: ${log.id}, Title: "${log.title}", Media: ${log.mediaType}, Time: ${log.totalWatchTime} min`);
    });

    // Let's try to delete the most recent one
    const logToDelete = recentLogs[0];
    console.log(`\n2. Testing DELETE endpoint with log ID ${logToDelete.id}...`);
    console.log(`   Deleting: "${logToDelete.title}" (${logToDelete.mediaType})`);

    const deleteResponse = await axios.delete(`http://localhost:3001/api/watch-logs/${logToDelete.id}`);
    
    if (deleteResponse.status === 200) {
      console.log('✅ DELETE request successful!');
      console.log('Response:', deleteResponse.data);

      // Verify the log was actually deleted
      console.log('\n3. Verifying deletion...');
      const verifyResponse = await axios.get('http://localhost:3001/api/watch-stats/recent?limit=5');
      const updatedLogs = verifyResponse.data;

      const stillExists = updatedLogs.find(log => log.id === logToDelete.id);
      if (stillExists) {
        console.log('❌ Log still exists after deletion!');
      } else {
        console.log('✅ Log successfully deleted from database!');
        console.log(`📊 Watch logs count: ${recentLogs.length} → ${updatedLogs.length}`);
      }
    }

    console.log('\n🎉 Delete Watch Log test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testDeleteWatchLog();
