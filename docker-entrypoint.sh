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

# Create database file if it doesn't exist
if [ ! -f "/app/data/master_order.db" ]; then
    echo "🗄️ Creating new database file..."
    touch /app/data/master_order.db
    chmod 644 /app/data/master_order.db || true
fi

# Set DATABASE_URL with proper SQLite format
export DATABASE_URL="file:/app/data/master_order.db"
echo "🔧 Database URL set to: $DATABASE_URL"

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
