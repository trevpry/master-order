const axios = require('axios');

async function testSingleBook() {
  try {
    // First create a test order
    console.log('Creating test order...');
    const orderResponse = await axios.post('http://localhost:3001/api/custom-orders', {
      name: 'Single Book Test',
      description: 'Testing single book addition'
    });
    
    const orderId = orderResponse.data.id;
    console.log(`Created order with ID: ${orderId}`);
    
    // Try to add a book
    console.log('Adding book to order...');
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
    
    const addBookResponse = await axios.post(`http://localhost:3001/api/custom-orders/${orderId}/items`, bookData);
    
    if (addBookResponse.status === 201) {
      console.log('✅ Successfully added book!');
      console.log('Book data:', addBookResponse.data);
    }
    
    // Clean up
    await axios.delete(`http://localhost:3001/api/custom-orders/${orderId}`);
    console.log('✅ Test order cleaned up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testSingleBook();
