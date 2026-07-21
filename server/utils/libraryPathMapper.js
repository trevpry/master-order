/**
 * Library Path Mapper
 *
 * Generalized remote-path -> local-filesystem-path translation utility.
 *
 * Historically this logic lived only in server/routes/music.js to let the
 * server read audio files directly off disk when Plex reports a path that
 * doesn't match the container's mounted volume path. It is now shared so
 * that Radarr/Sonarr sync services and the direct-play/transcoding
 * streaming service (see SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md) can
 * resolve movie/episode file paths the same way, without duplicating logic.
 *
 * Configuration (numbered mappings, checked in order 1-50):
 *   REMOTE_PATH_n / LOCAL_PATH_n   - preferred, provider-agnostic names
 *   PLEX_PATH_n   / LOCAL_PATH_n   - legacy names, still supported
 *
 * Example (Docker/Unraid, paths already match):
 *   REMOTE_PATH_1=/movies
 *   LOCAL_PATH_1=/movies
 *
 * Example (Windows dev, remote source reports a different path):
 *   REMOTE_PATH_1=/movies
 *   LOCAL_PATH_1=D:\Media\Movies
 */

const path = require('path');

/**
 * Read numbered REMOTE_PATH_n/PLEX_PATH_n + LOCAL_PATH_n env var pairs plus
 * the legacy XMAS_PATH/CLASSICAL_PATH fallbacks, sorted so the longest
 * remote-path prefix is tried first (so nested mappings resolve correctly).
 */
function getConfiguredPathMappings() {
  const numberedMappings = [];
  for (let i = 1; i <= 50; i += 1) {
    const configuredRemotePath = process.env[`REMOTE_PATH_${i}`] || process.env[`PLEX_PATH_${i}`];
    const configuredLocalPath = process.env[`LOCAL_PATH_${i}`];

    if (!configuredRemotePath || !configuredLocalPath) {
      continue;
    }

    numberedMappings.push({
      remotePath: configuredRemotePath.trim(),
      localPath: configuredLocalPath.trim(),
    });
  }

  // Legacy fallback mappings kept for backward compatibility
  const legacyMappings = [
    { remotePath: '/xmas', localPath: process.env.XMAS_PATH },
    { remotePath: '/classical', localPath: process.env.CLASSICAL_PATH }
  ];

  return [...numberedMappings, ...legacyMappings]
    .filter((mapping) => mapping.remotePath && mapping.localPath)
    // Prefer longest remote-path prefix first so nested mappings resolve correctly
    .sort((left, right) => right.remotePath.length - left.remotePath.length);
}

/**
 * Translate a Plex/Radarr/Sonarr-reported path like /mnt/user/Media/Movies/...
 * into the equivalent path on the current host (Unraid share <-> UNC/local
 * share root), independent of any explicit numbered mapping above.
 */
function mapUnraidMediaPathToHost(filePath) {
  if (!filePath) {
    return null;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const unraidMediaPrefix = '/mnt/user/Media';
  if (!normalizedPath.toLowerCase().startsWith(unraidMediaPrefix.toLowerCase())) {
    return null;
  }

  const relativePath = normalizedPath.substring(unraidMediaPrefix.length).replace(/^\//, '');
  if (process.platform === 'win32') {
    const unraidServerName = process.env.UNRAID_SERVER_NAME || 'tower';
    const uncRoot = `\\\\${unraidServerName}\\Media`;
    return relativePath ? path.join(uncRoot, relativePath) : uncRoot;
  }

  const shareRoot = process.env.UNRAID_SHARE_ROOT || '/mnt/user';
  return path.join(shareRoot, 'Media', relativePath);
}

/**
 * Resolve a remote (Plex/Radarr/Sonarr) path to a local filesystem path,
 * returning details about which mapping (if any) matched.
 */
function mapRemotePathToLocalDetailed(remotePath) {
  if (!remotePath) {
    return {
      localPath: null,
      mappingMatched: false,
      matchedRemotePath: null,
      matchedLocalPath: null,
    };
  }

  const pathMappings = getConfiguredPathMappings();

  // Try each configured mapping
  for (const mapping of pathMappings) {
    if (remotePath.toLowerCase().startsWith(mapping.remotePath.toLowerCase())) {
      const relativePath = remotePath.substring(mapping.remotePath.length);
      const localPath = mapping.localPath + relativePath.replace(/\//g, path.sep);
      console.log(`Mapped library path: ${remotePath} -> ${localPath}`);
      return {
        localPath,
        mappingMatched: true,
        matchedRemotePath: mapping.remotePath,
        matchedLocalPath: mapping.localPath,
      };
    }
  }

  const translatedUnraidPath = mapUnraidMediaPathToHost(remotePath);
  if (translatedUnraidPath) {
    console.log(`Translated Unraid media path: ${remotePath} -> ${translatedUnraidPath}`);
    return {
      localPath: translatedUnraidPath,
      mappingMatched: true,
      matchedRemotePath: '/mnt/user/Media',
      matchedLocalPath: translatedUnraidPath,
    };
  }

  // If no mapping found, return original path (useful for Docker where paths match)
  console.log(`No path mapping found for: ${remotePath}, using as-is`);
  return {
    localPath: remotePath,
    mappingMatched: false,
    matchedRemotePath: null,
    matchedLocalPath: null,
  };
}

/** Convenience wrapper returning just the resolved local path. */
function mapRemotePathToLocal(remotePath) {
  return mapRemotePathToLocalDetailed(remotePath).localPath;
}

module.exports = {
  getConfiguredPathMappings,
  mapUnraidMediaPathToHost,
  mapRemotePathToLocalDetailed,
  mapRemotePathToLocal,
  // Back-compat aliases for existing call sites (server/routes/music.js)
  mapPlexPathToLocalDetailed: mapRemotePathToLocalDetailed,
  mapPlexPathToLocal: mapRemotePathToLocal,
};
