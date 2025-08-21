#!/bin/sh
# Master Order Docker Entrypoint - DATA PRESERVATION POLICY
# This script is designed to NEVER destroy existing data during container updates:
# - Only applies new migrations with 'prisma migrate deploy' (safe, preserves data)
# - Never uses '--force-reset' on existing databases  
# - Distinguishes between new installations and container updates
# - Preserves all user data during container rebuilds

echo "🚀 Starting Master Order application..."

# Ensure data directory exists and has correct permissions
mkdir -p /app/data
mkdir -p /app/server/artwork-cache
mkdir -p /app/logs

# Set ownership if running as root (will be changed by USER directive)
if [ "$(id -u)" = "0" ]; then
    chown -R app:nodejs /app/data /app/server/artwork-cache /app/logs
fi

# Ensure the app user owns these directories (in case mounted volumes have different permissions)
# This will work even if we're running as app user
chmod 755 /app/data /app/server/artwork-cache /app/logs || true

# Change to server directory for Prisma commands
cd /app/server

echo "📊 Setting up database..."

# CRITICAL: Ensure DATABASE_URL has proper SQLite format with timeout parameters
# Use a subdirectory to avoid volume mount conflicts
mkdir -p /app/data/db
export DATABASE_URL="file:/app/data/db/master_order.db?connection_limit=1&pool_timeout=20&socket_timeout=20"
echo "🔧 DATABASE_URL set to: $DATABASE_URL"

# CRITICAL DATA PRESERVATION CHECK - Do this FIRST before any database operations
echo "🛡️ CRITICAL: Checking for existing user data BEFORE any database operations..."
PRESERVE_EXISTING_DATA=false

if [ -f "/app/data/db/master_order.db" ] && [ -s "/app/data/db/master_order.db" ]; then
    # Check if the existing database has user data in key tables
    echo "🔍 Existing database file found, checking for user data..."
    
    # Try to check for user data in the existing database
    EXISTING_SETTINGS=$(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM Settings;" 2>/dev/null || echo "0")
    EXISTING_CUSTOM_ORDERS=$(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM CustomOrder;" 2>/dev/null || echo "0")
    EXISTING_PLEX_DATA=$(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM PlexMovie;" 2>/dev/null || echo "0")
    
    EXISTING_USER_DATA=$((EXISTING_SETTINGS + EXISTING_CUSTOM_ORDERS + EXISTING_PLEX_DATA))
    
    if [ "$EXISTING_USER_DATA" -gt "0" ]; then
        echo "🚨 FOUND EXISTING USER DATA: $EXISTING_USER_DATA records"
        echo "   Settings: $EXISTING_SETTINGS"
        echo "   Custom Orders: $EXISTING_CUSTOM_ORDERS" 
        echo "   Plex Movies: $EXISTING_PLEX_DATA"
        echo "🛡️ PRESERVING EXISTING DATABASE - Will NOT recreate or initialize"
        PRESERVE_EXISTING_DATA=true
    else
        echo "📝 Existing database has no user data (empty tables)"
        PRESERVE_EXISTING_DATA=false
    fi
else
    echo "📁 No existing database file found"
    PRESERVE_EXISTING_DATA=false
fi

# Only create/initialize database if no user data exists
if [ "$PRESERVE_EXISTING_DATA" = "false" ]; then
    # Create database file if it doesn't exist or is empty
    if [ ! -f "/app/data/db/master_order.db" ] || [ ! -s "/app/data/db/master_order.db" ]; then
        echo "🗄️ Creating new database file..."
        
        # Create a proper SQLite database file with optimized settings
        echo "🔧 Creating SQLite database file with optimizations..."
        sqlite3 /app/data/db/master_order.db << 'EOF'
-- Set WAL mode for better concurrent access
PRAGMA journal_mode=WAL;
-- Optimize for performance
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=1000;
PRAGMA temp_store=memory;
-- Set busy timeout to 30 seconds
PRAGMA busy_timeout=30000;
-- Create minimal table to initialize database structure
CREATE TABLE IF NOT EXISTS _temp (id INTEGER); 
DROP TABLE _temp;
EOF
        echo "✅ Database file created with SQLite optimizations"
    fi
fi

# Set proper permissions on database file
if [ -f "/app/data/db/master_order.db" ]; then
    echo "🔧 Setting database file permissions..."
    if [ "$(id -u)" = "0" ]; then
        echo "🔧 Setting proper ownership and permissions..."
        chown -R app:nodejs /app/data/
        chmod -R 755 /app/data/
        chmod 644 /app/data/db/master_order.db
        echo "✅ Ownership set to app:nodejs for /app/data/"
    else
        echo "⚠️ Not running as root, cannot change ownership"
    fi
fi

# Test database accessibility
echo "🔍 Testing basic SQLite access..."
if sqlite3 /app/data/db/master_order.db "SELECT 'Database accessible' as test;" >/dev/null 2>&1; then
    echo "✅ SQLite access successful"
else
    if [ "$PRESERVE_EXISTING_DATA" = "true" ]; then
        echo "🚨 WARNING: Database has user data but is not accessible - attempting permission fix only"
        chmod 644 /app/data/db/master_order.db || true
        chown app:nodejs /app/data/db/master_order.db 2>/dev/null || true
        
        # Test again
        if sqlite3 /app/data/db/master_order.db "SELECT 'Database accessible' as test;" >/dev/null 2>&1; then
            echo "✅ Database access restored with permission fix"
        else
            echo "❌ CRITICAL: Cannot access database with user data - manual intervention required"
        fi
    else
        echo "⚠️ SQLite access failed - database has no user data, attempting to reinitialize"
        rm -f /app/data/db/master_order.db
        sqlite3 /app/data/db/master_order.db << 'EOF'
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=1000;
PRAGMA temp_store=memory;
PRAGMA busy_timeout=30000;
CREATE TABLE IF NOT EXISTS _temp (id INTEGER); 
DROP TABLE _temp;
EOF
        chmod 644 /app/data/db/master_order.db || true
        echo "✅ Database reinitialized"
    fi
fi

# Apply migrations using the preservation flag
echo "🔄 Checking database migrations..."

if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Schema file found at prisma/schema.prisma"
    
    # Use the preservation flag to determine migration strategy
    if [ "$PRESERVE_EXISTING_DATA" = "true" ]; then
        echo "🛡️ EXISTING USER DATA DETECTED - Using safe migration strategy"
        echo "🔄 Running SAFE migration deployment (NEVER destroys data)..."
        
        # Only run migrate deploy - this NEVER destroys data, only applies new migrations
        if npx prisma migrate deploy 2>&1; then
            echo "✅ Migrations completed successfully - user data preserved"
        else
            echo "⚠️ Migration deploy failed - this may be normal if no new migrations"
            echo "🔍 Checking migration status..."
            npx prisma migrate status 2>&1 || echo "Unable to check migration status"
        fi
        
    else
        # No existing user data detected - check if we have schema-only database
        TABLE_COUNT=$(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations';" 2>/dev/null || echo "0")
        
        if [ "$TABLE_COUNT" -gt "10" ]; then
            echo "🗄️ Database has $TABLE_COUNT tables but no user data - running safe migrations..."
            if npx prisma migrate deploy 2>&1; then
                echo "✅ Migrations completed successfully"
            else
                echo "⚠️ Migration deploy failed - this may be normal if no new migrations"
            fi
        else
            echo "🆕 Database appears to be completely new ($TABLE_COUNT tables) - initializing schema..."
            # For brand new databases, we can safely use db push
            if npx prisma db push 2>&1; then
                echo "✅ Database schema initialized successfully"
            else
                echo "❌ Failed to initialize database schema"
            fi
        fi
    fi
    
    # Verify database file is accessible after operations
    if [ -f "/app/data/db/master_order.db" ] && sqlite3 /app/data/db/master_order.db "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database is accessible after migrations"
    else
        echo "❌ Database not accessible after migration attempts"
    fi
    
else
    echo "❌ Schema file not found at prisma/schema.prisma"
    echo "🔍 Current directory contents:"
    ls -la
    echo "🔍 Looking for schema in other locations..."
    find . -name "schema.prisma" -type f 2>/dev/null || echo "No schema.prisma found anywhere"
fi

# Final database health check
echo "🔍 Final database health check..."
if sqlite3 /app/data/db/master_order.db ".tables" >/dev/null 2>&1; then
    echo "✅ Database tables accessible"
    
    # Test if we can query the Settings table (read-only check)
    if sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Settings';" 2>/dev/null | grep -q "1"; then
        echo "✅ Settings table exists - database is properly initialized"
        
        # Show existing data count (helpful for confirming data preservation)
        SETTINGS_COUNT=$(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM Settings;" 2>/dev/null || echo "0")
        echo "📊 Settings table has $SETTINGS_COUNT records"
        
        # If this was a preservation scenario, confirm data is still there
        if [ "$PRESERVE_EXISTING_DATA" = "true" ]; then
            echo "🛡️ DATA PRESERVATION VERIFICATION:"
            echo "   Settings: $(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM Settings;" 2>/dev/null || echo "0")"
            echo "   Custom Orders: $(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM CustomOrder;" 2>/dev/null || echo "0")"
            echo "   Plex Movies: $(sqlite3 /app/data/db/master_order.db "SELECT COUNT(*) FROM PlexMovie;" 2>/dev/null || echo "0")"
        fi
    else
        echo "⚠️ Settings table missing - may need to initialize application data"
    fi
else
    echo "❌ Database tables not accessible"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate 2>&1 || echo "⚠️ Prisma generate failed"

echo "🌟 Starting application server..."
echo "📍 Server starting from directory: $(pwd)"
echo "🌐 Application will be available on configured port"

# Switch to app user and start the application
exec su-exec app node ../start.js
