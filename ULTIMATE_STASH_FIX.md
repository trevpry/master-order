# DOCKER STASH CONNECTION - ULTIMATE FIX 🚀

## Problem Analysis ✅
Your connectivity test shows:
- ✅ `http://192.168.1.154:9999` works from your local machine
- ❌ Docker container can't reach this IP due to network isolation

## Solution Applied

### 1. Custom Docker Network with Host Mapping 🌐
Created custom bridge network with explicit host mapping:

```yaml
networks:
  master-order-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

extra_hosts:
  - "stash.local:192.168.1.154"  # Maps stash.local to your Stash server
```

### 2. Multiple URL Fallback System 🔄
Updated code to try URLs in order:
1. `http://stash.local:9999` (custom host mapping)
2. `http://192.168.1.154:9999` (direct IP)
3. `http://host.docker.internal:9999` (Docker Desktop)
4. `http://172.20.0.1:9999` (bridge gateway)

### 3. Smart Connection Testing 🧪
Application now tests each URL and uses the first working one.

## Deployment Steps

### Step 1: Deploy Updated Container
```bash
# Stop current container
docker-compose down

# Remove old container and images
docker container rm master-order 2>/dev/null || true
docker image rm master-order_master-order 2>/dev/null || true

# Deploy with new network configuration
docker-compose up -d --build

# Watch logs for connection testing
docker logs master-order -f
```

### Step 2: Verify Stash Connection
Look for these messages in the logs:
```
🔍 Initializing Stash service...
   - Testing connection to: http://stash.local:9999
   ✅ Connection successful to: http://stash.local:9999
✅ Stash service initialized
```

### Step 3: Test from Inside Container (If Still Issues)
```bash
# Enter running container
docker exec -it master-order bash

# Run network connectivity test
bash /app/docker-network-test.sh

# Or manual test
curl -v http://stash.local:9999/graphql
curl -v http://192.168.1.154:9999/graphql
```

## Expected Results

### ✅ Success Indicators:
- No more `EHOSTUNREACH` errors
- Stash sync completes successfully
- Android endpoints return proper stream URLs
- Container logs show successful connection test

### 🚨 If Still Not Working:

**Option A: Host Networking (Linux/Unraid only)**
```yaml
services:
  master-order:
    network_mode: host
    # Remove ports section when using host mode
```

**Option B: Force Direct IP**
Update docker-compose.yml:
```yaml
- "STASH_URL=http://192.168.1.154:9999"
```
And add to container with privileged networking:
```yaml
privileged: true
```

**Option C: External Network Bridge**
If your Docker host is on Unraid, create external network:
```bash
docker network create --driver bridge --subnet=192.168.1.0/24 unraid-bridge
```

Then use in docker-compose.yml:
```yaml
networks:
  default:
    external: true
    name: unraid-bridge
```

## Testing Commands

### Local Testing (Before Docker):
```bash
node debug-stash-connectivity.js
```

### Container Testing (After Deployment):
```bash
docker exec -it master-order bash -c "curl -s http://stash.local:9999/graphql -d '{\"query\":\"{version{version}}\"}' -H 'Content-Type: application/json'"
```

### Application Testing:
```bash
# Test Stash sync via API
curl http://localhost:3001/api/stash/sync

# Check Android endpoint
curl http://localhost:3001/api/android/stash/next
```

## Why This Should Work Now

1. **Custom Network**: Eliminates Docker's default network restrictions
2. **Host Mapping**: `stash.local` directly maps to your Stash server IP
3. **Fallback System**: If one URL fails, others are tested automatically
4. **Connection Testing**: Application validates connectivity before using URL

The key insight is that `192.168.1.154` works from your machine but not from Docker's isolated network. By creating `stash.local` hostname mapping and custom networking, we bypass Docker's network isolation while maintaining security.

## Deploy Now! 🚀
```bash
docker-compose down && docker-compose up -d --build
```
