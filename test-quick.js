const axios = require('axios');

// Set a default timeout
axios.defaults.timeout = 10000;

async function quickTest() {
  try {
    console.log('Testing up_next API...');
    const response = await axios.get('http://localhost:3001/api/up_next', { timeout: 5000 });
    console.log('✅ Success!');
    console.log(`Type: ${response.data.type}`);
    console.log(`Title: ${response.data.title}`);
    
    if (response.data.comicDetails) {
      console.log(`Cover URL: ${response.data.comicDetails.coverUrl ? 'Present' : 'Missing'}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest();
