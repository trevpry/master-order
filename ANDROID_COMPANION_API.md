# Master Order - Android Companion App WebSocket API Documentation

## Overview

The Master O**Updated**: Stash integration now uses **both WebSocket messages and optional HTTP communication**. The primary method is WebSocket messages, with HTTP as a fallback for legacy Android apps.

### Connection Details
- **Primary Method**: WebSocket messages via `androidCompanion` channel
- **Fallback Method**: HTTP POST requests (optional)
- **Android App Expected Endpoints** (optional):
  - `http://localhost:8080/play` - Start playback
  - `http://localhost:8080/pause` - Pause playback  
  - `http://localhost:8080/stop` - Stop playback
- **Forwarding Endpoint**: `/api/android/play` (on Master Order server)er emits real-time WebSocket messages specifically designed for Android companion app integration. These messages provide notifications about reading sessions and media playback events, allowing the Android app to synchronize music playback and provide contextual information during reading sessions.

## WebSocket Connection

### Connection Details
- **WebSocket URL**: `ws://your-server:3000` (production) or `ws://localhost:3001` (development)
- **Protocol**: Socket.IO WebSocket protocol
- **Channel**: `androidCompanion`
- **Authentication**: No authentication required (messages are broadcast)

### Connection Example (JavaScript/Node.js)
```javascript
const io = require('socket.io-client');
const socket = io('ws://your-master-order-server:3000');

socket.on('androidCompanion', (message) => {
  console.log('Received Android companion message:', message);
  // Handle the message in your Android app
});
```

### 2. STASH_PLAYBACK

Emitted when a user interacts with Stash scene playback (play, pause, stop).

#### Message Structure
```json
{
  "type": "STASH_PLAYBACK",
  "action": "PLAY|PAUSE|STOP|PLAY_CLIP",
  "scene": {
    "id": "string",
    "title": "string",
    "streamUrl": "string", // Only for PLAY and PLAY_CLIP actions
    "resumeTime": "number", // Only for PLAY action
    "startTime": "number", // Only for PLAY_CLIP action (clip start time)
    "endTime": "number", // Only for PLAY_CLIP action (clip end time)
    "duration": "number", // For PLAY (full duration) or PLAY_CLIP (clip duration)
    "clipIndex": "number", // Only for PLAY_CLIP action (1-based index)
    "totalClips": "number", // Only for PLAY_CLIP action
    "stashUrl": "string", // Only for PLAY and PLAY_CLIP actions
    "currentTime": "number" // Only for PAUSE action
  },
  "clip": { // Only for PLAY_CLIP action
    "id": "number",
    "clipIndex": "number", // 0-based index
    "startTime": "number",
    "endTime": "number",
    "duration": "number"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

#### Examples

**Example 1: Play Scene**
```json
{
  "type": "STASH_PLAYBACK",
  "action": "PLAY",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title",
    "streamUrl": "http://192.168.1.100:9999/scene/12345/stream",
    "resumeTime": 0,
    "duration": 1800,
    "stashUrl": "http://192.168.1.100:9999"
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 2: Pause Scene**
```json
{
  "type": "STASH_PLAYBACK",
  "action": "PAUSE",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title",
    "currentTime": 450
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 3: Stop Scene**
```json
{
  "type": "STASH_PLAYBACK",
  "action": "STOP",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title"
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 4: Play Clip (1-minute segment)**
```json
{
  "type": "STASH_PLAYBACK",
  "action": "PLAY_CLIP",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title",
    "streamUrl": "http://192.168.1.100:9999/scene/12345/stream",
    "startTime": 120,
    "endTime": 180,
    "duration": 60,
    "clipIndex": 3,
    "totalClips": 15,
    "stashUrl": "http://192.168.1.100:9999"
  },
  "clip": {
    "id": 42,
    "clipIndex": 2,
    "startTime": 120,
    "endTime": 180,
    "duration": 60
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

---

## Stash Integration (Hybrid WebSocket + HTTP)

**Important**: Stash integration does **not** use WebSocket messages. Instead, it uses direct HTTP communication to an Android companion app running on `localhost:8080`.

### Connection Details
- **Protocol**: HTTP POST requests
- **Android App Expected Endpoints**:
  - `http://localhost:8080/play` - Start playback
  - `http://localhost:8080/pause` - Pause playback  
  - `http://localhost:8080/stop` - Stop playback
- **Forwarding Endpoint**: `/api/android/play` (on Master Order server)

### Stash Message Types

#### PLAY_SCENE
Sent when a user clicks play on a Stash scene.

**HTTP Request Structure**:
```json
{
  "action": "play",
  "scene": {
    "id": "string",
    "title": "string",
    "streamUrl": "http://stash-server:9999/scene/{id}/stream",
    "resumeTime": "number",
    "duration": "number",
    "stashUrl": "string"
  }
}
```

**Example**:
```json
{
  "action": "play",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title",
    "streamUrl": "http://192.168.1.100:9999/scene/12345/stream",
    "resumeTime": 0,
    "duration": 1800,
    "stashUrl": "http://192.168.1.100:9999"
  }
}
```

#### PAUSE_SCENE
Sent when a user clicks pause on a playing Stash scene.

**HTTP Request Structure**:
```json
{
  "action": "pause",
  "scene": {
    "id": "string",
    "title": "string",
    "currentTime": "number"
  }
}
```

**Example**:
```json
{
  "action": "pause",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title",
    "currentTime": 450
  }
}
```

#### STOP_SCENE
Sent when a user clicks stop on a playing Stash scene.

**HTTP Request Structure**:
```json
{
  "action": "stop",
  "scene": {
    "id": "string",
    "title": "string"
  }
}
```

**Example**:
```json
{
  "action": "stop",
  "scene": {
    "id": "12345",
    "title": "Sample Scene Title"
  }
}
```

### Android App HTTP Server Requirements

Your Android companion app must implement an HTTP server listening on `localhost:8080` with these endpoints:

#### POST /play
Handles scene playback requests.
- **Request Body**: PLAY_SCENE message structure
- **Expected Response**: 200 OK with success confirmation

#### POST /pause
Handles scene pause requests.
- **Request Body**: PAUSE_SCENE message structure
- **Expected Response**: 200 OK with success confirmation

#### POST /stop
Handles scene stop requests.
- **Request Body**: STOP_SCENE message structure
- **Expected Response**: 200 OK with success confirmation

### Stash Integration Flow

1. **User Action**: User clicks play/pause/stop on Stash page
2. **Frontend Request**: JavaScript sends POST to `/api/android/play`
3. **WebSocket Emission**: Master Order server emits `STASH_PLAYBACK` message via WebSocket
4. **Optional HTTP Forward**: Server attempts HTTP request to `localhost:8080/{action}` (with 2-second timeout)
5. **Android Processing**: Android app receives WebSocket message and/or HTTP request
6. **User Feedback**: Success confirmation shown in Master Order UI

### Recommended Implementation

For new Android apps, **use WebSocket messages** as the primary method:

```kotlin
// WebSocket connection for Stash messages
socket.on("androidCompanion") { args ->
    val message = args[0] as JSONObject
    val type = message.getString("type")
    
    when (type) {
        "STASH_PLAYBACK" -> handleStashPlayback(message)
        "START_READ_SESSION" -> handleReadingSession(message)
    }
}

fun handleStashPlayback(message: JSONObject) {
    val action = message.getString("action")
    val scene = message.getJSONObject("scene")
    
    when (action) {
        "PLAY" -> playStashScene(scene)
        "PAUSE" -> pauseStashScene(scene)
        "STOP" -> stopStashScene(scene)
        "PLAY_CLIP" -> {
            val clip = message.getJSONObject("clip")
            playStashClip(scene, clip)
        }
    }
}

fun playStashClip(scene: JSONObject, clip: JSONObject) {
    val streamUrl = scene.getString("streamUrl")
    val startTime = scene.getInt("startTime") // Clip start time in seconds
    val duration = scene.getInt("duration") // Clip duration (usually 60s)
    val clipIndex = scene.getInt("clipIndex") // Human-readable clip number
    
    // Start video playback at specific timestamp with duration limit
    startVideoWithTimeConstraints(streamUrl, startTime, duration)
    
    // Show clip info to user
    showClipNotification("Playing clip $clipIndex", duration)
    
    // Optional: Auto-stop after clip duration
    Handler(Looper.getMainLooper()).postDelayed({
        stopVideoPlayback()
    }, (duration * 1000).toLong())
}
```

### Example Android Server Implementation (Pseudo-code)

```kotlin
// HTTP Server for Stash integration
class StashHttpServer {
    private val server = HttpServer.create(InetSocketAddress(8080), 0)
    
    init {
        server.createContext("/play") { exchange ->
            val requestBody = exchange.requestBody.readBytes().toString(Charset.defaultCharset())
            val playData = parseJson<PlaySceneRequest>(requestBody)
            
            // Handle scene playback
            playStashScene(playData.scene)
            
            sendResponse(exchange, 200, "Scene playback started")
        }
        
        server.createContext("/pause") { exchange ->
            val requestBody = exchange.requestBody.readBytes().toString(Charset.defaultCharset())
            val pauseData = parseJson<PauseSceneRequest>(requestBody)
            
            // Handle scene pause
            pauseStashScene(pauseData.scene)
            
            sendResponse(exchange, 200, "Scene playback paused")
        }
        
        server.createContext("/stop") { exchange ->
            val requestBody = exchange.requestBody.readBytes().toString(Charset.defaultCharset())
            val stopData = parseJson<StopSceneRequest>(requestBody)
            
            // Handle scene stop
            stopStashScene(stopData.scene)
            
            sendResponse(exchange, 200, "Scene playback stopped")
        }
    }
    
    fun start() {
        server.executor = null
        server.start()
    }
}
```

---

## Message Types (WebSocket)

### 1. START_READ_SESSION

Emitted when a user starts a reading session for books, comics, or short stories.

#### Message Structure
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "string",
  "mediaType": "book|comic|shortstory",
  "timestamp": "ISO 8601 timestamp",
  
  // Present only if part of a custom order
  "customOrderName": "string",
  "customOrderDescription": "string|null",
  
  // Present only if custom order has linked playlist
  "playlistName": "string",
  "playlistPath": "string",
  "playlistType": "plex|custom",
  "playlistTrackCount": "number",
  "playlistDescription": "string|null", // Only for custom playlists
  "playlistMetadata": {
    // Plex playlist metadata
    "ratingKey": "string",
    "playlistType": "audio|video",
    "duration": "number|null"
    
    // OR Custom playlist metadata
    "id": "number",
    "trackCount": "number",
    "isPublic": "boolean",
    "createdBy": "string|null"
  },
  
  // Present only if custom order has no playlist
  "note": "Custom order has no linked playlist"
}
```

#### Examples

**Example 1: Custom Order with Plex Playlist**
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "The Fellowship of the Ring",
  "mediaType": "book",
  "customOrderName": "Lord of the Rings Complete Experience",
  "customOrderDescription": "A complete multimedia journey through Middle-earth",
  "playlistName": "LOTR Soundtrack Collection",
  "playlistPath": "plex://playlist/12345",
  "playlistType": "plex",
  "playlistTrackCount": 45,
  "playlistMetadata": {
    "ratingKey": "12345",
    "playlistType": "audio",
    "duration": 9870000
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 2: Custom Order with Custom Playlist**
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "Batman: Year One",
  "mediaType": "comic",
  "customOrderName": "Batman Origins Arc",
  "customOrderDescription": "The definitive Batman origin story collection",
  "playlistName": "Dark Knight Ambient",
  "playlistPath": "http://localhost:3001/api/custom-playlists/67/play",
  "playlistType": "custom",
  "playlistTrackCount": 23,
  "playlistDescription": "Atmospheric music for Batman reading sessions",
  "playlistMetadata": {
    "id": 67,
    "trackCount": 23,
    "isPublic": false,
    "createdBy": "admin"
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 3: Custom Order without Playlist**
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "The Hobbit",
  "mediaType": "book",
  "customOrderName": "Tolkien Reading Order",
  "customOrderDescription": "Reading Tolkien's works in chronological order",
  "note": "Custom order has no linked playlist",
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 4: Standalone Reading Session**
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "Dune",
  "mediaType": "book",
  "note": "Standalone reading session - not part of a custom order",
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

**Example 5: Short Story with Custom Playlist**
```json
{
  "action": "START_READ_SESSION",
  "mediaTitle": "The Last Question",
  "mediaType": "shortstory",
  "customOrderName": "Asimov Sci-Fi Collection",
  "customOrderDescription": "Classic science fiction short stories",
  "playlistName": "Sci-Fi Ambience",
  "playlistPath": "http://localhost:3001/api/custom-playlists/89/play",
  "playlistType": "custom",
  "playlistTrackCount": 18,
  "playlistDescription": "Futuristic ambient soundscapes",
  "playlistMetadata": {
    "id": 89,
    "trackCount": 18,
    "isPublic": true,
    "createdBy": "sci-fi-fan"
  },
  "timestamp": "2025-08-26T15:30:00.000Z"
}
```

## Android App Implementation Guide

### Recommended Message Handling

1. **Connect to WebSocket** on app startup
2. **Listen for `androidCompanion` events**
3. **Parse message action** to determine response
4. **Handle playlist integration** based on playlist type

### Playlist Integration Suggestions

#### Plex Playlists
- **Path Format**: `plex://playlist/{ratingKey}`
- **Integration**: Use Plex API or Plex Mobile SDK to start playlist playback
- **Metadata**: Use `ratingKey` for direct Plex playlist access

#### Custom Playlists  
- **Path Format**: `http://server:port/api/custom-playlists/{id}/play`
- **Integration**: HTTP request to Master Order server for playlist data
- **Streaming**: Implement custom audio streaming or download tracks

### Example Android Implementation (Pseudo-code)

```kotlin
// WebSocket connection
val socket = IO.socket("http://your-server:3000")

socket.on("androidCompanion") { args ->
    val message = args[0] as JSONObject
    val action = message.getString("action")
    
    when (action) {
        "START_READ_SESSION" -> handleReadingSession(message)
    }
}

fun handleReadingSession(message: JSONObject) {
    val mediaTitle = message.getString("mediaTitle")
    val mediaType = message.getString("mediaType")
    
    // Show notification
    showReadingNotification(mediaTitle, mediaType)
    
    // Handle playlist if present
    if (message.has("playlistPath")) {
        val playlistPath = message.getString("playlistPath")
        val playlistType = message.getString("playlistType")
        
        when (playlistType) {
            "plex" -> startPlexPlaylist(playlistPath)
            "custom" -> startCustomPlaylist(playlistPath)
        }
    }
}
```

## Message Timing

### When Messages Are Sent
- **Immediately** when a reading session starts via `/api/reading/start`
- **Before** the HTTP response is sent to the frontend
- **After** successful reading session creation in the database

### Message Reliability
- Messages are broadcast to all connected clients
- No delivery confirmation or retry mechanism
- Consider implementing connection health checks in your Android app

## Future Message Types

The following message types may be implemented in future versions:

### PAUSE_READ_SESSION
```json
{
  "action": "PAUSE_READ_SESSION",
  "sessionId": "number",
  "mediaTitle": "string",
  "timestamp": "ISO 8601 timestamp"
}
```

### STOP_READ_SESSION  
```json
{
  "action": "STOP_READ_SESSION",
  "sessionId": "number",
  "mediaTitle": "string",
  "progress": {
    "currentPage": "number",
    "totalPages": "number", 
    "readPercentage": "number"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

### RESUME_READ_SESSION
```json
{
  "action": "RESUME_READ_SESSION",
  "sessionId": "number",
  "mediaTitle": "string",
  "timestamp": "ISO 8601 timestamp"
}
```

## Testing

### WebSocket Message Testing
You can test WebSocket messages using browser developer tools:

```javascript
// Connect to Master Order WebSocket
const socket = io('ws://localhost:3001');

// Listen for Android companion messages
socket.on('androidCompanion', (message) => {
    console.log('📱 Android message received:', message);
});

// Start a reading session to trigger a message
fetch('/api/reading/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        mediaType: 'book',
        title: 'Test Book',
        customOrderItemId: 123
    })
});
```

### Stash HTTP Integration Testing

To test Stash integration, you need a mock Android HTTP server:

#### Mock Android Server (Node.js)
```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/play', (req, res) => {
    console.log('🎬 Play request received:', req.body);
    res.json({ success: true, message: 'Scene playback started' });
});

app.post('/pause', (req, res) => {
    console.log('⏸️ Pause request received:', req.body);
    res.json({ success: true, message: 'Scene playback paused' });
});

app.post('/stop', (req, res) => {
    console.log('⏹️ Stop request received:', req.body);
    res.json({ success: true, message: 'Scene playback stopped' });
});

app.listen(8080, () => {
    console.log('Mock Android server listening on port 8080');
});
```

#### Test Stash Commands
```bash
# Test play command via Master Order server
curl -X POST http://localhost:3001/api/android/play \
  -H "Content-Type: application/json" \
  -d '{
    "action": "play",
    "scene": {
      "id": "12345",
      "title": "Test Scene",
      "streamUrl": "http://stash:9999/scene/12345/stream",
      "resumeTime": 0,
      "duration": 1800,
      "stashUrl": "http://stash:9999"
    }
  }'
```

### Example Server Logs
When messages are emitted, you'll see logs like:
```
📱 Emitting Android companion app message: {
  "action": "START_READ_SESSION",
  "mediaTitle": "The Fellowship of the Ring",
  "mediaType": "book",
  "customOrderName": "LOTR Experience",
  ...
}
```

## Error Handling

### Connection Issues
- Implement automatic reconnection in your Android app
- Handle network interruptions gracefully
- Consider offline functionality for critical features

### Message Parsing
- Always validate message structure before processing
- Handle missing optional fields gracefully
- Log unknown message types for debugging

### Playlist Integration Failures
- Provide fallback behavior when playlists can't be accessed
- Show user-friendly error messages
- Consider caching playlist data for offline access

---

## Additional Resources

- **Master Order Project**: [GitHub Repository](https://github.com/your-repo)
- **Socket.IO Documentation**: [socket.io](https://socket.io/docs/)
- **Plex API Documentation**: [plexapi.dev](https://plexapi.dev/)
- **WebSocket Testing Tools**: Use browser developer tools or Postman for testing

---

*Last Updated: August 26, 2025*
*API Version: 1.0*
