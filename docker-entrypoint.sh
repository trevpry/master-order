#!/bin/sh
# Database initialization script # Apply migrations and push schema to ensure database is properly initialized
echo "🔄 Applying database migrations..."

# First, check if schema exists - check both locations found by debugging
echo "🔍 Checking for Prisma schema file..."
SCHEMA_PATH=""
if [ -f "prisma/schema.prisma" ]; then
    SCHEMA_PATH="prisma/schema.prisma"
    echo "✅ Schema file found at prisma/schema.prisma"
elif [ -f "server/prisma/schema.prisma" ]; then
    SCHEMA_PATH="server/prisma/schema.prisma"
    echo "✅ Schema file found at server/prisma/schema.prisma"
    # Change to server directory for Prisma commands to work
    cd /app/server
else
    echo "❌ Schema file not found in expected locations"
    echo "🔍 Current directory contents:"
    ls -la
    echo "🔍 Looking for schema in other locations..."
    find . -name "schema.prisma" -type f 2>/dev/null || echo "No schema.prisma found anywhere"
fi

if [ -n "$SCHEMA_PATH" ]; then
    # Verify database file is accessible before running migrations
    if [ -f "/app/data/master_order.db" ] && sqlite3 /app/data/master_order.db "SELECT 1;" 2>/dev/null; then
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
        rm -rf /app/data/master_order.db
        
        # Create new database file
        sqlite3 /app/data/master_order.db "CREATE TABLE IF NOT EXISTS _temp (id INTEGER); DROP TABLE _temp;"
        chmod 644 /app/data/master_order.db
        
        # Try migrations again
        if [ -f "/app/data/master_order.db" ]; then
            npx prisma db push --force-reset 2>&1 || echo "❌ Database recreation failed"
        fi
    fi
else
    echo "❌ No schema file found, cannot run migrations"
fi

# Debug: Check if tables were created and database is functional
echo "🔍 Checking database functionality..."
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
    # Final attempt to create a working database
    echo "🔧 Final attempt to create functional database..."
    rm -f /app/data/master_order.db
    
    # Create database with a basic table to ensure it's valid
    sqlite3 /app/data/master_order.db "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY); INSERT INTO test_table (id) VALUES (1);"
    
    if [ -f "/app/data/master_order.db" ]; then
        echo "✅ Database file created successfully"
        chmod 644 /app/data/master_order.db
        # Try schema push one more time
        npx prisma db push --force-reset 2>&1 || echo "❌ Final schema push failed"
    else
        echo "❌ Critical: Cannot create database file - check volume mount"
    fi
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate 2>&1 || echo "⚠️ Prisma generate failed"ker

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

# Create database file if it doesn't exist
if [ ! -f "/app/data/master_order.db" ]; then
    echo "🗄️ Creating new database file..."
    # Ensure parent directory exists and has proper permissions
    mkdir -p /app/data
    chmod 755 /app/data || true
    
    # CRITICAL: Check if it's a directory and remove it
    if [ -d "/app/data/master_order.db" ]; then
        echo "🚨 ERROR: master_order.db exists as directory! Removing..."
        rm -rf /app/data/master_order.db
    fi
    
    # Create a proper SQLite database file (not just empty file)
    echo "🔧 Creating SQLite database file..."
    sqlite3 /app/data/master_order.db "CREATE TABLE IF NOT EXISTS _temp (id INTEGER); DROP TABLE _temp;" 2>/dev/null || {
        echo "❌ SQLite creation failed, trying alternative method..."
        # Alternative: create empty file first, then initialize
        touch /app/data/master_order.db
        sqlite3 /app/data/master_order.db "SELECT 1;" 2>/dev/null || true
    }
    
    # Verify it's a file, not a directory
    if [ -f "/app/data/master_order.db" ]; then
        chmod 644 /app/data/master_order.db || true
        echo "✅ Database file created successfully"
    else
        echo "❌ CRITICAL: Could not create database as file - volume mount issue!"
        ls -la /app/data/
    fi
    
    # Set ownership if running as root
    if [ "$(id -u)" = "0" ]; then
        chown app:nodejs /app/data/master_order.db || true
    fi
else
    echo "🗄️ Database file already exists"
fi

echo "🔧 Using DATABASE_URL from environment: $DATABASE_URL"

# Debug: Check database file status
echo "🔍 Database file status:"
ls -la /app/data/ || echo "❌ Data directory not accessible"
ls -la /app/data/master_order.db 2>/dev/null && echo "✅ Database file exists" || echo "❌ Database file missing"

# Debug: Test if we can create a simple SQLite connection
echo "🔍 Testing basic SQLite access..."
if sqlite3 /app/data/master_order.db "SELECT 'Database accessible' as test;" 2>/dev/null; then
    echo "✅ SQLite access successful"
else
    echo "❌ SQLite access failed - trying to recreate database"
    sqlite3 /app/data/master_order.db "SELECT 1;" 2>/dev/null || true
    chmod 644 /app/data/master_order.db || true
fi

# Apply migrations without connection tests that might fail
echo "� Applying database migrations..."
npx prisma migrate deploy || echo "⚠️ Migrations may have failed, but continuing..."

# Generate Prisma client
echo "� Generating Prisma client..."
npx prisma generate

echo "🌟 Starting application server..."

# Switch to app user for running the application
if [ "$(id -u)" = "0" ]; then
    echo "🔄 Switching to app user for security..."
    exec su-exec app:nodejs node index.js
else
    exec node index.js
fi
