#!/bin/bash

# Data Safety Verification for Unraid/Shell environments
# Run this BEFORE any Docker deployment

echo "🔒 MANDATORY DATA SAFETY VERIFICATION"
echo "====================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENTRYPOINT_FILE="$SCRIPT_DIR/docker-entrypoint.sh"

if [ ! -f "$ENTRYPOINT_FILE" ]; then
    echo "❌ ERROR: docker-entrypoint.sh not found at $ENTRYPOINT_FILE"
    exit 1
fi

echo ""
echo "🔍 Scanning for dangerous commands..."

DANGEROUS_FOUND=false
SAFETY_FOUND=false

# Check for dangerous commands
if grep -q "migrate reset" "$ENTRYPOINT_FILE"; then
    echo "❌ DANGER: Found 'migrate reset' in docker-entrypoint.sh"
    DANGEROUS_FOUND=true
fi

if grep -q "prisma migrate reset" "$ENTRYPOINT_FILE"; then
    echo "❌ DANGER: Found 'prisma migrate reset' in docker-entrypoint.sh"
    DANGEROUS_FOUND=true
fi

if grep -q "force-reset" "$ENTRYPOINT_FILE"; then
    echo "❌ DANGER: Found 'force-reset' in docker-entrypoint.sh"
    DANGEROUS_FOUND=true
fi

if grep -q "DROP DATABASE\|DROP TABLE\|TRUNCATE\|DELETE FROM" "$ENTRYPOINT_FILE"; then
    echo "❌ DANGER: Found destructive SQL commands in docker-entrypoint.sh"
    DANGEROUS_FOUND=true
fi

echo ""
echo "🛡️  Checking for safety measures..."

# Check for safety measures
if grep -q "accept-data-loss=false" "$ENTRYPOINT_FILE"; then
    echo "✅ SAFE: Found '--accept-data-loss=false'"
    SAFETY_FOUND=true
fi

if grep -q "Will NOT attempt reset" "$ENTRYPOINT_FILE"; then
    echo "✅ SAFE: Found 'Will NOT attempt reset'"
    SAFETY_FOUND=true
fi

if grep -q "DATA-SAFE" "$ENTRYPOINT_FILE"; then
    echo "✅ SAFE: Found 'DATA-SAFE' indicators"
    SAFETY_FOUND=true
fi

if grep -q "preserve your data" "$ENTRYPOINT_FILE"; then
    echo "✅ SAFE: Found 'preserve your data'"
    SAFETY_FOUND=true
fi

echo ""
echo "📋 SAFETY ASSESSMENT:"
echo "====================="

if [ "$DANGEROUS_FOUND" = true ]; then
    echo "❌ FAILED: Dangerous commands detected"
    echo "🚨 DEPLOYMENT BLOCKED - Data loss risk detected"
    echo ""
    echo "❗ ACTION REQUIRED:"
    echo "  1. Remove all destructive commands from docker-entrypoint.sh"
    echo "  2. Add proper data safety measures"
    echo "  3. Re-run this verification"
    exit 1
fi

if [ "$SAFETY_FOUND" = false ]; then
    echo "⚠️  WARNING: No explicit safety measures found"
    echo "🚨 DEPLOYMENT BLOCKED - Insufficient safety measures"
    exit 1
fi

echo "✅ PASSED: No dangerous commands detected"
echo "✅ PASSED: Safety measures in place"
echo "🎉 DEPLOYMENT APPROVED - Data safety verified"
echo ""
echo "✨ Your PostgreSQL data will be preserved during deployment"
echo ""
echo "🚀 You may proceed with Docker deployment"

exit 0