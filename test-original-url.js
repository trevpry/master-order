const fetch = require('node-fetch');

async function testOriginalUrl() {
  console.log('Testing original URL download...');
  
  try {
    // Test the original URL you were trying to use
    const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh#CQVsPLJ';
    
    const response = await fetch('http://localhost:3001/api/backgrounds/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Download successful!');
      console.log('Background created:', {
        id: result.id,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        width: result.width,
        height: result.height,
        mimetype: result.mimetype
      });
    } else {
      const error = await response.json();
      console.log('❌ Download failed:', error);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Also test a direct image URL
async function testDirectImageUrl() {
  console.log('\nTesting direct image URL...');
  
  try {
    // Use a direct image URL
    const testUrl = 'https://picsum.photos/800/600.jpg';
    
    const response = await fetch('http://localhost:3001/api/backgrounds/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Direct image download successful!');
      console.log('Background created:', {
        id: result.id,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        width: result.width,
        height: result.height,
        mimetype: result.mimetype
      });
    } else {
      const error = await response.json();
      console.log('❌ Direct image download failed:', error);
    }
  } catch (error) {
    console.log('❌ Direct image test failed:', error.message);
  }
}

testOriginalUrl().then(() => testDirectImageUrl());
