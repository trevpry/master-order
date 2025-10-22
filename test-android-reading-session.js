/**
 * Test script for Android API reading session workflow
 * Simulates: Start -> Wait -> Stop with progress tracking
 */

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(80)}`, colors.bright);
  log(`STEP ${step}: ${message}`, colors.cyan);
  log('='.repeat(80), colors.bright);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${baseUrl}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  logInfo(`Making ${method} request to: ${url}`);
  if (body) {
    logInfo(`Request body: ${JSON.stringify(body, null, 2)}`);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    logInfo(`Response status: ${response.status} ${response.statusText}`);
    logInfo(`Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (!response.ok) {
      logError(`Request failed with status ${response.status}`);
      return { success: false, status: response.status, data };
    }
    
    return { success: true, status: response.status, data };
  } catch (error) {
    logError(`Request error: ${error.message}`);
    throw error;
  }
}

async function testReadingSessionWorkflow() {
  log('\n' + '█'.repeat(80), colors.bright);
  log('ANDROID API READING SESSION TEST', colors.magenta);
  log('█'.repeat(80), colors.bright);
  log(`Base URL: ${baseUrl}`, colors.cyan);
  
  try {
    // Step 1: Get a custom order item to test with
    logStep(1, 'Getting a custom order item for testing');
    
    const itemsResponse = await makeRequest('/api/custom-orders');
    if (!itemsResponse.success) {
      logError('Failed to get custom order items');
      return;
    }

    // Find a book or comic to test with
    let testItem = null;
    for (const order of itemsResponse.data) {
      if (order.items && order.items.length > 0) {
        testItem = order.items.find(item => 
          ['book', 'comic', 'shortstory'].includes(item.mediaType)
        );
        if (testItem) break;
      }
    }

    if (!testItem) {
      logWarning('No reading content found in custom orders. Creating a test session without customOrderItemId...');
      testItem = {
        title: 'Test Book',
        mediaType: 'book',
        id: null
      };
    } else {
      logSuccess(`Found test item: "${testItem.title}" (${testItem.mediaType}, ID: ${testItem.id})`);
    }

    // Step 2: Start reading session
    logStep(2, 'Starting reading session via Android API');
    
    const startBody = {
      mediaType: testItem.mediaType,
      title: testItem.title,
      seriesTitle: 'Test Series',
      customOrderItemId: testItem.id
    };

    const startResponse = await makeRequest('/api/android/reading/start', 'POST', startBody);
    
    if (!startResponse.success) {
      logError('Failed to start reading session');
      logError(JSON.stringify(startResponse.data, null, 2));
      return;
    }

    const sessionId = startResponse.data.data?.sessionId || startResponse.data.sessionId;
    if (!sessionId) {
      logError('No session ID returned from start endpoint');
      return;
    }

    logSuccess(`Reading session started successfully!`);
    logInfo(`Session ID: ${sessionId}`);
    logInfo(`Title: ${testItem.title}`);
    logInfo(`Media Type: ${testItem.mediaType}`);

    // Step 3: Wait for a specified duration
    const waitTime = parseInt(process.env.WAIT_TIME) || 65000; // Default 65 seconds
    const waitSeconds = Math.floor(waitTime / 1000);
    
    logStep(3, `Waiting ${waitSeconds} seconds to simulate reading...`);
    
    // Show countdown
    for (let i = waitSeconds; i > 0; i--) {
      process.stdout.write(`\r⏳ Time remaining: ${i}s `);
      await delay(1000);
    }
    console.log('\n');
    
    logSuccess('Wait complete!');

    // Step 4: Pause/Resume test (optional)
    if (process.env.TEST_PAUSE === 'true') {
      logStep(4, 'Testing pause functionality');
      
      const pauseResponse = await makeRequest('/api/android/reading/pause', 'POST', {});
      
      if (pauseResponse.success) {
        logSuccess('Session paused successfully');
        logInfo('Waiting 5 seconds...');
        await delay(5000);
        
        logStep(4.1, 'Testing resume functionality');
        const resumeResponse = await makeRequest('/api/android/reading/pause', 'POST', {});
        
        if (resumeResponse.success) {
          logSuccess('Session resumed successfully');
        } else {
          logError('Failed to resume session');
        }
      } else {
        logError('Failed to pause session');
      }
    }

    // Step 5: Stop reading session with progress
    logStep(process.env.TEST_PAUSE === 'true' ? 5 : 4, 'Stopping reading session with progress');
    
    const progress = {
      currentPage: 75,
      totalPages: 100,
      readPercentage: 75
    };

    logInfo(`Progress being sent: ${JSON.stringify(progress, null, 2)}`);
    
    const stopBody = { progress };
    const stopResponse = await makeRequest('/api/android/reading/stop', 'POST', stopBody);
    
    if (!stopResponse.success) {
      logError('Failed to stop reading session');
      logError(JSON.stringify(stopResponse.data, null, 2));
      
      // Log the full error for debugging
      if (stopResponse.data.error) {
        logError(`Error: ${stopResponse.data.error}`);
      }
      if (stopResponse.data.details) {
        logError(`Details: ${stopResponse.data.details}`);
      }
      if (stopResponse.data.data?.error) {
        logError(`Data Error: ${stopResponse.data.data.error}`);
      }
      
      return;
    }

    logSuccess('Reading session stopped successfully!');
    
    const stopData = stopResponse.data.data || stopResponse.data;
    logInfo(`Duration: ${stopData.duration}s`);
    logInfo(`Total Active Time: ${stopData.totalActiveTime}s`);
    logInfo(`Progress Updated: ${stopData.progressUpdated}`);
    logInfo(`Marked as Read: ${stopData.markedAsRead}`);
    
    if (stopData.progress) {
      logInfo(`Final Progress: ${JSON.stringify(stopData.progress, null, 2)}`);
    }

    // Step 6: Verify the session was recorded
    logStep(process.env.TEST_PAUSE === 'true' ? 6 : 5, 'Verifying session in watch history');
    
    const historyResponse = await makeRequest('/api/watch-history?limit=1');
    
    if (historyResponse.success && historyResponse.data.length > 0) {
      const latestSession = historyResponse.data[0];
      if (latestSession.id === sessionId) {
        logSuccess('Session verified in watch history');
        logInfo(`Title: ${latestSession.title}`);
        logInfo(`Duration: ${latestSession.duration}s`);
        logInfo(`Ended at: ${latestSession.endTime}`);
      } else {
        logWarning('Latest session ID does not match our session');
      }
    } else {
      logWarning('Could not verify session in watch history');
    }

    // Final summary
    log('\n' + '█'.repeat(80), colors.bright);
    log('TEST COMPLETED SUCCESSFULLY', colors.green);
    log('█'.repeat(80), colors.bright);

  } catch (error) {
    log('\n' + '█'.repeat(80), colors.bright);
    log('TEST FAILED', colors.red);
    log('█'.repeat(80), colors.bright);
    logError(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Test for 100% completion scenario
async function test100PercentCompletion() {
  log('\n' + '█'.repeat(80), colors.bright);
  log('ANDROID API 100% COMPLETION TEST', colors.magenta);
  log('█'.repeat(80), colors.bright);
  
  try {
    logStep(1, 'Getting a test item');
    
    const itemsResponse = await makeRequest('/api/custom-orders');
    if (!itemsResponse.success) {
      logError('Failed to get custom order items');
      return;
    }

    let testItem = null;
    for (const order of itemsResponse.data) {
      if (order.items && order.items.length > 0) {
        testItem = order.items.find(item => 
          ['book', 'comic', 'shortstory'].includes(item.mediaType) && !item.isWatched
        );
        if (testItem) break;
      }
    }

    if (!testItem) {
      logWarning('No unwatched reading content found');
      return;
    }

    logSuccess(`Found unwatched item: "${testItem.title}"`);

    logStep(2, 'Starting reading session');
    const startResponse = await makeRequest('/api/android/reading/start', 'POST', {
      mediaType: testItem.mediaType,
      title: testItem.title,
      customOrderItemId: testItem.id
    });

    if (!startResponse.success) {
      logError('Failed to start session');
      return;
    }

    logSuccess('Session started');
    logInfo('Waiting 65 seconds...');
    await delay(65000);

    logStep(3, 'Stopping with 100% completion');
    const stopResponse = await makeRequest('/api/android/reading/stop', 'POST', {
      progress: {
        currentPage: 100,
        totalPages: 100,
        readPercentage: 100
      }
    });

    if (!stopResponse.success) {
      logError('Failed to stop session');
      logError(JSON.stringify(stopResponse.data, null, 2));
      return;
    }

    const stopData = stopResponse.data.data || stopResponse.data;
    
    if (stopData.markedAsRead) {
      logSuccess('✅ Item correctly marked as read!');
    } else {
      logError('❌ Item was NOT marked as read at 100%');
    }

    logInfo(`Response: ${JSON.stringify(stopData, null, 2)}`);

  } catch (error) {
    logError(`Test failed: ${error.message}`);
    throw error;
  }
}

// Main execution
if (require.main === module) {
  const testType = process.env.TEST_TYPE || 'normal';
  
  if (testType === '100percent') {
    test100PercentCompletion()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  } else {
    testReadingSessionWorkflow()
      .then(() => process.exit(0))
      .catch(error => {
        console.error(error);
        process.exit(1);
      });
  }
}

module.exports = { testReadingSessionWorkflow, test100PercentCompletion };
