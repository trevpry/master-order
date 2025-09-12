#!/bin/bash

# Production Backup and Rollback Scripts for History Plus Deployment
# Ensures data safety during PostgreSQL production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
POSTGRES_BACKUP_FILE="$BACKUP_DIR/postgresql_backup_$TIMESTAMP.sql"
SQLITE_BACKUP_FILE="$BACKUP_DIR/sqlite_backup_$TIMESTAMP.db"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

create_backup_directory() {
    log_info "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    log_success "Backup directory created: $BACKUP_DIR"
}

backup_sqlite_database() {
    log_info "Creating SQLite database backup..."
    
    if [ -f "master_order.db" ]; then
        cp "master_order.db" "$SQLITE_BACKUP_FILE"
        log_success "SQLite backup created: $SQLITE_BACKUP_FILE"
    else
        log_warning "SQLite database not found, skipping SQLite backup"
    fi
}

backup_postgresql_database() {
    log_info "Creating PostgreSQL database backup..."
    
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable not set"
        exit 1
    fi
    
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools"
        exit 1
    fi
    
    log_info "Running pg_dump..."
    pg_dump "$DATABASE_URL" > "$POSTGRES_BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "PostgreSQL backup created: $POSTGRES_BACKUP_FILE"
    else
        log_error "PostgreSQL backup failed"
        exit 1
    fi
}

verify_backup_integrity() {
    log_info "Verifying backup integrity..."
    
    # Check PostgreSQL backup
    if [ -f "$POSTGRES_BACKUP_FILE" ]; then
        if [ -s "$POSTGRES_BACKUP_FILE" ]; then
            log_success "PostgreSQL backup file is valid and non-empty"
        else
            log_error "PostgreSQL backup file is empty"
            exit 1
        fi
    fi
    
    # Check SQLite backup
    if [ -f "$SQLITE_BACKUP_FILE" ]; then
        if [ -s "$SQLITE_BACKUP_FILE" ]; then
            log_success "SQLite backup file is valid and non-empty"
        else
            log_error "SQLite backup file is empty"
            exit 1
        fi
    fi
}

create_rollback_script() {
    local rollback_script="$BACKUP_DIR/rollback_$TIMESTAMP.sh"
    
    log_info "Creating rollback script..."
    
    cat > "$rollback_script" << EOF
#!/bin/bash

# Rollback script generated on $TIMESTAMP
# Use this script to restore from backup if deployment fails

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "\${YELLOW}ℹ️  \$1\${NC}"
}

log_success() {
    echo -e "\${GREEN}✅ \$1\${NC}"
}

log_error() {
    echo -e "\${RED}❌ \$1\${NC}"
}

echo "🔙 Starting rollback process..."

# Stop Docker containers
log_info "Stopping Docker containers..."
docker-compose -f docker-compose.external-db.yml down || docker-compose down || true

# Restore PostgreSQL database
if [ -f "$POSTGRES_BACKUP_FILE" ]; then
    log_info "Restoring PostgreSQL database from backup..."
    
    if [ -z "\$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable not set"
        exit 1
    fi
    
    # Drop and recreate database (be careful!)
    log_warning "This will DROP the current database. Press Ctrl+C to abort in 10 seconds..."
    sleep 10
    
    psql "\$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
    psql "\$DATABASE_URL" < "$POSTGRES_BACKUP_FILE"
    
    log_success "PostgreSQL database restored from backup"
else
    log_error "PostgreSQL backup file not found: $POSTGRES_BACKUP_FILE"
    exit 1
fi

# Restart containers
log_info "Restarting Docker containers..."
docker-compose -f docker-compose.external-db.yml up -d

log_success "Rollback completed successfully!"
log_info "Please verify that the application is working correctly"

EOF

    chmod +x "$rollback_script"
    log_success "Rollback script created: $rollback_script"
}

display_summary() {
    echo ""
    log_success "=== BACKUP SUMMARY ==="
    echo "Timestamp: $TIMESTAMP"
    echo "PostgreSQL Backup: $POSTGRES_BACKUP_FILE"
    echo "SQLite Backup: $SQLITE_BACKUP_FILE"
    echo "Rollback Script: $BACKUP_DIR/rollback_$TIMESTAMP.sh"
    echo ""
    log_info "NEXT STEPS:"
    echo "1. Run the History Plus data migration: node migrate-history-plus-data.js"
    echo "2. Deploy with: docker-compose -f docker-compose.external-db.yml up -d"
    echo "3. Test all functionality thoroughly"
    echo "4. If issues occur, run the rollback script"
    echo ""
}

# Main execution
main() {
    log_info "🚀 Starting production backup process..."
    
    create_backup_directory
    backup_sqlite_database
    backup_postgresql_database
    verify_backup_integrity
    create_rollback_script
    display_summary
    
    log_success "✅ Production backup process completed successfully!"
}

# Execute main function
main "$@"