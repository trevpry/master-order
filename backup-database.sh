#!/bin/bash

# Master Order Database Backup Script
# Run this script to manually backup your database

REPO_PATH="/mnt/user/appdata/master-order-build/master-order"
BACKUP_DIR="$REPO_PATH/database-backups"
CONTAINER_NAME="master-order"

echo "💾 Master Order Database Backup..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# First try to backup from running container
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "📁 Backing up database from running container..."
    BACKUP_FILE="$BACKUP_DIR/master_order_container_backup_$BACKUP_TIMESTAMP.db"
    
    # First check if the database file exists in the container
    if docker exec "$CONTAINER_NAME" test -f /app/data/master_order.db; then
        echo "🔍 Found database file in container, copying..."
        docker cp "$CONTAINER_NAME:/app/data/master_order.db" "$BACKUP_FILE"
        
        if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
            echo "✅ Container database backup completed successfully!"
            echo "📊 Backup file size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
            BACKUP_SUCCESS=true
        else
            echo "❌ Container backup command succeeded but file not created, trying host filesystem..."
            BACKUP_SUCCESS=false
        fi
    else
        echo "❌ Database file not found in container at /app/data/master_order.db"
        BACKUP_SUCCESS=false
    fi
else
    echo "⚠️  Container not running, trying host filesystem..."
    BACKUP_SUCCESS=false
fi

# If container backup failed or container not running, try host filesystem
if [ "$BACKUP_SUCCESS" != "true" ] && [ -f "$REPO_PATH/master_order.db" ]; then
    echo "� Backing up database from host filesystem..."
    BACKUP_FILE="$BACKUP_DIR/master_order_host_backup_$BACKUP_TIMESTAMP.db"
    
    cp "$REPO_PATH/master_order.db" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Host database backup completed successfully!"
        echo "📊 Backup file size: $(ls -lh "$BACKUP_FILE" | awk '{print $5}')"
        BACKUP_SUCCESS=true
    fi
fi

if [ "$BACKUP_SUCCESS" != "true" ]; then
    echo "❌ No database found to backup!"
    echo "   Checked: Container at /app/data/master_order.db"
    echo "   Checked: Host at $REPO_PATH/master_order.db"
    exit 1
fi

# Show backup history
echo ""
echo "📚 Recent backups:"
ls -lht "$BACKUP_DIR"/*.db 2>/dev/null | head -5

# Show disk usage
echo ""
echo "💽 Backup directory disk usage:"
du -sh "$BACKUP_DIR"
