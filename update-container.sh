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

# Check if there are any uncommitted changes or conflicts
if ! git status --porcelain | grep -q .; then
    # No local changes, try normal pull
    git pull origin master
else
    echo "⚠️ Local changes detected, will reset to remote version..."
    git fetch origin master
    git reset --hard origin/master
fi

# If pull still fails, force reset to remote
if [ $? -ne 0 ]; then
    echo "⚠️ Pull failed, forcing reset to remote version..."
    git fetch origin master
    git reset --hard origin/master
    if [ $? -ne 0 ]; then
        echo "❌ Failed to update code. Please check your git repository."
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
