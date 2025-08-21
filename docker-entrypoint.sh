#!/bin/sh
# Database initialization script for Docker

echo "🚀 Starting Master Order application..."

# Set DATABASE_URL explicitly to ensure Prisma uses the correct database
export DATABASE_URL="file:/app/data/master_order.db"
echo "🔧 Database URL set to: $DATABASE_URL"

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

echo "📊 Checking database schema..."

# Check if database exists and has tables
if [ ! -f "/app/data/master_order.db" ]; then
    echo "🗄️ Creating new database..."
    # Create an empty database file first to ensure proper permissions
    touch /app/data/master_order.db
    chmod 644 /app/data/master_order.db || true
    npx prisma migrate deploy
    echo "✅ Database created and migrated"
else
    echo "🔄 Applying any pending migrations..."
    # Ensure we can write to the existing database
    chmod 644 /app/data/master_order.db || true
    npx prisma migrate deploy
    echo "✅ Migrations applied"
fi

# Generate Prisma client (in case of any changes)
echo "🔧 Generating Prisma client..."
npx prisma generate

# Test database connection before starting application
echo "🔍 Testing database connection..."
CONNECTION_SUCCESS=false

for attempt in 1 2 3 4 5; do
    echo "🔄 Connection test attempt $attempt/5..."
    
    if npx prisma db execute --stdin <<EOF
SELECT name FROM sqlite_master WHERE type='table' AND name='Settings';
EOF
    then
        echo "✅ Database connection test successful on attempt $attempt"
        CONNECTION_SUCCESS=true
        break
    else
        echo "❌ Database connection test failed on attempt $attempt"
        if [ $attempt -lt 5 ]; then
            echo "⏳ Waiting 3 seconds before retry..."
            sleep 3
        fi
    fi
done

if [ "$CONNECTION_SUCCESS" != "true" ]; then
    echo "💥 Fatal: Could not establish database connection after 5 attempts"
    echo "🔍 Database file status:"
    ls -la /app/data/master_order.db || echo "❌ Database file not found"
    echo "🔍 Environment:"
    echo "DATABASE_URL: $DATABASE_URL"
    exit 1
fi

# Give additional time for any remaining database connections to stabilize
echo "⏳ Allowing 5 seconds for connection stabilization..."
sleep 5

echo "🌟 Starting application server..."

# Switch to app user for running the application
if [ "$(id -u)" = "0" ]; then
    echo "🔄 Switching to app user for security..."
    exec su-exec app:nodejs node index.js
else
    exec node index.js
fi
