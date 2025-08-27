#!/bin/bash
# Run this script to test Docker network connectivity to Stash
# Execute: docker exec -it master-order bash /app/test-stash-connectivity.sh

echo "🐳 Docker Host Network Connectivity Test"
echo "========================================"

echo ""
echo "📋 Container Network Information:"
echo "Network Mode: $(cat /proc/1/environ | tr '\0' '\n' | grep -i network || echo 'Not available')"
echo "Hostname: $(hostname)"
echo "Container IP: $(hostname -I 2>/dev/null || echo 'Not available')"

echo ""
echo "🌐 Network Interfaces:"
ip addr show | grep -E "inet |UP|DOWN" | head -10

echo ""
echo "📡 Routing Table:"
route -n | head -5

echo ""
echo "🧪 Testing Stash Connectivity:"
STASH_HOST="192.168.1.154"
STASH_PORT="9999"

echo "Testing ping to $STASH_HOST..."
if ping -c 2 $STASH_HOST > /dev/null 2>&1; then
    echo "✅ Ping successful"
else
    echo "❌ Ping failed"
fi

echo "Testing port connectivity to $STASH_HOST:$STASH_PORT..."
if timeout 5 bash -c "</dev/tcp/$STASH_HOST/$STASH_PORT" 2>/dev/null; then
    echo "✅ Port $STASH_PORT is open"
else
    echo "❌ Port $STASH_PORT is closed or unreachable"
fi

echo "Testing HTTP connectivity..."
if timeout 10 curl -s -o /dev/null "http://$STASH_HOST:$STASH_PORT/" 2>/dev/null; then
    echo "✅ HTTP connection successful"
else
    echo "❌ HTTP connection failed"
fi

echo "Testing GraphQL endpoint..."
if timeout 10 curl -s -o /dev/null -X POST \
    -H "Content-Type: application/json" \
    -d '{"query": "{ version { version } }"}' \
    "http://$STASH_HOST:$STASH_PORT/graphql" 2>/dev/null; then
    echo "✅ GraphQL endpoint accessible"
else
    echo "❌ GraphQL endpoint failed"
fi

echo ""
echo "🔍 DNS Resolution:"
nslookup $STASH_HOST

echo ""
echo "🔐 Environment Variables:"
env | grep -i stash

echo ""
echo "========================================"
