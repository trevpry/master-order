const fetch = require('node-fetch');

async function testGalleryDownload() {
  console.log('Testing Imgur gallery download...');
  
  try {
    // Test the original Imgur gallery URL
    const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh';
    
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
      console.log('✅ Gallery download successful!');
      console.log('Background created:', {
        id: result.id,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        width: result.width,
        height: result.height,
        mimetype: result.mimetype,
        isFromGallery: result.isFromGallery,
        galleryUrl: result.galleryUrl,
        galleryTitle: result.galleryTitle,
        availableImages: result.availableImages
      });
    } else {
      const error = await response.json();
      console.log('❌ Gallery download failed:', error);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Also test a regular direct image to make sure we didn't break anything
async function testDirectImage() {
  console.log('\nTesting direct image download (to ensure it still works)...');
  
  try {
    const testUrl = 'https://picsum.photos/500/300.jpg';
    
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
      console.log('✅ Direct image download still works!');
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

testGalleryDownload().then(() => testDirectImage());
