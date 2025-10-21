#!/bin/bash

# Docker Build Script - OPTIMIZED VERSION
# This script uses Docker BuildKit for faster, cached builds
# 
# BuildKit features used:
# - Layer caching: Reuses unchanged layers
# - Cache mounts: Speeds up npm installs
# - Parallel builds: Builds stages concurrently where possible
#
# 🔒 DATA SAFETY: This optimized build is 100% PostgreSQL data safe
# - Build optimizations only affect layer caching (build time)
# - Production runtime behavior IDENTICAL to original
# - Same entrypoint, same data protection, same migrations
# - See DOCKER_OPTIMIZED_DATA_SAFETY.md for verification
#
# Usage:
#   ./build-docker-optimized.sh          # Build with cache
#   ./build-docker-optimized.sh --no-cache  # Force full rebuild

set -e

echo "🚀 Building Master Order with OPTIMIZED caching..."
echo "🔒 Data Safety: 100% PostgreSQL data safe (identical runtime to original)"
echo ""

# Enable BuildKit for better caching and performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Check if --no-cache flag is passed
if [ "$1" == "--no-cache" ]; then
    echo "⚠️  Building WITHOUT cache (full rebuild)..."
    docker build --no-cache -f Dockerfile.optimized -t master-order:latest .
else
    echo "✅ Building WITH cache (incremental rebuild)..."
    docker build -f Dockerfile.optimized -t master-order:latest .
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build stats:"
docker images master-order:latest --format "Size: {{.Size}}"
echo ""
echo "🎯 Next steps:"
echo "   docker-compose up -d     # Start the container"
echo "   docker logs -f master-order  # View logs"
