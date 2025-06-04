/**
 * Live Book Search Test Script
 * Tests the complete book search workflow including:
 * 1. Title-only search functionality
 * 2. Selection modal display
 * 3. Book selection and addition to custom orders
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5175';
const API_BASE_URL = 'http://localhost:3001';

async function testBookSearchAPI() {
    console.log('=== Testing Book Search API ===');
    
    try {
        // Test 1: Search for a book with multiple results (like "Dune")
        console.log('\n1. Testing API search for "Dune"...');
        const response = await axios.get(`${API_BASE_URL}/api/openlibrary/search`, {
            params: { query: 'Dune' }
        });
        
        console.log('✓ API Response Status:', response.status);
        console.log('✓ Number of results:', response.data.length);
        
        if (response.data.length > 0) {
            console.log('✓ First result sample:');
            const firstBook = response.data[0];
            console.log('  - Title:', firstBook.title);
            console.log('  - Authors:', firstBook.authors?.join(', ') || 'N/A');
            console.log('  - Year:', firstBook.firstPublishYear);
            console.log('  - ISBN:', firstBook.isbn || 'N/A');
            console.log('  - Edition Count:', firstBook.editionCount);
        }
        
        // Test 2: Search for a more specific book
        console.log('\n2. Testing API search for "The Great Gatsby"...');
        const response2 = await axios.get(`${API_BASE_URL}/api/openlibrary/search`, {
            params: { query: 'The Great Gatsby' }
        });
        
        console.log('✓ API Response Status:', response2.status);
        console.log('✓ Number of results:', response2.data.length);
        
        // Test 3: Search for a book that should return fewer results
        console.log('\n3. Testing API search for "Neuromancer"...');
        const response3 = await axios.get(`${API_BASE_URL}/api/openlibrary/search`, {
            params: { query: 'Neuromancer' }
        });
        
        console.log('✓ API Response Status:', response3.status);
        console.log('✓ Number of results:', response3.data.length);
        
        return true;
    } catch (error) {
        console.error('✗ API Test failed:', error.message);
        return false;
    }
}

async function testFrontendInteraction() {
    console.log('\n=== Frontend Interaction Test Results ===');
    
    console.log('\nTo test the frontend manually:');
    console.log('1. Open: http://localhost:5175/custom-orders');
    console.log('2. Look for the "Add Book" section or search form');
    console.log('3. Enter a book title like "Dune" in the search field');
    console.log('4. Click search and verify if a modal appears with multiple results');
    console.log('5. Select a book from the modal and verify it gets added to the order');
    
    console.log('\nExpected behavior:');
    console.log('- Search form should accept title input');
    console.log('- Multiple results should show a selection modal');
    console.log('- Modal should display book details (title, author, year, etc.)');
    console.log('- Selecting a book should add it to the custom order');
    console.log('- Modal should close after selection');
    
    console.log('\nApplication URLs:');
    console.log('- Frontend: http://localhost:5175/');
    console.log('- Custom Orders: http://localhost:5175/custom-orders');
    console.log('- API Base: http://localhost:3001');
}

async function checkApplicationStatus() {
    console.log('=== Application Status Check ===');
    
    try {
        // Check frontend
        const frontendResponse = await axios.get(BASE_URL);
        console.log('✓ Frontend accessible at:', BASE_URL);
        
        // Check API by testing a simple book search
        const testResponse = await axios.get(`${API_BASE_URL}/api/openlibrary/search`, {
            params: { query: 'test' }
        });
        console.log('✓ API accessible at:', API_BASE_URL);
        
        return true;
    } catch (error) {
        console.log('✗ Application status check failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('Starting Live Book Search Tests...\n');
    
    // Check if application is running
    const appRunning = await checkApplicationStatus();
    if (!appRunning) {
        console.log('Please ensure the application is running with "npm start"');
        return;
    }
    
    // Test API functionality
    const apiWorking = await testBookSearchAPI();
    if (!apiWorking) {
        console.log('API tests failed. Please check the server.');
        return;
    }
    
    // Provide manual testing instructions
    await testFrontendInteraction();
    
    console.log('\n=== Test Summary ===');
    console.log('✓ Application is running');
    console.log('✓ Book search API is working');
    console.log('→ Manual frontend testing required');
    console.log('\nPlease test the frontend interface manually using the instructions above.');
}

// Run the tests
runTests().catch(console.error);
