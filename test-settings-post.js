const axios = require('axios');

async function testSettingsPost() {
  try {
    const response = await axios.post('http://localhost:3001/api/settings', {
      plexUrl: 'http://test.example.com'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSettingsPost();
