#!/bin/sh
# Master Order Docker Entrypoint - PostgreSQL Production Setup
# This script is designed for production use with PostgreSQL
# SQLite is used only in development outside of Docker

echo "[INFO] Master Order Docker Entrypoint Started"
echo "[INFO] This script runs when the container STARTS, not during build"
echo "[DEBUG] Initial DATABASE_URL: $DATABASE_URL"
echo "[DEBUG] Environment check:"
echo "[DEBUG] - NODE_ENV: $NODE_ENV"
echo "[DEBUG] - Working directory: $(pwd)"
echo "[DEBUG] - Container runtime detected"
echo "[DEBUG] - Available .env files:"
find /app -name ".env*" -type f 2>/dev/null || echo "[DEBUG] No .env files found"
echo "[DEBUG] All DATABASE_URL related env vars:"
env | grep -i database || echo "[DEBUG] No DATABASE_URL env vars found"

# Force correct DATABASE_URL if it's been overridden (Docker safety check)
if [ "$DATABASE_URL" = "file:/app/data/master_order.db" ] || echo "$DATABASE_URL" | grep -q "file:"; then
    echo "[WARN] DATABASE_URL appears to be SQLite format, forcing PostgreSQL for Docker"
    export DATABASE_URL="postgresql://master_order_user:${POSTGRES_PASSWORD:-secure_password_change_me}@localhost:5432/master_order"
    echo "[INFO] Forced DATABASE_URL to: $DATABASE_URL"
fi

# Ensure required directories exist and have correct permissions
mkdir -p /app/server/artwork-cache
mkdir -p /app/logs

# Set ownership if running as root (will be changed by USER directive)
if [ "$(id -u)" = "0" ]; then
    chown -R app:nodejs /app/server/artwork-cache /app/logs
fi

# Ensure the app user owns these directories
chmod 755 /app/server/artwork-cache /app/logs || true

# Change to server directory for consistency
cd /app/server

echo "[INFO] Setting correct DATABASE_URL for runtime..."

# Debug: Show final DATABASE_URL after schema setup
echo "[DEBUG] Final DATABASE_URL: $DATABASE_URL"
echo "[DEBUG] Prisma will use this DATABASE_URL for connections"

echo "[INFO] Setting up PostgreSQL database..."

# Add debug mode to skip PostgreSQL readiness check
if [ "$SKIP_PG_CHECK" = "true" ]; then
    echo "[WARN] Skipping PostgreSQL readiness check (SKIP_PG_CHECK=true)"
    echo "[INFO] Proceeding directly to application startup..."
else
    # Validate required environment variables
    if [ -z "$DATABASE_URL" ]; then
        echo "[ERROR] DATABASE_URL environment variable is required for PostgreSQL"
        echo "   Example: postgresql://username:password@localhost:5432/master_order"
        exit 1
    fi

    echo "[INFO] DATABASE_URL configured for PostgreSQL"

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "[INFO] Waiting for PostgreSQL to be ready..."
    
    # Extract connection details for pg_isready
    # Parse DATABASE_URL to get host and port for pg_isready
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*://[^@]*@[^:]*:\([0-9]*\)/.*|\1|p')
    
    if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
        echo "[WARN] Could not parse host/port from DATABASE_URL, using default localhost:5432"
        DB_HOST="localhost"
        DB_PORT="5432"
    fi
    
    echo "[INFO] Checking PostgreSQL at $DB_HOST:$DB_PORT..."
    echo "[DEBUG] Using pg_isready command: pg_isready -h $DB_HOST -p $DB_PORT"
    
    # First, check if the host is reachable at all
    echo "[DEBUG] Testing basic connectivity to $DB_HOST:$DB_PORT..."
    
    # Wait for PostgreSQL to accept connections (max 90 seconds, longer timeout)
    COUNTER=0
    MAX_ATTEMPTS=45  # 90 seconds total
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U master_order_user > /dev/null 2>&1; do
        COUNTER=$((COUNTER + 1))
        if [ $COUNTER -gt $MAX_ATTEMPTS ]; then
            echo "[ERROR] PostgreSQL did not become ready within 90 seconds"
            echo "   Host: $DB_HOST"
            echo "   Port: $DB_PORT"
            echo "   User: master_order_user"
            echo "   DATABASE_URL: $DATABASE_URL"
            echo ""
            echo "[DEBUG] Final connection test results:"
            pg_isready -h "$DB_HOST" -p "$DB_PORT" -U master_order_user -v
            echo ""
            echo "[DEBUG] Network connectivity test:"
            nc -z "$DB_HOST" "$DB_PORT" && echo "Port is open" || echo "Port is closed/unreachable"
            echo ""
            echo "[ERROR] This suggests PostgreSQL container may not be starting properly"
            echo "        Check: docker-compose logs postgres"
            exit 1
        fi
        echo "[INFO] PostgreSQL is unavailable - sleeping... (attempt $COUNTER/30)"
        sleep 2
    done
    
    echo "[INFO] PostgreSQL is ready!"
}

# Wait for PostgreSQL to be available
if [ "$SKIP_PG_CHECK" = "true" ]; then
    echo "[INFO] Skipped PostgreSQL readiness check"
else
    wait_for_postgres
fi

# Check if this is a new installation or existing database
echo "[INFO] Checking for existing database data..."
PRESERVE_EXISTING_DATA=false

# Test if we can connect and if key tables exist with data
if npx prisma db pull --force-reset >/dev/null 2>&1; then
    # Database exists and is accessible, check for user data
    echo "[INFO] Database connection successful, checking for existing data..."
    
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
        echo "[INFO] FOUND EXISTING USER DATA:"
        echo "$EXISTING_DATA_CHECK" | grep -E "(Settings|Custom Orders|Plex Movies):"
        echo "[INFO] PRESERVING EXISTING DATABASE - Will only apply new migrations"
        PRESERVE_EXISTING_DATA=true
    else
        echo "[INFO] Database exists but has no user data"
        PRESERVE_EXISTING_DATA=false
    fi
else
    echo "[INFO] Database does not exist or is not accessible - will initialize new database"
    PRESERVE_EXISTING_DATA=false
fi

# Apply database migrations based on database state
if [ "$PRESERVE_EXISTING_DATA" = true ]; then
    echo "[INFO] PRESERVING EXISTING DATA - Applying only new migrations"
    echo "[INFO] Running Prisma migrate deploy..."
    if ! npx prisma migrate deploy; then
        echo "[ERROR] Migration deployment failed"
        echo "[INFO] Attempting to resolve migration conflicts..."
        
        # Check if there are pending migrations to resolve
        MIGRATION_STATUS=$(npx prisma migrate status 2>&1)
        if echo "$MIGRATION_STATUS" | grep -q "following migration have not yet been applied"; then
            echo "[INFO] Applying pending migrations..."
            npx prisma migrate deploy
        elif echo "$MIGRATION_STATUS" | grep -q "Your local migration history and the migrations table"; then
            echo "[INFO] Migration history conflict detected - resolving..."
            # Try to resolve by marking the latest migration as applied
            LATEST_MIGRATION=$(ls -1 prisma/migrations/ 2>/dev/null | grep -E '^[0-9]{14}_' | tail -1)
            if [ -n "$LATEST_MIGRATION" ]; then
                echo "[INFO] Marking migration $LATEST_MIGRATION as applied..."
                npx prisma migrate resolve --applied "$LATEST_MIGRATION"
                npx prisma migrate deploy
            fi
        fi
    fi
    echo "[INFO] Existing database updated with new migrations"
else
    echo "[INFO] NEW DATABASE - Initializing fresh database"
    echo "[INFO] Running Prisma migrate deploy to create schema..."
    if ! npx prisma migrate deploy; then
        echo "[ERROR] Database initialization failed"
        exit 1
    fi
    echo "[INFO] Fresh database created and ready"
fi

# Generate and push Prisma Client
echo "[INFO] Generating Prisma Client..."
if ! npx prisma generate; then
    echo "[ERROR] Failed to generate Prisma Client"
    exit 1
fi
echo "[INFO] Prisma Client generated successfully"

# Final database connection test
echo "[INFO] Final database connection test..."
DATABASE_TEST_RESULT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    async function testConnection() {
        try {
            await prisma.\$connect();
            console.log('[INFO] Database connection successful');
            await prisma.\$disconnect();
        } catch (error) {
            console.log('[ERROR] Database connection failed:', error.message);
            process.exit(1);
        }
    }
    
    testConnection();
" 2>/dev/null)

echo "$DATABASE_TEST_RESULT"

fi

echo "[INFO] Database setup completed successfully!"
echo "[INFO] Starting the application..."

# Start the application
exec "$@"
