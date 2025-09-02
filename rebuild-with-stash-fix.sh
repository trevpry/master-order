#!/bin/bash
echo "🔧 Rebuilding Master Order with Multi-URL Stash Connection Testing"
echo "================================================================="
echo ""
echo "📋 Configuration Summary:"
echo "   Primary URL: http://stash.internal:9999"
echo "   Fallback 1:  http://192.168.1.154:9999" 
echo "   Fallback 2:  http://192.168.1.114:9999"
echo "   Fallback 3:  http://localhost:9999"
echo "   Fallback 4:  http://host.docker.internal:9999"
echo ""
echo "🐳 Network Mode: host (preserves Plex connectivity)"
echo "🔗 Host Mapping: stash.internal -> 192.168.1.154"
echo ""
echo "🚀 Starting rebuild..."

# Stop current container
docker-compose down

# Remove old container and images to ensure clean build
docker container rm master-order 2>/dev/null || true
docker image rm master-order_master-order 2>/dev/null || true

# Build and start with new configuration
docker-compose up -d --build

echo ""
echo "✅ Container rebuilt! Checking logs..."
echo "   Watch for: '✅ Stash connection successful: http://stash.internal:9999'"
echo ""
echo "🔍 To monitor logs: docker logs master-order -f"
echo "================================================================="
