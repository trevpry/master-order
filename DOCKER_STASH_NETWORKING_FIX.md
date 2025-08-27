# Docker Stash Network Connectivity Fix

## Problem
Getting `EHOSTUNREACH` error when Master Order Docker container tries to connect to Stash server:
```
FetchError: request to http://192.168.1.154:9999/graphql failed, reason: connect EHOSTUNREACH 192.168.1.154:9999
```

## Root Cause
Docker containers run in isolated networks and may not be able to reach services on the host network or other devices on your LAN without proper configuration.

## Solutions (Try in Order)

### Solution 1: Set STASH_URL Environment Variable ✅ APPLIED
Added `STASH_URL=http://192.168.1.154:9999` to docker-compose.yml environment variables.

### Solution 2: Host Network Mode ✅ APPLIED
Added `network_mode: host` to docker-compose.yml to use host networking.

### Solution 3: Alternative IP Addresses (Try if above fails)

If the current setup doesn't work, try these alternative Stash URLs:

1. **Docker Host Gateway** (recommended for Docker Desktop):
   ```yaml
   - "STASH_URL=http://host.docker.internal:9999"
   ```

2. **Docker Bridge Gateway**:
   ```yaml
   - "STASH_URL=http://172.17.0.1:9999"
   ```

3. **Unraid Host IP** (if Stash is on same Unraid server):
   ```yaml
   - "STASH_URL=http://192.168.1.113:9999"
   ```

### Solution 4: Custom Docker Network
Create a custom bridge network that can reach your LAN:

```yaml
version: '3.8'

networks:
  master-order-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

services:
  master-order:
    networks:
      - master-order-net
    # ... rest of config
```

## Troubleshooting Steps

### 1. Test Connectivity from Container
```bash
# Enter the running container
docker exec -it master-order bash

# Test network connectivity
curl -v http://192.168.1.154:9999/graphql
ping 192.168.1.154
nslookup 192.168.1.154
```

### 2. Check Stash Server Accessibility
From your Unraid host or any other device on the network:
```bash
curl -v http://192.168.1.154:9999/graphql
```

### 3. Verify Docker Network Configuration
```bash
# Check container network settings
docker inspect master-order | grep -A 20 NetworkSettings

# Check available networks
docker network ls
```

### 4. Check Firewall Rules
Ensure the Stash server (192.168.1.154) allows connections on port 9999 from the Docker subnet.

## Environment Variable Reference

Add these to your docker-compose.yml environment section:

```yaml
environment:
  # Required for Stash integration
  - "STASH_URL=http://192.168.1.154:9999"
  
  # Alternative formats if above doesn't work
  # - "STASH_URL=http://host.docker.internal:9999"
  # - "STASH_URL=http://172.17.0.1:9999"
```

## Common Unraid Docker Networking Issues

1. **Container cannot reach host services**: Use `host.docker.internal` or the Unraid server IP
2. **Container cannot reach other containers**: Ensure they're on the same Docker network
3. **Container cannot reach LAN devices**: Use host networking or custom bridge network
4. **Firewall blocking connections**: Check Unraid firewall settings

## Verification

After applying fixes, restart the container and check logs:

```bash
# Restart container
docker-compose down && docker-compose up -d

# Check logs for successful connection
docker logs master-order -f
```

Look for successful Stash sync messages without `EHOSTUNREACH` errors.

## Production Deployment Notes

- Host networking (`network_mode: host`) is simple but less secure
- Custom bridge networks provide better isolation
- Always verify connectivity before deploying
- Consider using Docker secrets for sensitive configuration
