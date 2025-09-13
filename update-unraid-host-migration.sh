#!/bin/bash

# Master Order Unraid Update Script with History Plus Migration
# Run this script on your Unraid server to update the container
# Now includes comprehensive History Plus data migration to PostgreSQL
#
# 🛡️  DATA SAFETY GUARANTEE:
# - Migration ONLY INSERTS new records, never updates existing PostgreSQL data
# - All existing PostgreSQL data is preserved completely unchanged
# - Database transactions ensure atomicity and rollback capability
# - Pre-migration analysis shows exactly what will be migrated
# - User confirmation required before any database operations

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

echo "🔄 Starting Master Order update with History Plus migration on Unraid..."
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
HISTORY_PLUS_MIGRATION_LOG="$BACKUP_DIR/history-plus-migration.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages (now safe to use after git pull)
log_info() {
    echo "ℹ️  $1" | tee -a "$HISTORY_PLUS_MIGRATION_LOG"
}

log_success() {
    echo "✅ $1" | tee -a "$HISTORY_PLUS_MIGRATION_LOG"
}

log_warning() {
    echo "⚠️  $1" | tee -a "$HISTORY_PLUS_MIGRATION_LOG"
}

log_error() {
    echo "❌ $1" | tee -a "$HISTORY_PLUS_MIGRATION_LOG"
}

# Check for required files (now using updated repository)
log_info "Checking for required files in updated repository..."
REQUIRED_FILES=(
    "server/import-history-plus-data.js"
    "Dockerfile"
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

# Function to test PostgreSQL connectivity
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

# Function to create PostgreSQL backup
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
    ls -t master_order_backup_*.db | tail -n +11 | xargs -r rm
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

# Step 2: Test PostgreSQL connection before proceeding
if ! test_postgresql_connection; then
    log_error "Cannot connect to PostgreSQL database. Please verify:"
    echo "   - PostgreSQL is running on $POSTGRES_HOST:$POSTGRES_PORT"
    echo "   - Database '$POSTGRES_DB' exists"
    echo "   - User '$POSTGRES_USER' has access"
    echo "   - Password is correct"
    exit 1
fi

# Step 3: Create PostgreSQL backup before any changes
POSTGRES_BACKUP_FILE=$(create_postgresql_backup)
if [ $? -ne 0 ]; then
    log_warning "PostgreSQL backup failed, but continuing with update"
fi

# ===============================================================================
# HISTORY PLUS MIGRATION
# ===============================================================================

# Step 4: Import History Plus data from pre-exported CSV files
EXPORT_DIR="$REPO_PATH/history-plus-export"

if [ -d "$EXPORT_DIR" ]; then
    log_info "History Plus CSV files found, starting import process..."
    
    # Check if CSV files exist
    CSV_COUNT=$(find "$EXPORT_DIR" -name "*.csv" | wc -l)
    if [ $CSV_COUNT -gt 0 ]; then
        log_info "Found $CSV_COUNT CSV files ready for import"
        
        # Ensure we're in the server directory where dependencies exist
        cd "$REPO_PATH/server"
        
        # Check if Node.js dependencies are installed and install them properly
        log_info "Ensuring Node.js dependencies are properly installed..."
        
        # Always run npm install to ensure dependencies are up to date
        if npm install --production >> "$HISTORY_PLUS_MIGRATION_LOG" 2>&1; then
            log_success "Node.js dependencies installed successfully"
        else
            log_error "npm install failed"
            cat "$HISTORY_PLUS_MIGRATION_LOG" | tail -20
            echo ""
            echo "🔙 TROUBLESHOOTING OPTIONS:"
            echo "   1. Check if Node.js is installed: node --version"
            echo "   2. Check if npm is available: npm --version"
            echo "   3. Try manual installation: cd $REPO_PATH/server && npm install"
            echo "   4. Check package.json exists: ls -la package.json"
            echo ""
            read -p "Continue anyway (dependencies might be pre-installed)? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Migration cancelled due to dependency installation failure"
                cd "$REPO_PATH"
                return 1
            fi
        fi
        
        # Verify Prisma is available
        if ! node -e "require('@prisma/client')" 2>/dev/null; then
            log_error "Prisma client not available - migration cannot proceed"
            echo "Please ensure @prisma/client is installed: npm install @prisma/client"
            cd "$REPO_PATH"
            return 1
        fi
        
        log_success "All dependencies verified and ready"
        
        echo ""
        echo "🔍 IMPORT PROCESS:"
        echo "   📂 Source: Pre-exported CSV files in history-plus-export/"
        echo "   🎯 Target: PostgreSQL ($POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB)"
        echo "   🛡️  SAFE MODE: Only new records will be added, existing PostgreSQL data preserved"
        echo ""
        
        echo "⚠️  FINAL SAFETY CONFIRMATION:"
        echo "   This import will ONLY INSERT new records"
        echo "   Existing PostgreSQL data will NOT be modified"
        echo "   CSV files contain History Plus data ready for import"
        echo ""
        read -p "Proceed with History Plus import to PostgreSQL? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Import cancelled by user (CSV files available for manual import)"
        else
            # Import from CSV to PostgreSQL
            log_info "Importing History Plus data to PostgreSQL..."
            log_info "Current directory: $(pwd)"
            log_info "Database URL: ${DATABASE_URL:0:20}..." # Log partial URL for debugging
            log_info "Export directory: $EXPORT_DIR"
            
            export DATABASE_URL="$DATABASE_URL"
            
            # Run with more detailed logging
            log_info "Running: node import-history-plus-data.js $EXPORT_DIR"
            if echo "y" | node import-history-plus-data.js "$EXPORT_DIR" 2>&1 | tee -a "$HISTORY_PLUS_MIGRATION_LOG"; then
                log_success "History Plus migration completed successfully"
            else
                log_error "History Plus import failed - check log: $HISTORY_PLUS_MIGRATION_LOG"
                echo ""
                echo "� RECENT LOG OUTPUT:"
                tail -20 "$HISTORY_PLUS_MIGRATION_LOG"
                echo ""
                echo "�🔙 ROLLBACK OPTIONS:"
                echo "   1. Check migration log: $HISTORY_PLUS_MIGRATION_LOG"
                if [ -n "$POSTGRES_BACKUP_FILE" ]; then
                    echo "   2. Restore PostgreSQL backup using Docker PostgreSQL container"
                fi
                echo "   3. Retry import manually: cd server && node import-history-plus-data.js ../history-plus-export"
                echo "   4. Continue without migration"
                echo ""
                echo "🔧 DEBUGGING COMMANDS:"
                echo "   - Test Node.js: node --version"
                echo "   - Test Prisma: node -e \"require('@prisma/client')\""
                echo "   - Test database connection: node -e \"console.log(process.env.DATABASE_URL)\""
                echo "   - List CSV files: ls -la ../history-plus-export/"
                echo ""
                read -p "Continue with deployment anyway? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log_error "Deployment cancelled due to migration failure"
                    exit 1
                fi
            fi
        fi
    else
        log_warning "No CSV files found in export directory"
        log_info "Skipping History Plus migration"
    fi
else
    log_info "No History Plus export directory found"
    log_info "Skipping History Plus migration"
fi

# Return to repo root for subsequent operations
cd "$REPO_PATH"

# ===============================================================================
# CONTAINER UPDATE AND DEPLOYMENT
# ===============================================================================

# Step 5: Stop the running container
log_info "Stopping container: $CONTAINER_NAME"
docker stop $CONTAINER_NAME

# Step 6: Remove the container and old image to force clean rebuild
log_info "Removing old container..."
docker rm $CONTAINER_NAME

log_info "Removing old image to force clean rebuild..."
docker rmi $IMAGE_NAME || log_warning "No existing image to remove"

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

# ===============================================================================
# VALIDATION AND COMPLETION
# ===============================================================================

# Step 9: Validate deployment
log_info "Validating deployment..."
sleep 10  # Give container time to start

# Check if container is running
if docker ps | grep -q "$CONTAINER_NAME"; then
    log_success "Container is running"
    
    # Test application health if validation script exists
    if [ -f "$REPO_PATH/validate-deployment.js" ]; then
        log_info "Running deployment validation..."
        if node "$REPO_PATH/validate-deployment.js" "http://localhost:$HOST_PORT" >> "$HISTORY_PLUS_MIGRATION_LOG" 2>&1; then
            log_success "Deployment validation passed"
        else
            log_warning "Deployment validation failed - check logs"
        fi
    else
        log_info "No validation script found, skipping automated tests"
    fi
else
    log_error "Container failed to start"
    exit 1
fi

log_success "Master Order updated successfully on Unraid with History Plus export/import!"
echo "🌐 Application should be available at: http://192.168.1.252:$HOST_PORT"
echo "🗃️  Using PostgreSQL database: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo "💾 Database backups stored at: $BACKUP_DIR"
if [ -n "$POSTGRES_BACKUP_FILE" ]; then
    echo "🔙 PostgreSQL backup: $(basename "$POSTGRES_BACKUP_FILE")"
fi
echo "📋 Migration log: $HISTORY_PLUS_MIGRATION_LOG"
echo ""
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 To check logs: docker logs $CONTAINER_NAME"
echo "📝 To access container: docker exec -it $CONTAINER_NAME /bin/sh"
echo "📁 Database backups location: $BACKUP_DIR"
echo "📋 History Plus migration log: $HISTORY_PLUS_MIGRATION_LOG"