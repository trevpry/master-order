#!/bin/bash

echo "[INFO] PostgreSQL Connection Debugging Script"
echo "[INFO] Testing connectivity to PostgreSQL on localhost:5432"

# Test if port is open
echo "[DEBUG] Testing if port 5432 is open..."
if timeout 3 bash -c "</dev/tcp/localhost/5432"; then
    echo "[SUCCESS] Port 5432 is open and accepting connections"
else
    echo "[ERROR] Port 5432 is not accessible"
    echo "[INFO] Checking what's listening on port 5432..."
    netstat -tlnp | grep :5432 || echo "[INFO] Nothing listening on port 5432"
fi

# Test with pg_isready if available
if command -v pg_isready >/dev/null 2>&1; then
    echo "[DEBUG] Testing with pg_isready..."
    pg_isready -h localhost -p 5432 -U postgres -v
    pg_isready -h localhost -p 5432 -U master_order_user -v
else
    echo "[INFO] pg_isready not available in this container"
fi

# Test with psql if available
if command -v psql >/dev/null 2>&1; then
    echo "[DEBUG] Testing with psql connection..."
    PGPASSWORD=secure_password_change_me psql -h localhost -p 5432 -U master_order_user -d master_order -c "SELECT 1;" 2>&1
else
    echo "[INFO] psql not available in this container"
fi

echo "[INFO] Connection test completed"
