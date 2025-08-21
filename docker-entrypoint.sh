#!/bin/sh
# Database initialization script # Apply migrations and push schema to ensure database is properly initialized
echo "🔄 Applying database migrations..."
npx prisma migrate deploy 2>&1 | head -20

# If migrations failed, try db push as fallback
if [ $? -ne 0 ]; then
    echo "🔄 Migration failed, trying db push..."
    npx prisma db push --force-reset || echo "⚠️ DB push also failed, but continuing..."
fi

# Debug: Check if tables were created
echo "🔍 Checking database tables after migration..."
sqlite3 /app/data/master_order.db ".tables" || echo "❌ Could not list tables"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generateker

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
    touch /app/data/master_order.db
    chmod 644 /app/data/master_order.db || true
else
    echo "🗄️ Database file already exists"
fi

echo "🔧 Using DATABASE_URL from environment: $DATABASE_URL"

# Debug: Check database file status
echo "🔍 Database file status:"
ls -la /app/data/master_order.db || echo "❌ Database file not found"

# Debug: Test if we can create a simple SQLite connection
echo "🔍 Testing basic SQLite access..."
sqlite3 /app/data/master_order.db "SELECT 'Database accessible' as test;" || echo "❌ SQLite access failed"

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
