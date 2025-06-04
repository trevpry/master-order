const axios = require('axios');

async function testConnection() {
  console.log('Starting connectivity test...');
  console.log('Making request to http://localhost:3001/api/settings');
  
  try {
    const response = await axios.get('http://localhost:3001/api/settings', { timeout: 5000 });
    console.log('✅ Server is responding');
    console.log('Status:', response.status);
    console.log('Data received:', typeof response.data);
  } catch (error) {
    console.log('❌ Server connection failed');
    console.log('Error message:', error.message);
    console.log('Error code:', error.code);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('Server appears to be down');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('Server request timed out');
    }
  }
  console.log('Test completed');
}

testConnection();
