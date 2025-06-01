const fs = require('fs');
const http = require('http');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message);
    fs.appendFileSync('test-results.log', logMessage);
}

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

async function testComicVineIntegration() {
    log('🧪 Starting ComicVine Integration Test');
    
    try {
        // Test 1: Verify settings
        log('1️⃣ Testing settings endpoint...');
        const settingsResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/settings',
            method: 'GET'
        });
        
        if (settingsResponse.statusCode === 200) {
            const settings = JSON.parse(settingsResponse.data);
            log(`✅ Settings loaded, ComicVine API key: ${settings.comicVineApiKey ? 'CONFIGURED' : 'MISSING'}`);
        } else {
            log(`❌ Settings endpoint failed: ${settingsResponse.statusCode}`);
        }
        
        // Test 2: Test ComicVine search
        log('2️⃣ Testing ComicVine search...');
        const searchResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/comicvine/search?query=Spider-Man',
            method: 'GET'
        });
        
        if (searchResponse.statusCode === 200) {
            const results = JSON.parse(searchResponse.data);
            log(`✅ ComicVine search successful: ${results.length} results found`);
            if (results.length > 0) {
                log(`   First result: ${results[0].name} (#${results[0].issue_number})`);
            }
        } else {
            log(`❌ ComicVine search failed: ${searchResponse.statusCode}`);
            log(`   Response: ${searchResponse.data}`);
        }
        
        // Test 3: Get custom orders
        log('3️⃣ Testing custom orders...');
        const ordersResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/custom-orders',
            method: 'GET'
        });
        
        if (ordersResponse.statusCode === 200) {
            const orders = JSON.parse(ordersResponse.data);
            log(`✅ Custom orders loaded: ${orders.length} orders found`);
            
            let totalComics = 0;
            orders.forEach(order => {
                const comics = order.items.filter(item => item.type === 'comic');
                totalComics += comics.length;
                if (comics.length > 0) {
                    log(`   Order "${order.name}" has ${comics.length} comics`);
                }
            });
            log(`   Total comics across all orders: ${totalComics}`);
        } else {
            log(`❌ Custom orders failed: ${ordersResponse.statusCode}`);
        }
        
        // Test 4: Test up_next endpoint
        log('4️⃣ Testing up_next endpoint...');
        const upNextResponse = await makeRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/up-next',
            method: 'GET'
        });
        
        if (upNextResponse.statusCode === 200) {
            const upNext = JSON.parse(upNextResponse.data);
            if (upNext) {
                log(`✅ Up next item: ${upNext.title} (${upNext.type})`);
                if (upNext.type === 'comic' && upNext.coverUrl) {
                    log(`   Has cover URL: ${upNext.coverUrl.substring(0, 50)}...`);
                }
            } else {
                log('⚠️ No up next item available');
            }
        } else {
            log(`❌ Up next endpoint failed: ${upNextResponse.statusCode}`);
        }
        
        log('🎉 ComicVine Integration Test Completed!');
        
    } catch (error) {
        log(`❌ Test error: ${error.message}`);
    }
}

// Clear previous log
if (fs.existsSync('test-results.log')) {
    fs.unlinkSync('test-results.log');
}

testComicVineIntegration();
