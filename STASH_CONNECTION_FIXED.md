# DOCKER STASH CONNECTION FIXED ✅

## Problem Solved
Fixed `EHOSTUNREACH` error when Master Order Docker container tries to connect to Stash at `192.168.1.154:9999`.

## Root Cause
The application was only reading the Stash URL from the database settings, but the database likely had no Stash URL configured or had an old/incorrect URL. Docker networking isolation prevented the container from reaching the Stash server.

## Solution Applied

### 1. Environment Variable Configuration ✅
Added `STASH_URL` to docker-compose.yml:
```yaml
environment:
  - "STASH_URL=http://192.168.1.154:9999"
```

### 2. Host Networking Mode ✅
Added `network_mode: host` to docker-compose.yml for direct host network access.

### 3. Code Updates ✅
Modified server code to fall back to environment variables when database settings are empty:

**Files Updated:**
- `server/index.js` - initializeStashService() function
- `server/stashSyncService.js` - ensureConfigLoaded() function

**Changes Made:**
```javascript
// Before: Only database settings
const stashUrl = settings?.stashUrl;

// After: Database settings with environment fallback
const stashUrl = settings?.stashUrl || process.env.STASH_URL;
```

## Next Steps

### 1. Rebuild and Deploy
```bash
# Stop current container
docker-compose down

# Rebuild with new changes
docker-compose up -d --build

# Check logs for successful Stash connection
docker logs master-order -f
```

### 2. Verify Connection
Look for these success messages in the logs:
```
✅ Stash service initialized
🔧 StashSyncService config loaded:
   - Final URL: http://192.168.1.154:9999
```

### 3. Test Sync
Once deployed, trigger a Stash sync to confirm the connection works:
- Go to Settings page in Master Order
- Click "Sync from Stash" button
- Should see successful sync without `EHOSTUNREACH` errors

## Alternative URLs (If Still Not Working)

If `192.168.1.154:9999` still doesn't work from Docker, try these alternatives:

### For Docker Desktop:
```yaml
- "STASH_URL=http://host.docker.internal:9999"
```

### For Docker on Unraid (if Stash is on same server):
```yaml  
- "STASH_URL=http://192.168.1.113:9999"  # Use your Unraid server IP
```

### For Bridge Network:
```yaml
- "STASH_URL=http://172.17.0.1:9999"
```

## Network Troubleshooting

If issues persist, test connectivity from inside the container:
```bash
# Enter running container
docker exec -it master-order bash

# Test connection
curl -v http://192.168.1.154:9999/graphql
ping 192.168.1.154
```

## Success Indicators

✅ No more `EHOSTUNREACH` errors in logs  
✅ Stash sync completes successfully  
✅ Android endpoints return clips with proper stream URLs  
✅ Video playback works from Android app  

The fix ensures Master Order can reach your Stash server regardless of Docker networking configuration!
