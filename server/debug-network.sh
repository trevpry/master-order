#!/bin/bash

# Simple TVDB connectivity test for Unraid container
# Run this inside your master-order container

echo "=== TVDB Network Test (Unraid Container) ==="
echo ""

# Test 1: Basic connectivity
echo "1. Testing basic connectivity to api4.thetvdb.com..."
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 https://api4.thetvdb.com/v4 | grep -q "200\|401"; then
    echo "✅ Can reach api4.thetvdb.com"
else
    echo "❌ Cannot reach api4.thetvdb.com"
    exit 1
fi

# Test 2: DNS resolution
echo ""
echo "2. Testing DNS resolution..."
nslookup api4.thetvdb.com
echo ""

# Test 3: Test with curl (similar to axios)
echo "3. Testing TVDB search API with curl..."
echo "Note: You'll need to add your bearer token to this command"
echo ""
echo "Run this command with your actual bearer token:"
echo 'curl -H "Authorization: Bearer YOUR_TOKEN_HERE" "https://api4.thetvdb.com/v4/search?query=The%20Big%20Bang%20Theory&type=series"'
echo ""

# Test 4: Container environment
echo "4. Container environment info:"
echo "Hostname: $(hostname)"
echo "Network interfaces:"
ip addr show | grep -E "inet |UP"
echo ""

# Test 5: Check if there are any proxy settings
echo "5. Proxy environment variables:"
env | grep -i proxy || echo "No proxy variables set"
echo ""

echo "Now run the Node.js debug script:"
echo "node debug-tvdb-network.js"
