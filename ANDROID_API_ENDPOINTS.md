# Android Companion App API Endpoints

This document describes the API endpoints specifically designed for the Android companion app integration with the Master Order application.

## Overview

All Android endpoints return JSON responses in a standardized format with a `type` field indicating the command/response type and a `data` field containing the relevant information. These endpoints are designed to mirror the functionality of the web application's buttons without triggering WebSocket emissions that would interfere with the main web app.

## Base URL

- **Development**: `http://localhost:3001`
- **Production/Docker**: `http://localhost:3000` (or your configured port)

## Authentication

Currently, no authentication is required for these endpoints. They are designed for local network access between the Android app and the Master Order server.

---

## Master Order Integration Endpoints

### 1. Get Up Next

**Endpoint**: `GET /api/android/up-next`

**Description**: Retrieves the next recommended content from the Master Order system, equivalent to pressing the "Get Up Next" button on the home page. This can return TV episodes, movies, custom order items, or History Plus reading sessions (books, chapters, sections) based on the current configuration.

**Response Format**:

**TV Episode Response**:
```json
{
  "type": "PLAY_TV_EPISODE",
  "data": {
    "ratingKey": "67890",
    "episodeRatingKey": "67890",
    "seriesRatingKey": "12345",
    "plexId": "67890",
    "title": "Series Name",
    "episodeTitle": "Episode Title",
    "summary": "Series description...",
    "episodeSummary": "Episode description...",
    "seasonNumber": 3,
    "episodeNumber": 8,
    "isFinalSeason": false,
    "leafCount": 100,
    "viewedLeafCount": 45,
    "thumb": "/library/metadata/67890/thumb/1234567890",
    "art": "/library/metadata/67890/art/1234567890",
    "artworkUrl": "http://localhost:3000/api/artwork/series-artwork.jpg",
    "streamUrl": "http://plex-server:32400/video/:/transcode/...",
    "otherCollections": [...]
  }
}
```

**Movie Response**:
```json
{
  "type": "PLAY_MOVIE",
  "data": {
    "ratingKey": "67890",
    "plexId": "67890",
    "title": "Movie Title",
    "year": 2023,
    "duration": 7200,
    "summary": "Movie description...",
    "studio": "Studio Name",
    "rating": 8.5,
    "thumb": "/library/metadata/67890/thumb/1234567890",
    "art": "/library/metadata/67890/art/1234567890",
    "artworkUrl": "http://localhost:3000/api/artwork/movie-artwork.jpg",
    "streamUrl": "http://plex-server:32400/video/:/transcode/...",
    "otherCollections": [...]
  }
}
```

**Custom Order Item Response**:
```json
{
  "type": "PLAY_CUSTOM_ORDER_ITEM",
  "data": {
    "id": 123,
    "title": "Custom Item Title",
    "type": "webvideo",
    "orderName": "My Custom Order",
    "summary": "Item description...",
    "duration": 2400,
    "localArtworkPath": "/path/to/artwork.jpg",
    "artworkUrl": "http://localhost:3000/api/artwork/artwork-filename.jpg",
    "streamUrl": "http://plex-server:32400/video/:/transcode/...",
    "ratingKey": "54321",
    "plexId": "54321",
    "webUrl": "https://example.com/video-url",
    "customOrderId": 456,
    "customOrderItemId": 789,
    "playlistName": "My Playlist",
    "playlistType": "plex",
    "playlistId": "playlist-123",
    "backgroundGalleryName": "Background Gallery",
    "backgroundGalleryId": 321,
    "seasonNumber": 2,
    "episodeNumber": 5,
    "episodeTitle": "Episode Title",
    "seriesTitle": "Series Name"
  }
}
```

---

### Delete Stash Scene By Clip ID (Android Only)

**Endpoint**: `POST /api/android/stash/clip/delete`

**Description**: Deletes the entire Stash scene associated with a provided `clipId`. This removes the scene and all its clips locally and (if Stash is configured) attempts remote deletion through the Stash GraphQL API. This is useful when the Android client only has a reference to a clip but needs to purge the parent scene.

**Request Body**:
```json
{
  "clipId": 1234,
  "deleteFile": true,
  "deleteGenerated": true
}
```
- `clipId` (required, number): The ID of the clip whose parent scene will be deleted.
- `deleteFile` (optional, boolean, default: true): Whether the underlying media file should be deleted remotely in Stash.
- `deleteGenerated` (optional, boolean, default: true): Whether to delete generated assets (thumbnails, previews) in Stash.

**Successful Response**:
```json
{
  "type": "STASH_SCENE_DELETED",
  "data": {
    "clipId": 1234,
    "sceneId": "6c9d6d5b-...",
    "local": {
      "sceneDeleted": true,
      "clipsDeleted": 12
    },
    "remote": {
      "attempted": true,
      "success": true,
      "deleted": true,
      "message": "Scene deleted successfully from Stash"
    },
    "message": "Scene deleted locally and remotely",
    "timestamp": "2025-10-03T12:34:56.000Z"
  }
}
```

**Error Response (Clip Not Found)**:
```json
{
  "type": "STASH_SCENE_DELETE_ERROR",
  "data": {
    "success": false,
    "error": "CLIP_NOT_FOUND",
    "message": "Clip 9999 not found",
    "timestamp": "2025-10-03T12:34:56.000Z"
  }
}
```

**Error Response (Remote Failure)**:
```json
{
  "type": "STASH_SCENE_DELETED",
  "data": {
    "clipId": 1234,
    "sceneId": "6c9d6d5b-...",
    "local": { "sceneDeleted": true, "clipsDeleted": 12 },
    "remote": {
      "attempted": true,
      "success": false,
      "error": "Stash API request failed: 500"
    },
    "message": "Scene deleted locally; remote deletion skipped or failed",
    "timestamp": "2025-10-03T12:34:56.000Z"
  }
}
```

**Notes**:
- Remote deletion only runs if Stash URL is configured in settings.
- Local deletion removes all related clips first, then the scene.
- This endpoint is idempotent in practice for local deletions—subsequent calls with the same clipId after deletion will return a CLIP_NOT_FOUND error.


**Custom Order Book Response**:
```json
{
  "type": "PLAY_CUSTOM_ORDER_ITEM",
  "data": {
    "id": 123,
    "title": "Book Title",
    "type": "book",
    "orderName": "My Reading List",
    "summary": "Book description...",
    "duration": 0,
    "localArtworkPath": "/path/to/book-cover.jpg",
    "artworkUrl": "http://localhost:3000/api/artwork/book-cover.jpg",
    "streamUrl": "",
    "ratingKey": null,
    "plexId": null,
    "webUrl": null,
    "customOrderId": 456,
    "customOrderItemId": 789,
    "bookTitle": "The Example Book",
    "bookAuthor": "Author Name",
    "bookYear": 2023,
    "bookIsbn": "978-0123456789",
    "bookPublisher": "Example Publisher",
    "bookPageCount": 300,
    "bookCoverUrl": "https://covers.openlibrary.org/b/id/12345-L.jpg",
    "bookDescription": "Detailed book description...",
    "bookOpenLibraryId": "OL12345M",
    "chapterNumber": 5,
    "chapterTitle": "Chapter Title",
    "chapterDescription": "Chapter description...",
    "sectionNumber": 2,
    "sectionTitle": "Section Title", 
    "sectionDescription": "Section description...",
    "pageStart": 100,
    "pageEnd": 120
  }
}
```

**History Plus Custom Order Response**:
```json
### Stash Clip Playback (Enhanced Scene Metadata)

When the Android endpoint `GET /api/android/stash/next` returns a `PLAY_CLIP` response, it now includes a `scene` object with full parent scene metadata (performers, studio, tags, technical attributes) in addition to the core clip playback fields.

Example:
```json
{
  "type": "PLAY_CLIP",
  "data": {
    "url": "http://stash.local/scene/abcd-1234/stream",
    "title": "Sample Scene Title",
    "performers": "Performer A, Performer B",
    "studio": "Studio Name",
    "duration": 60,
    "startTime": 0,
    "endTime": 60,
    "clipId": 42,
    "sceneId": "abcd-1234",
    "clipIndex": 3,
    "scene": {
      "id": "abcd-1234",
      "title": "Sample Scene Title",
      "details": "Extended description...",
      "date": "2025-09-14",
      "rating": 80,
      "organized": false,
      "path": "/media/scenes/sample.mp4",
      "duration": 1800,
      "fileSize": 1234567890,
      "resolution": "1920x1080",
      "width": 1920,
      "height": 1080,
      "frameRate": 29.97,
      "codec": "h264",
      "userRating": 4.5,
      "favorite": false,
      "playCount": 2,
      "studio": { "id": "studio-1", "name": "Studio Name", "image": null },
      "performers": [
        { "id": "perf-1", "name": "Performer A", "image": null, "gender": "F", "rating": 4 },
        { "id": "perf-2", "name": "Performer B", "image": null, "gender": "M", "rating": 5 }
      ],
      "tags": [
        { "id": "tag-1", "name": "Outdoor", "description": null },
        { "id": "tag-2", "name": "HD", "description": "High Definition" }
      ]
    }
  }
}
```

If full scene metadata cannot be loaded (e.g., transient DB issue) the `scene` field may be `null` while core clip playback still succeeds.

---

### Android Stash Clip Filters And Filtered Clip Play

These endpoints provide Android parity with the web Clips page filter model.

#### Filter Query Parameters

The following optional query params are supported by Android clip playback endpoints:

- `search`: Scene title text search
- `watched`: `true` or `false`
- `rating`: `1`..`5` or `unrated`
- `includeHigherRatings`: `true` (used with numeric `rating`)
- `tags`: Comma-separated tag IDs (example: `tag-a,tag-b`)

#### Get Clip Filter Options

**Endpoint**: `GET /api/android/stash/clips/filter-options`

**Description**: Returns the supported clip filter schema and available clip tag options for Android UI rendering.

**Success Response**:
```json
{
  "type": "STASH_CLIP_FILTER_OPTIONS",
  "data": {
    "search": {
      "enabled": true,
      "queryParam": "search"
    },
    "watched": {
      "queryParam": "watched",
      "options": [
        { "value": "all", "label": "All clips" },
        { "value": "true", "label": "Played" },
        { "value": "false", "label": "Unplayed" }
      ]
    },
    "rating": {
      "queryParam": "rating",
      "options": [
        { "value": "all", "label": "All ratings" },
        { "value": "5", "label": "5 stars" },
        { "value": "4", "label": "4 stars" },
        { "value": "3", "label": "3 stars" },
        { "value": "2", "label": "2 stars" },
        { "value": "1", "label": "1 star" },
        { "value": "unrated", "label": "Unrated" }
      ],
      "includeHigherRatings": {
        "queryParam": "includeHigherRatings",
        "supported": true
      }
    },
    "tags": {
      "queryParam": "tags",
      "format": "comma-separated tag IDs",
      "options": [
        { "id": "tag-uuid-1", "name": "Action", "favorite": false }
      ]
    }
  }
}
```

#### Get Next Clip (Now Supports Filters)

**Endpoint**: `GET /api/android/stash/next`

**Description**: Existing Android clip-play endpoint. Now accepts the same optional filter query params listed above and plays from the filtered pool when provided.

**Example**:
```bash
curl "http://localhost:3001/api/android/stash/next?watched=false&rating=4&includeHigherRatings=true&tags=tag-uuid-1"
```

**Response Type**: `PLAY_CLIP` (same structure as existing clip playback response).

#### Get Next Clip (Filters Required)

**Endpoint**: `GET /api/android/stash/next/filtered`

**Description**: Dedicated filtered clip-play endpoint. Requires at least one filter query parameter.

**Validation**:
- Returns `400` when no filter params are provided.

**Example**:
```bash
curl "http://localhost:3001/api/android/stash/next/filtered?search=studio%20title&watched=false&rating=unrated"
```

**Response Type**: `PLAY_CLIP`

**Error Example (No Filters)**:
```json
{
  "type": "STASH_FILTERED_CLIP_ERROR",
  "data": {
    "success": false,
    "error": "FILTERS_REQUIRED",
    "message": "Provide at least one filter: search, watched, rating, includeHigherRatings, or tags"
  }
}
```

Notes:
- `GET /api/android/stash/next/filtered` uses the same clip selection logic as `GET /api/android/stash/next` with filters applied.
- Clip selection remains randomized within the matching filtered pool.

---

### Stash Tag Hierarchy & Management (Android Only)

Provides hierarchical tag data plus basic create/delete operations for Stash tags.

#### Get Tag Hierarchy
**Endpoint**: `GET /api/android/stash/tags`

Query Params:
- `counts=true` (optional) include usage counts (scenes, performers, images, galleries, clips)

Response:
```json
{
  "type": "STASH_TAG_HIERARCHY",
  "data": {
    "total": 42,
    "roots": [ { "id": "uuid-root", "name": "Root Tag", "children": [...], "parents": [] } ],
    "tags": [ { "id": "uuid", "name": "Tag", "parents": [], "children": [], "counts": { "scenes": 5, "performers": 2, "images": 0, "galleries": 0, "clips": 12 } } ],
    "timestamp": "2025-10-03T12:34:56.000Z"
  }
}
```

#### Create Tag
**Endpoint**: `POST /api/android/stash/tags`

Body:
```json
{
  "name": "New Tag",
  "description": "Optional description",
  "parentIds": ["existing-parent-uuid"]
}
```

Success:
```json
{
  "type": "STASH_TAG_CREATED",
  "data": { "tag": { "id": "generated-uuid", "name": "New Tag", "description": "Optional description" }, "timestamp": "..." }
}
```

#### Delete Tag
**Endpoint**: `DELETE /api/android/stash/tags/:id`

Success:
```json
{ "type": "STASH_TAG_DELETED", "data": { "id": "deleted-uuid", "timestamp": "..." } }
```

Errors:
```json
{ "type": "STASH_TAG_DELETE_ERROR", "data": { "success": false, "error": "NOT_FOUND", "message": "Tag not found", "timestamp": "..." } }
```

Notes:
- Hierarchy is derived via `StashTagHierarchy` relations (parent->child edges).
- Deletion cascades through hierarchy links and aliases by schema constraints.
- Creation allows optional immediate parent connections through `parentIds`.

---

### Stash Clip Tag Assignment (Android Only)

Wraps existing web API endpoints for adding/removing tags from a clip, providing standardized Android response types.

#### Add Tags to a Clip
**Endpoint**: `POST /api/android/stash/clip/:clipId/tags`

Body:
```json
{ "tagIds": ["uuid-tag-1", "uuid-tag-2"] }
```

Success:
```json
{
  "type": "STASH_CLIP_TAGS_ADDED",
  "data": {
    "clipId": 42,
    "addedCount": 2,
    "tags": [ { "id": "uuid-tag-1", "tagId": "uuid-tag-1", "tag": { "id": "uuid-tag-1", "name": "Action" } } ],
    "raw": { /* upstream response */ },
    "timestamp": "..." 
  }
}
```

Errors:
```json
{ "type": "STASH_CLIP_TAG_ERROR", "data": { "success": false, "error": "INVALID_TAG_IDS", "message": "tagIds must be a non-empty array", "timestamp": "..." } }
```

#### Remove Tag from a Clip
**Endpoint**: `DELETE /api/android/stash/clip/:clipId/tags/:tagId`

Success:
```json
{
  "type": "STASH_CLIP_TAG_REMOVED",
  "data": { "clipId": 42, "tagId": "uuid-tag-1", "raw": { /* upstream */ }, "timestamp": "..." }
}
```

Errors:
```json
{ "type": "STASH_CLIP_TAG_DELETE_ERROR", "data": { "success": false, "error": "UPSTREAM_FAILED", "message": "Tag not associated with this clip", "timestamp": "..." } }
```

Notes:
- Upstream logic ensures idempotency by skipping existing associations.
- `addedCount` may be 0 if all provided tags were already linked.
- Uses internal server-to-server call to `/api/stash/clips/:id/tags` for consistency.

---

### Stash Performer Detail (Android Only)

**Endpoint**: `GET /api/android/stash/performer/:id`

Returns full performer metadata including tags, a limited recent scene list, and associated images with proxied URLs.

Example Response:
```json
{
  "type": "STASH_PERFORMER_DETAIL",
  "data": {
    "id": "perf-uuid",
    "name": "Performer Name",
    "gender": "F",
    "birthdate": "1995-04-12",
    "details": "Biography / scraped details...",
    "rating": 4,
    "ethnicity": "European",
    "country": "USA",
    "hair_color": "Blonde",
    "height": "170 cm",
    "weight": "55 kg",
    "measurements": "34C-24-35",
    "favorite": false,
    "image": "/path/to/image.jpg",
    "imageUrl": "http://localhost:3001/api/stash-image-proxy/%2Fpath%2Fto%2Fimage.jpg",
    "instagram": null,
    "twitter": null,
    "url": null,
    "tags": [ { "id": "tag-uuid", "name": "Action" } ],
    "scenes": [ { "id": "scene-uuid", "title": "Scene Title", "date": "2025-09-03", "studio": "Studio Name", "rating": 80, "duration": 1800 } ],
    "images": [ { "id": "img-uuid", "title": "Promo Shot", "path": "/image/path.jpg", "rating": 80, "galleryId": "gallery-uuid", "url": "http://localhost:3001/api/stash-image-proxy/%2Fimage%2Fpath.jpg" } ],
    "timestamp": "2025-10-03T12:34:56.000Z"
  }
}
```

Notes:
- `scenes` limited to 24 and `images` limited to 50 for payload size.
- `imageUrl` and each image's `url` use the image proxy endpoint for consistent client consumption.
- Fields mirror those stored in the Stash performer schema for parity with web interface.

{
  "type": "PLAY_CUSTOM_ORDER_ITEM",
  "data": {
    "id": 136,
    "title": "Ancient Egyptian Literature - Chapter 3: From the Pyramid Texts - Section 3: Pepi I Pyramid Texts",
    "type": "section",
    "orderName": "History Plus Content",
    "summary": "",
    "duration": 0,
    "localArtworkPath": null,
    "artworkUrl": null,
    "streamUrl": "",
    "ratingKey": null,
    "plexId": null,
    "webUrl": null,
    "customOrderId": null,
    "customOrderItemId": null,
    "bookTitle": "Ancient Egyptian Literature",
    "bookAuthor": "Unknown Author",
    "bookYear": null,
    "bookIsbn": null,
    "bookPublisher": null,
    "bookPageCount": null,
    "bookCoverUrl": null,
    "bookDescription": null,
    "chapterNumber": 3,
    "chapterTitle": "From the Pyramid Texts",
    "chapterDescription": null,
    "sectionNumber": 3,
    "sectionTitle": "Pepi I Pyramid Texts",
    "sectionDescription": null,
    "pageStart": null,
    "pageEnd": null,
    "eventId": 533,
    "eventTitle": "Reign of Pharaoh Pepi I",
    "eventTitleWithDates": "Reign of Pharaoh Pepi I (2331 BCE - 2287 BCE)",
    "eventDate": "-2331-01-01",
    "historyPlus": {
      "orderType": "HISTORY_PLUS",
      "type": "section",
      "content": {
        "id": 136,
        "title": "Pepi I Pyramid Texts",
        "sectionNumber": 3,
        "description": null,
        "pageStart": null,
        "pageEnd": null,
        "content": null,
        "isCompleted": false,
        "chapterId": 75,
        "createdAt": "2024-11-15T20:45:12.000Z",
        "updatedAt": "2024-11-15T20:45:12.000Z"
      }
    }
  }
}
```

**Response Fields**:
- `type`: Indicates the content type (`PLAY_TV_EPISODE`, `PLAY_MOVIE`, or `PLAY_CUSTOM_ORDER_ITEM`)
- TV Episode Fields:
  - `ratingKey`: Plex rating key for the specific episode (not the series)
  - `episodeRatingKey`: Explicit episode-specific rating key for direct episode playback
  - `seriesRatingKey`: Plex rating key for the series (for reference)
  - `plexId`: Plex identifier for direct media access (same as episodeRatingKey)
  - `title`: Series name
  - `episodeTitle`: Specific episode title
  - `summary`: Series description
  - `episodeSummary`: Episode-specific description
  - `seasonNumber`: Season number (integer)
  - `episodeNumber`: Episode number within the season (integer)
  - `isFinalSeason`: Boolean indicating if this is the final/last season
  - `leafCount`: Total episodes in series
  - `viewedLeafCount`: Number of watched episodes
  - `thumb`/`art`: Plex artwork URLs
  - `artworkUrl`: Network-accessible artwork URL for Android consumption
  - `streamUrl`: Direct stream URL for playback
  - `otherCollections`: Array of other collections this series belongs to
- Movie Fields:
  - `ratingKey`: Plex rating key for the movie
  - `plexId`: Plex identifier for direct media access (same as ratingKey)
  - `title`: Movie title
  - `year`: Release year
  - `duration`: Duration in seconds
  - `summary`: Movie description
  - `studio`: Production studio
  - `rating`: Movie rating
  - `thumb`/`art`: Plex artwork URLs
  - `artworkUrl`: Network-accessible artwork URL for Android consumption
  - `streamUrl`: Direct stream URL for playback
  - `otherCollections`: Array of collections this movie belongs to
- Custom Order Fields:
  - `id`: Custom order item ID
  - `title`: Item title (can be TV episode, movie, book, comic, web video, etc.)
  - `type`: Item media type (tv_episode, movie, book, comic, webvideo, etc.)
  - `orderName`: Name of the actual custom order containing this item
  - `summary`: Item description
  - `duration`: Duration in seconds
  - `localArtworkPath`: Local artwork file path (for reference)
  - `artworkUrl`: Network-accessible artwork URL for Android consumption
  - `streamUrl`: Direct stream URL for playback (for Plex content)
  - `ratingKey`: Associated Plex rating key (if applicable)
  - `plexId`: Plex identifier for direct media access (if applicable, same as ratingKey)
  - `webUrl`: Direct web video URL (for webvideo type items)
  - `customOrderId`: ID of the parent custom order
  - `customOrderItemId`: Specific ID of this item within the custom order
  - `playlistName`: Name of associated playlist (if any)
  - `playlistType`: Type of playlist ("plex" or "custom", if any)
  - `backgroundGalleryName`: Name of associated background gallery (if any)
  - `backgroundGalleryId`: ID of associated background gallery (if any)
  - Episode-specific fields (only included for TV episode items):
    - `seasonNumber`: Season number (integer)
    - `episodeNumber`: Episode number within the season (integer)  
    - `episodeTitle`: Specific episode title
    - `seriesTitle`: Name of the TV series
  - Book-specific fields (only included for book items):
    - `bookTitle`: Title of the book
    - `bookAuthor`: Author of the book
    - `bookYear`: Publication year
    - `bookIsbn`: ISBN number
    - `bookPublisher`: Publisher name
    - `bookPageCount`: Total pages in book
    - `bookCoverUrl`: Book cover image URL
    - `bookDescription`: Book description
    - `bookOpenLibraryId`: OpenLibrary identifier (if available)
    - `chapterNumber`: Chapter number (if reading chapter/section)
    - `chapterTitle`: Chapter title (if reading chapter/section)
    - `chapterDescription`: Chapter description (if reading chapter/section)
    - `sectionNumber`: Section number (if reading section)
    - `sectionTitle`: Section title (if reading section)
    - `sectionDescription`: Section description (if reading section)
    - `pageStart`: Starting page number (if applicable)
    - `pageEnd`: Ending page number (if applicable)
  - History Plus fields (only included for History Plus content returned as custom order items):
    - `eventId`: History Plus event ID
    - `eventTitle`: Event title
    - `eventTitleWithDates`: Event title with historical dates
    - `eventDate`: Historical date of the event
    - `historyPlus`: Object containing original History Plus content data
      - `orderType`: Always "HISTORY_PLUS" for this content
      - `type`: Content type ("book", "chapter", "section")
      - `content`: Raw content object with full relational data

**Content Selection Logic**: The endpoint uses the same logic as the web interface to determine what content to return based on current settings and order type configuration.

**Order Name Context**: The `orderName` field is only included in custom order item responses (`PLAY_CUSTOM_ORDER_ITEM` type) and contains the actual name of the custom order containing the item. This applies to all media types within custom orders (TV episodes, movies, books, comics, etc.).

**Error Responses**:
- `404`: No content available
- `500`: Server error

**Example Usage**:
```bash
curl -X GET "http://localhost:3001/api/android/up-next"
```

---

### 2. Play Plex Media

**Endpoint**: `POST /api/android/play-plex`

**Description**: Triggers playback of media content on the configured Plex player, equivalent to pressing the "Play" button on the home page. This endpoint emulates the exact same functionality as the web interface's play button.

**Request Body**:
```json
{
  "ratingKey": "12345",
  "mediaType": "episode",
  "title": "Series Name - Episode Title"
}
```

**Request Fields**:
- `ratingKey` (required): Plex rating key for the content to play
- `mediaType` (optional): Type of media (episode, movie, etc.) for logging purposes
- `title` (optional): Human-readable title for logging and notifications

**Success Response**:
```json
{
  "type": "PLAY_SUCCESS",
  "data": {
    "success": true,
    "ratingKey": "12345",
    "title": "Series Name - Episode Title",
    "mediaType": "episode",
    "player": "Living Room TV",
    "message": "Playing \"Series Name - Episode Title\" on Living Room TV",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response**:
```json
{
  "type": "PLAY_ERROR",
  "data": {
    "success": false,
    "ratingKey": "12345",
    "title": "Series Name - Episode Title",
    "mediaType": "episode",
    "error": "No Plex player selected. Please configure a player in Settings.",
    "details": "Check Plex server connection and player availability",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Fields**:
- `success`: Boolean indicating if playback started successfully
- `ratingKey`: Plex rating key that was played
- `title`: Media title
- `mediaType`: Type of media played
- `player`: Name of the Plex player used (success only)
- `message`: Human-readable success message (success only)
- `error`: Error message (error only)
- `details`: Additional error details (error only)
- `timestamp`: ISO timestamp of the response

**Functionality**:
- Uses the same Plex player configuration as the web interface
- Sends webhook notifications to Node-RED (if configured)
- Supports TV episodes and movies
- Provides detailed error messages for troubleshooting

**Common Error Scenarios**:
- Missing or invalid rating key
- No Plex player configured in settings
- Selected Plex player is offline or unavailable
- Plex server connection issues

**Example Usage**:
```bash
curl -X POST "http://localhost:3001/api/android/play-plex" \
  -H "Content-Type: application/json" \
  -d '{
    "ratingKey": "12345",
    "mediaType": "episode",
    "title": "Breaking Bad - Pilot"
  }'
```

---

### 7. Play Episode, Movie, or Web Video by Identification (POST /api/android/play-episode)

**Purpose**: Initiate playback of specific media content, supporting TV episodes (identified by series/season/episode), movies (identified by title), and web videos (identified by URL). Primarily designed for custom order items that need to be identified by metadata rather than direct Plex rating keys. For web videos, automatically starts a viewing session that can be managed through the viewing session endpoints.

**Request Body for Episodes**:
```json
{
  "seriesTitle": "Star Wars",
  "seasonNumber": 2,
  "episodeNumber": 5,
  "customOrderItemId": 123
}
```

**Request Body for Movies**:
```json
{
  "movieTitle": "Star Wars: A New Hope",
  "customOrderItemId": 456
}
```

**Request Body for Web Videos**:
```json
{
  "webUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "mediaType": "webvideo",
  "title": "Educational Video",
  "customOrderItemId": 789
}
```

**Request Fields**:
- **For Episodes**:
  - `seriesTitle`: Name of the TV series (string, required for episodes)
  - `seasonNumber`: Season number (integer, required for episodes)
  - `episodeNumber`: Episode number within the season (integer, required for episodes)
- **For Movies**:
  - `movieTitle`: Title of the movie (string, required for movies)
- **For Web Videos**:
  - `webUrl`: Direct URL to the web video (string, required for web videos)
  - `mediaType`: Must be "webvideo" (string, required for web videos)
- **Common Fields**:
  - `customOrderItemId`: ID of the custom order item (integer, optional)
  - `title`: Fallback title if movieTitle not provided (string, optional)

**Episode Response Format**: 
```json
{
  "type": "PLAY_TV_EPISODE",
  "data": {
    "success": true,
    "ratingKey": "4829",
    "episodeRatingKey": "4829", 
    "seriesRatingKey": "4701",
    "plexId": "4829",
    "title": "Star Wars",
    "episodeTitle": "Revenge of the Sith",
    "summary": "The entire galaxy is at war...",
    "seasonNumber": 2,
    "episodeNumber": 5,
    "duration": 2700,
    "thumb": "/library/metadata/4829/thumb/1638360183",
    "art": "/library/metadata/4701/art/1638360183",
    "artworkUrl": "http://192.168.1.114:32400/library/metadata/4829/thumb/1638360183?X-Plex-Token=xyz",
    "mediaType": "episode",
    "customOrderItemId": 123,
    "player": "Living Room TV",
    "message": "Playing \"Revenge of the Sith\" on Living Room TV",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Movie Response Format**: 
```json
{
  "type": "PLAY_MOVIE", 
  "data": {
    "success": true,
    "ratingKey": "5829",
    "plexId": "5829",
    "title": "Star Wars: A New Hope",
    "year": 1977,
    "duration": 7260,
    "summary": "A young farm boy becomes a hero...",
    "studio": "Lucasfilm",
    "rating": 8.6,
    "thumb": "/library/metadata/5829/thumb/1638360183",
    "art": "/library/metadata/5829/art/1638360183", 
    "artworkUrl": "http://192.168.1.114:32400/library/metadata/5829/thumb/1638360183?X-Plex-Token=xyz",
    "mediaType": "movie",
    "customOrderItemId": 456,
    "player": "Living Room TV",
    "message": "Playing \"Star Wars: A New Hope\" on Living Room TV",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Web Video Response Format**:
```json
{
  "type": "PLAY_CUSTOM_ORDER_ITEM",
  "data": {
    "success": true,
    "id": 789,
    "title": "Educational Video",
    "type": "webvideo",
    "orderName": "Custom Order",
    "summary": "",
    "duration": 0,
    "artworkUrl": null,
    "webUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "customOrderItemId": 789,
    "viewingSession": {
      "sessionId": 101,
      "startedAt": "2024-01-15T11:00:00.000Z",
      "isPaused": false
    },
    "message": "Started viewing session for \"Educational Video\"",
    "timestamp": "2024-01-15T11:00:00.000Z"
  }
}
```

**Custom Order Item Response** (when customOrderItemId provided):
```json
{
  "type": "PLAY_CUSTOM_ORDER_ITEM",
  "data": {
    "success": true,
    "ratingKey": "4829",
    "plexId": "4829", 
    "title": "Star Wars: A New Hope",
    "type": "movie",
    "orderName": "Custom Order",
    "summary": "A young farm boy becomes a hero...",
    "duration": 7260,
    "artworkUrl": "http://192.168.1.114:32400/library/metadata/5829/thumb/1638360183?X-Plex-Token=xyz",
    "mediaType": "movie",
    "customOrderItemId": 456,
    "player": "Living Room TV",
    "message": "Playing \"Star Wars: A New Hope\" on Living Room TV", 
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response**:
```json
{
  "type": "PLAY_ERROR",
  "data": {
    "success": false,
    "error": "Media not found: [Media Title]",
    "mediaType": "episode",
    "mediaTitle": "Star Wars",
    "seasonNumber": 2,
    "episodeNumber": 5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Fields**:
- **Episode Responses**:
  - `type`: `PLAY_TV_EPISODE` for regular episodes, `PLAY_CUSTOM_ORDER_ITEM` for custom order episodes
  - `ratingKey`: Plex rating key for the specific episode (for direct playback)
  - `episodeRatingKey`: Same as ratingKey, explicitly the episode-specific rating key
  - `seriesRatingKey`: Plex rating key for the parent series
  - `plexId`: Episode identifier for media access (same as episodeRatingKey)
  - `title`: Series name
  - `episodeTitle`: Specific episode title
  - `summary`: Episode description
  - `seasonNumber`/`episodeNumber`: Episode identification numbers
  - `duration`: Episode duration in seconds
  
- **Movie Responses**:
  - `type`: `PLAY_MOVIE` for regular movies, `PLAY_CUSTOM_ORDER_ITEM` for custom order movies
  - `ratingKey`: Plex rating key for the movie (for direct playback)
  - `plexId`: Movie identifier for media access (same as ratingKey)
  - `title`: Movie title
  - `year`: Release year
  - `duration`: Movie duration in seconds
  - `summary`: Movie description
  - `studio`: Movie studio/distributor
  - `rating`: Movie rating (0-10)
  
- **Web Video Responses**:
  - `type`: Always `PLAY_CUSTOM_ORDER_ITEM` for web videos
  - `id`: Custom order item ID
  - `title`: Web video title
  - `type`: Always "webvideo"
  - `orderName`: Name of the custom order containing this video
  - `webUrl`: Direct URL to the web video
  - `viewingSession`: Object containing viewing session information (if successfully started):
    - `sessionId`: Unique identifier for the viewing session
    - `startedAt`: ISO timestamp when the session was started
    - `isPaused`: Boolean indicating if the session is currently paused (initially false)
  
- **Common Fields**:
  - `success`: Boolean indicating if playback started successfully
  - `artworkUrl`: Network-accessible artwork URL for Android consumption
  - `thumb`/`art`: Plex artwork paths (not applicable for web videos)
  - `mediaType`: Type of media (`episode`, `movie`, or `webvideo`)
  - `customOrderItemId`: Custom order item ID (if applicable)
  - `player`: Name of the Plex player used (not applicable for web videos)
  - `message`: Human-readable success/error message
  - `timestamp`: ISO timestamp of the response

**Functionality**:
- **Episode Support**: Searches Plex libraries to find exact episodes based on series title, season, and episode number
- **Movie Support**: Searches Plex libraries to find movies based on movie title
- **Web Video Support**: Handles web video playback by automatically starting a viewing session, enabling pause/resume/stop functionality
- **Custom Order Integration**: Returns appropriate response types for custom order items vs. regular Plex content
- **Viewing Session Management**: For web videos, automatically initiates a viewing session that can be controlled via `/api/android/viewing/pause` and `/api/android/viewing/stop` endpoints
- **Fallback Handling**: For episode requests, falls back to movie search if no TV series match found
- **Webhook Integration**: Sends webhook notifications to trigger actual playback on connected Plex clients (for Plex content)
- **Consistent Response Format**: Uses same structured response format as other Android API endpoints
- **Artwork URL Generation**: Provides network-accessible artwork URLs for Android consumption (Plex content only)

**Example Usage**:

*Play an episode:*
```bash
curl -X POST "http://localhost:3001/api/android/play-episode" \
  -H "Content-Type: application/json" \
  -d '{
    "seriesTitle": "Star Wars",
    "seasonNumber": 2,
    "episodeNumber": 5,
    "customOrderItemId": 123
  }'
```

*Play a movie:*
```bash
curl -X POST "http://localhost:3001/api/android/play-episode" \
  -H "Content-Type: application/json" \
  -d '{
    "movieTitle": "Star Wars: A New Hope",
    "customOrderItemId": 456
  }'
```

*Play a web video:*
```bash
curl -X POST "http://localhost:3001/api/android/play-episode" \
  -H "Content-Type: application/json" \
  -d '{
    "webUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "mediaType": "webvideo",
    "title": "Educational Video",
    "customOrderItemId": 789
  }'
```

---

### 3. Mark Item as Read/Watched

**Endpoint**: `POST /api/android/mark-watched`

**Description**: Marks a comic, book, story, or web video as read/watched, equivalent to pressing the "Mark as Read" or "Mark as Watched" button on the home page.

**Request Body**:
```json
{
  "itemId": 123,
  "mediaType": "book",
  "title": "The Great Gatsby"
}
```

**Request Fields**:
- `itemId` (required): Custom order item ID to mark as watched
- `mediaType` (optional): Type of media (book, comic, shortstory, webvideo) for logging purposes
- `title` (optional): Human-readable title for logging and notifications

**Success Response**:
```json
{
  "type": "MARK_WATCHED_SUCCESS",
  "data": {
    "success": true,
    "itemId": 123,
    "title": "The Great Gatsby",
    "mediaType": "book",
    "message": "Successfully marked \"The Great Gatsby\" as read/watched",
    "watchLogCreated": true,
    "plexUpdated": false,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response**:
```json
{
  "type": "MARK_WATCHED_ERROR",
  "data": {
    "success": false,
    "itemId": 123,
    "title": "The Great Gatsby",
    "mediaType": "book",
    "error": "Item already marked as watched",
    "details": "Check item exists and is not already watched",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Example Usage**:
```bash
curl -X POST "http://localhost:3001/api/android/mark-watched" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": 123,
    "mediaType": "book",
    "title": "The Great Gatsby"
  }'
```

---

### 4. Reading Session Management

#### Start Reading Session

**Endpoint**: `POST /api/android/reading/start`

**Description**: Starts a reading session for books, comics, or stories, equivalent to pressing the "Start" button on the home page for reading content.

**Request Body**:
```json
{
  "mediaType": "book",
  "title": "The Great Gatsby",
  "seriesTitle": "F. Scott Fitzgerald Collection",
  "customOrderItemId": 123
}
```

**Request Fields**:
- `mediaType` (required): Must be "book", "comic", or "shortstory"
- `title` (required): Title of the content being read
- `seriesTitle` (optional): Series or collection title
- `customOrderItemId` (optional): Associated custom order item ID

**Success Response**:
```json
{
  "type": "READING_SESSION_STARTED",
  "data": {
    "success": true,
    "sessionId": 456,
    "mediaType": "book",
    "title": "The Great Gatsby",
    "seriesTitle": "F. Scott Fitzgerald Collection",
    "customOrderItemId": 123,
    "startedAt": "2024-01-15T10:30:00.000Z",
    "isPaused": false,
    "message": "Started reading session for \"The Great Gatsby\"",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Pause/Resume Reading Session

**Endpoint**: `POST /api/android/reading/pause`

**Description**: Pauses or resumes the active reading session, equivalent to pressing the "Pause" or "Resume" button.

**Request Body**: Empty `{}`

**Success Response**:
```json
{
  "type": "READING_SESSION_PAUSED",
  "data": {
    "success": true,
    "sessionId": 456,
    "isPaused": true,
    "title": "The Great Gatsby",
    "mediaType": "book",
    "message": "Paused reading session for \"The Great Gatsby\"",
    "pausedAt": "2024-01-15T10:35:00.000Z",
    "totalActiveTime": 300,
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
}
```

#### Stop Reading Session

**Endpoint**: `POST /api/android/reading/stop`

**Description**: Stops the active reading session, equivalent to pressing the "Stop" button, with optional progress tracking. When the read percentage reaches 100%, automatically marks the comic or book as read/watched in the custom order.

**Request Body**:
```json
{
  "progress": {
    "currentPage": 150,
    "totalPages": 200,
    "readPercentage": 75
  }
}
```

**Request Fields**:
- `progress` (optional): Reading progress information
  - `currentPage`: Current page number
  - `totalPages`: Total page count
  - `readPercentage`: Percentage read (0-100)

**Success Response**:
```json
{
  "type": "READING_SESSION_STOPPED",
  "data": {
    "success": true,
    "sessionId": 456,
    "title": "The Great Gatsby",
    "mediaType": "book",
    "duration": 600,
    "totalActiveTime": 480,
    "progressUpdated": true,
    "progress": {
      "currentPage": 150,
      "totalPages": 200,
      "readPercentage": 75
    },
    "markedAsRead": false,
    "message": "Stopped reading session for \"The Great Gatsby\"",
    "completedAt": "2024-01-15T10:40:00.000Z",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

**100% Completion Response**:
```json
{
  "type": "READING_SESSION_STOPPED",
  "data": {
    "success": true,
    "sessionId": 456,
    "title": "Comic Book Title",
    "mediaType": "comic",
    "duration": 1200,
    "totalActiveTime": 1050,
    "progressUpdated": true,
    "progress": {
      "currentPage": 24,
      "totalPages": 24,
      "readPercentage": 100
    },
    "markedAsRead": true,
    "message": "Completed reading \"Comic Book Title\" and marked as read",
    "completedAt": "2024-01-15T10:40:00.000Z",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

**Response Fields**:
- `markedAsRead`: Boolean indicating if the item was automatically marked as read due to 100% completion
- `message`: Dynamic message that changes based on completion status
- All other fields remain the same as previously documented

**Automatic Read Marking**:
- When `readPercentage` equals 100, the comic/book is automatically marked as read in the custom order
- The `markedAsRead` field in the response indicates this occurred
- The response message changes to reflect completion status
- This functionality works for both comics and books in custom orders

---

### 5. History Plus Reading Session Management

#### Start History Plus Reading Session

**Endpoint**: `POST /api/android/history-plus/reading/start`

**Description**: Starts a reading session for History Plus content (books, chapters, or sections). Creates a reading session for the parent book while tracking the specific content being read. This implements a dual-layer approach where time is tracked at the book level but completion can be marked at the granular level.

**Request Body**:
```json
{
  "contentType": "section",
  "contentId": 136,
  "bookId": 3,
  "bookTitle": "Ancient Egyptian Literature",
  "chapterId": 75,
  "chapterTitle": "From the Pyramid Texts",
  "chapterNumber": 3,
  "sectionId": 136,
  "sectionTitle": "Pepi I Pyramid Texts",
  "sectionNumber": 3,
  "eventId": 533,
  "eventTitle": "Reign of Pharaoh Pepi I"
}
```

**Request Fields**:
- `contentType` (required): Type of content being read ("book", "chapter", or "section")
- `contentId` (required): ID of the specific content being read
- `bookId` (required): ID of the parent book (always required for session tracking)
- `bookTitle` (required): Title of the parent book
- `chapterId` (optional): Chapter ID (required for section type, optional for chapter type)
- `chapterTitle` (optional): Chapter title
- `chapterNumber` (optional): Chapter number
- `sectionId` (optional): Section ID (required for section type)
- `sectionTitle` (optional): Section title
- `sectionNumber` (optional): Section number
- `eventId` (required): History Plus event ID
- `eventTitle` (required): History Plus event title

**Success Response**:
```json
{
  "type": "HISTORY_PLUS_READING_SESSION_STARTED",
  "data": {
    "success": true,
    "sessionId": 789,
    "bookSessionId": 790,
    "contentType": "section",
    "contentId": 136,
    "bookId": 3,
    "bookTitle": "Ancient Egyptian Literature",
    "readingContent": {
      "type": "section",
      "title": "Ancient Egyptian Literature - Chapter 3: From the Pyramid Texts - Section 3: Pepi I Pyramid Texts",
      "chapterNumber": 3,
      "chapterTitle": "From the Pyramid Texts",
      "sectionNumber": 3,
      "sectionTitle": "Pepi I Pyramid Texts"
    },
    "eventContext": {
      "eventId": 533,
      "eventTitle": "Reign of Pharaoh Pepi I"
    },
    "startedAt": "2024-01-15T10:30:00.000Z",
    "isPaused": false,
    "message": "Started reading session for \"Ancient Egyptian Literature\" (Section 3: Pepi I Pyramid Texts)",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Pause/Resume History Plus Reading Session

**Endpoint**: `POST /api/android/history-plus/reading/pause`

**Description**: Pauses or resumes the active History Plus reading session. This affects the parent book's reading session time tracking.

**Request Body**: Empty `{}`

**Success Response**:
```json
{
  "type": "HISTORY_PLUS_READING_SESSION_PAUSED",
  "data": {
    "success": true,
    "sessionId": 789,
    "bookSessionId": 790,
    "isPaused": true,
    "bookTitle": "Ancient Egyptian Literature",
    "contentType": "section",
    "readingContent": {
      "title": "Ancient Egyptian Literature - Chapter 3: From the Pyramid Texts - Section 3: Pepi I Pyramid Texts"
    },
    "message": "Paused reading session for \"Ancient Egyptian Literature\"",
    "pausedAt": "2024-01-15T10:35:00.000Z",
    "totalActiveTime": 300,
    "timestamp": "2024-01-15T10:35:00.000Z"
  }
}
```

#### Stop History Plus Reading Session

**Endpoint**: `POST /api/android/history-plus/reading/stop`

**Description**: Stops the active History Plus reading session. This stops the parent book's reading session and logs the total time, but does not automatically mark any content as read. Use the separate mark-as-read endpoint for completion tracking.

**Request Body**: Empty `{}`

**Success Response**:
```json
{
  "type": "HISTORY_PLUS_READING_SESSION_STOPPED",
  "data": {
    "success": true,
    "sessionId": 789,
    "bookSessionId": 790,
    "bookTitle": "Ancient Egyptian Literature",
    "contentType": "section",
    "readingContent": {
      "title": "Ancient Egyptian Literature - Chapter 3: From the Pyramid Texts - Section 3: Pepi I Pyramid Texts"
    },
    "duration": 600,
    "totalActiveTime": 480,
    "message": "Stopped reading session for \"Ancient Egyptian Literature\"",
    "completedAt": "2024-01-15T10:40:00.000Z",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

#### Mark History Plus Content as Read

**Endpoint**: `POST /api/android/history-plus/reading/mark-read`

**Description**: Marks the specific History Plus content (book, chapter, or section) as read. This only affects the granular content that was being read, not necessarily the parent book, unless the content type is "book".

**Request Body**:
```json
{
  "contentType": "section",
  "contentId": 136,
  "bookId": 3,
  "chapterId": 75,
  "eventId": 533
}
```

**Request Fields**:
- `contentType` (required): Type of content to mark as read ("book", "chapter", or "section")
- `contentId` (required): ID of the specific content to mark as read
- `bookId` (required): ID of the parent book
- `chapterId` (optional): Chapter ID (required for section type)
- `eventId` (required): History Plus event ID

**Success Response for Section**:
```json
{
  "type": "HISTORY_PLUS_CONTENT_MARKED_READ",
  "data": {
    "success": true,
    "contentType": "section",
    "contentId": 136,
    "bookId": 3,
    "chapterId": 75,
    "markedAsRead": true,
    "affectedContent": {
      "sectionTitle": "Pepi I Pyramid Texts",
      "chapterTitle": "From the Pyramid Texts",
      "bookTitle": "Ancient Egyptian Literature"
    },
    "eventProgress": {
      "eventId": 533,
      "eventTitle": "Reign of Pharaoh Pepi I",
      "totalContent": 15,
      "readContent": 8,
      "completionPercentage": 53.3,
      "eventCompleted": false
    },
    "message": "Marked section \"Pepi I Pyramid Texts\" as read",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

**Success Response for Chapter**:
```json
{
  "type": "HISTORY_PLUS_CONTENT_MARKED_READ",
  "data": {
    "success": true,
    "contentType": "chapter",
    "contentId": 75,
    "bookId": 3,
    "markedAsRead": true,
    "affectedContent": {
      "chapterTitle": "From the Pyramid Texts",
      "bookTitle": "Ancient Egyptian Literature",
      "sectionsInChapter": 5,
      "sectionsMarkedRead": 5
    },
    "eventProgress": {
      "eventId": 533,
      "eventTitle": "Reign of Pharaoh Pepi I",
      "totalContent": 15,
      "readContent": 12,
      "completionPercentage": 80.0,
      "eventCompleted": false
    },
    "message": "Marked chapter \"From the Pyramid Texts\" as read",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

**Success Response for Book**:
```json
{
  "type": "HISTORY_PLUS_CONTENT_MARKED_READ",
  "data": {
    "success": true,
    "contentType": "book",
    "contentId": 3,
    "markedAsRead": true,
    "affectedContent": {
      "bookTitle": "Ancient Egyptian Literature",
      "chaptersInBook": 8,
      "chaptersMarkedRead": 8
    },
    "eventProgress": {
      "eventId": 533,
      "eventTitle": "Reign of Pharaoh Pepi I",
      "totalContent": 15,
      "readContent": 15,
      "completionPercentage": 100.0,
      "eventCompleted": true
    },
    "message": "Marked book \"Ancient Egyptian Literature\" as read - Event completed!",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

**Response Fields**:
- `contentType`: Type of content that was marked as read
- `contentId`: ID of the content that was marked as read
- `markedAsRead`: Always true for successful requests
- `affectedContent`: Details about what was marked as read
- `eventProgress`: Progress tracking for the History Plus event
  - `eventCompleted`: Boolean indicating if the entire event is now completed
  - `completionPercentage`: Percentage of event content that has been read
- `message`: Dynamic message indicating what was completed

**Key Behavior Notes**:
- **Granular Marking**: Only the specific content type is marked as read
- **Session Independence**: Marking as read is independent of reading sessions
- **Event Progress**: Each response includes overall event completion progress
- **Hierarchical Awareness**: The system understands the book→chapter→section hierarchy
- **No Automatic Propagation**: Marking a section as read does NOT automatically mark the chapter or book as read

---

### 6. Viewing Session Management

#### Start Viewing Session

**Endpoint**: `POST /api/android/viewing/start`

**Description**: Starts a viewing session for web videos, equivalent to pressing the "Start" button on the home page for video content.

**Request Body**:
```json
{
  "mediaType": "webvideo",
  "title": "Educational Video",
  "seriesTitle": "Learning Series",
  "customOrderItemId": 789
}
```

**Request Fields**:
- `mediaType` (required): Must be "webvideo"
- `title` (required): Title of the video being watched
- `seriesTitle` (optional): Series or collection title
- `customOrderItemId` (optional): Associated custom order item ID

**Success Response**:
```json
{
  "type": "VIEWING_SESSION_STARTED",
  "data": {
    "success": true,
    "sessionId": 101,
    "mediaType": "webvideo",
    "title": "Educational Video",
    "seriesTitle": "Learning Series",
    "customOrderItemId": 789,
    "startedAt": "2024-01-15T11:00:00.000Z",
    "isPaused": false,
    "message": "Started viewing session for \"Educational Video\"",
    "timestamp": "2024-01-15T11:00:00.000Z"
  }
}
```

#### Pause/Resume Viewing Session

**Endpoint**: `POST /api/android/viewing/pause`

**Description**: Pauses or resumes the active viewing session, equivalent to pressing the "Pause" or "Resume" button.

**Request Body**: Empty `{}`

**Success Response**:
```json
{
  "type": "VIEWING_SESSION_PAUSED",
  "data": {
    "success": true,
    "sessionId": 101,
    "isPaused": true,
    "title": "Educational Video",
    "mediaType": "webvideo",
    "message": "Paused viewing session for \"Educational Video\"",
    "pausedAt": "2024-01-15T11:05:00.000Z",
    "totalActiveTime": 300,
    "timestamp": "2024-01-15T11:05:00.000Z"
  }
}
```

#### Stop Viewing Session

**Endpoint**: `POST /api/android/viewing/stop`

**Description**: Stops the active viewing session, equivalent to pressing the "Stop" button, with optional progress tracking.

**Request Body**:
```json
{
  "progress": {
    "currentTime": 1200,
    "totalDuration": 1800,
    "watchedPercentage": 67
  }
}
```

**Request Fields**:
- `progress` (optional): Viewing progress information
  - `currentTime`: Current playback time in seconds
  - `totalDuration`: Total video duration in seconds
  - `watchedPercentage`: Percentage watched (0-100)

**Success Response**:
```json
{
  "type": "VIEWING_SESSION_STOPPED",
  "data": {
    "success": true,
    "sessionId": 101,
    "title": "Educational Video",
    "mediaType": "webvideo",
    "duration": 900,
    "totalActiveTime": 720,
    "progressUpdated": true,
    "progress": {
      "currentTime": 1200,
      "totalDuration": 1800,
      "watchedPercentage": 67
    },
    "message": "Stopped viewing session for \"Educational Video\"",
    "completedAt": "2024-01-15T11:15:00.000Z",
    "timestamp": "2024-01-15T11:15:00.000Z"
  }
}
```

---

## Gallery and Playlist Endpoints

### 1. Get Random Gallery Image

**Endpoint**: `GET /api/android/gallery/:galleryName/random-image`

**Description**: Returns a random image from the specified background gallery with complete metadata. Uses exact name matching to find the gallery and returns comprehensive image information including direct URLs, dimensions, and file details.

**Parameters**:
- `galleryName` (URL parameter): Name of the gallery to search for

**Response Format**:
```json
{
  "type": "RANDOM_IMAGE_SUCCESS",
  "data": {
    "success": true,
    "galleryName": "Star Warss",
    "galleryId": 1,
    "galleryDescription": null,
    "image": {
      "id": 82,
      "filename": "bg-1757010659871-3618122.jpg",
      "originalName": "Image 63",
      "url": "https://i.imgur.com/YZocsK0.jpg",
      "width": 1920,
      "height": 1080,
      "size": 482147,
      "mimetype": "image/jpeg"
    },
    "totalImages": 145,
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

**Error Response**:
```json
{
  "type": "RANDOM_IMAGE_ERROR",
  "data": {
    "error": "Gallery not found",
    "message": "Gallery \"NonExistentGallery\" does not exist",
    "galleryName": "NonExistentGallery",
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

**Example Request**:
```
GET /api/android/gallery/vacation%20photos/random-image
```

**Response Fields**:
- `success`: Boolean indicating successful operation
- `galleryName`: Name of the gallery containing the image
- `galleryId`: Unique identifier for the gallery
- `galleryDescription`: Gallery description (may be null)
- `image`: Object containing complete image metadata:
  - `id`: Unique image identifier in the database
  - `filename`: Image filename on the server
  - `originalName`: Original name or title of the image
  - `url`: Direct URL to the image (may be external URL or server-based path)
  - `width`: Image width in pixels
  - `height`: Image height in pixels  
  - `size`: File size in bytes
  - `mimetype`: MIME type of the image (e.g., "image/jpeg")
- `totalImages`: Total number of images available in the gallery
- `timestamp`: ISO timestamp of the response

**Notes**:
- Gallery name matching uses exact match (case-sensitive)
- Images are selected from the `BackgroundImage` table associated with `BackgroundGallery`
- URLs may be direct external links (e.g., Imgur) or server-relative paths
- All image metadata is preserved from the database for client-side use

**Example Response**:
```json
{
  "type": "RANDOM_IMAGE_SUCCESS",
  "data": {
    "success": true,
    "galleryName": "Vacation Photos",
    "galleryId": 45,
    "galleryDescription": "Summer vacation memories",
    "image": {
      "id": 150,
      "filename": "vacation_beach_001.jpg",
      "originalName": "Beach Sunset",
      "url": "https://i.imgur.com/abc123.jpg",
      "width": 1920,
      "height": 1080,
      "size": 524288,
      "mimetype": "image/jpeg"
    },
    "totalImages": 87,
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

### 2. Get Random Playlist Track

**Endpoint**: `GET /api/android/playlist/:playlistName?/random-track`

**Description**: Returns a random track from the specified playlist or from the Classical music section if no playlist is specified. When a playlist name is provided, searches both Plex playlists and custom playlists for exact name matches. When no playlist name is provided, defaults to selecting a random track from the "Classical" music section. Includes the complete Plex streaming URL that can be played directly on Android devices, along with comprehensive artwork metadata and track information.

**Parameters**:
- `playlistName` (URL parameter, optional): Name of the playlist to search for. If omitted, returns a random track from the Classical music section.

**Response Format (Playlist)**:
```json
{
  "type": "RANDOM_TRACK_SUCCESS",
  "data": {
    "success": true,
    "playlistName": "Rock Classics",
    "playlistType": "plex",
    "playlistId": 15,
    "playlistDescription": "Best rock songs of all time",
    "track": {
      "ratingKey": "98765",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera",
      "duration": 355000,
      "type": "track",
      "streamUrl": "http://192.168.1.100:32400/library/parts/98765/1234567890/file.mp3?X-Plex-Token=abc123def456",
      "artworkUrl": "http://192.168.1.100:32400/library/metadata/98760/thumb?X-Plex-Token=abc123def456",
      "plexUrl": "http://192.168.1.100:32400",
      "year": 1975,
      "index": 11,
      "parentIndex": 1,
      "rating": 9.5,
      "addedAt": "2024-01-15T10:30:00.000Z"
    },
    "totalTracks": 42,
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

**Response Format (Classical Section - No Playlist)**:
```json
{
  "type": "RANDOM_TRACK_SUCCESS",
  "data": {
    "success": true,
    "playlistName": "Classical",
    "playlistType": "section",
    "playlistId": "4",
    "playlistDescription": "Random track from Classical music section",
    "track": {
      "ratingKey": "143528",
      "title": "206 - Act II - Scene 5",
      "artist": "Pfitzner, Hans",
      "album": "Das Herz",
      "duration": 183719,
      "type": "track",
      "streamUrl": "http://192.168.1.119:32400/library/parts/165761/1284346867/file.mp3?X-Plex-Token=Bazf-s9L36e4roJGMhHs",
      "artworkUrl": "http://192.168.1.119:32400/library/metadata/143510/thumb/1725490956?X-Plex-Token=Bazf-s9L36e4roJGMhHs",
      "plexUrl": "http://192.168.1.119:32400",
      "year": null,
      "index": 6,
      "parentIndex": 1,
      "rating": null,
      "addedAt": "2024-09-04T23:02:31Z"
    },
    "totalTracks": 42248,
    "timestamp": "2025-09-19T21:22:42.652Z"
  }
}
```

**Error Response**:
```json
{
  "type": "RANDOM_TRACK_ERROR",
  "data": {
    "error": "Playlist not found",
    "message": "Playlist \"NonExistentPlaylist\" does not exist in Plex or Custom playlists",
    "playlistName": "NonExistentPlaylist",
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

**Example Requests**:
```
# Get random track from specific playlist
GET /api/android/playlist/rock%20classics/random-track

# Get random track from Classical section (no playlist name)
GET /api/android/playlist/random-track
```

**Response Fields**:
- `success`: Boolean indicating successful operation
- `playlistName`: Name of the playlist containing the track, or "Classical" for section-based selection
- `playlistType`: Type of playlist (`plex`, `custom`, or `section` for Classical music section)
- `playlistId`: Unique identifier for the playlist (ratingKey for Plex, database ID for custom, section key for Classical)
- `playlistDescription`: Playlist description or summary (may be null)
- `track`: Object containing complete track metadata:
  - `ratingKey`: Plex rating key for the track (for streaming)
  - `title`: Track title
  - `artist`: Artist name (from Plex metadata or database)
  - `album`: Album title (from Plex metadata or database)
  - `duration`: Track duration in milliseconds
  - `type`: Media type (typically "track")
  - `streamUrl`: Direct Plex streaming URL with authentication token
  - `artworkUrl`: Artwork URL with fallback hierarchy (track → album → artist)
  - `plexUrl`: Base Plex server URL for reference
  - `year`: Release year (from Plex metadata)
  - `index`: Track number within the album
  - `parentIndex`: Disc number (for multi-disc albums)
  - `rating`: Track rating (from Plex metadata)
  - `addedAt`: When the track was added to the playlist
- `totalTracks`: Total number of tracks available in the playlist or Classical section
- `timestamp`: ISO timestamp of the response

**Example Response**:
```json
{
  "type": "RANDOM_TRACK_SUCCESS",
  "data": {
    "success": true,
    "playlistName": "Rock Classics",
    "playlistType": "plex",
    "playlistId": 15,
    "playlistDescription": "Classic rock hits from the 70s and 80s",
    "track": {
      "ratingKey": "98765",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera",
      "duration": 355000,
      "type": "track",
      "streamUrl": "http://192.168.1.100:32400/library/parts/98765/1234567890/file.mp3?X-Plex-Token=abc123def456",
      "artworkUrl": "http://192.168.1.100:32400/library/metadata/98760/thumb?X-Plex-Token=abc123def456",
      "plexUrl": "http://192.168.1.100:32400",
      "year": 1975,
      "index": 11,
      "parentIndex": 1,
      "rating": 9.5,
      "addedAt": "2024-01-15T10:30:00.000Z"
    },
    "totalTracks": 42,
    "timestamp": "2025-09-04T23:08:57.741Z"
  }
}
```

**Notes**:
- The `streamUrl` is a direct Plex streaming URL compatible with Android MediaPlayer
- Artwork URL is provided in a single `artworkUrl` field with fallback hierarchy: track artwork → album artwork → artist artwork
- All URLs include the necessary Plex authentication token
- Duration is provided in milliseconds for Android compatibility
- Playlist name matching uses exact match (case-sensitive)
- Searches both Plex playlists (`PlexPlaylist` table) and custom playlists (`CustomPlaylist` table)
- Response includes playlist type (`plex` or `custom`) for client-side handling
- Additional metadata includes track index (track number), parent index (disc number), and rating
- If no tracks are found in the playlist, an appropriate error message is returned
- Supports both Plex playlists (with `ratingKey`) and custom playlists (with database `id`)

---

## Weather Information Endpoint

### 1. Get Current Weather

**Endpoint**: `GET /api/android/weather`

**Description**: Returns current weather information for the configured location. Provides comprehensive weather data including temperature, conditions, wind, humidity, and extended metadata optimized for Android display.

**Configuration Requirements**:
- Weather must be enabled in Eddie settings (`weatherEnabled: true`)
- Valid OpenWeatherMap API key must be configured (`weatherApiKey`)
- Location must be set (city name or latitude,longitude coordinates)

**Response Format**:
```json
{
  "type": "WEATHER_SUCCESS",
  "data": {
    "success": true,
    "location": {
      "name": "New York",
      "country": "US",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "timezone": -18000,
      "sunrise": "2024-09-04T11:45:00.000Z",
      "sunset": "2024-09-05T00:15:00.000Z"
    },
    "current": {
      "temperature": 22.5,
      "feelsLike": 24.1,
      "tempMin": 20.2,
      "tempMax": 25.8,
      "humidity": 65,
      "pressure": 1013,
      "visibility": 10.0,
      "uvIndex": null
    },
    "weather": {
      "condition": "Clear",
      "description": "clear sky",
      "icon": "01d",
      "iconUrl": "https://openweathermap.org/img/wn/01d@2x.png"
    },
    "wind": {
      "speed": 3.2,
      "direction": 225,
      "gust": 4.5
    },
    "clouds": {
      "cloudiness": 0
    },
    "rain": {
      "oneHour": null,
      "threeHours": null
    },
    "snow": {
      "oneHour": null,
      "threeHours": null
    },
    "units": {
      "system": "metric",
      "temperature": "°C",
      "windSpeed": "m/s",
      "pressure": "hPa",
      "visibility": "km"
    },
    "metadata": {
      "dataTime": "2024-09-04T15:30:00.000Z",
      "requestTime": "2024-09-04T15:35:22.123Z",
      "source": "OpenWeatherMap",
      "apiVersion": "2.5"
    }
  }
}
```

**Error Responses**:

*Weather Disabled*:
```json
{
  "type": "WEATHER_ERROR",
  "data": {
    "error": "Weather service disabled",
    "message": "Weather functionality is not enabled in settings",
    "enabled": false,
    "timestamp": "2024-09-04T15:35:22.123Z"
  }
}
```

*Configuration Missing*:
```json
{
  "type": "WEATHER_ERROR",
  "data": {
    "error": "Weather API key missing",
    "message": "Weather API key is not configured in settings",
    "enabled": true,
    "configured": false,
    "timestamp": "2024-09-04T15:35:22.123Z"
  }
}
```

*API Error*:
```json
{
  "type": "WEATHER_ERROR",
  "data": {
    "error": "Weather API error",
    "message": "Failed to fetch weather data: Invalid API key",
    "statusCode": 401,
    "enabled": true,
    "configured": true,
    "timestamp": "2024-09-04T15:35:22.123Z"
  }
}
```

**Example Request**:
```
GET /api/android/weather
```

**Notes**:
- Location can be configured as city name (e.g., "New York, NY") or coordinates (e.g., "40.7128,-74.0060")
- Weather icons are provided as both icon codes and full URLs for easy integration
- All timestamps are in ISO 8601 format (UTC)
- Temperature units depend on settings: metric (°C), imperial (°F), or kelvin (K)
- Visibility is converted from meters to kilometers for better readability
- Sunrise/sunset times are automatically converted from Unix timestamps to ISO format
- Rain and snow data included when available (1-hour and 3-hour precipitation)
- Requires active internet connection and valid OpenWeatherMap API access

**Android Integration**:
- Icon URLs work directly with image loading libraries (Picasso, Glide, Coil)
- All numeric values are provided as appropriate data types for easy parsing
- Error states include detailed configuration status for troubleshooting
- Comprehensive units information for proper display formatting
- Timezone offset provided for local time calculations

---

## Custom Orders Browsing Endpoints

These endpoints allow the Android app to browse and play items directly from custom orders, enabling a dedicated custom orders viewing experience within the app.

### 1. Get All Custom Orders

**Endpoint**: `GET /api/android/custom-orders`

**Description**: Retrieves a list of all custom orders with summary statistics, allowing users to browse available custom orders in the Android app.

**Response Format**:
```json
{
  "type": "CUSTOM_ORDERS_LIST",
  "data": {
    "orders": [
      {
        "id": 1,
        "name": "Star Wars Canon Timeline",
        "description": "Complete Star Wars canon content in chronological order",
        "icon": "🌟",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-20T15:30:00.000Z",
        "totalItems": 150,
        "watchedItems": 75,
        "unwatchedItems": 75,
        "playlistName": "Star Wars Music",
        "playlistType": "plex",
        "backgroundGalleryName": "Space Backgrounds"
      },
      {
        "id": 2,
        "name": "Marvel Cinematic Universe",
        "description": "All MCU content in timeline order",
        "icon": "🦸",
        "createdAt": "2024-01-10T09:00:00.000Z",
        "updatedAt": "2024-01-18T12:00:00.000Z",
        "totalItems": 85,
        "watchedItems": 40,
        "unwatchedItems": 45,
        "playlistName": "Epic Soundtracks",
        "playlistType": "custom",
        "backgroundGalleryName": null
      }
    ],
    "totalOrders": 2
  }
}
```

**Response Fields**:
- `orders`: Array of custom order objects
  - `id`: Unique identifier for the custom order
  - `name`: Name of the custom order
  - `description`: Optional description text
  - `icon`: Emoji or icon character for the order
  - `createdAt`: ISO timestamp when order was created
  - `updatedAt`: ISO timestamp when order was last modified
  - `totalItems`: Total number of items in the order (excluding reference books)
  - `watchedItems`: Number of items marked as watched/completed
  - `unwatchedItems`: Number of unwatched items remaining
  - `playlistName`: Name of linked Plex or custom playlist (if any)
  - `playlistType`: Type of linked playlist (`"plex"`, `"custom"`, or `null`)
  - `backgroundGalleryName`: Name of linked background gallery (if any)
- `totalOrders`: Total count of custom orders

**Example Usage**:
```bash
curl -X GET "http://localhost:3001/api/android/custom-orders"
```

---

### 2. Get Custom Order Items

**Endpoint**: `GET /api/android/custom-orders/:id/items`

**Description**: Retrieves all items for a specific custom order with complete details needed for playback and display. This allows the Android app to show the full order content and play individual items.

**URL Parameters**:
- `id`: The custom order ID

**Response Format**:
```json
{
  "type": "CUSTOM_ORDER_ITEMS",
  "data": {
    "customOrder": {
      "id": 1,
      "name": "Star Wars Canon Timeline",
      "description": "Complete Star Wars canon content in chronological order",
      "icon": "🌟",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-20T15:30:00.000Z",
      "playlistName": "Star Wars Music",
      "playlistType": "plex",
      "backgroundGalleryName": "Space Backgrounds"
    },
    "items": [
      {
        "id": 101,
        "customOrderId": 1,
        "customOrderName": "Star Wars Canon Timeline",
        "mediaType": "episode",
        "title": "The Phantom Menace - Chapter 1",
        "sortOrder": 0,
        "isWatched": true,
        "watchedAt": "2024-01-15T12:00:00.000Z",
        "plexKey": "12345",
        "artworkUrl": "http://localhost:3001/api/artwork/episode-1-thumb.jpg",
        "localArtworkPath": "/app/server/artwork-cache/episode-1-thumb.jpg",
        "originalArtworkUrl": "https://tvdb.com/image/123.jpg",
        "seriesTitle": "Star Wars: The Clone Wars",
        "seasonNumber": 1,
        "episodeNumber": 1
      },
      {
        "id": 102,
        "customOrderId": 1,
        "customOrderName": "Star Wars Canon Timeline",
        "mediaType": "comic",
        "title": "Star Wars (2015) #1",
        "sortOrder": 1,
        "isWatched": false,
        "watchedAt": null,
        "plexKey": "comic-star-wars-2015-1",
        "artworkUrl": "http://localhost:3001/api/comicvine/artwork?url=https%3A%2F%2Fcomicvine.com%2Fimage.jpg",
        "localArtworkPath": null,
        "originalArtworkUrl": "https://comicvine.com/image.jpg",
        "comicSeries": "Star Wars",
        "comicYear": 2015,
        "comicIssue": "1",
        "comicPublisher": "Marvel Comics",
        "comicIssueName": "Skywalker Strikes",
        "comicDescription": "The first issue of the new series...",
        "comicWriter": "Jason Aaron",
        "comicCoverDate": "2015-01-14"
      },
      {
        "id": 103,
        "customOrderId": 1,
        "customOrderName": "Star Wars Canon Timeline",
        "mediaType": "book",
        "title": "Ahsoka",
        "sortOrder": 2,
        "isWatched": false,
        "watchedAt": null,
        "plexKey": "book-ahsoka-e-k-johnston",
        "artworkUrl": "http://localhost:3001/api/openlibrary/artwork?url=https%3A%2F%2Fcovers.openlibrary.org%2Fb%2Fid%2F12345-M.jpg",
        "bookTitle": "Ahsoka",
        "bookAuthor": "E. K. Johnston",
        "bookYear": 2016,
        "bookPublisher": "Disney Lucasfilm Press",
        "bookPageCount": 336,
        "bookCurrentPage": 0,
        "bookPercentRead": 0,
        "bookId": 45,
        "hasUnifiedProgress": true
      },
      {
        "id": 104,
        "customOrderId": 1,
        "customOrderName": "Star Wars Canon Timeline",
        "mediaType": "webvideo",
        "title": "Star Wars Galaxy of Adventures - Episode 1",
        "sortOrder": 3,
        "isWatched": false,
        "watchedAt": null,
        "plexKey": "webvideo-star-wars-galaxy-1",
        "webTitle": "Star Wars Galaxy of Adventures - Episode 1",
        "webUrl": "https://www.youtube.com/watch?v=example",
        "webDescription": "Animated short featuring Luke Skywalker"
      }
    ],
    "statistics": {
      "totalItems": 150,
      "watchedItems": 75,
      "unwatchedItems": 75,
      "progressPercentage": 50
    }
  }
}
```

**Response Fields**:
- `customOrder`: Summary information about the custom order
  - `id`: Custom order ID
  - `name`: Order name
  - `description`: Order description
  - `icon`: Order icon/emoji
  - `createdAt`: Creation timestamp
  - `updatedAt`: Last update timestamp
  - `playlistName`: Linked playlist name (if any)
  - `playlistType`: Playlist type (`"plex"`, `"custom"`, or `null`)
  - `backgroundGalleryName`: Linked gallery name (if any)

- `items`: Array of custom order items with media-type-specific fields
  - **Common fields** (all media types):
    - `id`: Item ID
    - `customOrderId`: Parent custom order ID
    - `customOrderName`: Parent custom order name
    - `mediaType`: Type of media (`"episode"`, `"movie"`, `"comic"`, `"book"`, `"shortstory"`, `"webvideo"`, `"suborder"`)
    - `title`: Item title
    - `sortOrder`: Position in the order
    - `isWatched`: Whether item has been completed
    - `watchedAt`: Completion timestamp (if watched)
    - `plexKey`: Plex rating key or generated identifier
    - `artworkUrl`: Full URL to item artwork/thumbnail
    - `localArtworkPath`: Local cached artwork path
    - `originalArtworkUrl`: Original remote artwork URL
  
  - **Episode-specific fields**:
    - `seriesTitle`: TV series name
    - `seasonNumber`: Season number
    - `episodeNumber`: Episode number
  
  - **Comic-specific fields**:
    - `comicSeries`: Comic series name
    - `comicYear`: Publication year
    - `comicIssue`: Issue number
    - `comicPublisher`: Publisher name
    - `comicIssueName`: Issue title/name
    - `comicDescription`: Issue description/synopsis
    - `comicWriter`: Writer(s) name(s)
    - `comicCoverDate`: Cover date
  
  - **Book-specific fields**:
    - `bookTitle`: Book title
    - `bookAuthor`: Author name
    - `bookYear`: Publication year
    - `bookPublisher`: Publisher name
    - `bookPageCount`: Total pages
    - `bookCurrentPage`: Current reading position
    - `bookPercentRead`: Reading progress percentage
    - `bookId`: Unified book system ID (if linked)
    - `hasUnifiedProgress`: Whether book uses unified progress tracking
  
  - **Short story-specific fields**:
    - `storyTitle`: Story title
    - `storyAuthor`: Author name
    - `storyYear`: Publication year
    - `storyUrl`: External URL (if available)
  
  - **Web video-specific fields**:
    - `webTitle`: Video title
    - `webUrl`: Video URL (YouTube, Vimeo, etc.)
    - `webDescription`: Video description
  
  - **Sub-order fields**:
    - `referencedCustomOrderId`: ID of referenced order
    - `referencedCustomOrder`: Object with `id`, `name`, and `icon`

- `statistics`: Aggregate statistics
  - `totalItems`: Total item count
  - `watchedItems`: Completed item count
  - `unwatchedItems`: Remaining item count
  - `progressPercentage`: Overall progress (0-100)

**Error Responses**:
- `404`: Custom order not found
- `500`: Server error

**Example Usage**:
```bash
curl -X GET "http://localhost:3001/api/android/custom-orders/1/items"
```

**Notes**:
- Reference books (books containing short stories) are filtered out from both endpoints
- Artwork URLs are fully qualified and ready for direct use in image loading libraries
- Items are returned in their sort order (as configured in the custom order)
- For episodes with Plex keys, the app can use existing `/api/android/play-plex` endpoint
- For web videos, use the `webUrl` field for playback
- For books/comics, integrate with reading session endpoints (`/api/android/reading/start`)

---

## Stash Integration Endpoints

> **🔔 Real-Time Overlay Feature**: When the Android app requests a clip via `/api/android/stash/next`, the web application automatically displays an overlay with comprehensive clip and scene metadata. This provides real-time visibility into what content is being played on connected Android devices. See [STASH_CLIP_OVERLAY.md](./STASH_CLIP_OVERLAY.md) for technical details.

### 1. Get Next Stash Clip

**Endpoint**: `GET /api/android/stash/next`

**Description**: Retrieves the next available unwatched 1-minute clip from Stash, similar to pressing the "Clip Play" button in the web interface. **This endpoint triggers a WebSocket event that displays an overlay in the web app with full clip details.**

**Response Format**:
```json
{
  "type": "PLAY_CLIP",
  "data": {
    "url": "stream_url_here",
    "title": "Scene Title",
    "performers": "Performer 1, Performer 2",
    "studio": "Studio Name",
    "duration": 60,
    "startTime": 540,
    "endTime": 600,
    "clipId": 2267,
    "sceneId": "12345",
    "clipIndex": 9
  }
}
```

**Response Fields**:
- `url`: Direct stream URL for the clip (may be empty if not configured)
- `title`: Scene title or filename without extension if title is empty
- `performers`: Comma-separated list of performer names
- `studio`: Studio name
- `duration`: Clip duration in seconds (typically 60)
- `startTime`: Start time of the clip within the full scene (in seconds)
- `endTime`: End time of the clip within the full scene (in seconds)
- `clipId`: Unique identifier for the specific clip
- `sceneId`: Identifier for the parent scene (optional)
- `clipIndex`: Index of this clip within the scene (0-based)

**Error Responses**:
- `404`: No clips available
- `500`: Server error

**Example Usage**:
```bash
curl -X GET "http://localhost:3001/api/android/stash/next"
```

---

### 2. Get Next Stash Scene

**Endpoint**: `GET /api/android/stash/scene/next`

**Description**: Retrieves the next random unwatched full scene from Stash, equivalent to pressing the "Next Stash" button in the web interface.

**Response Format**:
```json
{
  "type": "PLAY_SCENE",
  "data": {
    "url": "stream_url_here",
    "title": "Scene Title or Filename",
    "performers": "Performer 1, Performer 2",
    "studio": "Studio Name",
    "duration": 1498.11,
    "sceneId": "16152",
    "rating": 0,
    "totalUnwatched": 26621,
    "artwork": {
      "screenshot": "/screenshot/16152.webp",
      "preview": "/scene/16152/preview",
      "stream": "/scene/16152/stream",
      "webp": "/scene/16152/webp"
    }
  }
}
```

**Response Fields**:
- `url`: Direct stream URL for the scene (may be empty if not configured)
- `title`: Scene title, or filename without extension if title is empty
- `performers`: Comma-separated list of performer names
- `studio`: Studio name
- `duration`: Full scene duration in seconds
- `sceneId`: Unique identifier for the scene
- `rating`: Scene rating (0-5, or null)
- `totalUnwatched`: Total number of unwatched scenes remaining
- `artwork`: Object containing Stash artwork URLs (null if not available)
  - `screenshot`: Path to scene screenshot image
  - `preview`: Path to scene preview video
  - `stream`: Path to scene stream URL
  - `webp`: Path to scene WebP image

**Title Logic**: If the scene has no title or an empty title, the endpoint extracts the filename from the file path and removes the extension, matching the behavior of the web interface.

**Error Responses**:
- `404`: No unwatched scenes available
- `500`: Server error

**Example Usage**:
```bash
curl -X GET "http://localhost:3001/api/android/stash/scene/next"
```

---

### 3. Mark Scene as Watched

**Endpoint**: `POST /api/android/stash/scene/{sceneId}/watched`

**Description**: Marks a specific scene as watched, incrementing the play count in both the local database and Stash server. Behaves identically to the "Mark as Watched" button in the web interface.

**URL Parameters**:
- `sceneId` (required): The unique identifier of the scene to mark as watched

**Response Format**:
```json
{
  "type": "SCENE_MARKED_WATCHED",
  "data": {
    "success": true,
    "sceneId": "16152",
    "playCount": 1,
    "lastPlayedAt": "2025-08-27T04:05:44.364Z",
    "stashUpdated": true,
    "message": "Scene marked as watched successfully"
  }
}
```

**Response Fields**:
- `success`: Boolean indicating if the operation succeeded
- `sceneId`: The ID of the scene that was marked as watched
- `playCount`: Updated play count in the local database
- `lastPlayedAt`: Timestamp when the scene was last played (ISO 8601 format)
- `stashUpdated`: Boolean indicating if the Stash server was successfully updated
- `message`: Success message

**Database Operations**:
1. Increments `playCount` in local database (handles null values properly)
2. Sets `lastPlayedAt` to current timestamp
3. Increments play count in Stash server via GraphQL API

**Error Responses**:
- `400`: Invalid scene ID
- `404`: Scene not found
- `500`: Server error

**Example Usage**:
```bash
curl -X POST "http://localhost:3001/api/android/stash/scene/16152/watched"
```

---

### 4. Delete Scene

**Endpoint**: `DELETE /api/android/stash/scene/{sceneId}`

**Description**: Deletes a scene from both the local database and Stash server, with optional file deletion. Behaves identically to the delete button in the web interface.

**URL Parameters**:
- `sceneId` (required): The unique identifier of the scene to delete

**Query Parameters**:
- `deleteFile` (optional): Set to `true` to also delete the physical video file from disk

**Response Format**:
```json
{
  "type": "SCENE_DELETED",
  "data": {
    "success": true,
    "sceneId": "2475",
    "localDeleted": true,
    "clipsDeleted": 0,
    "stashDeleted": true,
    "fileDeleted": false,
    "message": "Scene deleted successfully"
  }
}
```

**Response Fields**:
- `success`: Boolean indicating if the operation succeeded
- `sceneId`: The ID of the scene that was deleted
- `localDeleted`: Boolean indicating if the scene was deleted from local database
- `clipsDeleted`: Number of associated clips that were deleted
- `stashDeleted`: Boolean indicating if the scene was deleted from Stash server
- `fileDeleted`: Boolean indicating if the physical file was deleted (matches query parameter)
- `message`: Success message

**Database Operations**:
1. Deletes all associated clips from local database
2. Deletes the scene from local database
3. Deletes the scene from Stash server via GraphQL API
4. Optionally deletes the physical video file from disk

**Error Responses**:
- `400`: Invalid scene ID
- `404`: Scene not found
- `500`: Server error

**Example Usage**:
```bash
# Delete scene but keep file
curl -X DELETE "http://localhost:3001/api/android/stash/scene/2475"

# Delete scene and file
curl -X DELETE "http://localhost:3001/api/android/stash/scene/2475?deleteFile=true"
```

---

### 5. Get Random Stash Images

**Endpoint**: `GET /api/android/stash/images`

**Description**: Retrieves a specified number of random images from the Stash library, including both gallery images and standalone images. Perfect for creating image viewers, wallpaper apps, or random image displays.

**Query Parameters**:
- `count` (optional): Number of random images to return (default: 1, min: 1, max: 50)

**Response Format**:
```json
{
  "type": "RANDOM_IMAGES",
  "data": {
    "images": [
      {
        "id": "12345",
        "title": "Image Title",
        "path": "/path/to/image.jpg",
        "url": "http://localhost:3001/api/stash-image-proxy/encoded-path",
        "photographer": "Photographer Name",
        "performers": [
          {
            "name": "Performer Name",
            "image": "performer_image_url"
          }
        ],
        "studio": {
          "name": "Studio Name",
          "image": "studio_image_url"
        },
        "gallery": {
          "title": "Gallery Title"
        },
        "rating": 4,
        "organized": true
      }
    ],
    "count": 1,
    "totalAvailable": 1523
  }
}
```

**Response Fields**:
- `images`: Array of image objects
  - `id`: Unique image identifier
  - `title`: Image title (from image or gallery)
  - `path`: Original file path on Stash server
  - `url`: Complete proxy URL for accessing the image through Master Order
  - `photographer`: Name of the photographer (if available)
  - `performers`: Array of associated performers with names and images
  - `studio`: Studio object with name and image (if available)
  - `gallery`: Gallery object with title (if image is part of a gallery)
  - `rating`: Star rating (1-5, if available)
  - `organized`: Boolean indicating if the image is marked as organized
- `count`: Number of images returned
- `totalAvailable`: Total number of images available in the library

**Image Sources**:
- Gallery images (images that are part of organized galleries)
- Standalone images (images not associated with any gallery)

**Error Responses**:
```json
{
  "type": "NO_IMAGES",
  "data": {
    "message": "No images found in Stash library",
    "images": []
  }
}
```

**Example Usage**:
```bash
# Get 1 random image (default)
curl -X GET "http://localhost:3001/api/android/stash/images"

# Get 5 random images
curl -X GET "http://localhost:3001/api/android/stash/images?count=5"

# Get maximum 50 random images
curl -X GET "http://localhost:3001/api/android/stash/images?count=50"
```

**Use Cases**:
- Random wallpaper/background image selection
- Image gallery/slideshow applications
- Sample image preview for browsing
- Random image widgets or displays

---

## Response Format Standards

All Android endpoints follow a consistent response format:

### Success Response Structure
```json
{
  "type": "COMMAND_TYPE",
  "data": {
    // Command-specific data
    "success": true,
    "message": "Operation completed successfully"
  }
}
```

### Error Response Structure
```json
{
  "error": "Error Category",
  "message": "Detailed error message",
  "details": "Additional error information"
}
```

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Integration Notes

### WebSocket Behavior
These Android endpoints are specifically designed **NOT** to emit WebSocket messages, unlike their web interface counterparts. This prevents interference with the main web application while allowing the Android app to function independently.

### Data Synchronization
All endpoints maintain perfect synchronization between:
1. **Local Database**: SQLite (development) or PostgreSQL (production)
2. **Stash Server**: Via GraphQL API integration
3. **File System**: When deletion operations are performed

### Error Handling
Each endpoint includes comprehensive error handling and will attempt to complete as much of the operation as possible. For example, if local database deletion succeeds but Stash server deletion fails, the response will indicate the partial success.

### Performance Considerations
- Endpoints use internal HTTP calls to existing functionality to ensure consistency
- Database operations are optimized for concurrent access
- Stash API calls include proper error handling and timeouts

---

## Android App Integration Example

Here's a basic example of how to integrate these endpoints in an Android app:

```kotlin
class StashApiService {
    private val baseUrl = "http://192.168.1.100:3001"
    
    suspend fun getNextScene(): StashScene? {
        val response = httpClient.get("$baseUrl/api/android/stash/scene/next")
        if (response.isSuccessful) {
            val apiResponse = response.body<AndroidApiResponse<StashScene>>()
            return apiResponse.data
        }
        return null
    }
    
    suspend fun markSceneWatched(sceneId: String): Boolean {
        val response = httpClient.post("$baseUrl/api/android/stash/scene/$sceneId/watched")
        return response.isSuccessful
    }
    
    suspend fun deleteScene(sceneId: String, deleteFile: Boolean = false): Boolean {
        val url = "$baseUrl/api/android/stash/scene/$sceneId" + 
                  if (deleteFile) "?deleteFile=true" else ""
        val response = httpClient.delete(url)
        return response.isSuccessful
    }
}
```

---

## Security Considerations

### Network Security
- Endpoints are designed for local network access only
- No authentication is currently implemented
- Consider implementing API key authentication for production use

### Data Validation
- All inputs are validated and sanitized
- SQL injection protection via Prisma ORM
- Proper error handling prevents information leakage

### File Operations
- File deletion operations include proper permission checks
- Physical file paths are validated to prevent directory traversal

---

## Future Enhancements

Potential improvements for these Android endpoints:

1. **Authentication**: JWT token-based authentication
2. **Rate Limiting**: Prevent API abuse
3. **Batch Operations**: Multi-scene operations in single requests
4. **WebSocket Support**: Optional WebSocket mode for real-time updates
5. **Filtering**: Advanced filtering options for scene selection
6. **Statistics**: Detailed usage and performance statistics

---

## Troubleshooting

### Common Issues

**Connection Refused**:
- Verify the Master Order server is running
- Check the IP address and port configuration
- Ensure firewall allows connections on the specified port

**Empty URLs in Response**:
- Verify Stash server configuration in Master Order settings
- Check Stash server accessibility from Master Order server
- Ensure proper Stash API key configuration

**Database Errors**:
- Check database connectivity
- Verify Prisma schema is up to date
- Ensure proper database migrations have been applied

### Logging

All endpoints include comprehensive logging that can be viewed in the Master Order server console:
- 📱 Prefix indicates Android companion app operations
- ✅ Indicates successful operations  
- ❌ Indicates errors
- 🔍 Indicates diagnostic information

---

## Version History

### v1.0 (Current)
- Initial implementation of core Stash integration endpoints
- Next scene/clip functionality
- Mark as watched functionality  
- Delete scene functionality
- Comprehensive error handling and logging
