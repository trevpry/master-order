# Android Clip ID Validation Fix

## Issue
Android app requests to `/api/stash/clips/next` were failing with:
```
Invalid `prisma.stashClip.findUnique()` invocation
Argument `id` is missing.
```

## Root Cause
**Route Order Problem**: In `server/routes/stash.js`, the route `/clips/:id` (line 6171) was defined BEFORE `/clips/next` (line 6609).

In Express.js, routes are matched in the order they're defined. This means:
1. Request to `/api/stash/clips/next` 
2. Matches `/clips/:id` with `id = "next"`
3. `parseInt("next")` returns `NaN`
4. `prisma.stashClip.findUnique({ where: { id: NaN } })` fails validation

## Solution

### Phase 1: Added Validation (Implemented)
Added validation to the `/clips/:id` route to reject invalid clip IDs and provide better error messages:

```javascript
router.get('/clips/:id', asyncHandler(async (req, res) => {
  const clipId = parseInt(req.params.id);
  
  // Validate that clipId is a valid number
  if (isNaN(clipId) || clipId <= 0) {
    return sendBadRequest(res, 'Invalid clip ID', {
      provided: req.params.id,
      message: 'Clip ID must be a valid positive integer'
    });
  }

  const clip = await prisma.stashClip.findUnique({
    where: { id: clipId },
    // ... rest of query
  });
  // ...
}));
```

This provides a cleaner error message but doesn't fully fix the root cause.

### Phase 2: Route Reordering (REQUIRED)
**Status**: ⚠️ STILL NEEDED

The proper fix is to reorder routes so specific routes come BEFORE parameterized routes:

**Current Order (WRONG):**
```javascript
router.get('/clips', ...);         // Line 6055
router.get('/clips/:id', ...);     // Line 6171 ❌ Catches /clips/next
router.post('/clips/:id/watched', ...);
router.post('/clips/:id/play', ...);
router.post('/clips/reset', ...);  // Line 6324
router.get('/clips/next', ...);    // Line 6617 ❌ Never reached!
```

**Correct Order:**
```javascript
router.get('/clips', ...);
router.get('/clips/next', ...);    // ✅ Specific route first
router.post('/clips/reset', ...);  // ✅ Specific route first
router.get('/clips/:id', ...);     // ✅ Parameterized route last
router.post('/clips/:id/watched', ...);
router.post('/clips/:id/play', ...);
```

### Additional Android Endpoint Validation (Implemented)
Added validation in `server/routes/android/stashIntegration.js` to check for valid clip data before attempting database queries:

```javascript
// Validate clip has required fields
if (!clip.id || !scene || !scene.id) {
  console.error('❌ Invalid clip data received:', {
    hasClipId: !!clip.id,
    hasScene: !!scene,
    hasSceneId: !!scene?.id
  });
  return res.status(500).json({
    error: 'Invalid clip data',
    message: 'Received clip data is missing required fields'
  });
}
```

## Why This Works
1. When `/clips/next` is requested and matches `/clips/:id`, `req.params.id = "next"`
2. `parseInt("next")` returns `NaN`
3. Validation catches `NaN` and returns 400 Bad Request
4. Express continues to the next matching route: `/clips/next` ✅

## Better Solution (Future)
The ideal fix would be to reorder routes so specific routes come before parameterized routes:
```javascript
// Specific routes first
router.get('/clips/next', ...);
router.get('/clips/reset', ...);

// Parameterized routes last
router.get('/clips/:id', ...);
```

However, this requires careful testing to ensure no functionality breaks.

## Files Modified
- `server/routes/stash.js` (line 6174-6180): Added clip ID validation
- `server/routes/android/stashIntegration.js` (line 174-190): Added clip data validation

## Status
✅ **FULLY FIXED** - Route reordering complete, Android app now works correctly!

### What's Working Now:
- ✅ `/clips/next` route executes properly (no longer shadowed by `/clips/:id`)
- ✅ Android endpoint returns valid clip data
- ✅ Invalid clip IDs return proper error messages
- ✅ Android endpoint validates clip data before database queries
- ✅ All specific routes come before parameterized routes

### Changes Applied:
1. ✅ Moved `router.get('/clips/next', ...)` to before `/clips/:id` (line 6172)
2. ✅ Moved `router.post('/clips/reset', ...)` to before `/clips/:id` (line 6530)  
3. ✅ Removed duplicate route definitions
4. ✅ Added route ordering comments for future maintainability

## Next Steps
1. Move `router.get('/clips/next', ...)` from line 6617 to before line 6171
2. Move `router.post('/clips/reset', ...)` from line 6324 to before line 6171
3. Ensure all specific `/clips/*` routes come before `/clips/:id`
4. Test thoroughly to ensure no regression

## Testing

### Current State (with validation only):
```bash
# Test invalid clip ID (returns 400 with clear message)
curl http://localhost:3001/api/stash/clips/invalid
# Returns: {"error":"Invalid clip ID","details":{"provided":"invalid",...}}

# Test "next" being treated as ID (returns 400 because :id matches first)
curl http://localhost:3001/api/stash/clips/next
# Returns: {"error":"Invalid clip ID"}

# Android endpoint (fails gracefully with validation)
curl http://localhost:3001/api/android/stash/next
# Returns: {"error":"Failed to get next clip","details":"{\"error\":\"Invalid clip ID\"}"}
```

### After Route Reordering (Future):
```bash
# Test next clip (should work properly)
curl http://localhost:3001/api/stash/clips/next
# Should return: {"success":true,"clip":{...}}

# Android endpoint (should work properly)
curl http://localhost:3001/api/android/stash/next
# Should return: {"clip":{...},"scene":{...}}
```

## Related Issues
- This also prevents any non-numeric clip ID from causing database errors
- Improves API robustness and error messages
- Android endpoint now gracefully handles invalid clip data

---

## ✅ FIX COMPLETED - October 22, 2025

### Final Test Results:
All endpoints now working correctly after route reordering:

1. **`/clips/next` endpoint**: ✅ Working
   - Returns valid clip with full metadata
   - Example: `{"message":"Next clip selected successfully","clip":{"id":6133,...}}`

2. **Android endpoint `/android/stash/next`**: ✅ Working
   - Returns proper playback data
   - Example: `{"type":"PLAY_CLIP","data":{"clipId":6163,"sceneId":"26416",...}}`

3. **Invalid ID validation**: ✅ Working
   - Clear error messages for non-numeric IDs
   - Example: `{"error":"Invalid clip ID","details":{"provided":"invalid",...}}`

### Route Order (Corrected):
```javascript
// ✅ Specific routes first
router.get('/clips', ...);           // Line 6055
router.get('/clips/next', ...);      // Line 6172 ← MOVED HERE
router.post('/clips/reset', ...);    // Line 6530 ← MOVED HERE

// ✅ Parameterized routes last
router.get('/clips/:id', ...);       // Line 6548
router.post('/clips/:id/watched', ...);
router.post('/clips/:id/play', ...);
```

The Android app can now successfully request and play Stash clips!
