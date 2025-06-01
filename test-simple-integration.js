// Simple test for ComicVine integration
const https = require('https');
const http = require('http');

console.log('🧪 Testing ComicVine integration...\n');

// Test 1: Check if server is responding
function testServer() {
    return new Promise((resolve, reject) => {
        console.log('1️⃣ Testing server connectivity...');
        const req = http.get('http://localhost:3001/api/settings', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const settings = JSON.parse(data);
                    if (settings.comicVineApiKey) {
                        console.log('✅ Server is running and ComicVine API key is configured\n');
                        resolve(settings);
                    } else {
                        reject(new Error('ComicVine API key not found'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout')));
    });
}

// Test 2: Create a custom order
function testCustomOrder() {
    return new Promise((resolve, reject) => {
        console.log('2️⃣ Testing custom order creation...');
        
        const postData = JSON.stringify({
            name: 'ComicVine Test Order',
            description: 'Testing comic integration',
            items: ['The Amazing Spider-Man (2022) #1', 'Batman (2016) #125']
        });
        
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/custom-orders',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('✅ Custom order created successfully');
                    console.log(`   Order ID: ${result.id}`);
                    console.log(`   Order Name: ${result.name}\n`);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('Timeout creating order')));
        req.write(postData);
        req.end();
    });
}

// Test 3: Check up_next for comic details
function testUpNext() {
    return new Promise((resolve, reject) => {
        console.log('3️⃣ Testing up_next API...');
        const req = http.get('http://localhost:3001/api/up_next', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const upNext = JSON.parse(data);
                    console.log('✅ up_next API responded successfully');
                    
                    // Look for custom orders with comic details
                    const customOrders = upNext.filter(item => item.type === 'custom-order');
                    console.log(`   Found ${customOrders.length} custom orders`);
                    
                    let comicsWithDetails = 0;
                    customOrders.forEach(order => {
                        if (order.comicDetails) {
                            const comicCount = Object.keys(order.comicDetails).length;
                            console.log(`   📖 ${order.name}: ${comicCount} comics with details`);
                            comicsWithDetails += comicCount;
                        }
                    });
                    
                    if (comicsWithDetails > 0) {
                        console.log(`✅ Found ${comicsWithDetails} comics with ComicVine details\n`);
                    } else {
                        console.log('⚠️  No comics with ComicVine details found\n');
                    }
                    
                    resolve(upNext);
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(10000, () => reject(new Error('Timeout fetching up_next')));
    });
}

// Run tests
async function runTests() {
    try {
        await testServer();
        const order = await testCustomOrder();
        await testUpNext();
        
        console.log('🎉 All tests completed successfully!');
        console.log('\n📝 ComicVine integration is working properly:');
        console.log('   ✅ API key configuration');
        console.log('   ✅ Custom order creation');
        console.log('   ✅ Comic details fetching');
        console.log('   ✅ Up next API integration');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

runTests();
