# Master Order Development Environment Starter (PowerShell)
# This script starts the development container with volume mounts

Write-Host "🚀 Starting Master Order Development Environment..." -ForegroundColor Cyan

# Stop any existing development container
Write-Host "🛑 Stopping any existing development containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml down

# Build and start the development environment
Write-Host "🔨 Building and starting development container..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up --build -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start development environment." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Development environment started successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Container Status:" -ForegroundColor Cyan
docker-compose -f docker-compose.dev.yml ps

Write-Host ""
Write-Host "🌐 Application available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "📝 View logs: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor Gray
Write-Host "🛑 Stop environment: docker-compose -f docker-compose.dev.yml down" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Your code changes will be reflected instantly!" -ForegroundColor Green
