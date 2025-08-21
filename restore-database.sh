#!/bin/bash

# Master Order Database Restore Script
# Run this script to restore from a backup

REPO_PATH="/mnt/user/appdata/master-order-build/master-order"
BACKUP_DIR="$REPO_PATH/database-backups"
CONTAINER_NAME="master-order"

echo "🔄 Master Order Database Restore..."

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: $BACKUP_DIR"
    exit 1
fi

# List available backups
echo "📚 Available database backups:"
echo ""
BACKUPS=($(ls -t "$BACKUP_DIR"/*.db 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo "❌ No backup files found in $BACKUP_DIR"
    exit 1
fi

# Display numbered list of backups
for i in "${!BACKUPS[@]}"; do
    BACKUP_FILE="${BACKUPS[$i]}"
    BACKUP_NAME=$(basename "$BACKUP_FILE")
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    BACKUP_DATE=$(ls -l "$BACKUP_FILE" | awk '{print $6, $7, $8}')
    
    echo "[$((i+1))] $BACKUP_NAME"
    echo "    Size: $BACKUP_SIZE | Date: $BACKUP_DATE"
    echo ""
done

# Prompt user to select backup
echo "Select backup to restore (1-${#BACKUPS[@]}) or 'q' to quit:"
read -r SELECTION

if [ "$SELECTION" = "q" ] || [ "$SELECTION" = "Q" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Validate selection
if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt ${#BACKUPS[@]} ]; then
    echo "❌ Invalid selection: $SELECTION"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((SELECTION-1))]}"
BACKUP_NAME=$(basename "$SELECTED_BACKUP")

echo ""
echo "⚠️  WARNING: This will replace your current database with:"
echo "   $BACKUP_NAME"
echo ""
echo "Are you sure? (yes/no):"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "🔄 Restoring database from: $BACKUP_NAME"

# Stop container if running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "🛑 Stopping container..."
    docker stop "$CONTAINER_NAME"
fi

# Create a backup of current database before restoring
if [ -f "$REPO_PATH/master_order.db" ]; then
    CURRENT_BACKUP="$BACKUP_DIR/master_order_pre_restore_$(date +"%Y%m%d_%H%M%S").db"
    echo "💾 Backing up current database to: $(basename "$CURRENT_BACKUP")"
    cp "$REPO_PATH/master_order.db" "$CURRENT_BACKUP"
fi

# Restore the selected backup
echo "📁 Restoring database..."
cp "$SELECTED_BACKUP" "$REPO_PATH/master_order.db"

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
    
    # Restart container if it was running
    if [ ! -z "$CONTAINER_NAME" ]; then
        echo "🚀 Restarting container..."
        docker start "$CONTAINER_NAME"
        
        if [ $? -eq 0 ]; then
            echo "✅ Container restarted successfully!"
            echo "🌐 Application should be available at: http://192.168.1.252:3001"
        else
            echo "❌ Failed to restart container. Please check manually."
        fi
    fi
else
    echo "❌ Database restore failed!"
    exit 1
fi

echo ""
echo "📊 Restored database info:"
ls -lh "$REPO_PATH/master_order.db"
