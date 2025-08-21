#!/bin/bash

# Schema switcher script for development vs production
# This script switches between SQLite and PostgreSQL based on DATABASE_PROVIDER environment variable

# Source environment variables
if [ -f .env.production ]; then
    source .env.production
elif [ -f .env ]; then
    source .env
fi

SCHEMA_FILE="server/prisma/schema.prisma"

# Backup current schema
cp "$SCHEMA_FILE" "${SCHEMA_FILE}.backup"

if [ "$DATABASE_PROVIDER" = "sqlite" ]; then
    echo "Switching to SQLite schema..."
    sed -i 's/provider = "postgresql"/provider = "sqlite"/g' "$SCHEMA_FILE"
elif [ "$DATABASE_PROVIDER" = "postgresql" ]; then
    echo "Switching to PostgreSQL schema..."
    sed -i 's/provider = "sqlite"/provider = "postgresql"/g' "$SCHEMA_FILE"
else
    echo "Unknown DATABASE_PROVIDER: $DATABASE_PROVIDER"
    echo "Using current schema provider"
fi

echo "Schema provider set to: $DATABASE_PROVIDER"
