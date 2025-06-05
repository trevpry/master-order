// Test script to verify automatic book removal when last short story is removed
const axios = require('axios');

async function testBookRemoval() {
  console.log('=== Testing Automatic Book Removal Feature ===\n');
  
  try {
    // 1. Create a test custom order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Book Removal Test',
      description: 'Testing automatic book removal when last short story is removed'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);

    // 2. Add a book first
    console.log('\n2. Adding a reference book...');
    const bookResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, {
      mediaType: 'book',
      title: 'Test Collection Book',
      bookTitle: 'Test Collection Book',
      bookAuthor: 'Test Author',
      bookYear: 2023,
      bookOpenLibraryId: 'test-book-123'
    });
    
    const bookId = bookResponse.data.id;
    console.log(`✅ Added book with ID: ${bookId}`);

    // 3. Add multiple short stories to this book
    console.log('\n3. Adding short stories to the book...');
    
    const story1Response = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, {
      mediaType: 'shortstory',
      title: 'First Test Story',
      storyTitle: 'First Test Story',
      storyAuthor: 'Story Author',
      storyYear: 2023,
      storyContainedInBookId: bookId
    });
    console.log(`✅ Added first story with ID: ${story1Response.data.id}`);

    const story2Response = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, {
      mediaType: 'shortstory',
      title: 'Second Test Story',
      storyTitle: 'Second Test Story',
      storyAuthor: 'Story Author',
      storyYear: 2023,
      storyContainedInBookId: bookId
    });
    console.log(`✅ Added second story with ID: ${story2Response.data.id}`);

    // 4. Verify order contents
    console.log('\n4. Verifying order contents...');
    let orderCheck = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log(`Order has ${orderCheck.data.items.length} items:`);
    orderCheck.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.mediaType}: ${item.title}`);
      if (item.mediaType === 'shortstory' && item.storyContainedInBookId) {
        console.log(`     -> Contained in book ID: ${item.storyContainedInBookId}`);
      }
    });

    // 5. Remove first short story (book should remain)
    console.log('\n5. Removing first short story (book should remain)...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}/items/${story1Response.data.id}`);
    
    orderCheck = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log(`After removing first story, order has ${orderCheck.data.items.length} items:`);
    orderCheck.data.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.mediaType}: ${item.title}`);
    });

    // 6. Remove second short story (book should be automatically removed)
    console.log('\n6. Removing second short story (book should be automatically removed)...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}/items/${story2Response.data.id}`);
    
    orderCheck = await axios.get(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log(`After removing second story, order has ${orderCheck.data.items.length} items:`);
    if (orderCheck.data.items.length === 0) {
      console.log('✅ SUCCESS: Both story and book were automatically removed!');
    } else {
      console.log('Remaining items:');
      orderCheck.data.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.mediaType}: ${item.title}`);
      });
    }

    // 7. Clean up
    console.log('\n7. Cleaning up test order...');
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order deleted');

    console.log('\n=== Test Results ===');
    if (orderCheck.data.items.length === 0) {
      console.log('🎉 AUTOMATIC BOOK REMOVAL WORKING! ✅');
      console.log('When the last short story from a book is removed, the book is automatically removed too.');
    } else {
      console.log('⚠️  Book removal may not be working as expected - check the results above');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testBookRemoval().catch(console.error);
