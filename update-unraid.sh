#!/bin/bash

# Master Order Unraid Update Script
# Run this script on your Unraid server to update the container

CONTAINER_NAME="master-order"
IMAGE_NAME="master-order"
REPO_PATH="/mnt/user/appdata/master-order-build/master-order"  # Updated to match your actual path
HOST_PORT="3001"
CONTAINER_PORT="3001"
BACKUP_DIR="$REPO_PATH/database-backups"

echo "🔄 Starting Master Order update on Unraid..."

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Step 1: Create automatic database backup
if [ -f "$REPO_PATH/master_order.db" ]; then
    BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/master_order_backup_$BACKUP_TIMESTAMP.db"
    echo "💾 Creating database backup: $BACKUP_FILE"
    cp "$REPO_PATH/master_order.db" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup created successfully"
        # Keep only the last 10 backups to save space
        cd "$BACKUP_DIR"
        ls -t master_order_backup_*.db | tail -n +11 | xargs -r rm
        echo "📁 Cleaned old backups, keeping latest 10"
    else
        echo "❌ Database backup failed! Aborting update."
        exit 1
    fi
else
    echo "⚠️  No existing database found at $REPO_PATH/master_order.db"
    echo "   This might be the first run or database is in a different location"
fi

# Navigate to the repository directory
if [ ! -d "$REPO_PATH" ]; then
    echo "❌ Repository path not found: $REPO_PATH"
    echo "Please update the REPO_PATH variable in this script"
    exit 1
fi

cd "$REPO_PATH"

# Step 2: Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull latest code. Please check your git repository."
    exit 1
fi

# Step 3: Stop the running container
echo "🛑 Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME

# Step 4: Remove the container (but keep the image for faster rebuilds)
echo "🗑️ Removing old container..."
docker rm $CONTAINER_NAME

# Step 5: Rebuild the image with latest code
echo "🔨 Building updated image..."
docker build -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image. Please check the build logs."
    exit 1
fi

# Step 6: Start the new container with Unraid-specific settings
echo "🚀 Starting updated container on Unraid..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart=unless-stopped \
    -p $HOST_PORT:$CONTAINER_PORT \
    -v "$REPO_PATH/master_order.db:/app/data/master_order.db" \
    -e NODE_ENV=production \
    --network=bridge \
    $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container. Please check the Docker logs."
    echo "💾 Your database backup is available at: $BACKUP_DIR"
    exit 1
fi

echo "✅ Master Order updated successfully on Unraid!"
echo "🌐 Application should be available at: http://192.168.1.252:$HOST_PORT"
echo "💾 Database backup stored at: $BACKUP_DIR"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 To check logs: docker logs $CONTAINER_NAME"
echo "📝 To access container: docker exec -it $CONTAINER_NAME /bin/sh"
echo "📁 Database backups location: $BACKUP_DIR"
