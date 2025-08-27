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
    "totalUnwatched": 26621
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
