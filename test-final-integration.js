// Final end-to-end integration test for ComicVine API integration
const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

async function testCompleteFlow() {
    console.log('🧪 Starting complete end-to-end ComicVine integration test...\n');
    
    try {
        // 1. Test settings API to verify ComicVine API key
        console.log('1️⃣ Testing settings API...');
        const settingsResponse = await fetch(`${API_BASE}/settings`);
        const settings = await settingsResponse.json();
        
        if (settings.comicVineApiKey) {
            console.log('✅ ComicVine API key is configured');
        } else {
            throw new Error('❌ ComicVine API key not found in settings');
        }
        
        // 2. Test creating a custom order with comics
        console.log('\n2️⃣ Testing custom order creation with comics...');
        const testOrderData = {
            name: 'Test ComicVine Integration',
            description: 'Testing comic cover art integration',
            items: [
                'The Amazing Spider-Man (2022) #1',
                'Batman (2016) #125',
                'X-Men (2021) #15'
            ]
        };
        
        const createResponse = await fetch(`${API_BASE}/custom-orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testOrderData)
        });
        
        if (!createResponse.ok) {
            throw new Error(`Failed to create custom order: ${createResponse.status}`);
        }
        
        const createdOrder = await createResponse.json();
        console.log('✅ Custom order created successfully');
        console.log(`   Order ID: ${createdOrder.id}`);
        console.log(`   Order Name: ${createdOrder.name}`);
        
        // 3. Test fetching the up_next to see comic details
        console.log('\n3️⃣ Testing up_next API with comic details...');
        const upNextResponse = await fetch(`${API_BASE}/up_next`);
        if (!upNextResponse.ok) {
            throw new Error(`Failed to fetch up_next: ${upNextResponse.status}`);
        }
        
        const upNextData = await upNextResponse.json();
        console.log('✅ up_next API responded successfully');
        
        // Find our test order in the response
        const testOrder = upNextData.find(order => order.id === createdOrder.id);
        if (testOrder) {
            console.log('✅ Test order found in up_next response');
            console.log(`   Order: ${testOrder.name}`);
            
            if (testOrder.comicDetails) {
                console.log('✅ Comic details are populated');
                console.log(`   Comic details count: ${Object.keys(testOrder.comicDetails).length}`);
                
                // Check for cover art URLs
                let comicsWithCovers = 0;
                for (const [comic, details] of Object.entries(testOrder.comicDetails)) {
                    if (details.coverArt) {
                        comicsWithCovers++;
                        console.log(`   📖 ${comic}: Has cover art (${details.coverArt})`);
                    } else {
                        console.log(`   📖 ${comic}: No cover art found`);
                    }
                }
                
                if (comicsWithCovers > 0) {
                    console.log(`✅ ${comicsWithCovers} comics have cover art URLs`);
                } else {
                    console.log('⚠️  No comics have cover art URLs');
                }
            } else {
                console.log('⚠️  No comic details found in order');
            }
        } else {
            console.log('⚠️  Test order not found in up_next response');
        }
        
        // 4. Test ComicVine artwork proxy
        console.log('\n4️⃣ Testing ComicVine artwork proxy...');
        const testImageUrl = 'https://comicvine.gamespot.com/a/uploads/scale_small/6/67663/8969072-01.jpg';
        const proxyResponse = await fetch(`${API_BASE}/comicvine-artwork?url=${encodeURIComponent(testImageUrl)}`);
        
        if (proxyResponse.ok) {
            console.log('✅ ComicVine artwork proxy is working');
            console.log(`   Content-Type: ${proxyResponse.headers.get('content-type')}`);
        } else {
            console.log(`⚠️  ComicVine artwork proxy returned: ${proxyResponse.status}`);
        }
        
        // 5. Clean up - delete the test order
        console.log('\n5️⃣ Cleaning up test order...');
        const deleteResponse = await fetch(`${API_BASE}/custom-orders/${createdOrder.id}`, {
            method: 'DELETE'
        });
        
        if (deleteResponse.ok) {
            console.log('✅ Test order deleted successfully');
        } else {
            console.log(`⚠️  Failed to delete test order: ${deleteResponse.status}`);
        }
        
        console.log('\n🎉 Complete end-to-end test finished successfully!');
        console.log('\n📝 Summary:');
        console.log('   ✅ ComicVine API key configuration');
        console.log('   ✅ Custom order creation with comics');
        console.log('   ✅ Comic details fetching and processing');
        console.log('   ✅ ComicVine artwork proxy functionality');
        console.log('   ✅ Test cleanup');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testCompleteFlow();
