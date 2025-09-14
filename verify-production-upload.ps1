# Production Upload Functionality Verification Script (PowerShell)
# Run this after deploying to production to verify upload functionality

Write-Host "🚀 Testing History Plus Upload in Production Environment..." -ForegroundColor Green
Write-Host ""

# Test 1: Check if the API endpoints are accessible
Write-Host "1. Testing API endpoint accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Health endpoint accessible" -ForegroundColor Green
    } else {
        Write-Host "❌ Health endpoint returned HTTP $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Health endpoint not accessible: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Check temp-uploads directory in container
Write-Host ""
Write-Host "2. Checking temp-uploads directory in production..." -ForegroundColor Yellow
$dirCheck = docker exec master-order test -d /app/server/temp-uploads 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ temp-uploads directory exists in container" -ForegroundColor Green
} else {
    Write-Host "❌ temp-uploads directory missing in container" -ForegroundColor Red
    exit 1
}

# Test 3: Check directory permissions
Write-Host ""
Write-Host "3. Testing directory permissions..." -ForegroundColor Yellow
$permCheck = docker exec master-order test -w /app/server/temp-uploads 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ temp-uploads directory is writable" -ForegroundColor Green
} else {
    Write-Host "❌ temp-uploads directory is not writable" -ForegroundColor Red
    exit 1
}

# Test 4: Check if import script exists
Write-Host ""
Write-Host "4. Checking import script in container..." -ForegroundColor Yellow
$scriptCheck = docker exec master-order test -f /app/server/import-history-plus-data.js 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Import script exists in container" -ForegroundColor Green
} else {
    Write-Host "❌ Import script missing in container" -ForegroundColor Red
    exit 1
}

# Test 5: Test session file operations in container
Write-Host ""
Write-Host "5. Testing session file operations in container..." -ForegroundColor Yellow
$sessionTest = docker exec master-order bash -c @'
cd /app/server/temp-uploads
echo "{\"test\": true}" > test-session.json
if [ $? -eq 0 ]; then
    echo "SESSION_CREATE_OK"
else
    echo "SESSION_CREATE_FAIL"
    exit 1
fi

if [ -f test-session.json ]; then
    echo "SESSION_EXISTS_OK"
    rm test-session.json
    echo "SESSION_CLEANUP_OK"
else
    echo "SESSION_EXISTS_FAIL"
    exit 1
fi
'@ 2>$null

if ($sessionTest -contains "SESSION_CREATE_OK") {
    Write-Host "✅ Session file creation successful" -ForegroundColor Green
}
if ($sessionTest -contains "SESSION_EXISTS_OK") {
    Write-Host "✅ Session file exists" -ForegroundColor Green
}
if ($sessionTest -contains "SESSION_CLEANUP_OK") {
    Write-Host "✅ Session file cleanup successful" -ForegroundColor Green
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Session file operations failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Production upload functionality verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test actual file upload through the web interface" -ForegroundColor White
Write-Host "2. Monitor server logs during upload/import operations" -ForegroundColor White
Write-Host "3. Verify database import results" -ForegroundColor White
Write-Host "4. Check that uploaded files are cleaned up after import" -ForegroundColor White