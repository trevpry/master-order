#!/bin/bash

# Production Upload Functionality Verification Script
# Run this after deploying to production to verify upload functionality

echo "🚀 Testing History Plus Upload in Production Environment..."
echo ""

# Test 1: Check if the API endpoints are accessible
echo "1. Testing API endpoint accessibility..."
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$response" = "200" ]; then
    echo "✅ Health endpoint accessible"
else
    echo "❌ Health endpoint not accessible (HTTP $response)"
    exit 1
fi

# Test 2: Check temp-uploads directory in container
echo ""
echo "2. Checking temp-uploads directory in production..."
if docker exec master-order test -d /app/server/temp-uploads; then
    echo "✅ temp-uploads directory exists in container"
else
    echo "❌ temp-uploads directory missing in container"
    exit 1
fi

# Test 3: Check directory permissions
echo ""
echo "3. Testing directory permissions..."
if docker exec master-order test -w /app/server/temp-uploads; then
    echo "✅ temp-uploads directory is writable"
else
    echo "❌ temp-uploads directory is not writable"
    exit 1
fi

# Test 4: Check if import script exists
echo ""
echo "4. Checking import script in container..."
if docker exec master-order test -f /app/server/import-history-plus-data.js; then
    echo "✅ Import script exists in container"
else
    echo "❌ Import script missing in container"
    exit 1
fi

# Test 5: Test session file operations in container
echo ""
echo "5. Testing session file operations in container..."
docker exec master-order bash -c '
cd /app/server/temp-uploads
echo "{\"test\": true}" > test-session.json
if [ $? -eq 0 ]; then
    echo "✅ Session file creation successful"
else
    echo "❌ Session file creation failed"
    exit 1
fi

if [ -f test-session.json ]; then
    echo "✅ Session file exists"
    rm test-session.json
    echo "✅ Session file cleanup successful"
else
    echo "❌ Session file not found"
    exit 1
fi
'

echo ""
echo "🎉 Production upload functionality verification complete!"
echo ""
echo "Next steps:"
echo "1. Test actual file upload through the web interface"
echo "2. Monitor server logs during upload/import operations"
echo "3. Verify database import results"
echo "4. Check that uploaded files are cleaned up after import"