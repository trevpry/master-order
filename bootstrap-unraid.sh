#!/bin/bash

# Bootstrap script for Master Order Unraid updates
# This simple script pulls the latest code first, then runs the main update script

REPO_PATH="/mnt/user/appdata/master-order-build/master-order"

echo "🔄 Master Order Bootstrap - Pulling latest code first..."

# Check if repository exists
if [ ! -d "$REPO_PATH" ]; then
    echo "❌ Repository path not found: $REPO_PATH"
    echo "Please update the REPO_PATH variable in this script"
    exit 1
fi

cd "$REPO_PATH"

# Pull latest code from GitHub
echo "📥 Pulling latest code from GitHub..."
git config pull.rebase false 2>/dev/null || true

if ! git status --porcelain | grep -q .; then
    # No local changes, try normal pull
    if git pull origin master; then
        echo "✅ Successfully pulled latest code"
    else
        echo "⚠️ Normal pull failed, trying force reset..."
        git fetch origin master
        git reset --hard origin/master
        if [ $? -eq 0 ]; then
            echo "✅ Force reset successful"
        else
            echo "❌ Failed to update code"
            exit 1
        fi
    fi
else
    echo "⚠️ Local changes detected, resetting to remote version..."
    git fetch origin master
    git reset --hard origin/master
    if [ $? -eq 0 ]; then
        echo "✅ Force reset successful"
    else
        echo "❌ Failed to update code"
        exit 1
    fi
fi

# Now run the updated main script
echo "🚀 Running updated Master Order script..."
bash ./update-unraid.sh