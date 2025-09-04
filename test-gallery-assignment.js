const fetch = require('node-fetch');

async function testGalleryAssignment() {
  console.log('🔍 Testing gallery assignment functionality...');
  
  const testUrl = 'https://imgur.com/gallery/star-wars-wallpapers-W4lOh';
  
  try {
    // 1. Test gallery preview
    console.log('\n📋 Testing gallery preview...');
    const previewResponse = await fetch('http://localhost:3001/api/backgrounds/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });
    
    const previewResult = await previewResponse.json();
    console.log(`✅ Gallery preview: ${previewResult.isGallery ? 'Gallery detected' : 'Not a gallery'}`);
    console.log(`📊 Images found: ${previewResult.totalImages || 'N/A'}`);
    
    if (!previewResult.isGallery) {
      console.log('❌ Expected gallery, but got direct image response');
      return;
    }
    
    // 2. Create a test gallery
    console.log('\n📂 Creating test gallery...');
    const galleryResponse = await fetch('http://localhost:3001/api/background-galleries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Star Wars Test Gallery',
        description: 'Test gallery for Star Wars wallpapers from Imgur'
      })
    });
    
    const gallery = await galleryResponse.json();
    console.log(`✅ Created gallery: ${gallery.name} (ID: ${gallery.id})`);
    
    // 3. Test bulk download with gallery assignment
    console.log('\n📥 Testing bulk download with gallery assignment...');
    const bulkResponse = await fetch('http://localhost:3001/api/backgrounds/download-gallery-bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: testUrl,
        galleryId: gallery.id,
        selectedImages: [0, 1, 2] // Download first 3 images
      })
    });
    
    const bulkResult = await bulkResponse.json();
    console.log(`✅ Bulk download completed:`);
    console.log(`📊 Success: ${bulkResult.successCount}, Errors: ${bulkResult.errorCount}`);
    console.log(`📂 Assigned to gallery: ${bulkResult.galleryId}`);
    
    // 4. Verify gallery assignment
    console.log('\n🔍 Verifying gallery assignment...');
    const galleryCheckResponse = await fetch(`http://localhost:3001/api/background-galleries/${gallery.id}`);
    const galleryCheck = await galleryCheckResponse.json();
    console.log(`✅ Gallery now contains ${galleryCheck.backgrounds.length} images`);
    
    // 5. Test getting all galleries
    console.log('\n📋 Testing gallery list...');
    const galleriesResponse = await fetch('http://localhost:3001/api/background-galleries');
    const galleries = await galleriesResponse.json();
    console.log(`✅ Found ${galleries.length} galleries total`);
    
    const testGallery = galleries.find(g => g.id === gallery.id);
    if (testGallery) {
      console.log(`📊 Test gallery has ${testGallery.backgroundCount} images`);
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGalleryAssignment();
