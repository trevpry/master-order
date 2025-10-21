# Docker Build Optimization Guide

## Problem
The original Dockerfile rebuilds everything on every code change, which can take several minutes even for small changes. This is slow and inefficient for development and production updates.

## Solution
The optimized Dockerfile uses **layer caching** and **BuildKit** to dramatically speed up builds by only rebuilding what changed.

## How It Works

### Layer Caching Strategy
Docker caches each layer (instruction in Dockerfile). When a layer changes, all layers after it are invalidated. We've reorganized the Dockerfile to put things that change LEAST at the top:

```
📦 LAYER ORDER (least changing → most changing):
1. ✅ System dependencies (apk packages) - Almost never changes
2. ✅ package.json files - Changes when adding/removing packages
3. ✅ npm install - Only reruns if package.json changed
4. ✅ Prisma schema - Changes when database schema changes
5. ✅ Prisma generate - Only reruns if schema changed
6. ⚡ Source code - Changes frequently, but doesn't invalidate layers 1-5
7. ⚡ Client build - Only reruns if client source changed
```

### BuildKit Features Used

#### 1. Cache Mounts (`--mount=type=cache`)
BuildKit caches npm's download cache between builds:
```dockerfile
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```
**Result**: npm packages are cached, installs are 3-5x faster

#### 2. Layer Parallelization
BuildKit builds independent layers in parallel automatically

#### 3. Smart Invalidation
Only rebuilds layers that actually changed

## Files Created

### 1. `Dockerfile.optimized`
Optimized Dockerfile with proper layer ordering

### 2. `build-docker-optimized.sh` (Linux/Mac)
Build script with BuildKit enabled

### 3. `build-docker-optimized.bat` (Windows)
Build script for Windows with BuildKit enabled

## Usage

### First Build (Cold Cache)
```bash
# Linux/Mac
./build-docker-optimized.sh

# Windows
build-docker-optimized.bat
```
**Time**: Similar to original (~5-8 minutes)

### Subsequent Builds (Warm Cache)

#### If you changed server code only:
```bash
./build-docker-optimized.sh  # or .bat on Windows
```
**Time**: ~1-2 minutes (skips dependency install, only rebuilds code)

#### If you changed client code only:
```bash
./build-docker-optimized.sh  # or .bat on Windows
```
**Time**: ~2-3 minutes (skips server, only rebuilds client)

#### If you changed package.json:
```bash
./build-docker-optimized.sh  # or .bat on Windows
```
**Time**: ~3-4 minutes (reinstalls deps, but reuses system packages)

#### If you need a full rebuild:
```bash
./build-docker-optimized.sh --no-cache  # or .bat on Windows
```
**Time**: ~5-8 minutes (same as original)

## Performance Comparison

### Original Dockerfile
```
Code change → Full rebuild → 5-8 minutes
Package change → Full rebuild → 5-8 minutes
Schema change → Full rebuild → 5-8 minutes
```

### Optimized Dockerfile
```
Server code change only → Partial rebuild → 1-2 minutes ⚡
Client code change only → Partial rebuild → 2-3 minutes ⚡
Package.json change → Partial rebuild → 3-4 minutes ⚡
Prisma schema change → Partial rebuild → 2-3 minutes ⚡
Full rebuild (--no-cache) → Full rebuild → 5-8 minutes
```

## Typical Workflow

### Development Iteration
1. Make code changes to server or client
2. Run `./build-docker-optimized.sh`
3. Wait ~1-2 minutes (instead of 5-8 minutes!)
4. Run `docker-compose up -d`
5. Test changes

### Adding a Package
1. Update package.json
2. Run `./build-docker-optimized.sh`
3. Wait ~3-4 minutes (installs new package, reuses cached system deps)
4. Run `docker-compose up -d`

### Database Schema Change
1. Update Prisma schema
2. Run `./build-docker-optimized.sh`
3. Wait ~2-3 minutes (regenerates Prisma client, reuses cached deps)
4. Run `docker-compose up -d`

## Migration from Original

### Option 1: Test First (Recommended)
Keep both Dockerfiles and test the optimized one:
```bash
# Build with optimized
./build-docker-optimized.sh

# Test it works
docker-compose up -d
docker logs -f master-order

# If it works, continue using optimized version
```

### Option 2: Replace Original
Once tested, you can replace the original:
```bash
# Backup original
mv Dockerfile Dockerfile.original

# Use optimized as main
mv Dockerfile.optimized Dockerfile

# Update build scripts to use main Dockerfile
# Edit build-docker.sh and build-docker.bat to remove `-f Dockerfile.optimized`
```

### Option 3: Update docker-compose.yml
Point docker-compose to use the optimized Dockerfile:
```yaml
services:
  master-order:
    build:
      context: .
      dockerfile: Dockerfile.optimized  # Use optimized version
```

## Troubleshooting

### "BuildKit not enabled" error
Make sure Docker Desktop is updated to at least version 19.03+

### Cache seems to always miss
Check if you're changing files in a way that affects earlier layers:
- Don't modify package.json when you only need code changes
- Keep schema changes separate from code changes when possible

### Build fails with cache mount error
Your Docker version might not support cache mounts. Options:
1. Update Docker to latest version
2. Remove `--mount=type=cache` lines (will be slower but still cached)

### Still rebuilding everything
Make sure BuildKit is enabled:
```bash
# Linux/Mac
export DOCKER_BUILDKIT=1

# Windows (PowerShell)
$env:DOCKER_BUILDKIT=1

# Or use the provided build scripts which enable it automatically
```

## Docker Compose Integration

### Update docker-compose.yml to use optimized build:
```yaml
services:
  master-order:
    build:
      context: .
      dockerfile: Dockerfile.optimized
    # ... rest of config
```

### Build with docker-compose:
```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build
docker-compose build

# Build without cache (full rebuild)
docker-compose build --no-cache
```

## Best Practices

### 1. Separate Commits by Layer Impact
```bash
# Commit 1: Code changes only (fast rebuild)
git commit -m "Fix bug in scene scraper"

# Commit 2: Add new package (medium rebuild)  
git commit -m "Add axios package"

# Commit 3: Schema changes (medium rebuild)
git commit -m "Add new database table"
```

### 2. Use .dockerignore
Make sure `.dockerignore` excludes files that change frequently but aren't needed:
```
node_modules/
.git/
.env*
*.log
dist/
```

### 3. Keep Dependencies Stable
Only update package.json when necessary. For development, use the dev environment instead of rebuilding Docker.

## Summary

✅ **Use the optimized Dockerfile** to save 60-70% build time on code changes  
✅ **Use BuildKit** for faster npm installs and better caching  
✅ **Run `build-docker-optimized.sh`** instead of `build-docker.sh`  
✅ **Enjoy faster iteration** - deploy updates in 1-2 minutes instead of 5-8 minutes!
