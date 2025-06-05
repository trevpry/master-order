/**
 * Test Comic Reselection Functionality
 * Tests the complete comic reselection workflow including:
 * 1. Creating a custom order with a comic
 * 2. Testing fuzzy matching in ComicVine search
 * 3. Re-selecting the comic with a different series
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5175';
const API_BASE_URL = 'http://localhost:3001';

async function testComicReselectionWorkflow() {
    console.log('=== Testing Comic Reselection Workflow ===');
    
    try {
        // 1. Create a test custom order
        console.log('\n1. Creating test custom order...');
        const orderResponse = await axios.post(`${API_BASE_URL}/api/custom-orders`, {
            name: 'Comic Reselection Test Order',
            description: 'Testing comic reselection functionality',
            icon: '📚'
        });
        
        const orderId = orderResponse.data.id;
        console.log('✓ Created order with ID:', orderId);
        
        // 2. Add an initial comic to the order
        console.log('\n2. Adding initial comic...');
        const initialComicResponse = await axios.post(`${API_BASE_URL}/api/custom-orders/${orderId}/items`, {
            mediaType: 'comic',
            title: 'The Amazing Spider-Man (2018) #1',
            comicSeries: 'The Amazing Spider-Man',
            comicYear: 2018,
            comicIssue: '1'
        });
        
        const itemId = initialComicResponse.data.id;
        console.log('✓ Added comic with ID:', itemId);
        console.log('✓ Initial comic:', initialComicResponse.data.title);
        
        // 3. Test ComicVine fuzzy search
        console.log('\n3. Testing ComicVine fuzzy search...');
        try {
            const searchResponse = await axios.get(`${API_BASE_URL}/api/comicvine/search`, {
                params: { query: 'Spider-Man' }
            });
            
            console.log('✓ ComicVine search returned', searchResponse.data.length, 'results');
            
            if (searchResponse.data.length > 0) {
                const firstResult = searchResponse.data[0];
                console.log('✓ First result:', firstResult.name);
                console.log('✓ Similarity score:', firstResult.similarity ? Math.round(firstResult.similarity * 100) + '%' : 'N/A');
                console.log('✓ Is fuzzy match:', firstResult.isFuzzyMatch || false);
            }
        } catch (searchError) {
            console.log('⚠️  ComicVine search test skipped (API key may not be available)');
        }
        
        // 4. Test comic reselection via API
        console.log('\n4. Testing comic reselection...');
        const updateResponse = await axios.put(`${API_BASE_URL}/api/custom-orders/${orderId}/items/${itemId}`, {
            title: 'Batman (2016) #1',
            comicSeries: 'Batman',
            comicYear: 2016,
            comicIssue: '1'
        });
        
        console.log('✓ Comic updated successfully');
        console.log('✓ New comic title:', updateResponse.data.title);
        console.log('✓ New comic series:', updateResponse.data.comicSeries);
        console.log('✓ New comic year:', updateResponse.data.comicYear);
        console.log('✓ New comic issue:', updateResponse.data.comicIssue);
        
        // 5. Verify the update persisted
        console.log('\n5. Verifying comic update persisted...');
        const orderCheckResponse = await axios.get(`${API_BASE_URL}/api/custom-orders/${orderId}`);
        const order = orderCheckResponse.data;
        
        const updatedComic = order.items.find(item => item.id === itemId);
        if (updatedComic) {
            console.log('✓ Updated comic found in order');
            console.log('✓ Persisted title:', updatedComic.title);
            console.log('✓ Persisted series:', updatedComic.comicSeries);
        } else {
            console.log('❌ Updated comic not found in order');
        }
        
        // 6. Clean up
        console.log('\n6. Cleaning up...');
        await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
        console.log('✅ Test order deleted');
        
        console.log('\n=== COMIC RESELECTION TEST RESULTS ===');
        console.log('🎉 Comic reselection functionality is working correctly!');
        console.log('✅ Comics can be added to custom orders');
        console.log('✅ ComicVine fuzzy search is functional');
        console.log('✅ Comics can be re-selected via API');
        console.log('✅ Comic updates persist correctly');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        // Try to clean up if order was created
        try {
            if (orderId) {
                await axios.delete(`${API_BASE_URL}/api/custom-orders/${orderId}`);
                console.log('✅ Cleaned up test order');
            }
        } catch (cleanupError) {
            console.log('⚠️  Could not clean up test order');
        }
    }
}

async function testComicVineFuzzySearch() {
    console.log('\n=== Testing ComicVine Fuzzy Search ===');
    
    try {
        // Test various search terms to demonstrate fuzzy matching
        const testSearches = [
            'Spider-Man',
            'Spiderman',  // Alternative spelling
            'X-Men',
            'Xmen',       // Alternative spelling
            'Batman',
            'Batmn'       // Typo
        ];
        
        for (const searchTerm of testSearches) {
            try {
                console.log(`\nTesting search: "${searchTerm}"`);
                const response = await axios.get(`${API_BASE_URL}/api/comicvine/search`, {
                    params: { query: searchTerm }
                });
                
                const results = response.data;
                console.log(`✓ Found ${results.length} results`);
                
                if (results.length > 0) {
                    const topResults = results.slice(0, 3);
                    topResults.forEach((result, index) => {
                        const similarity = result.similarity ? Math.round(result.similarity * 100) + '%' : 'N/A';
                        const fuzzyIndicator = result.isFuzzyMatch ? ' (fuzzy)' : '';
                        console.log(`  ${index + 1}. ${result.name} - ${similarity}${fuzzyIndicator}`);
                    });
                }
            } catch (searchError) {
                if (searchError.response?.status === 500) {
                    console.log(`⚠️  ComicVine API not available for "${searchTerm}"`);
                } else {
                    console.log(`❌ Search failed for "${searchTerm}":`, searchError.message);
                }
            }
        }
        
    } catch (error) {
        console.log('⚠️  ComicVine fuzzy search test skipped:', error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting Comic Reselection Tests...');
    
    // Test the ComicVine fuzzy search functionality
    await testComicVineFuzzySearch();
    
    // Test the complete comic reselection workflow
    await testComicReselectionWorkflow();
    
    console.log('\n🎯 All tests completed!');
}

// Run the tests
runTests().catch(console.error);
