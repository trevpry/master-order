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

**Creating groups:** `EditGroupModal` without a `group.id` is a create form (a `group` without an id only prefills the name/studio). Saving calls `POST /api/stash/groups/create {name}` and then sends every other filled-in field through the same `PATCH`. If that second step fails, the group still exists and the user is told which details weren't saved.
- **Groups page:** "➕ New Group" (prefilled with the current search text) opens the new group's detail page after creating it.
- **Scene detail:** "➕ New Group" in the Groups / Movies card, or "Create new group" in the Add Group/Movie search (prefilled with the search text), creates a group with the scene's studio and adds the scene to it (`POST /api/stash/groups/:id/add-scene`).

### 8. AEBN Scene List Scraping ✅
**Scraper:** `server/services/scrapers/AebnScraper.js` → `parseAebnMoviePage(html)` reads every `section[id^="scene-"]`. For each scene it returns the number, a clean length (`"16:13"`), `durationSeconds` and `quality` (split from AEBN's `"16:13 (SD-480p)"`), plus performers and tags. It also returns movie fields: synopsis, front/back box covers (full size), studio, release date/director when listed, and Running Time.

**Group scrape:** `POST /api/stash/groups/:id/scrape-generic` returns `scraped.name/synopsis/front_image/back_image/duration` (seconds, from Running Time or the sum of scene lengths) and a `sceneList` (each scraped scene plus the local scene it matched). `matchMovieScenes` includes a length-matching pass (±max(10s, 3%), with position breaking ties) for scenes that list no performers. The GroupDetail scrape review shows the scene table: #, length/quality, performers, and the matched library scene with its length and match method.

### 9. Group Performers ✅
Stash groups have no performer field, so links live in the local `StashGroupPerformer` table (`groupId`, `performerId`, `source`). Logic is in `server/services/stashGroupPerformerService.js`.
- **`source: "scene"`** links are derived automatically from the performers of the group's scenes. They are added after a full sync, when a group is opened, when filtering groups by performer, after group scene add/remove/apply-matched/delete, and after any scene or scene-performer edit/merge. Refreshes never detach anyone: when a performer's scenes all leave the group (scene deleted, unlinked or split), the link becomes manual so the performer stays until removed explicitly.
- **`source: "manual"`** links are attached by the user, or kept from deleted scenes as above. They stay even when no scene contains the performer. Their ids are mirrored to the Stash group custom field `master_order_performer_ids` (comma list). After a full sync they are restored from there, add-only.

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
   - Finds the AEBN URL from the override, the Stash group URLs, the local `url`/`geviUrl`, or the GEVI page's external links.
   - Returns `mode: 'aebn'` when AEBN lists at least two scenes with lengths. Without an AEBN URL, a failed scrape or no scene lengths it returns `mode: 'manual'`: one scene covering the whole clip (the clip's own performers/tags) plus a warning, and you insert the cuts yourself.
   - `blackFrames` holds the clip's stored black-frame results (`{intervals, ranges, fullScan, scannedAt}` or null).
   - Builds cut points back to back from `offset`. Leftover time of up to 180s (credits) is folded into the last scene; larger gaps produce a warning.
   - Per scene it merges AEBN performers/tags with GEVI scene performers (action codes), details and episode URL, then matches them to the library.
   - The modal lets you edit start/end times, titles, performers and tags, and skip scenes.
   - **Visual cut editor** (`components/SplitTimeline.jsx`): the preview's `source.media` holds `{directUrl, hlsUrl, vttUrl, screenshotUrl}`, taken from Stash `paths`.
     - The video player tries the direct stream first; AVI/WMV start on Stash's transcoded HLS (`stream.m3u8?resolution=STANDARD`) and switch to the server's converted MP4 (keeping the playhead) once the whole-clip conversion finishes.
     - The timeline shows colored scene blocks over a sprite filmstrip from the VTT, plus a dotted marker at each AEBN length. Skipped scenes are hatched and invalid ones are outlined in red.
     - Drag a yellow cut handle to move it; dragging seeks the video. A shared boundary moves the end of one scene and the start of the next together.
     - With a cut selected you can nudge it (±0.1/1/5s, or ←/→, Shift = 5s, Alt = 0.1s), set it to the current video time, preview it from 5s before, or step to the previous/next cut.
     - Zoom goes up to 10×. Edits write back into the table's start/end fields to 0.1s precision.
     - **Insert / remove cut lines** (`components/splitSegmentEdits.js`): "Insert cut at <playhead>" (or `C`), double-clicking the timeline, or Shift+clicking a black-frame chip splits the scene under that time (≥1s from its edges). The new scene copies the performers/tags/URLs of the one it came from.
       - Selecting a shared cut shows "Remove this cut" (or `Delete`), which merges the two scenes and their performers/tags.
       - "Insert cuts at black frames" adds a cut in the middle of every black run that is at least the chosen minimum scene length (30s–5min) from existing cuts.
       - Scenes are renumbered in time order after every insert/remove; generated "<group> - Scene N" titles follow the new numbers. A clip that is still one whole-file scene can't be split.
     - **Black-frame suggestions:** `POST /api/stash/groups/:id/split/black-frames {sceneId, cuts?, window?, fullScan?}` starts a background ffmpeg `blackdetect` scan (`fps=10,scale=240:-2,blackdetect=d=0.2:pix_th=0.10:pic_th=0.98`).
       - It scans ±`window` seconds (5–600, default 90) around the current cuts, merged into ranges, or the whole file when `fullScan` is set.
       - Poll with `GET /api/stash/group-split-black-scans/:scanId` (`{status, progress, ranges, intervals[{start,end,duration}]}`) and cancel with `POST …/:scanId/cancel`. A new scan of the same scene replaces the running one.
       - The UI shades black runs on the track and on a clickable lane below it; clicking one snaps the selected cut there. Each cut gets a dashed cyan marker at the middle of its nearest black run within the window.
       - "Snap" (or `S`) moves the selected cut, and "Snap all cuts" applies every suggestion that doesn't cross a neighbor. An end/start pair around a gap may both land on the same black run, which joins the two scenes at one cut.
       - Results of fully scanned ranges are stored per clip (also when a scan is cancelled) in `<DATA_PATH or /app/data or ./data>/stash-black-frames.json` (`server/services/stashBlackFrameStore.js`, keyed by scene id and invalidated when the file path/size changes). The editor opens with them, and a new scan adds to them.
       - Only one clip per group is scanned at a time; starting a scan of another clip while one runs returns 409 `SCAN_BUSY`.
       - Scans run in 10-minute chunks with 2 decoder threads, skipping corrupt frames. If ffmpeg stops abnormally (terminated by a signal, which used to show as "exited with code null", e.g. from a crash on damaged frames or the out-of-memory killer), the black runs found so far are kept and the scan resumes just past where it stopped. The skipped seconds are reported as a `warning`, and it only fails after 4 failures in a row with no progress.
       - Scanning needs the server to read the file, so it only works where the Stash library is mounted (production).
   - **Group clip list:** above the scene grid, "⬛ Black frames" lists every clip with its stored results (`GET /api/stash/groups/:id/black-frames?sceneIds=1,2` → `{activeScan, results{[id]: {blackRuns, fullScan, scannedSeconds, duration, scannedAt}}}`).
     - Each clip has a **Scan** button (a whole-file scan through the endpoint above) and **Edit cuts**, which opens its split editor. One clip is scanned at a time, and a running scan is picked up again after a reload.
2. **Job:** `POST /api/stash/groups/:id/split {sceneId, segments, studioId?, originalAction: unlink|keep|delete, forceTranscode?}` queues an in-memory job; jobs run one at a time.
   - **Cut:** ffmpeg writes `"<file> - Scene NN.mp4"` next to the source.
     - MP4/MOV/MKV with H.264/HEVC + AAC/MP3 is stream-copied (fast and lossless, but cuts snap to keyframes).
     - AVI, WMV and other codecs are **converted first, then split**: the whole clip is converted once to a temporary MP4 next to the source (`<stem>.mo-converted.tmp`, written as `.part` first; Stash doesn't scan either). It uses the quality settings below plus an IDR keyframe every second (`-force_key_frames expr:gte(t,n_forced*1) -forced-idr 1`). The scenes are then stream-copied from it, landing within 1s of each cut. The temp file is deleted once the cuts are written and kept after a failed cut so a retry can reuse it.
       - The split dialog starts the conversion as soon as the plan loads: `POST /api/stash/groups/:id/split/convert {sceneId}`. Poll `GET …/split/convert/:sceneId` (`{status: none|queued|running|ready|failed|cancelled|discarded, progress, encoding}`); `POST …/split/convert/:sceneId/cancel` stops it or deletes a finished file. Conversions run one at a time; a split started meanwhile waits for it (job progress 0–60%).
       - Once ready, the preview plays the converted file (`GET …/split/convert/:sceneId/video`, HTTP Range) instead of Stash's transcoded HLS, and black-frame scans read it too. After a server restart, a converted file that's newer than and as long as the source (±2s) is reused.
     - "Re-encode for frame-accurate cuts" (MP4-friendly sources only) re-encodes each scene individually.
   - **Scan:** Stash `metadataScan` on the new paths (covers and phashes).
   - **Apply:** title, details, date, URLs, studio, performers, tags, cover image and group membership (`scene_index` = AEBN scene number). The job then syncs locally, applies action-code tags, and generates previews/sprites in the background.
   - **Original:** `unlink` (default) removes the full movie from the group, `keep` leaves it, and `delete` destroys the scene and its file. Unlink and delete only happen if every scene succeeded.
   - A failure while cutting deletes every file the job wrote. Cancel is possible during cutting.
   - Progress: `GET /api/stash/group-split-jobs/:jobId`, `GET /api/stash/groups/:id/split-jobs`, `POST /api/stash/group-split-jobs/:jobId/cancel`.
3. **File access:** the server must see Stash's files. `STASH_PATH_MAP=/data=/stash-library` (semicolon-separated `stashPrefix=localPrefix` pairs) maps Stash paths to server paths. Otherwise it falls back to the library path mappings.
   - `update-unraid.sh` mounts `STASH_LIBRARY_HOST_PATH` (`/mnt/user/Media/Other`, the host folder behind the Stash container's `/data`) at `/stash-library` read-write and sets the map.
   - ffmpeg is installed in the production images. `ffmpeg-static` and `@ffprobe-installer/ffprobe` are dev fallbacks.
   - **Quality:** MP4-friendly sources are stream-copied, which is lossless. Conversions (`planEncoding`) start with an ffprobe of the source and keep:
     - resolution (only odd sizes are rounded to even) and frame timing;
     - every audio track; AAC/MP3 tracks are copied untouched, and the rest become AAC at no less than the source bitrate (192k stereo / 384k surround minimum);
     - HEVC sources stay HEVC (libx265 CRF 18, 10-bit kept). Everything else becomes H.264 (libx264 CRF 16, preset `medium`).
     - Override with `SPLIT_X264_CRF`, `SPLIT_X264_PRESET`, `SPLIT_X265_CRF` and `SPLIT_X265_PRESET`. The chosen settings show in the job log and the split dialog.

### 11. Scrape All for Title-Only Scenes ✅
When a scene has a title but no performers and no URLs (scene URL, episode URLs or GEVI URL), **Scrape All** (`POST /api/stash/scenes/:id/scrape-all`) also searches GEVI and AEBN for the title as a movie title (`server/services/sceneTitleMovieSearchService.js`).
- **Title cleanup:** the title is stripped of video extensions, `_`/`.` separators and bracketed text. A trailing "Scene N" / "Sc N" picks that scene from the movie.
- **Searching:**
  - GEVI is searched through its `/shtt` DataTables JSON endpoint (`geviScraper.searchMovieTitles`). `searchMovie` now uses this endpoint first and the browser search only as a fallback. If nothing is found, it retries with punctuation removed and then with the first three words.
  - AEBN is searched with Puppeteer (`AebnScraper.searchMovies`, parsed by `parseAebnSearchResults`).
- **Matching:** candidates are ranked by title similarity; a different volume number cuts the score. The top 3 at ≥ 60% are scraped as full movies (or as the requested scene). Performers and groups are matched against the database.
- **Review:** the results appear first in the review modal as "GEVI/AEBN Movie Title Search" sources, with Title match %, ✓ IN DATABASE and ✦ NEW MOVIE badges.

### 12. GEVI Group Scrape Imports Performers into Empty Scenes ✅
On the group details page, **Scrape GEVI** (`POST /api/stash/gevi/movie` with `groupId`) matches the group's scenes to GEVI scenes. Scenes are passed with their `sceneIndex`, so scenes with no performers are matched by scene number (`matchMovieScenes` PASS 2).
- **Description:** an empty scene description is filled from the GEVI scene during the scrape, in Stash and locally.
- **Performers to import:** for matched scenes with **no performers**, `geviSceneImportService.annotatePerformerImports` resolves the GEVI performers against the library using names and aliases (`geviScraper.matchPerformers`). Each match gets `importPerformers` and `performerImports`: one entry per GEVI performer with `{key, scrapedName, url, actionCode, match, alternatives, choice}`. The GEVI scraper records each scene performer's profile `url`.
  - **Review:** the modal renders `GeviPerformerImportEditor`. As in regular scene scraping, each GEVI performer has a dropdown:
    - the matched library performer (✓) and its alternatives
    - 🔍 *Choose another performer…*, an inline library search
    - ➕ *Add "name" as new performer*
    - ✕ *Don't import*
  - **Choices:** `choice` is `{type:'library', id, name}`, `{type:'new', name}` or `{type:'skip'}`. Unmatched performers default to *new*.
  - **Resolving choices:** `resolvePerformerChoices` turns them into `performersToImport` (`{id, name, scrapedName, actionCode}`) and `performersToCreate` (`{name, url, actionCode, forceNew}`). The scrape also returns both lists for the default choices.
- **GEVI scene URL:** when accepted, every matched scene whose GEVI scene has its own page (`episodeUrl`, the `/episode/` link) gets that URL via `geviSceneImportService.addSceneUrl`. It is appended to the local `episodeUrls` and merged into the Stash scene's `urls`; existing URLs are kept and duplicates are skipped. The response counts `addedSceneUrls`.
- **On accept:** `POST /groups/:id/apply-matched-scenes` calls `importScenePerformers`, but only if the scene still has no performers.
  - The route uses the edited `performerImports` choices when present. It resolves `performersToCreate` with `createMissingPerformers`, which first re-checks the library and then Stash (`findPerformers` name EQUALS), so nobody is duplicated.
    - The library check matches by name, or also by alias unless the user explicitly chose *new* (`forceNew`).
    - Library lookups use `contains`, not `mode: 'insensitive'`, which SQLite does not support.
    - Anyone still missing is created with `performerCreate` (name and GEVI URL) and upserted locally.
  - It then sets `performer_ids` in Stash for all of them and creates the local links.
  - Finally it applies the action-code tags and refreshes the group performers.
  - The response counts `importedPerformers` and `createdPerformers`, and the page shows a summary alert, including any failures, before reloading.
  - Scenes that already have performers keep the existing behavior: only action codes are applied, to the matching existing performers.

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
