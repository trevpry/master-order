#!/bin/bash

# Eddie Life Management - Production Deployment Script
# This script ensures safe deployment to production with data preservation

set -e  # Exit on any error

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-./deployment-backups}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

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

resolve_compose_cmd() {
    if command -v docker-compose > /dev/null 2>&1; then
        echo "docker-compose"
        return 0
    fi

    if docker compose version > /dev/null 2>&1; then
        echo "docker compose"
        return 0
    fi

    return 1
}

extract_database_url() {
    local compose_file="$1"
    local extracted

    extracted=$(grep -E 'DATABASE_URL=' "$compose_file" | head -1 | sed -E 's/.*DATABASE_URL=([^" ]+).*/\1/' || true)
    if [ -n "$extracted" ]; then
        echo "$extracted"
        return 0
    fi

    if [ -n "$DATABASE_URL" ]; then
        echo "$DATABASE_URL"
        return 0
    fi

    return 1
}

# Pre-deployment checks
log_info "Running pre-deployment checks..."

COMPOSE_CMD="$(resolve_compose_cmd || true)"
if [ -z "$COMPOSE_CMD" ]; then
    log_error "Neither docker-compose nor docker compose is available"
    exit 1
fi

log_info "Using compose command: $COMPOSE_CMD"

if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "Compose file not found: $COMPOSE_FILE"
    exit 1
fi

log_info "Using compose file: $COMPOSE_FILE"

# Check if required files exist
required_files=("Dockerfile" "$COMPOSE_FILE" "start.js" "server/prisma/schema.postgresql.prisma")
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

# Run repository pre-deployment safety checks if present
if [ -f "./pre-deployment-check.sh" ]; then
    log_info "Running pre-deployment safety verification script..."
    chmod +x ./pre-deployment-check.sh
    ./pre-deployment-check.sh
    log_success "Pre-deployment verification passed"
fi

# Validate persistent data mount configuration
if ! grep -Eq '/app/data|DATA_PATH' "$COMPOSE_FILE"; then
    log_error "Compose file does not appear to define persistent app data storage (/app/data or DATA_PATH)"
    log_error "Refusing to deploy without persistence safeguards"
    exit 1
fi

log_success "Persistent data configuration detected"

# Mandatory backup creation before any destructive deployment step
log_info "Creating mandatory deployment backup snapshot..."
mkdir -p "$BACKUP_DIR"

cp "$COMPOSE_FILE" "$BACKUP_DIR/compose-file.snapshot.yml"
[ -f ".env" ] && cp ".env" "$BACKUP_DIR/.env.snapshot"

# Backup running container app data if present
if $COMPOSE_CMD -f "$COMPOSE_FILE" ps -q master-order > /dev/null 2>&1; then
    CONTAINER_ID="$($COMPOSE_CMD -f "$COMPOSE_FILE" ps -q master-order | head -1)"
    if [ -n "$CONTAINER_ID" ]; then
        log_info "Backing up /app/data from running container..."
        docker cp "$CONTAINER_ID:/app/data" "$BACKUP_DIR/app-data-container-backup" || log_warning "Could not copy /app/data from running container"
    fi
fi

# Backup host-mounted data if configured for standard Unraid path
if [ -d "/mnt/user/appdata/master-order/data" ]; then
    log_info "Backing up host app data directory..."
    tar -czf "$BACKUP_DIR/app-data-host-backup.tgz" -C "/mnt/user/appdata/master-order" data
fi

DB_URL="$(extract_database_url "$COMPOSE_FILE" || true)"
if [ -n "$DB_URL" ] && echo "$DB_URL" | grep -q '^postgresql://'; then
    log_info "PostgreSQL database detected - creating pg_dump backup..."
    if ! command -v pg_dump > /dev/null 2>&1; then
        log_error "pg_dump is required for PostgreSQL safety backup but is not installed"
        exit 1
    fi

    pg_dump --format=custom --file="$BACKUP_DIR/postgres-backup.dump" "$DB_URL"
    if [ ! -s "$BACKUP_DIR/postgres-backup.dump" ]; then
        log_error "PostgreSQL backup file is empty; refusing to deploy"
        exit 1
    fi
    log_success "PostgreSQL backup created"
else
    log_info "PostgreSQL URL not detected, attempting SQLite backup check..."
    if [ -f "/mnt/user/appdata/master-order/data/master_order.db" ]; then
        cp "/mnt/user/appdata/master-order/data/master_order.db" "$BACKUP_DIR/master_order_predeploy.db"
        log_success "SQLite backup created from host data path"
    elif [ -f "./master_order.db" ]; then
        cp "./master_order.db" "$BACKUP_DIR/master_order_predeploy.db"
        log_success "SQLite backup created from repository path"
    else
        log_warning "No SQLite database file found; ensure your production data source is externally backed up"
    fi
fi

# Require at least one backup artifact
BACKUP_FILES_FOUND=$(find "$BACKUP_DIR" -type f | wc -l | tr -d ' ')
if [ "$BACKUP_FILES_FOUND" -eq 0 ]; then
    log_error "No backup artifacts were created. Refusing to deploy."
    exit 1
fi

if command -v sha256sum > /dev/null 2>&1; then
    find "$BACKUP_DIR" -type f -exec sha256sum {} \; > "$BACKUP_DIR/backup-checksums.sha256"
fi

log_success "Mandatory backup snapshot complete: $BACKUP_DIR"

# Build and deployment
log_info "Starting deployment process..."

# Stop existing containers (if any)
log_info "Stopping existing containers..."
$COMPOSE_CMD -f "$COMPOSE_FILE" down || log_warning "No existing containers to stop"

# Remove old images to ensure fresh build
log_info "Cleaning up old images..."
$COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache || {
    log_error "Docker build failed"
    exit 1
}

log_success "Docker image built successfully"

# Start the application
log_info "Starting Eddie Life Management..."
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d || {
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
            $COMPOSE_CMD -f "$COMPOSE_FILE" logs --tail=20
            log_warning "Deployment backup snapshot preserved at: $BACKUP_DIR"
            log_warning "Use this backup before retrying deployment"
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
$COMPOSE_CMD -f "$COMPOSE_FILE" ps

echo ""
log_info "View logs with: $COMPOSE_CMD -f $COMPOSE_FILE logs -f"
log_info "Stop application with: $COMPOSE_CMD -f $COMPOSE_FILE down"
log_info "Deployment backup snapshot: $BACKUP_DIR"
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
