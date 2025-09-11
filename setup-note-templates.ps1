# Setup Note Templates for Docker/Unraid
# PowerShell script for Windows Docker Desktop users

Write-Host "🐳 Docker/Unraid Note Templates Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Get the container ID for master-order
$containerId = docker ps --filter "name=master-order" --format "{{.ID}}" | Select-Object -First 1

if (-not $containerId) {
    Write-Host "❌ ERROR: Master Order container not found or not running." -ForegroundColor Red
    Write-Host "💡 Make sure your Docker container is running with 'master-order' in the name." -ForegroundColor Yellow
    exit 1
}

Write-Host "🔍 Found container: $containerId" -ForegroundColor Green

# Run the template setup script inside the container
Write-Host "🔧 Running note templates setup inside container..." -ForegroundColor Yellow

try {
    $result = docker exec $containerId node server/scripts/setup-note-templates.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ SUCCESS: Note templates setup completed!" -ForegroundColor Green
        Write-Host "💡 You can now use the Notes section with default templates." -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ FAILED: Note templates setup failed." -ForegroundColor Red
        Write-Host "💡 Check the logs above for error details." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ ERROR: Failed to execute command in container." -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}
