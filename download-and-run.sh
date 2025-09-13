#!/bin/bash

# Direct download and run script for Master Order
# This bypasses any local version issues by downloading directly from GitHub

REPO_PATH="/mnt/user/appdata/master-order-build/master-order"
GITHUB_RAW_URL="https://raw.githubusercontent.com/trevpry/master-order/master/update-unraid.sh"

echo "🔄 Master Order Direct Update - Downloading latest script..."

# Create temp directory
TEMP_DIR="/tmp/master-order-update"
mkdir -p "$TEMP_DIR"

# Download latest script
echo "📥 Downloading latest update script from GitHub..."
if curl -L -o "$TEMP_DIR/update-unraid.sh" "$GITHUB_RAW_URL"; then
    echo "✅ Downloaded latest script"
    chmod +x "$TEMP_DIR/update-unraid.sh"
    
    # Run the downloaded script
    echo "🚀 Running latest Master Order update script..."
    bash "$TEMP_DIR/update-unraid.sh"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
else
    echo "❌ Failed to download script from GitHub"
    echo "Please check your internet connection and try again"
    exit 1
fi