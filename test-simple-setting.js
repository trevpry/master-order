// Simple test using built-in Node.js modules
const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testPartiallyWatchedSetting() {
  try {
    console.log('Testing partially watched collection setting...\n');
    
    // Get current settings
    console.log('1. Fetching current settings...');
    const currentSettings = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/settings',
      method: 'GET'
    });
    
    console.log('Current partiallyWatchedCollectionPercent:', currentSettings.partiallyWatchedCollectionPercent);
    
    // Update setting to 90%
    console.log('\n2. Updating setting to 90%...');
    const updateResult = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, { partiallyWatchedCollectionPercent: 90 });
    
    console.log('Update response:', updateResult.message || 'Success');
    
    // Verify the update
    console.log('\n3. Verifying the update...');
    const updatedSettings = await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: '/api/settings',
      method: 'GET'
    });
    
    console.log('Updated partiallyWatchedCollectionPercent:', updatedSettings.partiallyWatchedCollectionPercent);
    
    if (updatedSettings.partiallyWatchedCollectionPercent === 90) {
      console.log('✅ Setting update successful!');
    } else {
      console.log('❌ Setting update failed!');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testPartiallyWatchedSetting();
