#!/bin/bash

# PostgreSQL to SQLite Data Import Script
# Converts PostgreSQL dump files to SQLite compatible format

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
SOURCE_SQL="$1"
OUTPUT_SQL="${2:-master_order_sqlite_converted.sql}"
BACKUP_SUFFIX="backup_$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate input
if [ -z "$SOURCE_SQL" ] || [ ! -f "$SOURCE_SQL" ]; then
    print_error "Usage: $0 <source_postgres_dump.sql> [output_sqlite.sql]"
    print_error "Source SQL file is required and must exist"
    exit 1
fi

print_status "Starting PostgreSQL to SQLite conversion..."
print_status "Source: $SOURCE_SQL"
print_status "Output: $OUTPUT_SQL"

# Backup existing SQLite database if it exists
if [ -f "$PROJECT_ROOT/master_order.db" ]; then
    print_status "Backing up existing SQLite database..."
    cp "$PROJECT_ROOT/master_order.db" "$PROJECT_ROOT/master_order_${BACKUP_SUFFIX}.db"
    print_success "Backup created: master_order_${BACKUP_SUFFIX}.db"
fi

# Create temporary working file
TEMP_SQL="/tmp/postgres_to_sqlite_temp.sql"
cp "$SOURCE_SQL" "$TEMP_SQL"

print_status "Converting PostgreSQL syntax to SQLite..."

# PostgreSQL to SQLite conversions
sed -i 's/SERIAL PRIMARY KEY/INTEGER PRIMARY KEY AUTOINCREMENT/g' "$TEMP_SQL"
sed -i 's/SERIAL/INTEGER/g' "$TEMP_SQL"
sed -i 's/BIGSERIAL/INTEGER/g' "$TEMP_SQL"
sed -i 's/BOOLEAN/INTEGER/g' "$TEMP_SQL"
sed -i 's/TRUE/1/g' "$TEMP_SQL"
sed -i 's/FALSE/0/g' "$TEMP_SQL"
sed -i 's/TIMESTAMP WITH TIME ZONE/TEXT/g' "$TEMP_SQL"
sed -i 's/TIMESTAMP WITHOUT TIME ZONE/TEXT/g' "$TEMP_SQL"
sed -i 's/TIMESTAMP/TEXT/g' "$TEMP_SQL"
sed -i 's/JSONB/TEXT/g' "$TEMP_SQL"
sed -i 's/JSON/TEXT/g' "$TEMP_SQL"
sed -i 's/UUID/TEXT/g' "$TEMP_SQL"

# Remove PostgreSQL-specific syntax
sed -i '/^SET /d' "$TEMP_SQL"
sed -i '/^SELECT pg_catalog/d' "$TEMP_SQL"
sed -i '/^--.*PostgreSQL/d' "$TEMP_SQL"
sed -i '/^\\connect/d' "$TEMP_SQL"
sed -i '/^CREATE EXTENSION/d' "$TEMP_SQL"
sed -i '/^DROP EXTENSION/d' "$TEMP_SQL"
sed -i '/^COMMENT ON/d' "$TEMP_SQL"
sed -i '/^ALTER DEFAULT PRIVILEGES/d' "$TEMP_SQL"
sed -i '/^GRANT /d' "$TEMP_SQL"
sed -i '/^REVOKE /d' "$TEMP_SQL"

# Fix sequence-related issues
sed -i '/^CREATE SEQUENCE/d' "$TEMP_SQL"
sed -i '/^DROP SEQUENCE/d' "$TEMP_SQL"
sed -i '/^ALTER SEQUENCE/d' "$TEMP_SQL"
sed -i 's/nextval([^)]*)/NULL/g' "$TEMP_SQL"

# Remove schema qualifiers
sed -i 's/public\.//g' "$TEMP_SQL"

# Fix constraint syntax
sed -i 's/CONSTRAINT [a-zA-Z0-9_]* //g' "$TEMP_SQL"

# Convert double quotes to single quotes for string literals
sed -i 's/E'"'"'/'"'"'/g' "$TEMP_SQL"

print_status "Filtering out unsupported statements..."

# Create a clean version without problematic statements
cat "$TEMP_SQL" | grep -v '^\\' | grep -v '^COPY ' | grep -v '^SELECT setval' > "$OUTPUT_SQL"

print_status "Adding SQLite-specific optimizations..."

# Add SQLite pragmas for better performance during import
cat > "/tmp/sqlite_header.sql" << 'EOF'
-- SQLite import optimizations
PRAGMA foreign_keys = OFF;
PRAGMA synchronous = OFF;
PRAGMA journal_mode = MEMORY;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = 1000000;

-- Begin transaction for faster import
BEGIN TRANSACTION;

EOF

# Add closing transaction
echo "COMMIT;" > "/tmp/sqlite_footer.sql"
echo "PRAGMA foreign_keys = ON;" >> "/tmp/sqlite_footer.sql"
echo "PRAGMA synchronous = NORMAL;" >> "/tmp/sqlite_footer.sql"
echo "PRAGMA journal_mode = WAL;" >> "/tmp/sqlite_footer.sql"

# Combine header, converted SQL, and footer
cat "/tmp/sqlite_header.sql" "$OUTPUT_SQL" "/tmp/sqlite_footer.sql" > "/tmp/final_sqlite.sql"
mv "/tmp/final_sqlite.sql" "$OUTPUT_SQL"

print_success "Conversion completed: $OUTPUT_SQL"

# Clean up temporary files
rm -f "$TEMP_SQL" "/tmp/sqlite_header.sql" "/tmp/sqlite_footer.sql"

print_status "Validating converted SQL..."

# Basic validation
if [ ! -s "$OUTPUT_SQL" ]; then
    print_error "Output file is empty!"
    exit 1
fi

# Count tables and inserts
TABLE_COUNT=$(grep -c "^CREATE TABLE" "$OUTPUT_SQL" || echo "0")
INSERT_COUNT=$(grep -c "^INSERT INTO" "$OUTPUT_SQL" || echo "0")

print_success "Validation results:"
echo "  - Tables: $TABLE_COUNT"
echo "  - Insert statements: $INSERT_COUNT"
echo "  - File size: $(ls -lh "$OUTPUT_SQL" | awk '{print $5}')"

print_status "Next steps:"
echo "1. Review the converted SQL file: $OUTPUT_SQL"
echo "2. Test import with: sqlite3 master_order.db < $OUTPUT_SQL"
echo "3. Run application tests to verify data integrity"

print_warning "Important notes:"
echo "- Review the converted file for any PostgreSQL-specific syntax that may remain"
echo "- Test with a copy of your database first"
echo "- Some data types may need manual adjustment"
echo "- Foreign key constraints are disabled during import"

print_success "Conversion script completed successfully!"