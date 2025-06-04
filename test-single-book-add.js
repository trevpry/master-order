const axios = require('axios');

async function testAddBook() {
  console.log('=== Testing Single Book Addition ===\n');
  
  try {
    // First create a test order
    console.log('1. Creating test custom order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Book Test Order',
      description: 'Testing book addition functionality'
    }, { timeout: 10000 });
    
    if (orderResponse.status !== 201) {
      console.log('❌ Failed to create test order');
      return;
    }
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Created test order with ID: ${orderId}`);
    
    // Test adding a book
    console.log('\n2. Testing book addition...');
    const bookData = {
      mediaType: 'book',
      title: 'Dune',
      bookTitle: 'Dune',
      bookAuthor: 'Frank Herbert',
      bookYear: 1965,
      bookIsbn: '978-0441172719',
      bookPublisher: 'Ace Books',
      bookOpenLibraryId: 'OL893415W'
    };
    
    console.log('Book data to send:', JSON.stringify(bookData, null, 2));
    
    try {
      const addBookResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, bookData, { timeout: 10000 });
      
      if (addBookResponse.status === 201) {
        console.log('✅ Successfully added book to custom order');
        console.log('Response:', JSON.stringify(addBookResponse.data, null, 2));
      } else {
        console.log(`❌ Unexpected response status: ${addBookResponse.status}`);
      }
    } catch (error) {
      console.log('❌ Error adding book:');
      console.log('  Message:', error.message);
      
      if (error.response) {
        console.log('  Status:', error.response.status);
        console.log('  Status Text:', error.response.statusText);
        console.log('  Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error.code === 'ETIMEDOUT') {
        console.log('  Request timed out');
      }
    }
    
    // Clean up - delete the test order
    console.log('\n3. Cleaning up test order...');
    try {
      await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`, { timeout: 10000 });
      console.log('✅ Test order deleted');
    } catch (cleanupError) {
      console.log('⚠️  Failed to delete test order:', cleanupError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== Test Completed ===');
}

testAddBook().catch(console.error);
