# Master Order Docker Update Script (PowerShell)
# This script pulls the latest code and restarts the container

$ContainerName = "master-order"
$ImageName = "master-order"

Write-Host "🔄 Starting Master Order update process..." -ForegroundColor Cyan

# Step 1: Pull latest code from GitHub
Write-Host "📥 Pulling latest code from GitHub..." -ForegroundColor Yellow
git pull origin master

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to pull latest code. Please check your git repository." -ForegroundColor Red
    exit 1
}

# Step 2: Stop the running container
Write-Host "🛑 Stopping container: $ContainerName" -ForegroundColor Yellow
docker stop $ContainerName

# Step 3: Remove the container (but keep the image)
Write-Host "🗑️ Removing old container..." -ForegroundColor Yellow
docker rm $ContainerName

# Step 4: Rebuild the image with latest code
Write-Host "🔨 Building updated image..." -ForegroundColor Yellow
docker build -t $ImageName .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build Docker image. Please check the build logs." -ForegroundColor Red
    exit 1
}

# Step 5: Start the new container
Write-Host "🚀 Starting updated container..." -ForegroundColor Yellow
$currentPath = Get-Location
docker run -d `
    --name $ContainerName `
    -p 3001:3001 `
    -v "${currentPath}/master_order.db:/app/master_order.db" `
    $ImageName

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start container. Please check the Docker logs." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Master Order updated successfully!" -ForegroundColor Green
Write-Host "🌐 Application should be available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Container status:" -ForegroundColor Cyan
docker ps | Where-Object { $_ -match $ContainerName }
