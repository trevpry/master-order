# Docker Artwork Cache Fix

## Problem

When rebuilding Docker images on Unraid, custom order thumbnails disappear even though:
- Database is properly persisted via volume mount
- Artwork cache directory is mounted as a persistent volume
- The actual artwork files should be preserved

## Root Cause

The issue occurs because:
1. Docker image rebuilds can sometimes reset or interfere with mounted directories
2. Database entries still reference cached artwork files that may be missing after rebuild  
3. Frontend tries to load artwork from URLs that point to non-existent files
4. No automatic cleanup of orphaned database entries

## Solution

### Automatic Cleanup (Implemented)

The artwork cache service now automatically:
1. **Checks for orphaned entries on startup** - Detects when database references point to missing files
2. **Cleans up orphaned entries** - Removes invalid database references so items show fallback artwork
3. **Logs cleanup activity** - Shows what was cleaned up during startup

### Manual Repair Tools

**Health Check:**
```bash
curl http://localhost:3001/api/artwork-cache/health
```
Returns status of artwork cache including any orphaned entries.

**Manual Repair:**
```bash
curl -X POST http://localhost:3001/api/artwork-cache/repair
```
Attempts to re-cache missing artwork and cleans up orphaned entries.

**Diagnostic Script:**
```bash
node check-artwork-cache.js
```
Shows detailed report of artwork cache status.

**Repair Script:**
```bash
node fix-orphaned-artwork.js
```
Attempts to re-cache missing artwork or clean up orphaned entries.

### Prevention

To prevent artwork cache loss during Docker rebuilds:

1. **Verify volume mounts** - Ensure artwork cache directory is properly mounted:
   ```yaml
   volumes:
     - /mnt/user/appdata/master-order/artwork-cache:/app/server/artwork-cache
   ```

2. **Check permissions** - Ensure Docker can write to the mounted directory

3. **Backup artwork cache** - Periodically backup the artwork cache directory as a precaution

## Recovery Process

If thumbnails disappear after a Docker rebuild:

1. **Check the logs** - Look for orphaned entry cleanup messages during startup
2. **Use health check** - `GET /api/artwork-cache/health` to see the extent of the issue
3. **Run manual repair** - `POST /api/artwork-cache/repair` to attempt re-caching
4. **Re-cache specific items** - Items will automatically re-cache when viewed or manually triggered

## Key Improvements

- ✅ **Automatic startup cleanup** - No manual intervention needed
- ✅ **Graceful degradation** - Items show fallback artwork instead of broken images  
- ✅ **Self-healing** - Items automatically re-cache when accessed
- ✅ **Diagnostic tools** - Easy to check and repair cache issues
- ✅ **Prevention logging** - Docker startup messages help identify issues early

## Files Changed

- `server/artworkCacheService.js` - Added orphaned entry detection and cleanup
- `server/index.js` - Added health check and repair API endpoints + Docker diagnostics
- `check-artwork-cache.js` - Diagnostic script for cache consistency
- `fix-orphaned-artwork.js` - Manual repair script

This fix ensures that Docker rebuilds won't permanently break custom order thumbnails, and provides both automatic and manual recovery mechanisms.
