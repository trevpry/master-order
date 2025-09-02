#!/bin/bash

# Master Order Docker Update Script
# This script pulls the latest code and restarts the container

CONTAINER_NAME="master-order"
IMAGE_NAME="master-order"

echo "🔄 Starting Master Order update process..."

# Step 1: Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
# Configure git to handle divergent branches if needed
git config pull.rebase false 2>/dev/null || true
git pull origin master

if [ $? -ne 0 ]; then
    echo "⚠️ Standard pull failed, trying with merge strategy..."
    git pull --no-rebase origin master
    if [ $? -ne 0 ]; then
        echo "❌ Failed to pull latest code. Please check your git repository."
        exit 1
    fi
fi

# Step 2: Stop the running container
echo "🛑 Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME

# Step 3: Remove the container (but keep the image)
echo "🗑️ Removing old container..."
docker rm $CONTAINER_NAME

# Step 4: Rebuild the image with latest code
echo "🔨 Building updated image..."
docker build -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    echo "❌ Failed to build Docker image. Please check the build logs."
    exit 1
fi

# Step 5: Start the new container
echo "🚀 Starting updated container..."
docker run -d \
    --name $CONTAINER_NAME \
    -p 3001:3001 \
    -v "$(pwd)/master_order.db:/app/master_order.db" \
    $IMAGE_NAME

if [ $? -ne 0 ]; then
    echo "❌ Failed to start container. Please check the Docker logs."
    exit 1
fi

echo "✅ Master Order updated successfully!"
echo "🌐 Application should be available at: http://localhost:3001"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME
