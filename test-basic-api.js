const http = require('http');

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', (err) => {
            reject(err);
        });
        
        req.end();
    });
}

async function testBasicAPI() {
    console.log('🧪 Basic API Connectivity Test\n');
    
    try {
        // Test 1: Check if server is responding
        console.log('1️⃣ Testing server connectivity...');
        const healthResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/settings',
            method: 'GET'
        });
        
        if (healthResponse.statusCode === 200) {
            console.log('✅ Server is responding');
            const settings = JSON.parse(healthResponse.data);
            
            if (settings.comicVineApiKey) {
                console.log('✅ ComicVine API key is configured:', settings.comicVineApiKey.substring(0, 10) + '...');
            } else {
                console.log('❌ ComicVine API key not found');
            }
        } else {
            console.log('❌ Server not responding properly, status:', healthResponse.statusCode);
        }
        
        // Test 2: Check custom orders
        console.log('\n2️⃣ Testing custom orders endpoint...');
        const ordersResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/custom-orders',
            method: 'GET'
        });
        
        if (ordersResponse.statusCode === 200) {
            console.log('✅ Custom orders endpoint responding');
            const orders = JSON.parse(ordersResponse.data);
            console.log('   Found', orders.length, 'custom orders');
            
            // Look for comics in orders
            let totalComics = 0;
            orders.forEach(order => {
                const comics = order.items.filter(item => item.type === 'comic');
                totalComics += comics.length;
            });
            console.log('   Total comics across all orders:', totalComics);
        } else {
            console.log('❌ Custom orders endpoint failed, status:', ordersResponse.statusCode);
        }
        
        console.log('\n🎉 Basic API test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testBasicAPI();
