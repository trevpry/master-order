#!/bin/bash

# Master Order Unraid Update Script
# Run this script on your Unraid server to update the container

CONTAINER_NAME="master-order"
IMAGE_NAME="master-order"
REPO_PATH="/mnt/user/appdata/master-order"  # Adjust this path as needed
HOST_PORT="3001"
CONTAINER_PORT="3001"

echo "🔄 Starting Master Order update on Unraid..."

# Navigate to the repository directory
if [ ! -d "$REPO_PATH" ]; then
    echo "❌ Repository path not found: $REPO_PATH"
    echo "Please update the REPO_PATH variable in this script"
    exit 1
fi

cd "$REPO_PATH"

# Step 1: Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
git pull origin master

if [ $? -ne 0 ]; then
    echo "❌ Failed to pull latest code. Please check your git repository."
    exit 1
fi

# Step 2: Stop the running container
echo "🛑 Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME

# Step 3: Remove the container (but keep the image for faster rebuilds)
echo "🗑️ Removing old container..."
docker rm $CONTAINER_NAME

# Step 4: Rebuild the image with latest code
echo "🔨 Building updated image..."
docker build -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image. Please check the build logs."
    exit 1
fi

# Step 5: Start the new container with Unraid-specific settings
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
    exit 1
fi

echo "✅ Master Order updated successfully on Unraid!"
echo "🌐 Application should be available at: http://192.168.1.252:$HOST_PORT"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 To check logs: docker logs $CONTAINER_NAME"
echo "📝 To access container: docker exec -it $CONTAINER_NAME /bin/sh"
