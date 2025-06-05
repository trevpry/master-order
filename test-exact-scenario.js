// Test the exact scenario the user is experiencing
const axios = require('axios');

const testData = `Shield of the Jedi		Shield of the Jedi	Short Story`;

async function testExactScenario() {
  console.log('=== Testing Exact User Scenario ===');
  console.log('Input data:', testData);
  
  try {
    // 1. Create a test order
    console.log('\n1. Creating test order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Test Shield Import',
      description: 'Testing exact user scenario'
    });
    const orderId = orderResponse.data.id;
    console.log('✅ Created order ID:', orderId);

    // 2. Parse the data like the frontend would (including the new parsing logic)
    const lines = testData.split('\n').filter(line => line.trim());
    const items = [];
    
    for (const line of lines) {
      const columns = line.split('\t').map(part => part.trim());
      console.log('Raw columns:', columns);
      
      if (columns.length >= 4) {
        const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns;
        const mediaType = rawMediaType.toLowerCase().replace(' ', '');
        console.log('Parsed mediaType:', mediaType);
        
        // Parse author and year for short stories (NEW LOGIC)
        let bookAuthor = null;
        let bookYear = null;
        
        if (mediaType === 'shortstory') {
          if (seasonEpisode) {
            const bookMatch = seasonEpisode.match(/^(.+?)\s*(?:\((\d{4})\))?$/);
            if (bookMatch) {
              bookAuthor = bookMatch[1].trim();
              if (bookMatch[2]) {
                bookYear = parseInt(bookMatch[2]);
              }
            } else {
              bookAuthor = seasonEpisode.trim();
            }
          }
        }
        
        items.push({
          title: title,
          mediaType: mediaType,
          bookAuthor: bookAuthor,
          bookYear: bookYear
        });
      }
    }
    
    console.log('\n2. Parsed items:', JSON.stringify(items, null, 2));

    // 3. Test the bulk import endpoint directly (simulating what frontend calls)
    console.log('\n3. Testing bulk import...');
    
    // Simulate the exact request the frontend would make
    for (const item of items) {
      if (item.mediaType === 'shortstory') {
        const targetMedia = {
          title: item.title,
          type: 'shortstory',
          storyTitle: item.title,
          storyAuthor: item.bookAuthor || null,
          storyYear: item.bookYear || null,
          storyUrl: null,
          storyContainedInBookId: null,
          storyCoverUrl: null
        };
        
        const requestBody = {
          mediaType: targetMedia.type,
          title: targetMedia.title,
          storyTitle: targetMedia.storyTitle,
          storyAuthor: targetMedia.storyAuthor,
          storyYear: targetMedia.storyYear,
          storyUrl: targetMedia.storyUrl,
          storyContainedInBookId: targetMedia.storyContainedInBookId,
          storyCoverUrl: targetMedia.storyCoverUrl
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, requestBody);
        console.log('✅ Short story added successfully!');
        console.log('Response status:', response.status);
      }
    }

    // 4. Verify the order contents
    console.log('\n4. Verifying order contents...');
    const orderData = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Order items:', orderData.data.items.map(item => ({
      title: item.title,
      type: item.mediaType,
      storyTitle: item.storyTitle,
      storyAuthor: item.storyAuthor
    })));

    // 5. Cleanup
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('\n✅ Test completed successfully! The parsing fix should now work in the frontend.');

  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.details) {
      console.error('Details:', error.response.data.details);
    }
  }
}

testExactScenario();
