# Music Metadata Extraction Setup

## Problem
The music metadata extraction feature can't find your audio files because Plex and this application have different file system access. Plex sees your media at paths like `/xmas/Christmas with Babyface/...` but this Node.js application running on Windows can't access those same paths.

## Solution Options

### Option 1: Environment Variable Mapping (Recommended for Windows)

1. **Create a `.env` file** in your project root (copy from `.env.example`)

2. **Add your actual media paths** where the files really exist on your system:

```bash
# Map Plex paths to your Windows paths
XMAS_PATH=D:\Media\Christmas
MOVIES_PATH=D:\Media\Movies
MUSIC_PATH=D:\Media\Music
CLASSICAL_PATH=D:\Media\Classical
TV_PATH=D:\Media\TV
VIDEO_GAMES_PATH=D:\Media\VideoGames
POP_MUSIC_PATH=D:\Media\PopMusic
```

3. **Restart the development server** (`npm run dev`)

### Option 2: Docker Volume Mounting (For Docker deployments)

Update your `docker-compose.yml` to mount the same paths that Plex uses:

```yaml
volumes:
  # Your existing volumes...
  - /mnt/user/appdata/master-order/data:/app/data
  
  # Add media mounts that match Plex's paths
  - /path/to/your/christmas/music:/xmas:ro
  - /path/to/your/movies:/movies:ro
  - /path/to/your/music:/music:ro
  - /path/to/your/classical:/classical:ro
  - /path/to/your/tv:/tv:ro
  - /path/to/your/video_games:/video_games:ro
  - /path/to/your/pop_music:/pop_music:ro
```

### Option 3: Single Media Root (Simplest)

If all your media is under one root folder, just set:

```bash
MEDIA_PATH=D:\Media
```

## How to Find Your Media Paths

1. **Check where your Christmas music actually lives** on your file system
2. **Look at your Plex library settings** to see what folders you've added
3. **Match the Plex internal paths** (`/xmas`, `/music`, etc.) to your real paths

## Example Setup

If your media structure looks like:
```
D:\Media\
├── Christmas\          <- This is where /xmas points
├── Movies\             <- This is where /movies points  
├── Music\              <- This is where /music points
└── TV\                 <- This is where /tv points
```

Then set in `.env`:
```bash
XMAS_PATH=D:\Media\Christmas
MOVIES_PATH=D:\Media\Movies
MUSIC_PATH=D:\Media\Music
TV_PATH=D:\Media\TV
```

## Testing

After configuration:
1. Restart the server
2. Try the "Extract Metadata" button again
3. Check the console logs - you should see "✅ Found file at mapped path: ..." messages

## Current Library Mappings Detected

From your Plex server:
- Library 1: `/tv/Notflix Marvel`, `/tv`
- Library 2: `/movies`
- Library 3: `/music`
- Library 4: `/classical`
- Library 5: `/video_games`
- Library 6: `/tv/FanEdits`
- Library 7: `/pop_music`
- Library 8: `/xmas` <- Your Christmas music is here
