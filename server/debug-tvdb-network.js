const axios = require('axios');
const https = require('https');
const dns = require('dns').promises;

async function debugTVDBConnectivity() {
    console.log("=== TVDB CONNECTIVITY DEBUG (UNRAID) ===\n");
    
    // Get bearer token from database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
        const settings = await prisma.settings.findUnique({
            where: { id: 1 }
        });
        
        if (!settings?.tvdbBearerToken) {
            console.log("❌ No TVDB bearer token found in database");
            return;
        }
        
        const bearerToken = settings.tvdbBearerToken;
        console.log(`✅ Found TVDB bearer token: ${bearerToken.substring(0, 20)}...`);
        
        // Test 1: DNS Resolution
        console.log("\n1. Testing DNS resolution...");
        try {
            const addresses = await dns.lookup('api4.thetvdb.com');
            console.log(`✅ DNS resolved: api4.thetvdb.com -> ${addresses.address}`);
        } catch (error) {
            console.log(`❌ DNS resolution failed: ${error.message}`);
            return;
        }
        
        // Test 2: Basic connectivity
        console.log("\n2. Testing HTTPS connectivity...");
        try {
            const response = await axios.get('https://api4.thetvdb.com/v4', {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Master-Order-App/1.0'
                }
            });
            console.log(`✅ Basic connectivity: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.log(`❌ Basic connectivity failed: ${error.message}`);
            if (error.code) console.log(`   Error code: ${error.code}`);
            return;
        }
        
        // Test 3: Token validation endpoint
        console.log("\n3. Testing bearer token authentication...");
        try {
            const authResponse = await axios.get('https://api4.thetvdb.com/v4/user/info', {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'User-Agent': 'Master-Order-App/1.0'
                },
                timeout: 10000
            });
            console.log(`✅ Token authentication: ${authResponse.status} - Token is valid`);
        } catch (error) {
            console.log(`❌ Token authentication failed: ${error.response?.status} ${error.response?.statusText}`);
            console.log(`   Error data:`, error.response?.data);
            if (error.response?.status === 401) {
                console.log("   This suggests the token is expired or invalid");
            }
        }
        
        // Test 4: Search endpoint (the failing one)
        console.log("\n4. Testing search endpoint...");
        try {
            const searchResponse = await axios.get('https://api4.thetvdb.com/v4/search', {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'User-Agent': 'Master-Order-App/1.0'
                },
                params: {
                    query: 'The Big Bang Theory',
                    type: 'series'
                },
                timeout: 10000
            });
            console.log(`✅ Search endpoint: ${searchResponse.status} - Found ${searchResponse.data.data?.length || 0} results`);
            if (searchResponse.data.data && searchResponse.data.data.length > 0) {
                console.log(`   First result: ${searchResponse.data.data[0].name}`);
            }
        } catch (error) {
            console.log(`❌ Search endpoint failed: ${error.response?.status} ${error.response?.statusText}`);
            console.log(`   Error data:`, error.response?.data);
            console.log(`   Full error:`, error.message);
        }
        
        // Test 5: Network environment info
        console.log("\n5. Network environment information...");
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.log(`   Container hostname: ${require('os').hostname()}`);
        
        // Test 6: HTTP vs HTTPS agent differences
        console.log("\n6. Testing with different HTTP agents...");
        try {
            const agent = new https.Agent({
                rejectUnauthorized: false, // In case of SSL issues
                keepAlive: true,
                timeout: 10000
            });
            
            const agentResponse = await axios.get('https://api4.thetvdb.com/v4/search', {
                headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'User-Agent': 'Master-Order-App/1.0'
                },
                params: {
                    query: 'test',
                    type: 'series'
                },
                httpsAgent: agent,
                timeout: 10000
            });
            console.log(`✅ Custom agent: ${agentResponse.status} - Works with custom HTTPS agent`);
        } catch (error) {
            console.log(`❌ Custom agent failed: ${error.response?.status || error.message}`);
        }
        
    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugTVDBConnectivity().catch(console.error);
