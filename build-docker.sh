#!/bin/bash
# Build script for Master Order Docker image

set -e

echo "🏗️  Building Master Order Docker Image"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Set image name and tag
IMAGE_NAME="master-order"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "📋 Building image: ${FULL_IMAGE_NAME}"

# Build the Docker image
docker build -t "${FULL_IMAGE_NAME}" .

echo "✅ Build completed successfully!"

# Optional: Show image size
echo "📊 Image information:"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo "🚀 To run the container:"
echo "   docker run -d --name master-order -p 3001:3001 -v \$(pwd)/data:/app/data ${FULL_IMAGE_NAME}"
echo ""
echo "🐳 To use with docker-compose:"
echo "   docker-compose up -d"
echo ""
echo "📦 To save image for transfer:"
echo "   docker save ${FULL_IMAGE_NAME} | gzip > master-order-docker-image.tar.gz"
