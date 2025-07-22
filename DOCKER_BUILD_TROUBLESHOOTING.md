# Docker Build Troubleshooting Guide

## Your Error Analysis

You encountered two issues:
1. **Deprecation Warning**: "The legacy builder is deprecated"
2. **Build Failure**: "docker build requires exactly 1 argument"

## Immediate Solutions

### Fix 1: Verify You're in the Correct Directory
```bash
# Check your current location
pwd

# Look for the Dockerfile
ls -la Dockerfile

# If Dockerfile is not found, search for it
find . -name "Dockerfile" -type f

# Navigate to the correct directory
cd /path/to/directory/containing/dockerfile
```

### Fix 2: Use Modern Docker Build Command
```bash
# Option 1: Use buildx (recommended)
docker buildx build -t master-order:latest .

# Option 2: Use legacy builder with BuildKit disabled (suppresses warning)
DOCKER_BUILDKIT=0 docker build -t master-order:latest .

# Option 3: Install buildx if not available
docker buildx install
```

## Step-by-Step Verification

### 1. Verify File Structure
Your directory should contain these key files:
```bash
ls -la
# Expected output should include:
# Dockerfile
# docker-compose.yml
# package.json
# server/
# client/
# docker-entrypoint.sh
```

### 2. Check Docker Version
```bash
docker --version
# Should show Docker version 20.10+ for best compatibility
```

### 3. Test Build Command Step by Step
```bash
# Step 1: Verify syntax
docker buildx build --help

# Step 2: Try a simple build (dry run)
docker buildx build --dry-run -t master-order:latest .

# Step 3: Full build
docker buildx build -t master-order:latest .
```

## Common Directory Issues on Unraid

### Issue: Wrong Working Directory
```bash
# You might be in the wrong place. Common scenarios:

# Scenario 1: You're in the parent directory
cd /mnt/user/appdata/master-order-build
ls  # Should show master-order folder
cd master-order  # Enter the actual project directory

# Scenario 2: You extracted files to a subdirectory
cd /mnt/user/appdata/master-order-build
find . -name "Dockerfile" -type f  # Find where it actually is
cd ./path/to/actual/project  # Navigate there

# Scenario 3: Files weren't transferred properly
# Re-transfer your files from your development machine
```

### Issue: File Permissions
```bash
# Fix ownership and permissions
chown -R root:root .
chmod +x docker-entrypoint.sh
chmod 644 Dockerfile
```

## Alternative Build Methods

### Method 1: Using Docker Compose
```bash
# If docker build fails, try docker-compose
docker-compose build
```

### Method 2: Manual Multi-Stage Build
```bash
# Build just the first stage to test
docker buildx build --target=build -t master-order:build .

# Then build the full image
docker buildx build -t master-order:latest .
```

### Method 3: Build with Verbose Output
```bash
# Get detailed build information
docker buildx build --progress=plain -t master-order:latest .
```

## Unraid-Specific Considerations

### Docker Version on Unraid
```bash
# Check if Unraid has buildx support
docker buildx version

# If not available, update Docker or use legacy method
DOCKER_BUILDKIT=0 docker build -t master-order:latest .
```

### Memory Considerations
```bash
# Large builds might need more memory
# Check available memory
free -h

# If low on memory, build with limited parallel jobs
docker buildx build --progress=plain -t master-order:latest .
```

## Complete Working Example

Here's the exact sequence that should work:

```bash
# 1. SSH to your Unraid server
ssh root@your-unraid-ip

# 2. Navigate to where you put the project files
cd /mnt/user/appdata/master-order-build

# 3. Verify you're in the right place
ls -la Dockerfile  # This should show the file exists

# 4. Make scripts executable
chmod +x docker-entrypoint.sh

# 5. Build the image using modern method
docker buildx build -t master-order:latest .

# 6. Verify the build succeeded
docker images master-order
```

## Success Indicators

You'll know it worked when you see:
```
[+] Building XX.Xs (XX/XX) FINISHED
 => => naming to docker.io/library/master-order:latest
```

And then:
```bash
docker images master-order
# Shows: master-order   latest   abc123   X minutes ago   XXX MB
```

## Still Having Issues?

If you continue having problems, run this diagnostic:

```bash
#!/bin/bash
echo "=== Docker Build Diagnostic ==="
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la
echo ""
echo "Docker version:"
docker --version
echo ""
echo "Buildx available:"
docker buildx version 2>/dev/null || echo "Buildx not available"
echo ""
echo "Dockerfile content (first 10 lines):"
head -10 Dockerfile 2>/dev/null || echo "Dockerfile not found"
echo ""
echo "Available disk space:"
df -h .
echo ""
echo "Docker daemon status:"
systemctl is-active docker
```

Run this diagnostic and share the output if you need further help!
