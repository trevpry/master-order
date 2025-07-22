# Docker Build Fix for Your Unraid System

## Your Issue
Your Unraid system doesn't have Docker buildx installed, so the `docker buildx` command isn't recognized. This is normal for older Docker installations.

## Immediate Solution

**Use the standard Docker build command:**

```bash
# Make sure you're in the right directory first
cd /mnt/user/appdata/master-order-build/master-order
ls -la Dockerfile  # Should show the file exists

# Now build with the standard command
docker build -t master-order:latest .
```

## What You'll See

The build will show output like this:
```
Sending build context to Docker daemon  XX.XXkB
Step 1/XX : FROM node:18-alpine AS build
 ---> a1b2c3d4e5f6
Step 2/XX : RUN apk add --no-cache python3 make g++
 ---> Running in 1234567890ab
... (many more steps)
Step XX/XX : CMD ["./docker-entrypoint.sh"]
 ---> xyz789abc123
Successfully built xyz789abc123
Successfully tagged master-order:latest
```

## If You Get Warnings

If you see deprecation warnings about the legacy builder, you can suppress them:
```bash
DOCKER_BUILDKIT=0 docker build -t master-order:latest .
```

## Verify the Build Worked

After the build completes successfully:
```bash
# Check that your image was created
docker images master-order

# You should see:
# REPOSITORY     TAG       IMAGE ID       CREATED         SIZE
# master-order   latest    abc123def456   X minutes ago   XXX MB
```

## Complete Working Commands

Here's the exact sequence that will work on your system:

```bash
# 1. Navigate to your project directory
cd /mnt/user/appdata/master-order-build/master-order

# 2. Verify files are present
ls -la Dockerfile docker-entrypoint.sh

# 3. Make scripts executable
chmod +x docker-entrypoint.sh

# 4. Build the image (this is the key command that will work)
docker build -t master-order:latest .

# 5. Verify it worked
docker images master-order
```

## Why buildx Didn't Work

- `buildx` is a newer Docker plugin for advanced building
- Your Unraid installation uses the classic Docker build system
- The standard `docker build` command works perfectly for your needs
- You don't need buildx for this project

## Next Steps

Once your build completes successfully, continue with the guide from Step 7 (Verify Image Was Built). All the subsequent steps will work the same way.

**The corrected command for your system is simply:**
```bash
docker build -t master-order:latest .
```
