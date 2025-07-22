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

# Change to server directory for Prisma commands
cd /app/server

echo "📊 Checking database schema..."

# Check if database exists and has tables
if [ ! -f "/app/data/master_order.db" ]; then
    echo "🗄️ Creating new database..."
    npx prisma migrate deploy
    echo "✅ Database created and migrated"
else
    echo "🔄 Applying any pending migrations..."
    npx prisma migrate deploy
    echo "✅ Migrations applied"
fi

# Generate Prisma client (in case of any changes)
echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🌟 Starting application server..."
exec node index.js
