# Phase 2: Stash Enhanced Data Structure and Relationships

## Overview
Phase 2 focuses on enhancing the existing Stash data structure with performance optimizations, additional metadata fields, user interaction tracking, and advanced statistics support while maintaining full compatibility between SQLite (development) and PostgreSQL (production/Docker).

## Key Improvements

### 1. Performance Optimization Indexes
- Add database indexes for frequently queried fields
- Optimize junction table performance
- Improve search and filtering performance

### 2. Enhanced Metadata Fields
- Scene quality tracking (resolution, format, bitrate)
- Enhanced performer information (popularity scores, stats)
- Studio metadata enhancements
- File system metadata tracking

### 3. User Interaction Tracking
- Comprehensive watch/view history
- Rating system with timestamps
- Favorites and collections
- Search history and recommendations

### 4. Advanced Statistics Support
- Performance metrics for scenes, performers, studios
- Aggregated data for dashboard views
- Trending analysis support
- Content discovery enhancements

### 5. Cross-Database Compatibility Features
- Database-agnostic field types
- Proper foreign key constraints
- Index optimization for both SQLite and PostgreSQL
- Migration-safe schema changes

## Implementation Strategy

All changes will be implemented using:
1. ✅ Prisma schema modifications
2. ✅ Database migrations that work on both SQLite and PostgreSQL
3. ✅ Backward compatibility preservation
4. ✅ Three-schema synchronization (main, SQLite, PostgreSQL)
5. ✅ Performance testing on both database engines

## Database Compatibility Notes

### SQLite Specific Considerations
- Limited concurrent write operations
- No native UUID type (using String)
- Simplified full-text search capabilities
- File-based storage optimization

### PostgreSQL Specific Considerations  
- Superior concurrent access handling
- Advanced indexing capabilities (GIN, GIST)
- Native full-text search support
- JSON field support for complex metadata
- Better performance for large datasets

### Cross-Compatible Design
- Use Prisma's database-agnostic field types
- Implement indexes that work on both engines
- Design queries that perform well on both systems
- Use JSON fields sparingly (SQLite has limited JSON support)

## Performance Targets

### Development (SQLite)
- ✅ Fast local development experience
- ✅ Quick schema migrations
- ✅ Minimal resource usage
- ✅ File-based portability

### Production (PostgreSQL)
- ✅ Handle 10K+ scenes efficiently  
- ✅ Support concurrent user access
- ✅ Sub-second query response times
- ✅ Efficient full-text search
- ✅ Scalable aggregation queries

## Migration Strategy

All Phase 2 enhancements will be deployed using:
1. **Additive Changes First**: Add new fields/tables without breaking existing functionality
2. **Data Migration Scripts**: Populate new fields from existing data where applicable
3. **Gradual Feature Rollout**: Enable new features incrementally
4. **Rollback Safety**: Ensure all changes can be safely reverted
5. **Schema Synchronization**: Maintain all three schema files consistently

## Testing Protocol

Each enhancement will be tested on:
- ✅ SQLite (development environment)
- ✅ PostgreSQL (Docker/production environment) 
- ✅ Schema migration processes
- ✅ Data integrity validation
- ✅ Performance benchmarking
- ✅ Backward compatibility verification
