#!/bin/bash

# Schema Comparison Script
# Compares source database schema with current Master Order schema

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

SOURCE_CONNECTION="$1"
COMPARISON_TYPE="${2:-full}"

if [ -z "$SOURCE_CONNECTION" ]; then
    print_error "Usage: $0 <source_database_url> [comparison_type]"
    echo "comparison_type: 'full' (default), 'tables', 'columns'"
    exit 1
fi

print_status "Master Order Schema Comparison"
print_status "Source: $SOURCE_CONNECTION"
print_status "Comparison type: $COMPARISON_TYPE"

# Create temporary files for schema dumps
SOURCE_SCHEMA="/tmp/source_schema.sql"
TARGET_SCHEMA="/tmp/target_schema.sql"

# Export source schema
print_status "Exporting source database schema..."
pg_dump "$SOURCE_CONNECTION" --schema-only --no-owner --no-privileges > "$SOURCE_SCHEMA"

if [ ! -s "$SOURCE_SCHEMA" ]; then
    print_error "Failed to export source schema"
    exit 1
fi

# Generate current Master Order schema
print_status "Generating current Master Order schema..."
cd "$PROJECT_ROOT/server"

# Use Prisma to generate schema
npx prisma db push --preview-feature --accept-data-loss --skip-generate 2>/dev/null || true
npx prisma db execute --file=<(echo "SELECT 1;") --schema=schema.postgresql.prisma 2>/dev/null || true

# Export current schema (assuming PostgreSQL format)
if [ -f "schema.postgresql.prisma" ]; then
    # Generate SQL from Prisma schema
    npx prisma generate --schema=schema.postgresql.prisma
    npx prisma db push --schema=schema.postgresql.prisma --preview-feature --accept-data-loss 2>/dev/null || true
fi

# For now, let's extract table information from Prisma schema
print_status "Extracting table information from Prisma schema..."

# Extract table names from Prisma schema
SOURCE_TABLES=$(grep -E "^CREATE TABLE" "$SOURCE_SCHEMA" | sed 's/CREATE TABLE //g' | sed 's/ (.*//g' | sort)
CURRENT_TABLES=$(grep -E "^model " "$PROJECT_ROOT/server/prisma/schema.prisma" | sed 's/model //g' | sed 's/ {.*//g' | sort)

print_status "Table Comparison:"
echo "===================="

# Compare tables
echo "Source Tables:"
echo "$SOURCE_TABLES" | sed 's/^/  - /'
echo ""
echo "Current Tables:"
echo "$CURRENT_TABLES" | sed 's/^/  - /'
echo ""

# Find missing tables
MISSING_IN_CURRENT=$(comm -23 <(echo "$SOURCE_TABLES") <(echo "$CURRENT_TABLES"))
MISSING_IN_SOURCE=$(comm -13 <(echo "$SOURCE_TABLES") <(echo "$CURRENT_TABLES"))

if [ -n "$MISSING_IN_CURRENT" ]; then
    print_warning "Tables in source but not in current:"
    echo "$MISSING_IN_CURRENT" | sed 's/^/  - /'
    echo ""
fi

if [ -n "$MISSING_IN_SOURCE" ]; then
    print_warning "Tables in current but not in source:"
    echo "$MISSING_IN_SOURCE" | sed 's/^/  - /'
    echo ""
fi

# Detailed column comparison if requested
if [ "$COMPARISON_TYPE" = "full" ] || [ "$COMPARISON_TYPE" = "columns" ]; then
    print_status "Detailed Column Analysis:"
    echo "========================="
    
    # Common tables
    COMMON_TABLES=$(comm -12 <(echo "$SOURCE_TABLES") <(echo "$CURRENT_TABLES"))
    
    for table in $COMMON_TABLES; do
        print_status "Analyzing table: $table"
        
        # Extract columns from source schema
        SOURCE_COLUMNS=$(grep -A 50 "CREATE TABLE $table" "$SOURCE_SCHEMA" | sed -n '/CREATE TABLE/,/);/p' | grep -E "^\s*[a-zA-Z]" | sed 's/^\s*//g' | sed 's/,.*//g' | head -n -1)
        
        # Extract columns from Prisma schema (this is simplified)
        PRISMA_MODEL=$(grep -A 50 "^model $table" "$PROJECT_ROOT/server/prisma/schema.prisma" | sed -n '/^model/,/^}/p' | grep -E "^\s*[a-zA-Z]" | sed 's/^\s*//g' | sed 's/\s.*//g' | head -n -1)
        
        echo "  Source columns: $(echo "$SOURCE_COLUMNS" | wc -l)"
        echo "  Current columns: $(echo "$PRISMA_MODEL" | wc -l)"
        
        # This is a simplified comparison - in practice, you'd want more detailed column analysis
        echo ""
    done
fi

# Generate migration suggestions
print_status "Migration Recommendations:"
echo "=========================="

if [ -n "$MISSING_IN_CURRENT" ]; then
    echo "1. Add missing tables to Prisma schema:"
    for table in $MISSING_IN_CURRENT; do
        echo "   - model $table { ... }"
    done
    echo ""
fi

if [ -n "$MISSING_IN_SOURCE" ]; then
    echo "2. Consider whether these new tables are needed:"
    for table in $MISSING_IN_SOURCE; do
        echo "   - $table (only in current schema)"
    done
    echo ""
fi

echo "3. After schema updates, run:"
echo "   cd server"
echo "   npx prisma migrate dev --name 'import-compatibility'"
echo "   npx prisma generate"
echo ""

echo "4. Test the migration:"
echo "   npm run prisma:migrate:dev"
echo "   npm run test"

# Generate sample migration file
MIGRATION_FILE="/tmp/import_compatibility_migration.sql"
cat > "$MIGRATION_FILE" << 'EOF'
-- Import Compatibility Migration
-- Generated by schema comparison script

-- Add any missing tables or columns here
-- Example:
-- ALTER TABLE existing_table ADD COLUMN new_column TEXT;
-- CREATE TABLE new_table (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   name TEXT NOT NULL
-- );

EOF

if [ -n "$MISSING_IN_CURRENT" ]; then
    echo "-- Missing tables from source:" >> "$MIGRATION_FILE"
    for table in $MISSING_IN_CURRENT; do
        echo "-- TODO: Add model $table to schema.prisma" >> "$MIGRATION_FILE"
    done
    echo "" >> "$MIGRATION_FILE"
fi

print_status "Sample migration file created: $MIGRATION_FILE"

# Cleanup
rm -f "$SOURCE_SCHEMA"

print_success "Schema comparison completed!"
print_warning "Review the recommendations above before proceeding with data import"