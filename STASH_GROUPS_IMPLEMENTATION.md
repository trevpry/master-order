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
