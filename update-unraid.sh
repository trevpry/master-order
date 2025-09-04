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
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/master_order_backup_$BACKUP_TIMESTAMP.db"

# First try to backup from running container
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "💾 Backing up database from running container..."
    
    # First check if the database file exists in the container
    if docker exec "$CONTAINER_NAME" test -f /app/data/master_order.db; then
        # Use docker cp to copy the file
        docker cp "$CONTAINER_NAME:/app/data/master_order.db" "$BACKUP_FILE"
        
        if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
            echo "✅ Container database backup created successfully: $(basename "$BACKUP_FILE")"
            BACKUP_SUCCESS=true
        else
            echo "⚠️  Container backup command succeeded but file not found, trying host filesystem..."
            BACKUP_SUCCESS=false
        fi
    else
        echo "⚠️  Database file not found in container at /app/data/master_order.db, trying host filesystem..."
        BACKUP_SUCCESS=false
    fi
else
    echo "⚠️  Container not running, trying host filesystem..."
    BACKUP_SUCCESS=false
fi

# If container backup failed, try host filesystem
if [ "$BACKUP_SUCCESS" != "true" ] && [ -f "$REPO_PATH/master_order.db" ]; then
    echo "💾 Backing up database from host filesystem..."
    cp "$REPO_PATH/master_order.db" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Host database backup created successfully: $(basename "$BACKUP_FILE")"
        BACKUP_SUCCESS=true
    fi
fi

# Check if backup was successful
if [ "$BACKUP_SUCCESS" = "true" ]; then
    # Keep only the last 10 backups to save space
    cd "$BACKUP_DIR"
    ls -t master_order_backup_*.db | tail -n +11 | xargs -r rm
    echo "📁 Cleaned old backups, keeping latest 10"
    
    # Show backup file size for verification
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    echo "📊 Backup file size: $BACKUP_SIZE"
else
    echo "⚠️  No database found to backup"
    echo "   Checked: Container at /app/data/master_order.db"
    echo "   Checked: Host at $REPO_PATH/master_order.db"
    echo "   Continuing with update (this might be first run)..."
    # Don't exit - continue with update for first-time setup
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

# Step 6: Start the new container with Unraid-specific settings (PostgreSQL)
echo "🚀 Starting updated container on Unraid..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart=unless-stopped \
    --network=host \
    --add-host="stash.internal:192.168.1.154" \
    --add-host="plex.local:192.168.1.116" \
    -v "/mnt/user/appdata/master-order/data:/app/data" \
    -v "/mnt/user/appdata/master-order/artwork-cache:/app/server/artwork-cache" \
    -v "/mnt/user/appdata/master-order/logs:/app/logs" \
    -v "/mnt/user/Media/Christmas:/xmas:ro" \
    -v "/mnt/user/Media/Movies:/movies:ro" \
    -v "/mnt/user/Media/Music:/music:ro" \
    -v "/mnt/user/Media/Classical:/classical:ro" \
    -v "/mnt/user/Media/TV:/tv:ro" \
    -v "/mnt/user/Media/VideoGames:/video_games:ro" \
    -v "/mnt/user/Media/PopMusic:/pop_music:ro" \
    -e NODE_ENV=production \
    -e "DATABASE_URL=postgresql://master_order_user:secure_password_change_me@192.168.1.114:5432/master_order" \
    -e "POSTGRES_PASSWORD=secure_password_change_me" \
    -e PORT=3001 \
    -e "EXTERNAL_IP=192.168.1.114" \
    -e "STASH_URL=http://stash.internal:9999" \
    -e "STASH_URL_FALLBACK_1=http://192.168.1.154:9999" \
    -e "STASH_URL_FALLBACK_2=http://192.168.1.114:9999" \
    -e "STASH_URL_FALLBACK_3=http://localhost:9999" \
    -e "STASH_URL_FALLBACK_4=http://host.docker.internal:9999" \
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
