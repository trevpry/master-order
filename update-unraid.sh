#!/bin/bash

# Master Order Unraid Update Script
# Run this script on your Unraid server to update the container

# ===============================================================================
# CONFIGURATION SECTION - UPDATE THESE VALUES FOR YOUR ENVIRONMENT
# ===============================================================================

CONTAINER_NAME="master-order"
IMAGE_NAME="master-order"
REPO_PATH="/mnt/user/appdata/master-order-build/master-order"  # Updated to match your actual path
HOST_PORT="3001"
CONTAINER_PORT="3001"
BACKUP_DIR="$REPO_PATH/database-backups"

# PostgreSQL Configuration
POSTGRES_HOST="192.168.1.118"
POSTGRES_PORT="5432"
POSTGRES_DB="master_order"
POSTGRES_USER="master_order_user"
POSTGRES_PASSWORD="secure_password_change_me"
DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

# ===============================================================================
# INITIAL SETUP AND GITHUB PULL (MUST HAPPEN FIRST)
# ===============================================================================

echo "🔄 Starting Master Order update on Unraid..."
echo "🗃️  Target PostgreSQL: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"

# Basic pre-flight checks
echo ""
echo "🔍 Basic pre-flight checks..."

# Check if repository exists
if [ ! -d "$REPO_PATH" ]; then
    echo "❌ Repository path not found: $REPO_PATH"
    echo "Please update the REPO_PATH variable in this script"
    exit 1
fi

cd "$REPO_PATH"

# CRITICAL: Pull latest code from GitHub FIRST before using any new functionality
echo "🔄 Pulling latest code from GitHub (CRITICAL - must happen first)..."
# Configure git to handle divergent branches if needed
git config pull.rebase false 2>/dev/null || true

# Check if there are any uncommitted changes or conflicts
if ! git status --porcelain | grep -q .; then
    # No local changes, try normal pull
    if git pull origin master; then
        echo "✅ Successfully pulled latest code from GitHub"
    else
        echo "⚠️ Normal git pull failed, trying force reset..."
        git fetch origin master
        git reset --hard origin/master
        if [ $? -eq 0 ]; then
            echo "✅ Force reset successful"
        else
            echo "❌ Failed to update code. Please check your git repository."
            exit 1
        fi
    fi
else
    echo "⚠️ Local changes detected, will reset to remote version..."
    git fetch origin master
    git reset --hard origin/master
    if [ $? -eq 0 ]; then
        echo "✅ Force reset successful"
    else
        echo "❌ Failed to update code. Please check your git repository."
        exit 1
    fi
fi

# ===============================================================================
# POST-UPDATE SETUP (Now we can safely use updated functionality)
# ===============================================================================

# Set up logging after we have the latest version
MIGRATION_LOG="$BACKUP_DIR/migration.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages (now safe to use after git pull)
log_info() {
    echo "ℹ️  $1" | tee -a "$MIGRATION_LOG"
}

log_success() {
    echo "✅ $1" | tee -a "$MIGRATION_LOG"
}

log_warning() {
    echo "⚠️  $1" | tee -a "$MIGRATION_LOG"
}

log_error() {
    echo "❌ $1" | tee -a "$MIGRATION_LOG"
}

# Check for required files (now using updated repository)
log_info "Checking for required files in updated repository..."
REQUIRED_FILES=(
    "server/index.js"
    "Dockerfile"
    "docker-compose.yml"
    "package.json"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    log_error "Missing required files after git pull:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    echo "Please ensure all required files are present in the repository"
    exit 1
fi

log_success "All required files present in updated repository"

# Function to test PostgreSQL connectivity (skip if tools not available)
test_postgresql_connection() {
    log_info "Testing PostgreSQL connection..."
    
    # Try to connect using psql if available
    if command -v psql &> /dev/null; then
        if psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
            log_success "PostgreSQL connection successful"
            return 0
        else
            log_error "PostgreSQL connection failed"
            return 1
        fi
    else
        log_warning "psql not available, skipping connection test"
        return 0
    fi
}

# Function to create PostgreSQL backup (skip if tools not available)
create_postgresql_backup() {
    local backup_timestamp=$(date +"%Y%m%d_%H%M%S")
    local postgres_backup_file="$BACKUP_DIR/postgresql_backup_$backup_timestamp.sql"
    
    log_info "Creating PostgreSQL database backup..."
    
    if command -v pg_dump &> /dev/null; then
        if pg_dump "$DATABASE_URL" > "$postgres_backup_file"; then
            log_success "PostgreSQL backup created: $(basename "$postgres_backup_file")"
            echo "$postgres_backup_file"
            return 0
        else
            log_error "PostgreSQL backup failed"
            return 1
        fi
    else
        log_warning "pg_dump not available, cannot create PostgreSQL backup"
        return 1
    fi
}

# ===============================================================================
# BACKUP AND PREPARATION
# ===============================================================================

# Step 1: Create automatic database backup
log_info "Creating automatic database backup..."
BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/master_order_backup_$BACKUP_TIMESTAMP.db"

# First try to backup from running container
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_info "Backing up database from running container..."
    
    # First check if the database file exists in the container
    if docker exec "$CONTAINER_NAME" test -f /app/data/master_order.db; then
        # Use docker cp to copy the file
        docker cp "$CONTAINER_NAME:/app/data/master_order.db" "$BACKUP_FILE"
        
        if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
            log_success "Container database backup created successfully: $(basename "$BACKUP_FILE")"
            BACKUP_SUCCESS=true
        else
            log_warning "Container backup command succeeded but file not found, trying host filesystem..."
            BACKUP_SUCCESS=false
        fi
    else
        log_warning "Database file not found in container at /app/data/master_order.db, trying host filesystem..."
        BACKUP_SUCCESS=false
    fi
else
    log_warning "Container not running, trying host filesystem..."
    BACKUP_SUCCESS=false
fi

# If container backup failed, try host filesystem
if [ "$BACKUP_SUCCESS" != "true" ] && [ -f "$REPO_PATH/master_order.db" ]; then
    log_info "Backing up database from host filesystem..."
    cp "$REPO_PATH/master_order.db" "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Host database backup created successfully: $(basename "$BACKUP_FILE")"
        BACKUP_SUCCESS=true
    fi
fi

# Check if backup was successful
if [ "$BACKUP_SUCCESS" = "true" ]; then
    # Keep only the last 10 backups to save space
    cd "$BACKUP_DIR"
    ls -t master_order_backup_*.db 2>/dev/null | tail -n +11 | xargs -r rm
    log_info "Cleaned old backups, keeping latest 10"
    
    # Show backup file size for verification
    BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    log_info "Backup file size: $BACKUP_SIZE"
else
    log_warning "No database found to backup"
    log_info "Checked: Container at /app/data/master_order.db"
    log_info "Checked: Host at $REPO_PATH/master_order.db"
    log_info "Continuing with update (this might be first run)..."
fi

# Return to repo root
cd "$REPO_PATH"

# Step 2: Test PostgreSQL connection before proceeding (if tools available)
test_postgresql_connection

# Step 3: Create PostgreSQL backup before any changes (if tools available)
POSTGRES_BACKUP_FILE=$(create_postgresql_backup)
if [ $? -ne 0 ]; then
    log_warning "PostgreSQL backup failed, but continuing with update"
fi

# ===============================================================================
# CONTAINER UPDATE AND DEPLOYMENT
# ===============================================================================

# Step 5: Stop the running container
log_info "Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME 2>/dev/null || log_info "Container was not running"

# Step 6: Remove the container and old image to force clean rebuild
log_info "Removing old container..."
docker rm $CONTAINER_NAME 2>/dev/null || log_info "No container to remove"

log_info "Removing old image to force clean rebuild..."
docker rmi $IMAGE_NAME 2>/dev/null || log_warning "No existing image to remove"

# Step 7: Rebuild the image with latest code (no cache)
log_info "Building updated image (no cache)..."
docker build --no-cache -t $IMAGE_NAME .

if [ $? -ne 0 ]; then
    log_error "Failed to build Docker image. Please check the build logs."
    exit 1
fi

# Step 8: Start the new container with Unraid-specific settings (PostgreSQL)
log_info "Starting updated container on Unraid with PostgreSQL..."
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
    -e "DATABASE_URL=$DATABASE_URL" \
    -e "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" \
    -e PORT=3001 \
    -e "EXTERNAL_IP=192.168.1.118" \
    -e "STASH_URL=http://stash.internal:9999" \
    -e "STASH_URL_FALLBACK_1=http://192.168.1.154:9999" \
    -e "STASH_URL_FALLBACK_2=http://192.168.1.118:9999" \
    -e "STASH_URL_FALLBACK_3=http://localhost:9999" \
    -e "STASH_URL_FALLBACK_4=http://host.docker.internal:9999" \
    $IMAGE_NAME

if [ $? -ne 0 ]; then
    log_error "Failed to start container. Please check the Docker logs."
    log_info "Your database backups are available at: $BACKUP_DIR"
    exit 1
fi

# Step 9: Wait for container to be ready
log_info "Waiting for container to be ready..."
sleep 15

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    log_error "Container failed to start"
    exit 1
fi

log_success "Container is running"

# ===============================================================================
# POST-DEPLOYMENT SETUP
# ===============================================================================

# ===============================================================================
# VALIDATION AND COMPLETION
# ===============================================================================

# Step 11: Basic validation
log_info "Final validation..."

# Check if container is still running
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container is running successfully"
else
    log_error "Container stopped unexpectedly"
    echo "Check logs: docker logs $CONTAINER_NAME"
    exit 1
fi

log_success "Master Order updated successfully on Unraid!"
echo "🌐 Application should be available at: http://192.168.1.252:$HOST_PORT"
echo "🗃️  Using PostgreSQL database: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "💾 Database backups stored at: $BACKUP_DIR"
if [ -n "$POSTGRES_BACKUP_FILE" ]; then
    echo "🔙 PostgreSQL backup: $(basename "$POSTGRES_BACKUP_FILE")"
fi
echo "📋 Log file: $MIGRATION_LOG"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 Useful commands:"
echo "   - Check logs: docker logs $CONTAINER_NAME"
echo "   - Access container: docker exec -it $CONTAINER_NAME /bin/sh"
echo "   - View log: cat $MIGRATION_LOG"
echo ""
if [ "$RUN_MIGRATION_AFTER_DEPLOY" = true ]; then
    echo "🎯 MIGRATION STATUS:"
    echo "   ✅ Container deployed successfully"
    echo "   📊 Check migration results in the log above"
    echo "   echo "   🎯 Access your application at: http://[your-unraid-ip]:$HOST_PORT"
    echo """
fi