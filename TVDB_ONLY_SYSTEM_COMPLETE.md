# TVDB-Only Item Management System - Implementation Summary

## 🎯 Feature Overview
A sophisticated system that allows users to add TV episodes and movies to custom orders even when they don't exist in Plex yet, using data from TheTVDB. The system automatically checks for availability and updates items when they become available in Plex.

## 🔧 Components Implemented

### 1. Database Schema Enhancement
- **File**: `server/prisma/schema.prisma`
- **Changes**: Added `isFromTvdbOnly Boolean @default(false)` field to `CustomOrderItem` model
- **Migration**: Successfully applied `20250724_add_tvdb_only_field` migration

### 2. TVDB-Only Item Creation Endpoint
- **File**: `server/index.js`
- **Endpoint**: `POST /api/custom-orders/:id/items/tvdb-only`
- **Features**:
  - Validates TVDB data input
  - Generates unique plexKey for TVDB-only items
  - Stores TVDB metadata in custom order item
  - Marks items with `isFromTvdbOnly: true`

### 3. Plex Search Enhancement
- **File**: `server/plexDatabaseService.js`
- **New Methods**:
  - `searchTVEpisodes(seriesTitle, seasonNumber, episodeNumber)`: Search episodes by series, season, and episode
  - Enhanced `searchMovies(query, year)`: Already had year filtering capability
- **Purpose**: Enable checking if TVDB-only items now exist in Plex

### 4. TVDB-Only Item Management Logic
- **File**: `server/getNextCustomOrder.js`
- **New Function**: `checkIfTvdbItemExistsInPlex(customOrderItem)`
  - Searches Plex database for TVDB-only items
  - Handles both TV episodes and movies
  - Returns Plex item if found, null if not available

### 5. Custom Order Selection Enhancement
- **File**: `server/getNextCustomOrder.js`
- **Enhanced Logic**:
  - Automatic TVDB-only item checking during selection
  - Automatic update of items when they become available in Plex
  - Fallback mechanism to try different custom orders when TVDB-only items aren't available
  - Smart retry logic with maximum attempt limits

### 6. Metadata Handling
- **File**: `server/getNextCustomOrder.js`
- **Function**: `fetchMediaDetailsFromPlex()`
- **Features**:
  - Detects TVDB-only items
  - Checks Plex availability automatically
  - Updates database when items become available
  - Generates mock metadata for unavailable items
  - Preserves TVDB IDs for future reference

## 🔄 Workflow Overview

### Adding TVDB-Only Items
1. User adds TV episode/movie that doesn't exist in Plex yet
2. System stores TVDB metadata in custom order item
3. Item marked with `isFromTvdbOnly: true`
4. Unique plexKey generated for tracking

### Selecting TVDB-Only Items
1. Custom order selection encounters TVDB-only item
2. System automatically checks if item now exists in Plex
3. If found: Updates item with Plex data, marks `isFromTvdbOnly: false`
4. If not found: Tries different custom order or provides mock metadata

### Fallback Mechanism
1. Multiple custom order attempts (up to 5)
2. Skips unavailable TVDB-only items
3. Continues to next available order
4. Prevents infinite loops with maximum attempt limits

## 🛠️ API Usage

### Create TVDB-Only Item
```javascript
POST /api/custom-orders/:id/items/tvdb-only
{
  "mediaType": "episode",
  "title": "Episode Title",
  "seriesTitle": "Series Name",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "storyYear": 2024,
  "tvdbSeriesId": "12345",
  "tvdbSeasonId": "67890",
  "tvdbEpisodeId": "11111"
}
```

### Database Fields Used
- `plexKey`: Generated unique identifier (tvdb-episode-{id} or tvdb-movie-{id})
- `isFromTvdbOnly`: Boolean flag indicating TVDB-only status
- `comicSeries`: Stores tvdb-series-{id}
- `comicVolume`: Stores tvdb-season-{id}
- `comicIssue`: Stores tvdb-episode-{id}
- `bookIsbn`: Stores tvdb-movie-{id}

## ✅ Testing Results
- **PlexDatabaseService**: Both `searchTVEpisodes` and `searchMovies` methods working
- **Database Search**: Successfully finds episodes and movies in test Plex database
- **Migration**: Database schema updated successfully
- **Integration**: All components properly connected and functional

## 🎉 Benefits
1. **Proactive Planning**: Add items to custom orders before they're available
2. **Automatic Updates**: Items automatically integrate when added to Plex
3. **Seamless Experience**: Transparent fallback to other orders when items unavailable
4. **Data Preservation**: TVDB metadata preserved for future use
5. **Smart Selection**: Intelligent order selection with availability checking

## 🔮 Future Enhancements
- Periodic background checks for TVDB-only item availability
- Notifications when TVDB-only items become available
- Bulk import of TVDB-only items from TheTVDB API
- Advanced matching algorithms for fuzzy title matching

This system provides a comprehensive solution for managing media that exists in metadata databases but not yet in the user's Plex library, creating a seamless experience for planning and managing custom viewing orders.
