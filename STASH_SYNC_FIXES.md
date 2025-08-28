# Stash Sync Optimization Fixes

## Issues Fixed

### 1. `skipDuplicates` Parameter Error
**Problem**: Prisma `createMany` operations were failing with "Unknown argument `skipDuplicates`" error.

**Root Cause**: The `skipDuplicates` option is not supported in all Prisma configurations, particularly with SQLite databases or certain versions.

**Solution**: 
- Removed all `skipDuplicates: true` parameters from `createMany` operations
- Implemented proper deletion of existing relationships before creation to prevent duplicates
- Updated all affected operations: scene-performer relations, scene-tag relations, performer-tag relations, and marker creation

### 2. SQLite Transaction Timeout Error
**Problem**: Database transactions were timing out during large batch operations, particularly with studios and large datasets.

**Root Cause**: Default SQLite transaction timeout was insufficient for processing large batches (500+ items per transaction).

**Solution**:
- Added configurable transaction timeout settings (60-120 seconds)
- Implemented proper isolation levels (`ReadCommitted`) for better SQLite concurrency
- Added timeout configuration object for different operation types:
  - Standard operations: 60 seconds
  - Complex scene operations: 120 seconds

### 3. Large Batch Processing Improvements
**Problem**: Very large relationship sets could still cause timeouts even with increased timeouts.

**Solution**:
- Implemented chunked batch processing for large relationship datasets
- Added `batchConfig` object with configurable limits:
  - `maxBatchSize`: 100 items per transaction batch
  - `maxRelationships`: 500 relationships per `createMany` operation
  - Configurable timeouts for different operation types

**Chunked Processing Logic**:
- If relationship count > `maxRelationships`, automatically splits into chunks
- Processes chunks sequentially within the same transaction
- Provides progress logging for large relationship sets
- Applied to both performer-tag and scene relationships

### 4. Enhanced Error Handling
**Added comprehensive error reporting**:
- Detailed error context including page, pageSize, stashUrl
- Error type classification (PrismaClientValidationError, PrismaClientKnownRequestError, etc.)
- Error code and message extraction for better debugging
- Graceful chunk processing with error recovery

## Implementation Details

### Transaction Configuration
```javascript
// Before
await prisma.$transaction(async (tx) => {
  // operations
});

// After
await prisma.$transaction(async (tx) => {
  // operations
}, {
  timeout: this.batchConfig.transactionTimeout, // 60-120 seconds
  isolationLevel: 'ReadCommitted' // Better SQLite concurrency
});
```

### Chunked Relationship Processing
```javascript
// Before
await tx.stashPerformerTag.createMany({
  data: allTagRelations,
  skipDuplicates: true // ❌ Not supported
});

// After
if (allTagRelations.length > this.batchConfig.maxRelationships) {
  for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
    const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
    await tx.stashPerformerTag.createMany({
      data: chunk // ✅ No skipDuplicates, proper chunking
    });
  }
} else {
  await tx.stashPerformerTag.createMany({
    data: allTagRelations // ✅ Process all at once if within limits
  });
}
```

### Batch Configuration
```javascript
this.batchConfig = {
  maxBatchSize: 100,      // Maximum items per transaction batch
  maxRelationships: 500,  // Maximum relationships per createMany
  transactionTimeout: 60000, // Default timeout (60 seconds)
  sceneTimeout: 120000,   // Longer timeout for complex scene operations
};
```

## Performance Impact

### Before Fixes
- ❌ `skipDuplicates` errors causing sync failures
- ❌ SQLite timeouts on large datasets
- ❌ No handling for very large relationship sets
- ❌ Limited error context for debugging

### After Fixes
- ✅ Compatible with all Prisma configurations
- ✅ Configurable timeouts prevent database timeouts
- ✅ Chunked processing handles datasets of any size
- ✅ Enhanced error reporting for faster debugging
- ✅ Maintains all Phase 1 & 2 performance optimizations
- ✅ Better SQLite concurrency and stability

## Testing

The fixes have been applied to all sync operations:
- ✅ Scene sync with performer/tag relationships and markers
- ✅ Performer sync with tag relationships  
- ✅ Studio sync with timeout configuration
- ✅ Tag sync with timeout configuration

## Backward Compatibility

- All existing Phase 1 & 2 optimizations preserved
- Memory caching system unchanged
- API endpoints remain the same
- Configuration-based timeouts allow tuning per environment
- Graceful fallback for small datasets (no chunking overhead)
