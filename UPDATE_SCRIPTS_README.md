# Docker Update Scripts

This directory contains several update scripts to efficiently update your Master Order container without rebuilding from scratch each time.

## Scripts Available

### 1. `update-container.ps1` (Windows PowerShell)
Use this script on your Windows development machine.

**Usage:**
```powershell
.\update-container.ps1
```

### 2. `update-container.sh` (Linux/Mac)
Use this script on Linux or Mac systems.

**Usage:**
```bash
chmod +x update-container.sh
./update-container.sh
```

### 3. `update-unraid.sh` (Unraid Server)
Use this script directly on your Unraid server.

**Setup on Unraid:**
1. SSH into your Unraid server
2. Navigate to your app directory (usually `/mnt/user/appdata/master-order`)
3. Copy this script to the directory
4. Make it executable: `chmod +x update-unraid.sh`
5. Update the `REPO_PATH` variable if needed

**Usage:**
```bash
./update-unraid.sh
```

## What These Scripts Do

1. **Pull Latest Code**: Downloads the latest changes from your GitHub repository
2. **Stop Container**: Gracefully stops the running container
3. **Remove Old Container**: Removes the container (but keeps the image for faster rebuilds)
4. **Rebuild Image**: Builds a new image with the updated code
5. **Start New Container**: Starts the updated container with the same settings

## Benefits of This Approach

- ✅ **Fast Updates**: Only rebuilds the changed layers
- ✅ **Data Persistence**: Your database is preserved via volume mount
- ✅ **Automated Process**: One command updates everything
- ✅ **Rollback Capable**: Easy to revert if needed
- ✅ **Production Ready**: Includes proper restart policies and networking

## Unraid Integration

For the smoothest Unraid experience:

1. **User Scripts Plugin**: Install the User Scripts plugin in Unraid
2. **Add Update Script**: Create a new user script with the contents of `update-unraid.sh`
3. **Schedule Updates**: Optionally schedule automatic updates
4. **WebUI Access**: Continue accessing via http://192.168.1.252:3001

## Troubleshooting

### If the update fails:
```bash
# Check container logs
docker logs master-order

# Check if container is running
docker ps | grep master-order

# Restart manually if needed
docker restart master-order
```

### If you need to rollback:
```bash
# Stop current container
docker stop master-order
docker rm master-order

# Checkout previous git commit
git log --oneline -5  # See recent commits
git checkout <previous-commit-hash>

# Rebuild and restart
docker build -t master-order .
docker run -d --name master-order -p 3001:3001 -v "$(pwd)/master_order.db:/app/master_order.db" master-order
```

## Development Workflow

1. Make changes to your code
2. Commit and push to GitHub: `git add . && git commit -m "Your changes" && git push`
3. Run the appropriate update script
4. Test your changes at http://192.168.1.252:3001

This workflow allows you to deploy updates in under a minute instead of doing full container rebuilds!
