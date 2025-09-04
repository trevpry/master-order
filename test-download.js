const fetch = require('node-fetch');

async function testDownload() {
  try {
    console.log('Testing background image download...');
    
    const response = await fetch('http://localhost:3001/api/backgrounds/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://httpbin.org/image/png'
      })
    });

    if (!response.ok) {
      console.error('Response not OK:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }

    const result = await response.json();
    console.log('Success! Downloaded background:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDownload();
