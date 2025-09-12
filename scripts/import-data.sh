#!/bin/bash

# Data Import Script for Master Order
# Imports data from hosted PostgreSQL to local SQLite or production PostgreSQL

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Default configuration
TARGET_ENV=""
SOURCE_CONNECTION=""
BACKUP_ENABLED="true"
FORCE_IMPORT="false"
TABLES_ONLY=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET_ENV="$2"
            shift 2
            ;;
        --source)
            SOURCE_CONNECTION="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_ENABLED="false"
            shift
            ;;
        --force)
            FORCE_IMPORT="true"
            shift
            ;;
        --tables)
            TABLES_ONLY="$2"
            shift 2
            ;;
        --help)
            cat << 'EOF'
Master Order Data Import Script

USAGE:
    ./import-data.sh --target <env> --source <connection> [options]

ARGUMENTS:
    --target ENV        Target environment: 'local' or 'production'
    --source CONNECTION Source database connection string

OPTIONS:
    --no-backup         Skip backup creation before import
    --force             Force import without confirmation prompts
    --tables LIST       Import only specific tables (comma-separated)
    --help              Show this help message

EXAMPLES:
    # Import to local SQLite from hosted PostgreSQL
    ./import-data.sh --target local --source "postgresql://user:pass@host:5432/db"

    # Import to production PostgreSQL
    ./import-data.sh --target production --source "postgresql://user:pass@host:5432/db"

    # Import specific tables only
    ./import-data.sh --target local --source "postgresql://..." --tables "orders,episodes,movies"

ENVIRONMENT SETUP:
    Create .env.import with your source database credentials:
    IMPORT_HOST=your-host.com
    IMPORT_USER=your-username
    IMPORT_PASSWORD=your-password
    IMPORT_DATABASE=your-database
    IMPORT_PORT=5432

EOF
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required arguments
if [ -z "$TARGET_ENV" ] || [ -z "$SOURCE_CONNECTION" ]; then
    print_error "Missing required arguments"
    echo "Use --help for usage information"
    exit 1
fi

if [ "$TARGET_ENV" != "local" ] && [ "$TARGET_ENV" != "production" ]; then
    print_error "Target environment must be 'local' or 'production'"
    exit 1
fi

print_status "Master Order Data Import"
print_status "Target: $TARGET_ENV"
print_status "Source: $SOURCE_CONNECTION"

# Load import environment if exists
if [ -f "$PROJECT_ROOT/.env.import" ]; then
    print_status "Loading import configuration..."
    source "$PROJECT_ROOT/.env.import"
fi

# Create backup if enabled
if [ "$BACKUP_ENABLED" = "true" ]; then
    print_status "Creating backup before import..."
    
    if [ "$TARGET_ENV" = "local" ]; then
        if [ -f "$PROJECT_ROOT/master_order.db" ]; then
            BACKUP_FILE="$PROJECT_ROOT/master_order_backup_$(date +%Y%m%d_%H%M%S).db"
            cp "$PROJECT_ROOT/master_order.db" "$BACKUP_FILE"
            print_success "Local backup created: $(basename "$BACKUP_FILE")"
        fi
    else
        # Production backup
        if command -v docker &> /dev/null && docker ps | grep -q master-order-postgres; then
            BACKUP_FILE="$PROJECT_ROOT/master_order_prod_backup_$(date +%Y%m%d_%H%M%S).sql"
            docker exec master-order-postgres pg_dump -U postgres master_order > "$BACKUP_FILE"
            print_success "Production backup created: $(basename "$BACKUP_FILE")"
        else
            print_warning "Could not create production backup - Docker container not running"
        fi
    fi
fi

# Export data from source
print_status "Exporting data from source database..."
EXPORT_FILE="/tmp/master_order_export_$(date +%Y%m%d_%H%M%S).sql"

if [ -n "$TABLES_ONLY" ]; then
    # Export specific tables
    TABLE_ARGS=""
    IFS=',' read -ra TABLES <<< "$TABLES_ONLY"
    for table in "${TABLES[@]}"; do
        TABLE_ARGS="$TABLE_ARGS --table=$table"
    done
    
    pg_dump "$SOURCE_CONNECTION" $TABLE_ARGS --data-only --disable-triggers > "$EXPORT_FILE"
    print_success "Exported tables: $TABLES_ONLY"
else
    # Export all data
    pg_dump "$SOURCE_CONNECTION" --clean --if-exists --disable-triggers > "$EXPORT_FILE"
    print_success "Exported complete database"
fi

# Validate export
if [ ! -s "$EXPORT_FILE" ]; then
    print_error "Export failed - file is empty"
    exit 1
fi

EXPORT_SIZE=$(ls -lh "$EXPORT_FILE" | awk '{print $5}')
print_status "Export file size: $EXPORT_SIZE"

# Import based on target environment
if [ "$TARGET_ENV" = "local" ]; then
    print_status "Converting PostgreSQL export to SQLite format..."
    
    # Convert to SQLite format
    SQLITE_FILE="/tmp/master_order_sqlite_$(date +%Y%m%d_%H%M%S).sql"
    "$SCRIPT_DIR/convert-postgres-to-sqlite.sh" "$EXPORT_FILE" "$SQLITE_FILE"
    
    if [ ! -s "$SQLITE_FILE" ]; then
        print_error "SQLite conversion failed"
        exit 1
    fi
    
    # Import to SQLite
    print_status "Importing to local SQLite database..."
    cd "$PROJECT_ROOT"
    
    # Setup SQLite schema if needed
    npm run setup-schema:sqlite
    
    # Import data
    sqlite3 master_order.db < "$SQLITE_FILE"
    print_success "Import to SQLite completed"
    
    # Cleanup
    rm -f "$SQLITE_FILE"
    
else
    # Production PostgreSQL import
    print_status "Importing to production PostgreSQL..."
    
    if ! docker ps | grep -q master-order-postgres; then
        print_error "Production PostgreSQL container is not running"
        exit 1
    fi
    
    # Import to production PostgreSQL
    docker exec -i master-order-postgres psql -U postgres master_order < "$EXPORT_FILE"
    print_success "Import to production PostgreSQL completed"
fi

# Cleanup export file
rm -f "$EXPORT_FILE"

# Validate import
print_status "Validating imported data..."

if [ "$TARGET_ENV" = "local" ]; then
    # SQLite validation
    RECORD_COUNT=$(sqlite3 master_order.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    print_status "Tables imported: $RECORD_COUNT"
    
    # Check for data in main tables
    for table in orders episodes movies; do
        if sqlite3 master_order.db ".tables" | grep -q "$table"; then
            COUNT=$(sqlite3 master_order.db "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
            print_status "$table: $COUNT records"
        fi
    done
else
    # PostgreSQL validation
    TABLE_COUNT=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
    print_status "Tables imported: $(echo $TABLE_COUNT | tr -d ' ')"
    
    # Check for data in main tables
    for table in orders episodes movies; do
        COUNT=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")
        print_status "$table: $COUNT records"
    done
fi

print_success "Data import completed successfully!"

print_status "Post-import recommendations:"
echo "1. Test the application to ensure all features work correctly"
echo "2. Verify data integrity by checking key records"
echo "3. Update any API keys or settings that may have been overwritten"
echo "4. Consider running database optimization/vacuum"
echo "5. Setup regular backups for the imported data"

if [ "$TARGET_ENV" = "local" ]; then
    echo "6. Start the development server: npm run dev"
else
    echo "6. Restart the production container: docker-compose restart"
fi

print_warning "Remember to test thoroughly before using in production!"