#!/bin/bash

# Database location debug script
# Run this to see where the database actually is

CONTAINER_NAME="master-order"
REPO_PATH="/mnt/user/appdata/master-order-build/master-order"

echo "🔍 Master Order Database Location Debug"
echo "======================================"
echo ""

# Check if container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "✅ Container is running"
    
    # Check inside container
    echo ""
    echo "📁 Files in /app/data/ inside container:"
    docker exec "$CONTAINER_NAME" ls -la /app/data/ 2>/dev/null || echo "   Directory not found or empty"
    
    echo ""
    echo "📁 Files in /app/ inside container:"
    docker exec "$CONTAINER_NAME" ls -la /app/ | grep -E "\.db|data"
    
    echo ""
    echo "🔍 Searching for .db files in container:"
    docker exec "$CONTAINER_NAME" find /app -name "*.db" -type f 2>/dev/null || echo "   No .db files found"
    
    echo ""
    echo "🔧 Environment variables in container:"
    docker exec "$CONTAINER_NAME" env | grep DATABASE_URL || echo "   DATABASE_URL not set"
    
else
    echo "❌ Container is not running"
fi

echo ""
echo "📁 Files in host directory ($REPO_PATH):"
ls -la "$REPO_PATH"/*.db 2>/dev/null || echo "   No .db files found in host directory"

echo ""
echo "📁 All .db files in host directory (recursive):"
find "$REPO_PATH" -name "*.db" -type f 2>/dev/null || echo "   No .db files found anywhere in host directory"

echo ""
echo "💽 Disk usage in backup directory:"
BACKUP_DIR="$REPO_PATH/database-backups"
if [ -d "$BACKUP_DIR" ]; then
    ls -la "$BACKUP_DIR"
else
    echo "   Backup directory doesn't exist yet"
fi
