# Stash Clip Overlay - WebSocket Integration

## Overview
Real-time overlay system that displays clip metadata in the web application when the Android companion app requests a Stash clip via `/api/android/stash/next`.

## Architecture

### Backend Components

#### 1. WebSocket Server (`server/index.js`)
- **Location**: Lines 153 (io instance creation), Line 230 (pass to Android router)
- **Responsibility**: Initialize socket.io server and pass to route handlers
- **Key Code**:
```javascript
const io = socketIO(server, { cors: { origin: '*' } });
// ...
const androidRouter = createAndroidRouter({ io });
```

#### 2. Android Router Factory (`server/routes/android/index.js`)
- **Location**: Lines 10-15
- **Responsibility**: Accept io instance and pass to child route modules
- **Key Code**:
```javascript
function createAndroidRouter(options = {}) {
  const router = express.Router();
  const { io } = options;
  // ...
  router.use('/', createStashIntegrationRoutes(prisma, io));
```

#### 3. Stash Integration Routes (`server/routes/android/stashIntegration.js`)
- **Location**: Lines 11-16 (function signature), Lines 315-320 (event emission)
- **Responsibility**: Emit WebSocket event after sending clip response
- **Key Code**:
```javascript
function createStashIntegrationRoutes(prisma, io) {
  // ... /stash/next endpoint
  res.json(androidResponse);
  
  if (io) {
    console.log('🔔 Emitting stashClipRequested event to web app');
    io.emit('stashClipRequested', androidResponse.data);
  }
```

### Frontend Components

#### 1. WebSocket Hook (`client/src/hooks/useStashClipOverlay.js`)
- **Responsibility**: Manage WebSocket connection and overlay state
- **Returns**: `{ clipData, isOverlayVisible, closeOverlay }`
- **Features**:
  - Connects to socket.io server on mount
  - Listens for `stashClipRequested` events
  - Manages clip data and overlay visibility state
  - Provides closeOverlay callback
  - Auto-cleanup on unmount

#### 2. Overlay Component (`client/src/components/overlays/StashClipOverlay.jsx`)
- **Props**: `{ clipData, onClose }`
- **Responsibility**: Display comprehensive clip and scene metadata
- **Features**:
  - Modal overlay with backdrop
  - Clip details (ID, duration, timestamps)
  - Scene metadata (studio, date, rating, resolution, codec, file size)
  - Performers list with chips
  - Tags list with badges
  - Dismiss button with keyboard support (Escape key)
  - Fully styled with Tailwind CSS

#### 3. App Integration (`client/src/App.jsx`)
- **Location**: Lines 10, 13, 40-42, 93-98
- **Responsibility**: Wire hook and overlay into main app
- **Key Code**:
```javascript
import StashClipOverlay from './components/overlays/StashClipOverlay';
import { useStashClipOverlay } from './hooks/useStashClipOverlay';

function App() {
  const { clipData, isOverlayVisible, closeOverlay } = useStashClipOverlay();
  // ...
  {isOverlayVisible && clipData && (
    <StashClipOverlay clipData={clipData} onClose={closeOverlay} />
  )}
```

## Data Flow

1. **Android App Request**:
   ```
   GET /api/android/stash/next
   ```

2. **Backend Processing**:
   - Fetch clip from database
   - Enrich with scene metadata (performers, tags, studio)
   - Build `androidResponse` with nested data structure
   - Send JSON response to Android app
   - Emit `stashClipRequested` event via WebSocket

3. **WebSocket Event**:
   ```javascript
   io.emit('stashClipRequested', {
     clip: { id, title, duration, ... },
     scene: { studio, date, performers, tags, ... }
   })
   ```

4. **Frontend Reception**:
   - `useStashClipOverlay` hook receives event
   - Sets `clipData` state
   - Sets `isOverlayVisible` to true
   - App.jsx conditionally renders overlay

5. **User Interaction**:
   - User views clip details in overlay
   - Clicks dismiss or presses Escape
   - `closeOverlay()` hides overlay
   - Clip data cleared after animation (300ms)

## Event Data Structure

```javascript
{
  clip: {
    id: 123,
    title: "Scene Title",
    duration: 1800,  // seconds
    createdAt: "2024-01-01T00:00:00.000Z",
    lastPlayedAt: "2024-01-15T12:00:00.000Z",
    playCount: 5
  },
  scene: {
    id: 456,
    title: "Scene Title",
    date: "2024-01-01",
    studio: {
      id: 789,
      name: "Studio Name",
      image: "/api/stash/image-proxy/studio-image.jpg"
    },
    performers: [
      {
        id: 101,
        name: "Performer Name",
        image: "/api/stash/image-proxy/performer-image.jpg"
      }
    ],
    tags: [
      {
        id: 201,
        name: "Genre"
      }
    ],
    rating: 4.5,
    organized: true,
    files: [
      {
        size: 1073741824,  // bytes
        duration: 1800,    // seconds
        video_codec: "h264",
        audio_codec: "aac",
        width: 1920,
        height: 1080,
        frame_rate: 23.976,
        bit_rate: 5000000
      }
    ]
  }
}
```

## Testing

### Manual Testing Steps

1. **Start Development Server**:
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

2. **Trigger Android Endpoint**:
   ```bash
   curl http://localhost:3001/api/android/stash/next
   ```

3. **Verify WebSocket Event**:
   - Open browser console (web app)
   - Look for: `📱 Received Stash clip request from Android app:`
   - Verify overlay appears with clip details

4. **Test Overlay Functionality**:
   - Verify all clip details display correctly
   - Test dismiss button (closes overlay)
   - Test Escape key (closes overlay)
   - Verify overlay clears after 300ms

### Backend Logs to Monitor

```
📱 Android app requesting next Stash content...
📱 Next Stash clip sent to Android app: {...}
🔔 Emitting stashClipRequested event to web app
```

### Frontend Logs to Monitor

```
🔌 Connected to WebSocket server for Stash clip notifications
📱 Received Stash clip request from Android app: {...}
```

## Modularity Features

### ✅ Reusable Components
- **StashClipOverlay**: Accepts any clip data, no API calls
- **useStashClipOverlay**: Self-contained WebSocket logic
- Both can be used in other contexts without modification

### ✅ Clean Separation
- Backend: Route → Service → Database
- WebSocket: Emitted only in stash/next, not coupled to other endpoints
- Frontend: Hook manages connection, component handles display

### ✅ Dependency Injection
- `io` instance passed through routing layers (no globals)
- Overlay receives data via props (no direct socket access)
- Hook encapsulates all WebSocket logic

### ✅ No Code Duplication
- Reuses existing `androidResponse` data structure
- No duplicate data fetching
- Single source of truth for clip metadata

## Production Considerations

### Database Safety
- **No Schema Changes**: Uses existing tables and relationships
- **No Migrations Required**: Only adds event emission logic
- **Read-Only Operations**: WebSocket only reads data for display

### Performance
- **Event Size**: ~5-10KB per event (clip + scene metadata)
- **Connection Overhead**: One persistent WebSocket per client
- **Scalability**: socket.io handles multiple clients automatically

### Error Handling
- **Backend**: Fails gracefully if `io` not provided (no emission)
- **Frontend**: Logs connection errors, doesn't crash app
- **Disconnect**: Auto-reconnects on connection loss

## Future Enhancements

### Potential Improvements
1. **Action Buttons**: Add "Mark as Watched", "Add to Playlist" in overlay
2. **Video Preview**: Show scene preview/screenshot in overlay
3. **History**: Track overlay notifications in local storage
4. **Filtering**: User preferences for which clip types trigger overlay
5. **Android Metadata**: Include Android device info in event (which device requested)

### Extension Points
- Hook can emit custom events (e.g., track overlay dismissals)
- Overlay component can accept custom action buttons
- Event data can include additional metadata without breaking changes

## File Locations Summary

### Backend (3 files modified)
- `server/index.js`: Pass io to Android router (1 line change)
- `server/routes/android/index.js`: Accept and forward io (5 lines)
- `server/routes/android/stashIntegration.js`: Emit event (6 lines)

### Frontend (3 files created/modified)
- `client/src/hooks/useStashClipOverlay.js`: WebSocket hook (55 lines)
- `client/src/components/overlays/StashClipOverlay.jsx`: Overlay component (217 lines)
- `client/src/App.jsx`: Integration (10 lines added)

### Total Changes
- **Backend**: 12 lines added/modified
- **Frontend**: 282 lines added
- **Documentation**: This file (400+ lines)

## Related Documentation
- `ANDROID_API_ENDPOINTS.md`: Full Android API reference
- `server/routes/android/README.md`: Android routing architecture
- `MODULARIZATION_GUIDE.md`: Project-wide modular patterns
