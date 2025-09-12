#!/bin/bash

# Data Validation Script
# Validates imported data integrity and completeness

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

TARGET_ENV="${1:-local}"
VALIDATION_LEVEL="${2:-basic}"

if [ "$TARGET_ENV" != "local" ] && [ "$TARGET_ENV" != "production" ]; then
    print_error "Usage: $0 <local|production> [basic|full]"
    exit 1
fi

print_status "Master Order Data Validation"
print_status "Target: $TARGET_ENV"
print_status "Level: $VALIDATION_LEVEL"

# Database query function
execute_query() {
    local query="$1"
    local description="$2"
    
    if [ "$TARGET_ENV" = "local" ]; then
        sqlite3 "$PROJECT_ROOT/master_order.db" "$query" 2>/dev/null || echo "ERROR"
    else
        docker exec master-order-postgres psql -U postgres master_order -t -c "$query" 2>/dev/null | tr -d ' ' || echo "ERROR"
    fi
}

# Basic validation tests
print_status "Running basic validation tests..."
echo "=================================="

# Test 1: Database accessibility
print_status "Test 1: Database Connection"
if [ "$TARGET_ENV" = "local" ]; then
    if [ -f "$PROJECT_ROOT/master_order.db" ]; then
        TEST_RESULT=$(sqlite3 "$PROJECT_ROOT/master_order.db" "SELECT 1;" 2>/dev/null || echo "ERROR")
        if [ "$TEST_RESULT" = "1" ]; then
            print_success "SQLite database accessible"
        else
            print_error "SQLite database connection failed"
            exit 1
        fi
    else
        print_error "SQLite database file not found"
        exit 1
    fi
else
    if docker ps | grep -q master-order-postgres; then
        TEST_RESULT=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT 1;" 2>/dev/null | tr -d ' ' || echo "ERROR")
        if [ "$TEST_RESULT" = "1" ]; then
            print_success "PostgreSQL database accessible"
        else
            print_error "PostgreSQL database connection failed"
            exit 1
        fi
    else
        print_error "PostgreSQL container not running"
        exit 1
    fi
fi

# Test 2: Core tables existence
print_status "Test 2: Core Tables"
CORE_TABLES=("orders" "episodes" "movies" "settings")

for table in "${CORE_TABLES[@]}"; do
    if [ "$TARGET_ENV" = "local" ]; then
        TABLE_EXISTS=$(sqlite3 "$PROJECT_ROOT/master_order.db" ".tables" | grep -c "$table" || echo "0")
    else
        TABLE_EXISTS=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='$table';" | tr -d ' ')
    fi
    
    if [ "$TABLE_EXISTS" -gt 0 ]; then
        print_success "Table '$table' exists"
    else
        print_warning "Table '$table' missing"
    fi
done

# Test 3: Record counts
print_status "Test 3: Record Counts"
for table in "${CORE_TABLES[@]}"; do
    RECORD_COUNT=$(execute_query "SELECT COUNT(*) FROM $table;" "Count records in $table")
    if [ "$RECORD_COUNT" != "ERROR" ]; then
        print_status "$table: $RECORD_COUNT records"
    else
        print_warning "$table: Unable to count records (table may not exist)"
    fi
done

# Test 4: Data integrity checks
print_status "Test 4: Data Integrity"

# Check for NULL values in required fields
INTEGRITY_ISSUES=0

# Orders table checks
ORDERS_WITHOUT_TITLE=$(execute_query "SELECT COUNT(*) FROM orders WHERE title IS NULL OR title = '';" "Orders without title")
if [ "$ORDERS_WITHOUT_TITLE" != "ERROR" ] && [ "$ORDERS_WITHOUT_TITLE" -gt 0 ]; then
    print_warning "Found $ORDERS_WITHOUT_TITLE orders without titles"
    INTEGRITY_ISSUES=$((INTEGRITY_ISSUES + 1))
fi

# Episodes table checks
EPISODES_WITHOUT_SHOW=$(execute_query "SELECT COUNT(*) FROM episodes WHERE showTitle IS NULL OR showTitle = '';" "Episodes without show")
if [ "$EPISODES_WITHOUT_SHOW" != "ERROR" ] && [ "$EPISODES_WITHOUT_SHOW" -gt 0 ]; then
    print_warning "Found $EPISODES_WITHOUT_SHOW episodes without show titles"
    INTEGRITY_ISSUES=$((INTEGRITY_ISSUES + 1))
fi

if [ "$INTEGRITY_ISSUES" -eq 0 ]; then
    print_success "No major data integrity issues found"
else
    print_warning "Found $INTEGRITY_ISSUES potential data integrity issues"
fi

# Full validation (if requested)
if [ "$VALIDATION_LEVEL" = "full" ]; then
    print_status "Running full validation tests..."
    echo "================================="
    
    # Test 5: Foreign key relationships
    print_status "Test 5: Foreign Key Relationships"
    
    # Check order-episode relationships
    ORPHANED_EPISODES=$(execute_query "SELECT COUNT(*) FROM episodes WHERE orderId NOT IN (SELECT id FROM orders);" "Orphaned episodes")
    if [ "$ORPHANED_EPISODES" != "ERROR" ] && [ "$ORPHANED_EPISODES" -gt 0 ]; then
        print_warning "Found $ORPHANED_EPISODES orphaned episodes"
    else
        print_success "All episodes have valid order references"
    fi
    
    # Test 6: Data consistency
    print_status "Test 6: Data Consistency"
    
    # Check for duplicate orders
    DUPLICATE_ORDERS=$(execute_query "SELECT COUNT(*) - COUNT(DISTINCT title) FROM orders;" "Duplicate orders")
    if [ "$DUPLICATE_ORDERS" != "ERROR" ] && [ "$DUPLICATE_ORDERS" -gt 0 ]; then
        print_warning "Found $DUPLICATE_ORDERS potential duplicate orders"
    else
        print_success "No duplicate orders detected"
    fi
    
    # Test 7: Settings validation
    print_status "Test 7: Settings Validation"
    
    SETTINGS_COUNT=$(execute_query "SELECT COUNT(*) FROM settings;" "Settings count")
    if [ "$SETTINGS_COUNT" != "ERROR" ]; then
        if [ "$SETTINGS_COUNT" -eq 1 ]; then
            print_success "Settings table properly configured"
        elif [ "$SETTINGS_COUNT" -gt 1 ]; then
            print_warning "Multiple settings records found (expected 1)"
        else
            print_warning "No settings record found"
        fi
    fi
    
    # Test 8: Watch progress validation
    print_status "Test 8: Watch Progress"
    
    WATCH_PROGRESS_COUNT=$(execute_query "SELECT COUNT(*) FROM episodes WHERE watched = 1;" "Watched episodes")
    if [ "$WATCH_PROGRESS_COUNT" != "ERROR" ]; then
        print_status "Watched episodes: $WATCH_PROGRESS_COUNT"
    fi
    
    # Test 9: Custom orders validation
    print_status "Test 9: Custom Orders"
    
    CUSTOM_ORDERS=$(execute_query "SELECT COUNT(*) FROM orders WHERE customOrder = 1;" "Custom orders")
    if [ "$CUSTOM_ORDERS" != "ERROR" ]; then
        print_status "Custom orders: $CUSTOM_ORDERS"
    fi
fi

# Performance tests
print_status "Performance Check"
echo "=================="

# Database size
if [ "$TARGET_ENV" = "local" ]; then
    DB_SIZE=$(ls -lh "$PROJECT_ROOT/master_order.db" | awk '{print $5}')
    print_status "Database size: $DB_SIZE"
else
    DB_SIZE=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT pg_size_pretty(pg_database_size('master_order'));" | tr -d ' ')
    print_status "Database size: $DB_SIZE"
fi

# Index usage (simplified check)
if [ "$TARGET_ENV" = "production" ]; then
    INDEX_COUNT=$(docker exec master-order-postgres psql -U postgres master_order -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public';" | tr -d ' ')
    print_status "Indexes: $INDEX_COUNT"
fi

# Summary
print_status "Validation Summary"
echo "=================="

if [ "$INTEGRITY_ISSUES" -eq 0 ]; then
    print_success "All validation tests passed!"
else
    print_warning "Validation completed with $INTEGRITY_ISSUES warnings"
fi

# Recommendations
print_status "Recommendations:"
echo "1. Start the application and test core functionality"
echo "2. Check that all features work as expected"
echo "3. Verify API keys and external service connections"
echo "4. Test custom order functionality"
echo "5. Verify watch progress tracking"

if [ "$INTEGRITY_ISSUES" -gt 0 ]; then
    echo "6. Review and fix data integrity issues identified above"
fi

if [ "$TARGET_ENV" = "local" ]; then
    echo "7. Start development server: npm run dev"
else
    echo "7. Monitor production logs: docker logs master-order"
fi

print_success "Data validation completed!"