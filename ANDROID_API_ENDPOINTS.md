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

**Description**: Retrieves the next recommended content from the Master Order system, equivalent to pressing the "Get Up Next" button on the home page. This can return TV episodes, movies, or custom order items based on the current configuration.

**Response Format**:

**TV Episode Response**:
```json
{
  "type": "PLAY_TV_EPISODE",
  "data": {
    "ratingKey": "12345",
    "plexId": "12345",
    "title": "Series Name",
    "episodeTitle": "Episode Title",
    "summary": "Series description...",
    "episodeSummary": "Episode description...",
    "seasonNumber": 3,
    "episodeNumber": 8,
    "isFinalSeason": false,
    "leafCount": 100,
    "viewedLeafCount": 45,
    "thumb": "/library/metadata/12345/thumb/1234567890",
    "art": "/library/metadata/12345/art/1234567890",
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
    "customOrderId": 456
  }
}
```

**Response Fields**:
- `type`: Indicates the content type (`PLAY_TV_EPISODE`, `PLAY_MOVIE`, or `PLAY_CUSTOM_ORDER_ITEM`)
- TV Episode Fields:
  - `ratingKey`: Plex rating key for the series
  - `plexId`: Plex identifier for direct media access (same as ratingKey)
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

**Description**: Stops the active reading session, equivalent to pressing the "Stop" button, with optional progress tracking.

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
    "message": "Stopped reading session for \"The Great Gatsby\"",
    "completedAt": "2024-01-15T10:40:00.000Z",
    "timestamp": "2024-01-15T10:40:00.000Z"
  }
}
```

---

### 5. Viewing Session Management

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

## Stash Integration Endpoints

### 1. Get Next Stash Clip

**Endpoint**: `GET /api/android/stash/next`

**Description**: Retrieves the next available unwatched 1-minute clip from Stash, similar to pressing the "Clip Play" button in the web interface.

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
