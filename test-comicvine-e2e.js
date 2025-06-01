const axios = require('axios');

// Base URL for the API
const BASE_URL = 'http://localhost:3001';

async function testComicVineIntegration() {
    console.log('🧪 Starting ComicVine End-to-End Integration Test\n');

    try {
        // Test 1: Verify settings contain ComicVine API key
        console.log('1️⃣ Testing ComicVine API key configuration...');
        const settingsResponse = await axios.get(`${BASE_URL}/api/settings`);
        const apiKey = settingsResponse.data.comicVineApiKey;
        
        if (!apiKey || apiKey.length === 0) {
            throw new Error('ComicVine API key not configured');
        }
        console.log('✅ ComicVine API key is configured:', apiKey.substring(0, 10) + '...');

        // Test 2: Test ComicVine search functionality
        console.log('\n2️⃣ Testing ComicVine search...');
        try {
            const searchResponse = await axios.get(`${BASE_URL}/api/comicvine/search`, {
                params: { query: 'Spider-Man' }
            });
            
            if (searchResponse.data && searchResponse.data.length > 0) {
                console.log('✅ ComicVine search successful, found', searchResponse.data.length, 'results');
                console.log('   First result:', searchResponse.data[0].name, `(#${searchResponse.data[0].issue_number})`);
            } else {
                console.log('⚠️ ComicVine search returned no results');
            }
        } catch (error) {
            console.log('❌ ComicVine search failed:', error.response?.data?.error || error.message);
        }

        // Test 3: Get existing custom orders
        console.log('\n3️⃣ Testing custom orders retrieval...');
        const ordersResponse = await axios.get(`${BASE_URL}/api/custom-orders`);
        const orders = ordersResponse.data;
        console.log('✅ Found', orders.length, 'existing custom orders');

        // Find an order with comics
        const orderWithComics = orders.find(order => 
            order.items.some(item => item.type === 'comic')
        );

        if (orderWithComics) {
            console.log('   Found order with comics:', orderWithComics.name);
            const comicItems = orderWithComics.items.filter(item => item.type === 'comic');
            console.log('   Comic items count:', comicItems.length);
            
            // Display first comic item details
            if (comicItems.length > 0) {
                const firstComic = comicItems[0];
                console.log('   First comic:', firstComic.title);
                if (firstComic.metadata) {
                    const metadata = JSON.parse(firstComic.metadata);
                    console.log('   Has ComicVine data:', !!metadata.comicVineId);
                    if (metadata.comicVineId) {
                        console.log('   ComicVine ID:', metadata.comicVineId);
                        console.log('   Cover URL:', metadata.coverUrl ? 'Yes' : 'No');
                    }
                }
            }
        }

        // Test 4: Create a new custom order with a comic
        console.log('\n4️⃣ Testing custom order creation with comic...');
        const newOrderResponse = await axios.post(`${BASE_URL}/api/custom-orders`, {
            name: `ComicVine Test Order ${Date.now()}`,
            description: 'Test order for ComicVine integration'
        });
        
        const newOrder = newOrderResponse.data;
        console.log('✅ Created new order:', newOrder.name);

        // Test 5: Add a comic to the new order using bulk import
        console.log('\n5️⃣ Testing comic addition via bulk import...');
        const comicTitle = 'Amazing Spider-Man #1';
        const bulkImportResponse = await axios.post(`${BASE_URL}/api/custom-orders/${newOrder.id}/bulk-import`, {
            items: [comicTitle]
        });

        const importResult = bulkImportResponse.data;
        console.log('✅ Bulk import completed');
        console.log('   Added items:', importResult.addedItems);
        console.log('   Skipped items:', importResult.skippedItems.length);

        // Test 6: Verify the comic was added with ComicVine data
        console.log('\n6️⃣ Verifying comic was enhanced with ComicVine data...');
        const updatedOrderResponse = await axios.get(`${BASE_URL}/api/custom-orders/${newOrder.id}`);
        const updatedOrder = updatedOrderResponse.data;
        
        const addedComics = updatedOrder.items.filter(item => item.type === 'comic');
        if (addedComics.length > 0) {
            const comic = addedComics[0];
            console.log('✅ Comic added successfully:', comic.title);
            
            if (comic.metadata) {
                const metadata = JSON.parse(comic.metadata);
                console.log('   Has metadata:', !!metadata);
                console.log('   Has ComicVine ID:', !!metadata.comicVineId);
                console.log('   Has cover URL:', !!metadata.coverUrl);
                console.log('   Has description:', !!metadata.description);
                
                if (metadata.comicVineId) {
                    console.log('   ComicVine ID:', metadata.comicVineId);
                }
                if (metadata.coverUrl) {
                    console.log('   Cover URL:', metadata.coverUrl.substring(0, 50) + '...');
                }
            } else {
                console.log('⚠️ Comic was added but has no metadata');
            }
        } else {
            console.log('❌ No comics found in the updated order');
        }

        // Test 7: Test the up_next API with ComicVine data
        console.log('\n7️⃣ Testing up_next API with ComicVine integration...');
        const upNextResponse = await axios.get(`${BASE_URL}/api/up-next`);
        const upNextItem = upNextResponse.data;
        
        if (upNextItem) {
            console.log('✅ Up next API returned item:', upNextItem.title);
            console.log('   Type:', upNextItem.type);
            if (upNextItem.type === 'comic' && upNextItem.coverUrl) {
                console.log('   Has cover URL:', !!upNextItem.coverUrl);
                console.log('   Cover URL:', upNextItem.coverUrl.substring(0, 50) + '...');
            }
        } else {
            console.log('⚠️ Up next API returned no items');
        }

        // Test 8: Test ComicVine artwork proxy
        if (addedComics.length > 0) {
            const comic = addedComics[0];
            if (comic.metadata) {
                const metadata = JSON.parse(comic.metadata);
                if (metadata.coverUrl) {
                    console.log('\n8️⃣ Testing ComicVine artwork proxy...');
                    try {
                        const artworkResponse = await axios.get(`${BASE_URL}/api/comicvine/artwork`, {
                            params: { url: metadata.coverUrl },
                            responseType: 'arraybuffer'
                        });
                        
                        if (artworkResponse.status === 200 && artworkResponse.data.length > 0) {
                            console.log('✅ Artwork proxy working, received', artworkResponse.data.length, 'bytes');
                            console.log('   Content type:', artworkResponse.headers['content-type']);
                        } else {
                            console.log('❌ Artwork proxy returned empty response');
                        }
                    } catch (error) {
                        console.log('❌ Artwork proxy failed:', error.response?.status || error.message);
                    }
                }
            }
        }

        // Cleanup: Delete the test order
        console.log('\n🧹 Cleaning up test order...');
        await axios.delete(`${BASE_URL}/api/custom-orders/${newOrder.id}`);
        console.log('✅ Test order deleted');

        console.log('\n🎉 ComicVine End-to-End Integration Test Completed Successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.response?.data?.error || error.message);
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the test
testComicVineIntegration().catch(console.error);
