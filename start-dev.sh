#!/bin/bash

# Master Order Development Environment Starter (Bash)
# This script starts the development container with volume mounts

echo "🚀 Starting Master Order Development Environment..."

# Stop any existing development container
echo "🛑 Stopping any existing development containers..."
docker-compose -f docker-compose.dev.yml down

# Build and start the development environment
echo "🔨 Building and starting development container..."
docker-compose -f docker-compose.dev.yml up --build -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start development environment."
    exit 1
fi

echo "✅ Development environment started successfully!"
echo ""
echo "📊 Container Status:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "🌐 Application available at: http://localhost:3001"
echo "📝 View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "🛑 Stop environment: docker-compose -f docker-compose.dev.yml down"
echo ""
echo "💡 Your code changes will be reflected instantly!"
