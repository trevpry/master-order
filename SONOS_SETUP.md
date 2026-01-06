# SONOS Integration Setup

## Overview
Eddie Life Management supports casting music to SONOS speakers using **direct UPnP/SOAP control**. No external services required - works seamlessly in Docker/Unraid environments.

## Architecture

Eddie communicates directly with SONOS speakers using:
- **SSDP (UPnP Discovery)** - Automatic device discovery on local network
- **SOAP/AVTransport** - Direct playback control via UPnP protocol
- **HTTP Streaming** - SONOS streams audio directly from Eddie server

```
┌─────────────┐     SSDP Discovery     ┌──────────┐
│   Eddie     │ ←────────────────────→ │  SONOS   │
│   Server    │    SOAP Control        │ Speaker  │
│             │ ←────────────────────→ │          │
└─────────────┘                         └──────────┘
       ↓                                      ↓
       │          HTTP Audio Stream          │
       └─────────────────────────────────────┘
```

## Prerequisites
- SONOS speakers on the same network as Eddie server
- **No additional software required!**

## Setup

### Standard Installation
No setup required! Eddie automatically discovers SONOS devices on your network.

### Docker/Unraid Configuration

**Important**: Docker containers need host network access to discover SONOS devices.

#### Option 1: Host Network Mode (Recommended)

```yaml
services:
  eddie:
    image: your-eddie-image
    network_mode: host
    # ... rest of configuration
```

#### Option 2: Bridge Mode with Multicast

If you need bridge networking, enable multicast:

```yaml
services:
  eddie:
    image: your-eddie-image
    network_mode: bridge
    # ... other config
    sysctls:
      - net.ipv4.ip_forward=1
    cap_add:
      - NET_ADMIN
```

#### Unraid Docker Template

Add to your Eddie container template:
- **Network Type**: `Host` (or `Custom: br0` if using custom bridge)
- **Extra Parameters**: (none required for host mode)

## Usage

1. **Start Music Playback**: Play any track from the Eddie music library

2. **Connect to SONOS**:
   - Click the SONOS speaker icon (🔊) in the music player
   - Select your SONOS speaker/room from the dropdown
   - The track will automatically start playing on your SONOS

3. **Playback Control**:
   - Play/Pause works through Eddie's player controls
   - Track changes automatically update on SONOS
   - Disconnect by clicking the SONOS button again

## Features

- ✅ Automatic device discovery (no configuration needed)
- ✅ Works in Docker/Unraid without external services
- ✅ Direct UPnP/SOAP control
- ✅ Track metadata (title, artist, album, artwork)
- ✅ Play/pause control
- ✅ Automatic track changes
- ✅ Persistent device selection
- ✅ Works alongside Chromecast
- ✅ No port forwarding or additional services required

## Technical Details

### UPnP/SOAP Implementation

Eddie uses standard UPnP protocols to control SONOS:

1. **Device Discovery (SSDP)**:
   - Multicast search on 239.255.255.250:1900
   - Discovers `urn:schemas-upnp-org:device:ZonePlayer:1`
   - Parses device descriptions for room names and capabilities

2. **Playback Control (AVTransport)**:
   - SOAP requests to `/MediaRenderer/AVTransport/Control`
   - Actions: SetAVTransportURI, Play, Pause, Stop, Next, Previous
   - DIDL-Lite metadata for track information

3. **Direct Streaming**:
   - SONOS fetches audio directly from Eddie's HTTP endpoint
   - No transcoding or relay required
   - Supports standard audio formats (MP3, FLAC, etc.)

### Supported SONOS Actions

- `SetAVTransportURI` - Load new track with metadata
- `Play` - Start/resume playback
- `Pause` - Pause playback
- `Stop` - Stop playback
- `Next` - Skip to next track
- `Previous` - Go to previous track
- `GetTransportInfo` - Get current playback state
- `GetPositionInfo` - Get current position and track info

## Troubleshooting

### No SONOS Devices Found

1. **Network connectivity**:
   - Eddie server must be on same network as SONOS speakers
   - SONOS speakers must be powered on and connected
   - Check firewall rules (allow UPnP/SSDP on UDP port 1900)

2. **Docker/Unraid specific**:
   - Ensure container uses `host` network mode
   - Or verify multicast is enabled for bridge mode
   - Check container can reach local network devices

3. **Test device discovery**:
   ```bash
   # From inside container or host
   curl http://localhost:3001/api/sonos/devices
   ```

### Playback Doesn't Start

1. **Check Eddie is accessible from SONOS**:
   - SONOS must be able to reach Eddie's HTTP server
   - Verify Eddie is listening on all interfaces (0.0.0.0)
   - Test stream URL accessibility:
     ```bash
     # From another device on network
     curl http://eddie-ip:3001/api/music/stream/TRACK_ID
     ```

2. **Firewall rules**:
   - Allow incoming HTTP on Eddie's port (default 3001)
   - Allow UPnP (UDP 1900, TCP 1400)

3. **Check SONOS logs**: via SSDP
- `POST /api/sonos/play` - Play track on device (SetAVTransportURI + Play)
- `POST /api/sonos/control` - Control playback (play/pause/stop/next/previous)
- `GET /api/sonos/state/:deviceId` - Get device transport state

## Network Requirements

### Ports
- **UDP 1900** - SSDP/UPnP discovery (multicast)
- **TCP 1400** - SONOS control port (HTTP/SOAP)
- **TCP 3001** - Eddie HTTP server (for audio streaming)

### Firewall Rules

For Eddie server:
```bash
# Allow SSDP discovery
sudo ufw allow 1900/udp

# Allow SONOS control
sudo ufw allow from 192.168.1.0/24 to any port 1400

# Allow HTTP for streaming
sudo ufw allow 3001/tcp
```

## Resources

- [UPnP Device Architecture](http://upnp.org/specs/arch/UPnP-arch-DeviceArchitecture-v2.0.pdf)
- [SONOS UPnP Services](https://github.com/jishi/node-sonos-http-api/blob/master/API.md)
- [AVTransport Service Specification](http://upnp.org/specs/av/UPnP-av-AVTransport-v1-Service.pdf)
- [DIDL-Lite Metadata Format](http://upnp.org/specs/av/UPnP-av-ContentDirectory-v1-Service.pdf

```bash
# On Docker host
sudo iptables -I INPUT -p udp --dport 1900 -j ACCEPT
sudo iptables -I OUTPUT -p udp --dport 1900 -j ACCEPT
```

## API Endpoints

Eddie exposes these SONOS endpoints:

- `GET /api/sonos/devices` - Discover SONOS devices
- `POST /api/sonos/play` - Play track on device
- `POST /api/sonos/control` - Control playback (play/pause/stop)
- `GET /api/sonos/state/:deviceId` - Get device state

## Advanced Configuration

### Custom SONOS API URL

```bash
# If running on different host/port
SONOS_API_URL=http://192.168.1.100:5005
```

### Multiple SONOS Systems

The node-sonos-http-api automatically discovers all SONOS devices on the network. Eddie will show all available rooms for selection.

## Resources

- [node-sonos-http-api GitHub](https://github.com/jishi/node-sonos-http-api)
- [node-sonos-http-api Documentation](https://github.com/jishi/node-sonos-http-api/blob/master/README.md)
- [SONOS API Commands](https://github.com/jishi/node-sonos-http-api/blob/master/API.md)
