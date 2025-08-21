#!/bin/bash

# Master Order Database Backup Script
# Run this script to manually backup your database

REPO_PATH="/mnt/user/appdata/master-order-build/master-order"
BACKUP_DIR="$REPO_PATH/database-backups"
CONTAINER_NAME="master-order"

echo "💾 Master Order Database Backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ -f "$REPO_PATH/master_order.db" ]; then
    # Backup from host file system
    BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/master_order_manual_backup_$BACKUP_TIMESTAMP.db"
    
    echo "📁 Backing up database to: $BACKUP_FILE"
    cp "$REPO_PATH/master_order.db" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup completed successfully!"
        echo "📊 Backup file size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
    else
        echo "❌ Database backup failed!"
        exit 1
    fi
else
    echo "❌ Database file not found at: $REPO_PATH/master_order.db"
    
    # Try to backup from running container
    if docker ps | grep -q "$CONTAINER_NAME"; then
        echo "🔄 Attempting to backup from running container..."
        BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        BACKUP_FILE="$BACKUP_DIR/master_order_container_backup_$BACKUP_TIMESTAMP.db"
        
        docker cp "$CONTAINER_NAME:/app/data/master_order.db" "$BACKUP_FILE"
        
        if [ $? -eq 0 ]; then
            echo "✅ Container database backup completed!"
            echo "📊 Backup file size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
        else
            echo "❌ Container backup also failed!"
            exit 1
        fi
    else
        echo "❌ Container not running and no host database found!"
        exit 1
    fi
fi

# Show backup history
echo ""
echo "📚 Recent backups:"
ls -lht "$BACKUP_DIR"/*.db 2>/dev/null | head -5

# Show disk usage
echo ""
echo "💽 Backup directory disk usage:"
du -sh "$BACKUP_DIR"
