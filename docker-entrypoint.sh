#!/bin/sh
# Database initialization script for Docker

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

# Create database file if it doesn't exist
if [ ! -f "/app/data/db/master_order.db" ]; then
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
-- Create a minimal table to initialize the database
CREATE TABLE IF NOT EXISTS _temp (id INTEGER); 
DROP TABLE _temp;
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Database file created successfully with optimizations"
    else
        echo "❌ SQLite creation failed, trying touch method..."
        touch /app/data/db/master_order.db
    fi
else
    echo "🗄️ Database file already exists"
    echo "🔧 Applying SQLite optimizations to existing database..."
    sqlite3 /app/data/db/master_order.db << 'EOF'
-- Ensure WAL mode for better concurrent access
PRAGMA journal_mode=WAL;
-- Optimize for performance
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=1000;
PRAGMA temp_store=memory;
-- Set busy timeout to 30 seconds
PRAGMA busy_timeout=30000;
EOF
    echo "✅ SQLite optimizations applied"
fi

# CRITICAL: Set proper ownership and permissions for the entire data directory structure
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Setting proper ownership and permissions..."
    chown -R app:nodejs /app/data/
    chmod -R 755 /app/data/
    chmod 644 /app/data/db/master_order.db
    echo "✅ Ownership set to app:nodejs for /app/data/"
else
    echo "⚠️ Not running as root, cannot change ownership"
fi

echo "🔍 Database file status:"
ls -la /app/data/db/ || echo "❌ Database directory not accessible"
ls -la /app/data/db/master_order.db 2>/dev/null && echo "✅ Database file exists" || echo "❌ Database file missing"

# Debug: Test if we can create a simple SQLite connection
echo "🔍 Testing basic SQLite access..."
if sqlite3 /app/data/db/master_order.db "SELECT 'Database accessible' as test;" 2>/dev/null; then
    echo "✅ SQLite access successful"
else
    echo "❌ SQLite access failed - trying to recreate database"
    rm -f /app/data/db/master_order.db
    sqlite3 /app/data/db/master_order.db "CREATE TABLE IF NOT EXISTS _temp (id INTEGER); DROP TABLE _temp;" 2>/dev/null || true
    chmod 644 /app/data/db/master_order.db || true
fi

# Apply migrations
echo "🔄 Applying database migrations..."

# Check if schema exists
echo "🔍 Checking for Prisma schema file..."
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Schema file found at prisma/schema.prisma"
    
    # Verify database file is accessible before running migrations
    if [ -f "/app/data/db/master_order.db" ] && sqlite3 /app/data/db/master_order.db "SELECT 1;" 2>/dev/null; then
        echo "✅ Database accessible, running migrations..."
        
        # Run migrations with proper error handling
        if npx prisma migrate deploy 2>&1; then
            echo "✅ Migrations completed successfully"
        else
            echo "⚠️ Migrations failed, trying db push..."
            npx prisma db push --force-reset 2>&1 || echo "❌ DB push also failed"
        fi
    else
        echo "❌ Database not accessible, cannot run migrations"
        # Try to recreate the database
        echo "🔄 Attempting to recreate database..."
        rm -f /app/data/db/master_order.db
        
        # Create new database file
        sqlite3 /app/data/db/master_order.db "CREATE TABLE IF NOT EXISTS _temp (id INTEGER); DROP TABLE _temp;"
        chmod 644 /app/data/db/master_order.db
        
        # Try migrations again
        if [ -f "/app/data/db/master_order.db" ]; then
            npx prisma db push --force-reset 2>&1 || echo "❌ Database recreation failed"
        fi
    fi
else
    echo "❌ Schema file not found at prisma/schema.prisma"
    echo "🔍 Current directory contents:"
    ls -la
    echo "🔍 Looking for schema in other locations..."
    find . -name "schema.prisma" -type f 2>/dev/null || echo "No schema.prisma found anywhere"
fi

# Debug: Check if tables were created
echo "🔍 Checking database tables after migration..."
if sqlite3 /app/data/master_order.db ".tables" 2>/dev/null; then
    echo "✅ Database tables accessible:"
    sqlite3 /app/data/master_order.db ".tables"
    
    # Test if we can query the Settings table
    if sqlite3 /app/data/master_order.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Settings';" 2>/dev/null | grep -q "1"; then
        echo "✅ Settings table exists - database is properly initialized"
    else
        echo "⚠️ Settings table missing - may need to re-run migrations"
    fi
else
    echo "❌ Database tables not accessible"
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate 2>&1 || echo "⚠️ Prisma generate failed"

echo "🌟 Starting application server..."

# Final permission check before switching users
if [ "$(id -u)" = "0" ]; then
    echo "🔧 Final ownership and permission check..."
    chown -R app:nodejs /app/data/
    chmod -R 755 /app/data/
    chmod 644 /app/data/db/master_order.db 2>/dev/null || true
    
    # Test database access as app user
    echo "🔍 Testing database access as app user..."
    if su-exec app:nodejs sqlite3 /app/data/db/master_order.db "SELECT 'test' as test;" 2>/dev/null; then
        echo "✅ Database accessible by app user"
    else
        echo "❌ Database not accessible by app user - attempting fix..."
        chmod 666 /app/data/db/master_order.db || true
    fi
    
    echo "🔄 Switching to app user for security..."
    exec su-exec app:nodejs node index.js
else
    exec node index.js
fi
