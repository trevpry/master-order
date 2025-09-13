#!/bin/bash

# Simplified History Plus import script for Unraid
# This script only handles the History Plus CSV import

set -e

CONTAINER_NAME="master-order"
APP_DIR="/mnt/user/appdata/master-order"
BACKUP_DIR="$APP_DIR/backups"

# Logging functions
log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_error() {
    echo "❌ $1"
}

log_warning() {
    echo "⚠️  $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log_error "Container $CONTAINER_NAME is not running"
    exit 1
fi

log_info "Starting History Plus CSV import process..."

# Copy CSV files to container if they exist locally
if [ -d "./history-plus-export" ]; then
    log_info "Copying CSV files to container..."
    docker cp ./history-plus-export "$CONTAINER_NAME:/app/"
    if [ $? -eq 0 ]; then
        log_success "CSV files copied to container"
    else
        log_error "Failed to copy CSV files"
        exit 1
    fi
else
    log_warning "No local CSV files found, assuming they're already in container"
fi

# Run the import script inside the container
log_info "Running History Plus import script..."
docker exec "$CONTAINER_NAME" node /app/import-history-plus-data.js

if [ $? -eq 0 ]; then
    log_success "History Plus import completed successfully!"
    log_info "Your historical data has been imported to PostgreSQL"
else
    log_error "History Plus import failed"
    exit 1
fi

log_success "History Plus import process completed!"