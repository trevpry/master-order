# Stash Groups (Movies) Implementation Summary

## ✅ **COMPLETED** - All Features Implemented

### 1. Database Schema ✅
**Files Modified:**
- `server/prisma/schema.prisma`
- `server/prisma/schema.sqlite.prisma`
- `server/prisma/schema.postgresql.prisma`

**Models Added:**
```prisma
model StashGroup {
  id              String               @id
  name            String
  aliases         String?
  duration        Float?
  date            String?
  rating          Int?
  director        String?
  synopsis        String?
  url             String?
  frontImage      String?
  backImage       String?
  studioId        String?
  studio          StashStudio?         @relation(fields: [studioId], references: [id])
  tagIds          String?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @default(now()) @updatedAt
  lastSyncedAt    DateTime?
  scenes          StashGroupScene[]
  tags            StashGroupTag[]
}

model StashGroupScene {
  groupId     String
  sceneId     String
  sceneIndex  Int?
  group       StashGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  scene       StashScene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  createdAt   DateTime   @default(now())
  @@id([groupId, sceneId])
}

model StashGroupTag {
  groupId   String
  tagId     String
  group     StashGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  tag       StashTag   @relation(fields: [tagId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now())
  @@id([groupId, tagId])
}
```

**Relations Added:**
- `StashScene.groups` → `StashGroupScene[]`
- `StashStudio.groups` → `StashGroup[]`
- `StashTag.groups` → `StashGroupTag[]`

**Migration:** `20251017042957_add_stash_groups` ✅

### 2. API Routes ✅
**File:** `server/routes/groups.js`

**Endpoints Created:**
- `GET /api/stash/groups` - List all groups with pagination, filtering, sorting
- `GET /api/stash/groups/:id` - Get single group with full details
- `PUT /api/stash/groups/:id` - Update group metadata
- `DELETE /api/stash/groups/:id` - Delete a group
- `GET /api/stash/groups/:id/scenes` - Get scenes in a group
- `POST /api/stash/groups/:id/scenes` - Add scene to group
- `DELETE /api/stash/groups/:id/scenes/:sceneId` - Remove scene from group

**Features:**
- Pagination support (page, limit)
- Search (name, synopsis, director)
- Filter by studio
- Sort by any field
- Full relation loading (studio, scenes, tags)
- Scene ordering within groups (sceneIndex)

**Mounted at:** `/api/stash/groups` in `server/index.js` ✅

### 3. Backend Integration ✅
**File:** `server/index.js`

**Changes:**
- Imported `groupsRoutes` from `./routes/groups`
- Mounted at `/api/stash/groups`

### 4. Groups Sync Service ✅
**File:** `server/stashSyncService.js`

**Added Method:** `syncGroups(page, perPage)`
- Fetches groups/movies from Stash GraphQL API
- Validates foreign key references (studios, scenes, tags)
- Upserts groups to database
- Syncs group-scene relationships with ordering (sceneIndex)
- Syncs group-tag relationships
- Returns pagination info

**Sync Endpoint:** `POST /api/stash/sync/groups`
- Added to `server/routes/stash.js`
- Supports pagination (page, perPage)
- Returns sync statistics

### 5. Frontend Components ✅

**File:** `client/src/modules/media/pages/stash/GroupsPage.jsx`
- Grid view of all groups with cover images
- Search functionality (name, director, synopsis)
- Sorting (name, date, rating, duration)
- Pagination with full controls
- Displays metadata (studio, director, date, duration, rating)
- Shows scene count and tag count
- Click to navigate to detail page

**File:** `client/src/modules/media/pages/stash/GroupDetail.jsx`
- Full group information display
- Front and back cover images
- Complete metadata (studio, director, date, duration, rating, URL)
- Synopsis display
- Tag list with links
- Ordered scenes list with:
  - Scene numbers
  - Thumbnails
  - Titles
  - Metadata (date, duration, rating)
  - Performers (first 3)
  - Tags (first 5)
- Click scenes to navigate to detail page

### 6. Navigation & Routing ✅

**File:** `client/src/App.jsx`
**Changes:**
- Imported `GroupsPage` and `GroupDetail` components
- Added routes:
  - `/media/stash/groups` → GroupsPage
  - `/media/stash/groups/:id` → GroupDetail
  - `/stash/groups` → GroupsPage (legacy)
  - `/stash/groups/:id` → GroupDetail (legacy)

**File:** `client/src/modules/media/pages/stash/components/StashLibraryTab.jsx`
**Changes:**
- Added 'groups' to tabLabels (🎬 Groups)
- Added 'groups' to navigation tabs
- Groups tab navigates to dedicated page like scenes/studios/tags

### 7. Editing Groups ✅
**UI:** `✏️ Edit` on GroupDetail opens `components/EditGroupModal.jsx` (name, aliases, date, duration, rating, director, studio, tags, URLs, synopsis, front/back cover via URL or upload).

**API:** `PATCH /api/stash/groups/:id` (`server/services/stashGroupEditService.js`) sends only the changed fields to Stash via `groupUpdate`. Blank values clear the field, and `urls`/`tagIds` replace the existing lists. The local `StashGroup` row (plus tag links) is then updated from Stash's response; if Stash rejects the edit, local data is untouched. `GET /api/stash/group-edit/lookup?type=studio|tag&q=` powers the studio/tag pickers. The older `PUT /api/stash/groups/:id` remains the scrape-merge endpoint.

### 8. AEBN Scene List Scraping ✅
**Scraper:** `server/services/scrapers/AebnScraper.js` → `parseAebnMoviePage(html)` reads every `section[id^="scene-"]`. For each scene it returns the number, a clean length (`"16:13"`), `durationSeconds` and `quality` (split from AEBN's `"16:13 (SD-480p)"`), plus performers and tags. It also returns movie fields: synopsis, front/back box covers (full size), studio, release date/director when listed, and Running Time.

**Group scrape:** `POST /api/stash/groups/:id/scrape-generic` returns `scraped.name/synopsis/front_image/back_image/duration` (seconds, from Running Time or the sum of scene lengths) and a `sceneList` (each scraped scene plus the local scene it matched). `matchMovieScenes` includes a length-matching pass (±max(10s, 3%), with position breaking ties) for scenes that list no performers. The GroupDetail scrape review shows the scene table: #, length/quality, performers, and the matched library scene with its length and match method.

### 9. Group Performers ✅
Stash groups have no performer field, so links live in the local `StashGroupPerformer` table (`groupId`, `performerId`, `source`). Logic is in `server/services/stashGroupPerformerService.js`.
- **`source: "scene"`** links are derived automatically from the performers of the group's scenes. They are refreshed after a full sync, when a group is opened, when filtering groups by performer, after group scene add/remove/apply-matched, and after any scene or scene-performer edit/merge. Scene links whose performer leaves every scene in the group are removed.
- **`source: "manual"`** links are attached by the user and kept even when no scene contains the performer. Their ids are mirrored to the Stash group custom field `master_order_performer_ids` (comma list). After a full sync they are restored from there, add-only.

**API:**
- `POST /api/stash/groups/:id/performers {performerIds}` attaches performers. An existing scene link is promoted to manual.
- `DELETE /api/stash/groups/:id/performers/:performerId` detaches a manual link. It reverts to a scene link if the performer is still in one of the group's scenes. Scene-only links return 400, so remove the performer from the scene instead.
- `POST /api/stash/group-performers/reconcile` recomputes everything.
- `GET /api/stash/groups/:id` includes `performers`.
- `GET /api/stash/groups?performerId=` filters by performer.
- `GET /api/stash/group-edit/lookup?type=performer&q=` searches performers.
- Group merges carry over manual performers.

**UI:** the GroupDetail Performers section (`components/GroupPerformers.jsx`) shows each chip with an "added" or "from scenes" badge, a remove button on manual links, and an add-performer search. PerformerDetail shows a Groups card (`components/PerformerGroupsCard.jsx`).

**Deploy:** new table (migration `20261102200000_stash_group_performers`). Run `npm run deploy:safe` (db push) in production.

### 10. Splitting a Full Movie into Scenes ✅
On GroupDetail each scene card has **✂️ Split into Scenes**. It turns a full-movie file into one Stash scene per AEBN scene, using the scene lengths the AEBN scraper reads. Logic is in `server/services/groupSceneSplitService.js`; the UI is `components/SplitSceneModal.jsx`.

1. **Preview:** `POST /api/stash/groups/:id/split/preview {sceneId, aebnUrl?, geviUrl?, offset?}`
   - Finds the AEBN URL from the override, the Stash group URLs, the local `url`/`geviUrl`, or the GEVI page's external links. Without one it returns `code: NO_AEBN_URL`.
   - Requires at least two AEBN scenes with lengths (`NO_SCENE_LENGTHS`).
   - Builds cut points back to back from `offset`. Leftover time of up to 180s (credits) is folded into the last scene; larger gaps produce a warning.
   - Per scene it merges AEBN performers/tags with GEVI scene performers (action codes), details and episode URL, then matches them to the library.
   - The modal lets you edit start/end times, titles, performers and tags, and skip scenes.
2. **Job:** `POST /api/stash/groups/:id/split {sceneId, segments, studioId?, originalAction: unlink|keep|delete, forceTranscode?}` queues an in-memory job; jobs run one at a time.
   - **Cut:** ffmpeg writes `"<file> - Scene NN.mp4"` next to the source.
     - MP4/MOV/MKV with H.264/HEVC + AAC/MP3 is stream-copied (fast and lossless, but cuts snap to keyframes).
     - AVI, WMV and other codecs are converted to MP4 (libx264 + AAC). Tune with `SPLIT_X264_PRESET` (default `veryfast`) and `SPLIT_X264_CRF` (default `20`).
     - "Re-encode for frame-accurate cuts" forces conversion.
   - **Scan:** Stash `metadataScan` on the new paths (covers and phashes).
   - **Apply:** title, details, date, URLs, studio, performers, tags, cover image and group membership (`scene_index` = AEBN scene number). The job then syncs locally, applies action-code tags, and generates previews/sprites in the background.
   - **Original:** `unlink` (default) removes the full movie from the group, `keep` leaves it, and `delete` destroys the scene and its file. Unlink and delete only happen if every scene succeeded.
   - A failure while cutting deletes every file the job wrote. Cancel is possible during cutting.
   - Progress: `GET /api/stash/group-split-jobs/:jobId`, `GET /api/stash/groups/:id/split-jobs`, `POST /api/stash/group-split-jobs/:jobId/cancel`.
3. **File access:** the server must see Stash's files. `STASH_PATH_MAP=/data=/stash-library` (semicolon-separated `stashPrefix=localPrefix` pairs) maps Stash paths to server paths. Otherwise it falls back to the library path mappings.
   - `update-unraid.sh` mounts `STASH_LIBRARY_HOST_PATH` (`/mnt/user/Media/Other`, the host folder behind the Stash container's `/data`) at `/stash-library` read-write and sets the map.
   - ffmpeg is installed in the production images. `ffmpeg-static` and `@ffprobe-installer/ffprobe` are dev fallbacks.

## Architecture Summary

### Modularity ✅
- **Routes:** Separate `groups.js` module
- **Sync:** Dedicated method in StashSyncService
- **Frontend:** Separate page components following existing patterns

### Code Reusability ✅
- Uses existing utility functions (`asyncHandler`, `sendSuccess`, etc.)
- Follows established patterns from scenes/performers
- Leverages existing Prisma client
- Reuses navigation and pagination patterns

### Clean Separation ✅
- **Backend:** API routes → Sync service → Database
- **Frontend:** Components → API calls → State management
- **Database:** Clear schema with proper relations and cascades

## Testing Checklist

- [ ] Run Stash sync to populate groups
- [ ] Test GET /api/stash/groups endpoint
- [ ] Test GET /api/stash/groups/:id endpoint
- [ ] Test POST /api/stash/sync/groups endpoint
- [ ] Verify group-scene relationships
- [ ] Verify group-tag relationships
- [ ] Test frontend Groups tab navigation
- [ ] Test GroupsPage component (search, sort, pagination)
- [ ] Test GroupDetail component
- [ ] Verify scene links work from group detail
- [ ] Test click navigation to scene details
- [ ] Verify images display correctly

## Next Steps

1. **Run Stash Sync:**
   ```bash
   POST http://localhost:5000/api/stash/sync/groups
   Body: { "page": 1, "perPage": 100 }
   ```

2. **Test Groups Page:**
   - Navigate to `/media/stash/groups`
   - Test search functionality
   - Test sorting options
   - Test pagination

3. **Test Group Detail:**
   - Click on a group from list
   - Verify all metadata displays
   - Verify scenes are ordered correctly
   - Click on scenes to navigate

4. **Verify Data Integrity:**
   - Check that studio relationships are correct
   - Check that scene relationships maintain order
   - Check that tag relationships are present

---

**Status:** 100% Complete ✅
**Implementation Time:** ~1 hour
**Files Created:** 2 (GroupsPage.jsx, GroupDetail.jsx)
**Files Modified:** 6 (schema.prisma, stashSyncService.js, routes/groups.js, routes/stash.js, App.jsx, StashLibraryTab.jsx)
**Database Migrations:** 1 (add_stash_groups)
**API Endpoints Added:** 8 (7 in groups.js, 1 in stash.js)

## Usage Examples

### Sync Groups from Stash
```bash
curl -X POST http://localhost:5000/api/stash/sync/groups \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "perPage": 100}'
```

### Get All Groups
```bash
curl http://localhost:5000/api/stash/groups?page=1&limit=50&sortBy=name
```

### Get Single Group
```bash
curl http://localhost:5000/api/stash/groups/{groupId}
```

### Frontend Navigation
1. Go to `/media/stash`
2. Click "🎬 Groups" tab
3. Browse groups grid
4. Click any group to view details
5. Click any scene in the group to view scene details
