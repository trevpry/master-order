#!/bin/bash

echo "=== UNRAID TVDB DEBUG SCRIPT ==="
echo ""

# Check if we're in the container
if [ -f /.dockerenv ]; then
    echo "✅ Running inside Docker container"
else
    echo "❌ Not running in Docker container"
fi

echo ""
echo "=== Database File Checks ==="
ls -la /app/ | grep -E "\.(db|sqlite)" || echo "No database files found in /app/"
ls -la /app/server/prisma/ | grep -E "\.(db|sqlite)" || echo "No database files found in /app/server/prisma/"

echo ""
echo "=== Environment Variables ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "DATABASE_URL: ${DATABASE_URL:-not set}"

echo ""
echo "=== Testing TVDB Settings from Container ==="

# Create a temporary Node.js script inside the container
cat > /tmp/test-tvdb.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

async function testTVDB() {
    try {
        await prisma.$connect();
        console.log("✅ Prisma connected successfully");
        
        const settings = await prisma.settings.findMany({
            select: {
                tvdbApiKey: true,
                tvdbBearerToken: true
            }
        });
        
        if (settings.length === 0) {
            console.log("❌ No settings found!");
            return;
        }
        
        const setting = settings[0];
        console.log("TVDB Bearer Token:", setting.tvdbBearerToken ? "Found" : "Missing");
        
        if (setting.tvdbBearerToken) {
            try {
                const response = await axios.get('https://api4.thetvdb.com/v4/series?query=The%20Big%20Bang%20Theory', {
                    headers: {
                        'Authorization': `Bearer ${setting.tvdbBearerToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });
                console.log("✅ TVDB API call successful!");
                console.log(`Found ${response.data.data.length} results`);
            } catch (error) {
                console.log("❌ TVDB API call failed:");
                console.log(`Status: ${error.response?.status}`);
                console.log(`Message: ${error.response?.data?.message || error.message}`);
            }
        }
        
    } catch (error) {
        console.log("❌ Database error:", error.message);
    } finally {
        await prisma.$disconnect();
    }
}

testTVDB();
EOF

# Run the test script
cd /app && node /tmp/test-tvdb.js

echo ""
echo "=== Container Logs (last 20 lines) ==="
docker logs master-order --tail 20 2>/dev/null || echo "Could not fetch container logs"
