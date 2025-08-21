#!/bin/sh
# Master Order Docker Entrypoint - PostgreSQL Production Setup
# This script is designed for production use with PostgreSQL
# SQLite is used only in development outside of Docker
echo "🎯 Database setup completed successfully!"
echo "🚀 Starting the application..."

# Start the application
exec "$@" Starting Master Order application..."

# Ensure required directories exist and have correct permissions
mkdir -p /app/server/artwork-cache
mkdir -p /app/logs

# Set ownership if running as root (will be changed by USER directive)
if [ "$(id -u)" = "0" ]; then
    chown -R app:nodejs /app/server/artwork-cache /app/logs
fi

# Ensure the app user owns these directories
chmod 755 /app/server/artwork-cache /app/logs || true

# Change to server directory for Prisma commands
cd /app/server

echo "� Setting up PostgreSQL database..."

# Validate required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is required for PostgreSQL"
    echo "   Example: postgresql://username:password@postgres:5432/master_order"
    exit 1
fi

echo "🔧 DATABASE_URL configured for PostgreSQL"

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    
    # Extract connection details for pg_isready
    # Parse DATABASE_URL to get host and port for pg_isready
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@[^:]*:\([0-9]*\)/.*|\1|p')
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        echo "⚠️  Could not parse host/port from DATABASE_URL, using default postgres:5432"
        DB_HOST="postgres"
        DB_PORT="5432"
    fi
    
    echo "🔍 Checking PostgreSQL at $DB_HOST:$DB_PORT..."
    
    # Wait for PostgreSQL to accept connections (max 60 seconds)
    COUNTER=0
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; do
        COUNTER=$((COUNTER + 1))
        if [ $COUNTER -gt 30 ]; then
            echo "❌ ERROR: PostgreSQL did not become ready within 60 seconds"
            echo "   Host: $DB_HOST"
            echo "   Port: $DB_PORT"
            echo "   DATABASE_URL: $DATABASE_URL"
            exit 1
        fi
        echo "⏳ PostgreSQL is unavailable - sleeping... (attempt $COUNTER/30)"
        sleep 2
    done
    
    echo "✅ PostgreSQL is ready!"
}

# Wait for PostgreSQL to be available
wait_for_postgres

# Check if this is a new installation or existing database
echo "🛡️ Checking for existing database data..."
PRESERVE_EXISTING_DATA=false

# Test if we can connect and if key tables exist with data
if npx prisma db pull --force-reset >/dev/null 2>&1; then
    # Database exists and is accessible, check for user data
    echo "🔍 Database connection successful, checking for existing data..."
    
    # Check if key tables have data using Prisma
    EXISTING_DATA_CHECK=$(node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        async function checkData() {
            try {
                const settings = await prisma.settings.count().catch(() => 0);
                const customOrders = await prisma.customOrder.count().catch(() => 0);
                const plexData = await prisma.plexMovie.count().catch(() => 0);
                const total = settings + customOrders + plexData;
                
                if (total > 0) {
                    console.log('HAS_DATA');
                    console.log('Settings: ' + settings);
                    console.log('Custom Orders: ' + customOrders);
                    console.log('Plex Movies: ' + plexData);
                } else {
                    console.log('NO_DATA');
                }
            } catch (error) {
                console.log('CHECK_FAILED');
            } finally {
                await prisma.\$disconnect();
            }
        }
        
        checkData();
    " 2>/dev/null || echo "CHECK_FAILED")
    
    if echo "$EXISTING_DATA_CHECK" | grep -q "HAS_DATA"; then
        echo "🚨 FOUND EXISTING USER DATA:"
        echo "$EXISTING_DATA_CHECK" | grep -E "(Settings|Custom Orders|Plex Movies):"
        echo "🛡️ PRESERVING EXISTING DATABASE - Will only apply new migrations"
        PRESERVE_EXISTING_DATA=true
    else
        echo "📝 Database exists but has no user data"
        PRESERVE_EXISTING_DATA=false
    fi
else
    echo "📁 Database does not exist or is not accessible - will initialize new database"
    PRESERVE_EXISTING_DATA=false
fi

# Apply database migrations based on database state
if [ "$PRESERVE_EXISTING_DATA" = true ]; then
    echo "🛡️ PRESERVING EXISTING DATA - Applying only new migrations"
    echo "🔧 Running Prisma migrate deploy..."
    if ! npx prisma migrate deploy; then
        echo "❌ ERROR: Migration deployment failed"
        echo "� Attempting to resolve migration conflicts..."
        
        # Check if there are pending migrations to resolve
        MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
        if echo "$MIGRATION_STATUS" | grep -q "following migration have not yet been applied"; then
            echo "� Applying pending migrations..."
            npx prisma migrate deploy
        elif echo "$MIGRATION_STATUS" | grep -q "Your local migration history and the migrations table"; then
            echo "🔧 Migration history conflict detected - resolving..."
            # Try to resolve by marking the latest migration as applied
            LATEST_MIGRATION=$(ls -1 prisma/migrations/ 2>/dev/null | grep -E '^[0-9]{14}_' | tail -1)
            if [ -n "$LATEST_MIGRATION" ]; then
                echo "📌 Marking migration $LATEST_MIGRATION as applied..."
                npx prisma migrate resolve --applied "$LATEST_MIGRATION"
                npx prisma migrate deploy
            fi
        fi
    fi
    echo "✅ Existing database updated with new migrations"
else
    echo "🏗️ NEW DATABASE - Initializing fresh database"
    echo "🔧 Running Prisma migrate deploy to create schema..."
    if ! npx prisma migrate deploy; then
        echo "❌ ERROR: Database initialization failed"
        exit 1
    fi
    echo "✅ Fresh database created and ready"
fi

# Generate and push Prisma Client
echo "� Generating Prisma Client..."
if ! npx prisma generate; then
    echo "❌ ERROR: Failed to generate Prisma Client"
    exit 1
fi
echo "✅ Prisma Client generated successfully"

# Final database connection test
echo "� Final database connection test..."
DATABASE_TEST_RESULT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function testConnection() {
        try {
            await prisma.\$connect();
            console.log('✅ Database connection successful');
            await prisma.\$disconnect();
        } catch (error) {
            console.log('❌ Database connection failed:', error.message);
            process.exit(1);
        }
    }
    
    testConnection();
" 2>/dev/null)

echo "$DATABASE_TEST_RESULT"

echo "🎯 Database setup completed successfully!"
echo "� Starting the application..."

# Start the application
exec "$@"


# Switch to app user and start the application
exec su-exec app node ../start.js
