#!/bin/bash

# CRITICAL DATA SAFETY SCRIPT
# This script creates automatic backups before any Docker operations
# and validates data integrity

set -e

REPO_PATH="$(pwd)"
BACKUP_DIR="$REPO_PATH/database-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "🛡️  CRITICAL DATA SAFETY CHECK - Master Order Database Backup"
echo "📅 Backup Date: $(date)"
echo "📁 Repository Path: $REPO_PATH"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to create backup
create_backup() {
    local source_file="$1"
    local backup_name="$2"
    
    if [ -f "$source_file" ]; then
        local backup_file="$BACKUP_DIR/${backup_name}_$TIMESTAMP.db"
        echo "💾 Creating backup: $backup_file"
        cp "$source_file" "$backup_file"
        
        # Validate backup
        if [ -f "$backup_file" ]; then
            local original_size=$(stat -f%z "$source_file" 2>/dev/null || stat -c%s "$source_file" 2>/dev/null || echo "0")
            local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
            
            echo "📊 Original size: $original_size bytes"
            echo "📊 Backup size: $backup_size bytes"
            
            if [ "$original_size" -eq "$backup_size" ] && [ "$backup_size" -gt 0 ]; then
                echo "✅ Backup validated successfully!"
                echo "📂 Backup location: $backup_file"
                return 0
            else
                echo "❌ Backup validation failed! Size mismatch or empty file."
                return 1
            fi
        else
            echo "❌ Backup file creation failed!"
            return 1
        fi
    else
        echo "⚠️  Source file not found: $source_file"
        return 1
    fi
}

# Check for existing databases and create backups
BACKUP_CREATED=false

# Check main database file
if [ -f "$REPO_PATH/master_order.db" ]; then
    echo "🔍 Found main database file"
    if create_backup "$REPO_PATH/master_order.db" "pre_docker_main"; then
        BACKUP_CREATED=true
    fi
fi

# Check server database file
if [ -f "$REPO_PATH/server/master_order.db" ]; then
    echo "🔍 Found server database file"
    if create_backup "$REPO_PATH/server/master_order.db" "pre_docker_server"; then
        BACKUP_CREATED=true
    fi
fi

# Check for running container database
CONTAINER_NAME="master-order"
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "🔍 Found running container, checking for database..."
    if docker exec "$CONTAINER_NAME" test -f /app/master_order.db 2>/dev/null; then
        echo "💾 Backing up from running container..."
        docker cp "$CONTAINER_NAME:/app/master_order.db" "$BACKUP_DIR/pre_docker_container_$TIMESTAMP.db"
        if [ $? -eq 0 ]; then
            echo "✅ Container database backup completed!"
            BACKUP_CREATED=true
        fi
    fi
    
    if docker exec "$CONTAINER_NAME" test -f /app/data/master_order.db 2>/dev/null; then
        echo "💾 Backing up from container data directory..."
        docker cp "$CONTAINER_NAME:/app/data/master_order.db" "$BACKUP_DIR/pre_docker_container_data_$TIMESTAMP.db"
        if [ $? -eq 0 ]; then
            echo "✅ Container data directory backup completed!"
            BACKUP_CREATED=true
        fi
    fi
fi

# List existing backups
echo ""
echo "📋 EXISTING BACKUPS:"
if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR)" ]; then
    ls -la "$BACKUP_DIR"/*.db | while read -r line; do
        echo "   $line"
    done
else
    echo "   No existing backups found"
fi

if [ "$BACKUP_CREATED" = true ]; then
    echo ""
    echo "✅ DATA SAFETY VERIFIED - Backup(s) created successfully!"
    echo "🚀 Safe to proceed with Docker operations."
    echo ""
    echo "💡 RESTORE INSTRUCTIONS:"
    echo "   To restore from backup, copy the backup file over your main database:"
    echo "   cp $BACKUP_DIR/[backup_file].db $REPO_PATH/master_order.db"
    echo ""
else
    echo ""
    echo "⚠️  WARNING: No database files found to backup!"
    echo "   This might be normal for a fresh installation."
    echo "   If you expected to find data, please check your file locations."
    echo ""
fi

echo "🛡️  DATA SAFETY CHECK COMPLETE"
echo "=============================================="