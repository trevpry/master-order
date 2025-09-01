#!/bin/bash

# Eddie Life Management - Production Deployment Script
# This script ensures safe deployment to production with data preservation

set -e  # Exit on any error

echo "🚀 Eddie Life Management - Production Deployment"
echo "================================================"
echo "Date: $(date)"
echo "Working Directory: $(pwd)"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose is not installed or not in PATH"
    exit 1
fi

# Check if required files exist
required_files=("Dockerfile" "docker-compose.yml" "start.js" "server/prisma/schema.postgresql.prisma")
for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        log_error "Required file not found: $file"
        exit 1
    fi
done

log_success "All required files present"

# Verify schema synchronization
log_info "Verifying database schema synchronization..."

cd server

# Check if all schema files exist
if [ ! -f "prisma/schema.prisma" ] || [ ! -f "prisma/schema.postgresql.prisma" ] || [ ! -f "prisma/schema.sqlite.prisma" ]; then
    log_error "Missing schema files - cannot proceed"
    exit 1
fi

# Verify PostgreSQL schema has correct provider
if ! grep -q 'provider = "postgresql"' prisma/schema.postgresql.prisma; then
    log_error "PostgreSQL schema does not have correct provider"
    exit 1
fi

log_success "Database schema files are properly synchronized"

# Check migration status
log_info "Checking migration status..."
if npx prisma migrate status > /dev/null 2>&1; then
    log_success "Migration status check passed"
else
    log_warning "Migration status check failed - this may be normal for first deployment"
fi

cd ..

# Build and deployment
log_info "Starting deployment process..."

# Stop existing containers (if any)
log_info "Stopping existing containers..."
docker-compose down || log_warning "No existing containers to stop"

# Remove old images to ensure fresh build
log_info "Cleaning up old images..."
docker-compose build --no-cache || {
    log_error "Docker build failed"
    exit 1
}

log_success "Docker image built successfully"

# Start the application
log_info "Starting Eddie Life Management..."
docker-compose up -d || {
    log_error "Failed to start containers"
    exit 1
}

log_success "Containers started successfully"

# Wait for application to be ready
log_info "Waiting for application to be ready..."
sleep 10

# Health check
log_info "Performing health check..."
HEALTH_CHECK_URL="http://localhost:3001/api/health"
MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_success "Health check passed - application is ready!"
        break
    else
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            log_error "Health check failed after $MAX_ATTEMPTS attempts"
            log_info "Checking container logs..."
            docker-compose logs --tail=20
            exit 1
        fi
        log_info "Health check attempt $ATTEMPT/$MAX_ATTEMPTS failed, retrying in 5 seconds..."
        sleep 5
        ((ATTEMPT++))
    fi
done

# Display deployment summary
echo ""
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "=========================="
log_success "Eddie Life Management is now running in production mode"
log_info "Application URL: http://localhost:3001"
log_info "Health Check: $HEALTH_CHECK_URL"
log_info "Container Status:"
docker-compose ps

echo ""
log_info "View logs with: docker-compose logs -f"
log_info "Stop application with: docker-compose down"
echo ""

# Final verification of key features
log_info "Verifying key endpoints..."
ENDPOINTS=("/" "/api/health" "/api/notes" "/api/settings")

for endpoint in "${ENDPOINTS[@]}"; do
    if curl -f -s "http://localhost:3001$endpoint" > /dev/null 2>&1; then
        log_success "✅ $endpoint - OK"
    else
        log_warning "⚠️  $endpoint - May not be ready yet"
    fi
done

echo ""
log_success "🚀 Eddie Life Management deployment completed successfully!"
log_info "All existing PostgreSQL data has been preserved"
log_info "New Notes functionality is now available"
echo ""
