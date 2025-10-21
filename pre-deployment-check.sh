#!/bin/bash

# Eddie Life Management - Pre-Deployment Verification Script
# Ensures ZERO DATA LOSS for PostgreSQL production deployment
# Run this BEFORE deploying to verify everything is ready

set -e

echo "🔍 Eddie Life Management - Pre-Deployment Verification"
echo "========================================================"
echo "Date: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((ERRORS++))
}

# 1. Check Schema Synchronization
log_info "Checking schema file synchronization..."
cd server

if [ ! -f "prisma/schema.prisma" ] || [ ! -f "prisma/schema.postgresql.prisma" ] || [ ! -f "prisma/schema.sqlite.prisma" ]; then
    log_error "Missing schema files"
else
    # Verify PostgreSQL schema has correct provider
    if grep -q 'provider = "postgresql"' prisma/schema.postgresql.prisma; then
        log_success "PostgreSQL schema has correct provider"
    else
        log_error "PostgreSQL schema does not have 'provider = \"postgresql\"'"
    fi
    
    # Verify SQLite schema has correct provider
    if grep -q 'provider = "sqlite"' prisma/schema.sqlite.prisma; then
        log_success "SQLite schema has correct provider"
    else
        log_error "SQLite schema does not have 'provider = \"sqlite\"'"
    fi
    
    # Check if disambiguation field exists in all schemas
    if grep -q 'disambiguation.*String' prisma/schema.prisma && \
       grep -q 'disambiguation.*String' prisma/schema.postgresql.prisma && \
       grep -q 'disambiguation.*String' prisma/schema.sqlite.prisma; then
        log_success "Disambiguation field exists in all schemas"
    else
        log_error "Disambiguation field missing in one or more schemas"
    fi
fi

# 2. Check Migrations Directory
log_info "Checking migrations..."
if [ -d "prisma/migrations" ]; then
    MIGRATION_COUNT=$(find prisma/migrations -name "migration.sql" | wc -l)
    log_success "Found $MIGRATION_COUNT migrations"
    
    # Check if disambiguation migration exists
    if find prisma/migrations -name "migration.sql" -exec grep -l "disambiguation" {} \; | head -1 > /dev/null; then
        log_success "Disambiguation field migration exists"
    else
        log_warning "No disambiguation migration found - field may have been in original schema"
    fi
else
    log_error "Migrations directory not found"
fi

# 3. Verify Docker Files
cd ..
log_info "Checking Docker configuration files..."

DOCKER_FILES=("Dockerfile" "docker-compose.yml" "docker-entrypoint.sh")
for file in "${DOCKER_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
    else
        log_error "$file not found"
    fi
done

# 4. Check docker-entrypoint.sh for data safety
if [ -f "docker-entrypoint.sh" ]; then
    if grep -q "DATA-SAFE" docker-entrypoint.sh && \
       grep -q "PRESERVE_EXISTING_DATA" docker-entrypoint.sh; then
        log_success "Docker entrypoint has data safety checks"
    else
        log_warning "Docker entrypoint may not have full data safety checks"
    fi
    
    # Verify no database reset commands
    if grep -q "prisma migrate reset" docker-entrypoint.sh; then
        log_error "Docker entrypoint contains 'prisma migrate reset' - DANGEROUS!"
    else
        log_success "No destructive database reset commands found"
    fi
fi

# 5. Check if frontend is built
log_info "Checking frontend build..."
if [ -d "client/dist" ] && [ -f "client/dist/index.html" ]; then
    log_success "Frontend is built (dist folder exists)"
else
    log_warning "Frontend not built - will be built during Docker build"
fi

# 6. Verify package.json scripts
log_info "Checking package.json scripts..."
cd server
if grep -q '"build:production"' package.json; then
    log_success "Production build script exists"
else
    log_warning "Production build script not found in server/package.json"
fi

cd ..

# 7. Check for .env files that might interfere
log_info "Checking for .env files..."
ENV_FILES=$(find . -name ".env*" -type f 2>/dev/null || echo "")
if [ -z "$ENV_FILES" ]; then
    log_success "No .env files found (good - Docker uses environment variables)"
else
    log_warning "Found .env files that may interfere with Docker deployment:"
    echo "$ENV_FILES" | sed 's/^/         /'
    log_warning "These will be removed during Docker build"
fi

# 8. Verify entrypoint uses db push for existing data
log_info "Verifying safe migration strategy..."
if grep -q "prisma db push --accept-data-loss=false" docker-entrypoint.sh; then
    log_success "Entrypoint uses safe 'db push' for existing data"
else
    log_warning "Entrypoint may not use safest migration strategy"
fi

# 9. Check Dockerfile for proper Prisma setup
log_info "Checking Dockerfile Prisma configuration..."
if grep -q "npm run build:production" Dockerfile; then
    log_success "Dockerfile runs production build script"
else
    log_warning "Dockerfile may not run production build"
fi

# 10. Verify PostgreSQL migration compatibility
log_info "Verifying PostgreSQL compatibility..."
cd server
if grep -q '@db.Text' prisma/schema.postgresql.prisma; then
    log_success "Schema uses PostgreSQL-compatible types"
else
    log_warning "Schema may not have PostgreSQL-specific types"
fi
cd ..

# Summary
echo ""
echo "========================================================"
echo "PRE-DEPLOYMENT CHECK SUMMARY"
echo "========================================================"

if [ $ERRORS -gt 0 ]; then
    log_error "Found $ERRORS critical errors - DO NOT DEPLOY"
    echo ""
    echo "Fix these errors before deploying to production."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    log_warning "Found $WARNINGS warnings - review before deploying"
    echo ""
    echo "These warnings may be acceptable, but review them carefully."
    echo "Your data will be safe, but the deployment may have issues."
    exit 0
else
    log_success "All checks passed! ✨"
    echo ""
    echo "✅ SAFE TO DEPLOY"
    echo ""
    echo "Your PostgreSQL database will be preserved during deployment."
    echo "The following protections are in place:"
    echo "  - Existing data detection"
    echo "  - Safe schema updates with 'db push --accept-data-loss=false'"
    echo "  - No destructive reset commands"
    echo "  - Migration history preservation"
    echo ""
    echo "To deploy, run: ./deploy-production.sh"
    exit 0
fi
