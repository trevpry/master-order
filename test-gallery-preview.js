const fetch = require('node-fetch');

async function testGalleryPreview() {
  console.log('Testing gallery preview functionality...');
  
  try {
    const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh';
    
    const response = await fetch('http://localhost:3001/api/backgrounds/gallery-preview', {
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
      console.log('✅ Gallery preview successful!');
      console.log('Gallery info:', {
        url: result.url,
        totalImages: result.totalImages,
        galleryTitle: result.galleryTitle,
        hasMore: result.hasMore,
        sampleImages: result.images.slice(0, 3).map(img => ({
          index: img.index,
          title: img.title,
          url: img.url
        }))
      });
      
      // Test downloading a specific image by index
      if (result.images.length > 0) {
        console.log('\n🎯 Testing specific image download...');
        await testSpecificImageDownload(testUrl, 2); // Download the 3rd image
      }
      
    } else {
      const error = await response.json();
      console.log('❌ Gallery preview failed:', error);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function testSpecificImageDownload(galleryUrl, imageIndex) {
  try {
    const response = await fetch('http://localhost:3001/api/backgrounds/gallery-download-specific', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: galleryUrl,
        imageIndex: imageIndex
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Successfully downloaded image ${imageIndex}!`);
      console.log('Downloaded image:', {
        id: result.id,
        filename: result.filename,
        originalName: result.originalName,
        size: result.size,
        width: result.width,
        height: result.height,
        imageIndex: result.imageIndex,
        totalImages: result.totalImages,
        galleryTitle: result.galleryTitle
      });
    } else {
      const error = await response.json();
      console.log(`❌ Specific image download failed:`, error);
    }
  } catch (error) {
    console.log('❌ Specific image download test failed:', error.message);
  }
}

testGalleryPreview();
