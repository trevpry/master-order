#!/bin/bash
# Setup Note Templates for Docker/Unraid
# This script can be run inside a Docker container to setup default note templates

echo "🐳 Docker/Unraid Note Templates Setup"
echo "====================================="

# Change to the correct directory
cd /app || {
    echo "❌ ERROR: /app directory not found. Are you running this inside the Docker container?"
    exit 1
}

# Check if we're in a Docker environment
if [ ! -f "server/scripts/setup-note-templates.js" ]; then
    echo "❌ ERROR: Note templates script not found. Container may not be properly built."
    exit 1
fi

# Run the template setup script
echo "🔧 Running note templates setup..."
node server/scripts/setup-note-templates.js

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: Note templates setup completed!"
    echo "💡 You can now use the Notes section with default templates."
else
    echo ""
    echo "❌ FAILED: Note templates setup failed."
    echo "💡 Check the logs above for error details."
    exit 1
fi
