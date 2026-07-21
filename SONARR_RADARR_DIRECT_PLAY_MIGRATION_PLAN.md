# Plex → Sonarr/Radarr + Direct-Play Migration Plan

**Status:** Planning (no code changed yet)
**Scope:** Movie and TV libraries only. Music (Plex) and Stash remain on their current integrations — see "Out of Scope" below.
**Goal:** Stop depending on a running Plex Media Server for (1) discovering/populating the movie & TV libraries and (2) playing content. Radarr/Sonarr become the source of truth for what movies/episodes exist and where their files live on disk. Master Order gains its own direct-play + on-demand transcode streaming server, and the Android companion app becomes a real video player (ExoPlayer/Media3) instead of a Plex remote control.

---

## 1. Why this is a big change

Today, Plex is load-bearing in three distinct ways that all have to be replaced independently:

1. **Library population** — `PlexSyncService` polls Plex's HTTP API and mirrors `PlexTVShow`/`PlexSeason`/`PlexEpisode`/`PlexMovie` (and 10+ join tables: genres, roles, guids, images, ultra-blur colors, etc.) into our DB. This feeds `plexDatabaseService.js`, the movie/TV browsers, `getNextEpisode`/`getNextMovie`, custom orders, and list-sync matching.
2. **Playback** — `plexPlayerService.js` does **server-brokered casting**: it tells an already-registered Plex client device (e.g. Plex for Android TV) to play a `ratingKey` via Plex's own `/player/playback/playMedia` protocol. The Android companion app today is a *remote control*, not a video player, for movies/TV. (It *does* already act as a direct player for Stash clips and music tracks, which stream Plex/Stash URLs straight into ExoPlayer — that pattern is the template we'll reuse for movies/TV.)
3. **Artwork & transcoding** — Plex generates thumbnails/art and does the heavy lifting of transcoding/remuxing when a client can't direct-play a file. We currently only proxy Plex's image URLs (`/api/artwork`); there is no ffmpeg/transcode pipeline in this codebase today.

Removing Plex means rebuilding all three, ideally without breaking Up Next, custom orders, watch tracking, or list-sync while the migration is in progress.

### Confirmed helpful facts from the codebase
- The `master-order` container **already mounts the real media shares read-only** (`/movies`, `/tv`, `/music`, etc. in [docker-compose.yml](docker-compose.yml)), and there's already a `PLEX_PATH_n`/`LOCAL_PATH_n` env-based path-translation convention (used today in [server/routes/music.js](server/routes/music.js#L4042) to read audio files directly off disk for metadata). We can reuse this exact pattern for Radarr/Sonarr movie & episode file paths — **direct filesystem access to media files is not a new problem**.
- The Android app already knows how to play a raw `streamUrl` directly (Stash clips/scenes, Plex music tracks with Range-request proxying in [server/routes/music.js](server/routes/music.js#L5424)). We just need to point that same capability at our own streaming endpoints for video.
- No ffmpeg/transcoding dependency exists yet (checked `server/package.json`) — this is new infrastructure we must add.

---

## 2. Out of scope (for this plan)

- **Music** stays on Plex for now (Lidarr migration would be a separate future plan).
- **Stash** is already independent of Plex.
- Plex code is **not deleted** in this plan — it's isolated behind a provider flag so it can be removed later once Sonarr/Radarr + direct play are validated in production.

---

## 3. Target architecture

```mermaid
flowchart LR
  subgraph Sources
    Radarr[Radarr API]
    Sonarr[Sonarr API]
    TMDB[TMDB/TVDB - artwork+meta]
  end

  subgraph MasterOrderServer[Master Order Server]
    RadarrSync[RadarrSyncService]
    SonarrSync[SonarrSyncService]
    DB[(Postgres/SQLite\nMovie/Show/Season/Episode)]
    MediaProbe[MediaProbeService (ffprobe)]
    StreamSvc[StreamingService\n(direct-play + HLS transcode)]
    ArtworkSvc[ArtworkCacheService]
    API[/api/library, /api/stream, /api/watch-progress/]
  end

  Radarr --> RadarrSync --> DB
  Sonarr --> SonarrSync --> DB
  TMDB --> ArtworkSvc
  DB --> API
  StreamSvc --> API
  MediaProbe --> DB
  Files[(/movies, /tv volumes\nread-only)] --> MediaProbe
  Files --> StreamSvc

  API --> Android[Android App\n(ExoPlayer/Media3 player)]
  API --> WebApp[React Web App]
```

Key idea: Radarr/Sonarr tell us **what exists and where the file is**; ffprobe tells us **what's actually in the file** (codecs/resolution/audio tracks/subtitles) so we can decide direct-play vs transcode; our own streaming routes serve the bytes (or HLS segments) directly to whatever client is asking — Android app, web `<video>` tag, etc. Nobody needs a Plex client anymore.

---

## 4. Data model changes

Add new, Plex-independent models rather than repurposing `Plex*` tables (keeps rollback safe, keeps both systems queryable side-by-side during migration). Naming: `Movie`, `Show`, `Season`, `Episode` (generic, provider-agnostic).

```prisma
model Movie {
  id                Int       @id @default(autoincrement())
  radarrId          Int       @unique
  tmdbId            Int?
  imdbId            String?
  title             String
  sortTitle         String?
  year              Int?
  overview          String?
  runtime           Int?               // minutes, from Radarr
  studio            String?
  genres            String?            // JSON array
  collectionTitle   String?            // TMDB collection (Radarr "collection")
  collectionTmdbId  Int?
  posterUrl         String?            // remote (TMDB/Radarr image proxy) URL, cached separately
  fanartUrl         String?
  localArtworkPath  String?
  path              String             // Radarr's internal path, e.g. /movies/Foo (2020)
  relativePath      String?            // path relative to library root, for volume mapping
  filePath          String?            // resolved local container path (post path-translation)
  fileSize          BigInt?
  sceneName         String?
  videoCodec        String?            // from MediaInfo (Radarr) or ffprobe
  audioCodec        String?
  resolution        String?            // "1080p", "2160p" etc
  container         String?            // mkv/mp4
  hasFile           Boolean   @default(false)
  monitored         Boolean   @default(true)
  addedAt           DateTime?
  radarrUpdatedAt   DateTime?
  removed           Boolean   @default(false)   // soft-delete when missing from Radarr
  lastSyncedAt      DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  watchLogs         WatchLog[]
  @@index([tmdbId])
  @@index([title])
}

model Show {
  id                Int       @id @default(autoincrement())
  sonarrId          Int       @unique
  tvdbId            Int?
  imdbId            String?
  title             String
  sortTitle         String?
  year              Int?
  overview          String?
  network           String?
  genres            String?            // JSON array
  status            String?            // continuing/ended
  posterUrl         String?
  fanartUrl         String?
  localArtworkPath  String?
  path              String             // Sonarr series root folder
  monitored         Boolean   @default(true)
  addedAt           DateTime?
  sonarrUpdatedAt   DateTime?
  removed           Boolean   @default(false)
  lastSyncedAt      DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  seasons           Season[]
  @@index([tvdbId])
  @@index([title])
}

model Season {
  id                Int       @id @default(autoincrement())
  showId            Int
  seasonNumber      Int
  monitored         Boolean   @default(true)
  posterUrl         String?
  removed           Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  show              Show      @relation(fields: [showId], references: [id])
  episodes          Episode[]
  @@unique([showId, seasonNumber])
}

model Episode {
  id                Int       @id @default(autoincrement())
  sonarrEpisodeId   Int       @unique
  seasonId          Int
  episodeNumber     Int
  title             String?
  overview          String?
  airDate           DateTime?
  runtime           Int?
  path              String?            // Sonarr episodeFile.path
  relativePath      String?
  filePath          String?            // resolved local container path
  fileSize          BigInt?
  videoCodec        String?
  audioCodec        String?
  resolution        String?
  container         String?
  hasFile           Boolean   @default(false)
  monitored         Boolean   @default(true)
  removed           Boolean   @default(false)
  lastSyncedAt      DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  season            Season    @relation(fields: [seasonId], references: [id])
  watchLogs         WatchLog[]
  @@index([seasonId, episodeNumber])
}

model WatchProgress {
  id                Int       @id @default(autoincrement())
  mediaType         String              // "movie" | "episode"
  movieId           Int?
  episodeId         Int?
  positionSeconds   Int       @default(0)
  durationSeconds   Int?
  completed         Boolean   @default(false)
  updatedAt         DateTime  @updatedAt
  createdAt         DateTime  @default(now())

  movie             Movie?    @relation(fields: [movieId], references: [id])
  episode           Episode?  @relation(fields: [episodeId], references: [id])
  @@unique([mediaType, movieId, episodeId])
}
```

Notes:
- `WatchProgress` replaces "Plex viewOffset/viewCount" as the source of truth for resume-position and watched state. `WatchLog` (existing) keeps recording completed watch events for stats; `WatchProgress` is the lightweight "where did I leave off" table, updated frequently (every ~10s) by the player's heartbeat.
- As with the existing rule in [copilot-instructions.md](.github/instructions/copilot-instructions.md), any schema change must be applied to all three schema files (`schema.prisma`, `schema.sqlite.prisma`, `schema.postgresql.prisma`) and go through `prisma generate` + `prisma migrate dev`.

---

## 5. Phased implementation plan

### Phase 0 — Foundations
- Add env vars: `RADARR_URL`, `RADARR_API_KEY`, `SONARR_URL`, `SONARR_API_KEY`, `LIBRARY_PROVIDER` (`plex` default, switchable to `arr` per-library once ready), `TRANSCODE_TMP_DIR`, `FFMPEG_PATH`, `FFPROBE_PATH`, `HW_ACCEL` (`none|vaapi|nvenc`).
- Add dependencies: `fluent-ffmpeg`, and either bundle `ffmpeg-static`/`@ffprobe-installer/ffprobe` or require ffmpeg preinstalled in the Docker image (`apt-get install ffmpeg` in `Dockerfile`).
- Add path-translation helper `server/utils/libraryPathMapper.js`, generalizing the existing `PLEX_PATH_n/LOCAL_PATH_n` logic in `music.js` into a shared, reusable utility (`translateRemotePath(providerPath, mappings)`), used by both Radarr/Sonarr sync and the streaming service. Reuse rather than duplicate.

### Phase 1 — Radarr/Sonarr sync services (library population)
New files, following the existing modular pattern:
- `server/services/radarrService.js` — thin REST client (`GET /api/v3/movie`, `/moviefile`, `/system/status`, webhook payload parsing).
- `server/services/sonarrService.js` — thin REST client (`GET /api/v3/series`, `/episode`, `/episodefile`).
- `server/services/radarrSyncService.js` / `sonarrSyncService.js` — mirrors `PlexSyncService`'s shape: `fullSync()`, `cleanupOrphanedEntities()`, upserts into `Movie`/`Show`/`Season`/`Episode`, marks `removed: true` for anything no longer returned.
- `server/routes/radarr.js` / `server/routes/sonarr.js` — manual sync trigger, sync-status, sync-log (mirrors `server/routes/plex.js` sync endpoints), plus **webhook receivers**:
  - `POST /api/radarr/webhook` — handle Radarr's `Download`/`MovieFileDelete`/`MovieDelete`/`Rename` events for near-real-time updates instead of only polling.
  - `POST /api/sonarr/webhook` — handle Sonarr's equivalent events.
- Extend `BackgroundSyncService` (or add `RadarrBackgroundSyncService`/reuse the same class generically) so sync runs on an interval like Plex sync does today.
- `PlexSyncRunLog`-style table (`LibrarySyncRunLog`) to log each run's duration/added/updated/removed counts — reuse existing `plexSyncRunLog` pattern.

**Field mapping (Radarr `movie` → `Movie`):** `id→radarrId`, `tmdbId`, `imdbId`, `title`, `sortTitle`, `year`, `overview`, `runtime`, `studio`, `genres`, `collection.title→collectionTitle`, `collection.tmdbId→collectionTmdbId`, `path`, `movieFile.relativePath`, `movieFile.path`, `movieFile.size`, `movieFile.mediaInfo.videoCodec/audioCodec/resolution`, `hasFile`, `monitored`, `added`.

**Field mapping (Sonarr `series`/`episode` → `Show`/`Season`/`Episode`):** series `id→sonarrId`, `tvdbId`, `imdbId`, `title`, `path`, `seasons[]` (seasonNumber, monitored) → `Season`; episode `id→sonarrEpisodeId`, `seasonNumber`, `episodeNumber`, `title`, `overview`, `airDateUtc`, `episodeFile.path/relativePath/size/mediaInfo`, `hasFile`, `monitored`.

### Phase 2 — Media probing
- `server/services/mediaProbeService.js` wrapping `ffprobe` (via `fluent-ffmpeg`) to read: container, video codec, resolution, frame rate, audio codec/channels/language tracks, subtitle tracks, duration. Run once per file at sync time (when `hasFile` newly true or file changed) and cache results on the `Movie`/`Episode` row so we don't re-probe on every playback request.
- This technical metadata drives the "can this client direct-play this file?" decision in Phase 3.

### Phase 3 — Streaming & transcoding service
New `server/services/streamingService.js` + `server/routes/stream.js`:
- **Direct play**: `GET /api/stream/movie/:id/direct` / `/api/stream/episode/:id/direct` — stream the file straight off disk with full HTTP `Range` support (like `music.js` already does for audio, but reading local files with `fs.createReadStream` instead of proxying Plex). Content-Type derived from container/codec (mp4 → `video/mp4`, mkv → `video/x-matroska`, etc.). This is the cheapest, zero-CPU-cost path — client (ExoPlayer supports mp4/mkv/webm natively) plays it directly.
- **HLS transcode-on-demand**: `GET /api/stream/movie/:id/hls/master.m3u8` and `/hls/:segment.ts` — when the client requests a codec/container ExoPlayer can't direct-play (or requests a lower bitrate for bandwidth reasons), spawn an `ffmpeg` process per session:
  - `ffmpeg -i <file> -c:v libx264 (or h264_nvenc/vaapi) -c:a aac -f hls -hls_time 6 -hls_playlist_type event -hls_segment_filename <tmp>/seg%03d.ts <tmp>/index.m3u8`
  - Serve generated segments as they appear; track active sessions in-memory (session id → ffmpeg child process + tmp dir), kill + cleanup tmp dir on client disconnect/idle timeout.
  - Support **remux-only** fast path (`-c copy`) when only the container is the problem (e.g. mkv → fmp4/HLS) — much cheaper than full re-encode.
- **Playback decision endpoint**: `GET /api/stream/movie/:id/info` returns probed technical metadata + a `recommendedMode` (`direct` | `remux` | `transcode`) so the Android app can choose, or just always request `/auto` and let the server decide server-side based on a client-capabilities header the app sends (codecs it supports).
- Concurrency limits + queueing (transcoding is CPU-expensive) — cap concurrent ffmpeg sessions via config, return a clear "server busy" error otherwise.
- Reuse the already-mounted read-only volumes; add the same `LOCAL_PATH_n` translation used for Radarr/Sonarr paths.

### Phase 4 — New library/browsing API
- `server/routes/library.js`: `GET /api/library/movies`, `/api/library/movies/:id`, `/api/library/tv`, `/api/library/tv/:id`, `/api/library/tv/:id/seasons/:n` — modeled on the existing `movie-browser`/`tv-browser` endpoints in `plex.js` but reading from the new `Movie`/`Show`/`Season`/`Episode` tables. Same response shape where possible to minimize frontend churn.
- `server/routes/watchProgress.js`: `POST /api/watch-progress/heartbeat` (periodic position updates from player), `GET /api/watch-progress/:mediaType/:id`, `POST /api/watch-progress/:mediaType/:id/complete`.
- Update `getNextEpisode.js` / `getNextMovie.js` / `getNextCustomOrder.js` to source from `Show`/`Episode`/`Movie` + `WatchProgress`/`WatchLog` instead of `Plex*` tables, gated by `LIBRARY_PROVIDER` (or per-item `sourceProvider` field) so both can coexist during rollout.

### Phase 5 — Android app changes (contract-level; app code lives outside this repo)
- `PLAY_MOVIE` / `PLAY_TV_EPISODE` responses change `streamUrl` to point at our own `/api/stream/...` endpoints instead of being empty/Plex-derived, plus add `streamInfo: { mode, availableQualities, subtitleTracks, audioTracks }`.
- The Android app needs a real **ExoPlayer/Media3** playback screen for movies/TV (it already has this pattern for Stash clips/scenes and music — extend it to video, add HLS support via `HlsMediaSource`).
- Replace Plex "mark as watched" webhook flow with periodic `POST /api/watch-progress/heartbeat` calls from the player + a final completion call.
- Remove/retire the "select a Plex player" settings UI and `plexPlayerService` control calls for movies/TV specifically (Stash/music control flows are untouched).
- Document the updated contract in `ANDROID_API_ENDPOINTS.md` once implemented (this doc already exists and is the source of truth for the app team/consumer).

### Phase 6 — Feature parity work
- **Artwork**: Radarr/Sonarr expose poster/fanart via their own image endpoints (`{radarrUrl}/MediaCover/{id}/poster.jpg`) or we fetch directly from TMDB/TVDB using `tmdbId`/`tvdbId` (already have TVDB integration in this codebase — reuse `tvdbCachedService.js` patterns). Extend `ArtworkCacheService` to cache these into `localArtworkPath` on `Movie`/`Show`, same as today.
- **Collections**: Radarr's `collection.title` maps directly to today's "Plex collection" concept used in movie-browser filters — carry it over as `Movie.collectionTitle`.
- **Watch tracking / Up Next weighting**: Confirm `resolveUpNext`/`getNextEpisode`/`getNextMovie` and the "Up Next Weighting Guardrail" (see `/memories/repo/up-next-movie-collection-priority.md`) work against `WatchProgress`/`WatchLog` joined to `Movie`/`Episode` instead of Plex `viewCount`.
- **List sync matching** (`ListItemMatcherService.js`): update `matchMovie()`/`matchEpisode()` to query `Movie`/`Show`/`Episode` by exact normalized title (per the existing guardrail in `/memories/repo/list-sync-ordering.md` — **do not** relax to substring matching) instead of `PlexMovie`/`PlexTVShow`.
- **Custom Orders**: `CustomOrderItem` currently stores a Plex `ratingKey`-style reference for episodes/movies; add `movieId`/`episodeId` foreign keys (nullable, alongside the legacy Plex fields) so new items can point at the new tables while old items keep working.

### Phase 7 — Cutover, testing, rollback
- Run Radarr/Sonarr sync **in parallel** with Plex sync for a burn-in period; add an admin diagnostics endpoint comparing counts/titles between `Plex*` and new tables to catch mapping gaps (missing files, path-translation failures, unmatched titles).
- Feature-flag the switch (`LIBRARY_PROVIDER=arr`) per environment; flip dev/staging first, verify Up Next, custom orders, Android playback (direct play + at least one transcode scenario), watch tracking, and list-sync all work end-to-end before flipping production.
- Rollback = flip the flag back to `plex`; keep `Plex*` sync running (don't delete it) until confidence is high.
- Only after a full watch-through cycle in production should Plex-specific code (`plexSyncService.js`, `plexPlayerService.js`, `plexDatabaseService.js`, `routes/plex.js` playback/players endpoints) be removed. Artwork/browsing endpoints in `routes/plex.js` can be deleted first since they're superseded by `routes/library.js`.

---

## 6. New/changed files (summary)

| Area | New files | Modified files |
|---|---|---|
| Config | — | `.env.example`, `docker-compose*.yml` (add `RADARR_*`/`SONARR_*`, ffmpeg in Dockerfile) |
| Sync | `services/radarrService.js`, `services/sonarrService.js`, `services/radarrSyncService.js`, `services/sonarrSyncService.js`, `routes/radarr.js`, `routes/sonarr.js` | `backgroundSyncService.js` (generalize or add sibling), `index.js` (mount routes) |
| Schema | — | `prisma/schema.prisma` (+sqlite/+postgresql copies), new migration |
| Probing | `services/mediaProbeService.js` | — |
| Streaming | `services/streamingService.js`, `routes/stream.js`, `utils/libraryPathMapper.js` | `Dockerfile` (install ffmpeg), `package.json` (fluent-ffmpeg) |
| Library API | `routes/library.js`, `routes/watchProgress.js` | `getNextEpisode.js`, `getNextMovie.js`, `getNextCustomOrder.js`, `services/listItemMatcherService.js`, `services/artworkCacheService.js` |
| Android contract | — | `ANDROID_API_ENDPOINTS.md`, Android app repo (external) |

---

## 7. Risks & open questions

1. **Transcoding CPU/GPU capacity** — how many concurrent transcode sessions must be supported (likely 1, single-household use), and is hardware acceleration (Unraid GPU passthrough for NVENC/VAAPI) available? This determines whether software x264 encoding is fast enough.
2. **Subtitles** — Radarr/Sonarr files may have embedded or sidecar (`.srt`) subtitles; need a plan for extracting/serving them (HLS `subtitles` playlist or separate WebVTT endpoint).
3. **Multiple audio tracks / audio passthrough** — decide whether to expose track selection in the API or always pick the first/default track initially.
4. **Path-translation correctness** — Radarr/Sonarr may run on a different host than Master Order; their reported paths must map correctly to the container's mounted volumes (same class of problem already solved for music, but must be verified per-library-root).
5. **Simultaneous remote (outside-LAN) access** — Plex handled this via `plex.tv` relay; a self-hosted solution needs its own reverse-proxy/dynamic-DNS story if remote streaming is required (check `EXTERNAL_IP_SETUP.md`, `DYNAMIC_NETWORK_CONFIGURATION.md` for existing patterns to extend).
6. **Do you want Radarr/Sonarr to also *trigger* downloads/searches from this app**, or purely read their existing libraries? (This plan assumes read-only/population use — no download management UI.)
7. **Music** — confirm it should stay on Plex, or if a follow-up Lidarr plan is wanted later.

---

## 8. Suggested milestone order

1. Phase 0 + Phase 1 (Radarr/Sonarr sync) — get accurate library population working and verified against real Radarr/Sonarr instances.
2. Phase 2 + Phase 3 (probe + direct-play only, no transcoding yet) — prove end-to-end playback of already-compatible files works via the Android app.
3. Phase 4 (library/browsing API + Up Next integration) — swap the web app's movie/TV browser and Up Next over per the `LIBRARY_PROVIDER` flag in a dev environment.
4. Phase 3b (HLS transcode path) — add on-demand transcoding for incompatible files.
5. Phase 5 + 6 (Android contract, artwork, list-sync, custom orders parity).
6. Phase 7 (burn-in, cutover, eventual Plex removal).
