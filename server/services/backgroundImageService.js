const path = require('path');
const fs = require('fs/promises');
const prisma = require('../prismaClient');

function sanitizeStoragePath(storagePath) {
  return typeof storagePath === 'string' ? storagePath.trim() : '';
}

function normalizeSlashes(inputPath) {
  return inputPath.replace(/\\/g, '/');
}

function parseUncPath(inputPath) {
  const match = normalizeSlashes(inputPath).match(/^\/\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return { server: match[1], share: match[2], rest: (match[3] || '').replace(/^\/+/, '') };
}

function applyUncMappings(inputPath) {
  const mappings = process.env.BACKGROUND_UNC_PATH_MAPPINGS;
  if (!mappings) return null;

  const normalizedInput = normalizeSlashes(inputPath);
  for (const pair of mappings.split(';').map(entry => entry.trim()).filter(Boolean)) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex <= 0) continue;
    const uncPrefix = normalizeSlashes(pair.slice(0, separatorIndex).trim()).replace(/\/+$/, '');
    const targetPrefix = pair.slice(separatorIndex + 1).trim();
    if (!uncPrefix || !targetPrefix) continue;
    if (normalizedInput.toLowerCase() === uncPrefix.toLowerCase() ||
        normalizedInput.toLowerCase().startsWith(`${uncPrefix.toLowerCase()}/`)) {
      const remainder = normalizedInput.slice(uncPrefix.length).replace(/^\/+/, '');
      return remainder ? path.join(targetPrefix, remainder) : targetPrefix;
    }
  }
  return null;
}

function resolveConfiguredStoragePath(configuredPath) {
  const rawPath = sanitizeStoragePath(configuredPath);
  if (!rawPath) return '';
  const unc = parseUncPath(rawPath);
  if (!unc || process.platform === 'win32') return path.resolve(rawPath);

  const mappedPath = applyUncMappings(rawPath);
  if (mappedPath) return path.resolve(mappedPath);

  const unraidServerName = (process.env.UNRAID_SERVER_NAME || 'tower').toLowerCase();
  if (unc.server.toLowerCase() === unraidServerName) {
    return path.resolve(path.join(process.env.UNRAID_SHARE_ROOT || '/mnt/user', unc.share, unc.rest));
  }
  return path.resolve(path.join(process.env.UNC_MOUNT_ROOT || '/mnt/remotes', unc.server, unc.share, unc.rest));
}

async function getConfiguredBackgroundStoragePath() {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { backgroundImageStoragePath: true }
  });
  return sanitizeStoragePath(settings?.backgroundImageStoragePath);
}

function getDefaultBackgroundDirectory() {
  return path.resolve(path.join(process.env.UPLOAD_DIR || './uploads', 'backgrounds'));
}

async function getBackgroundUploadDirectory() {
  const configuredPath = await getConfiguredBackgroundStoragePath();
  return configuredPath ? resolveConfiguredStoragePath(configuredPath) : getDefaultBackgroundDirectory();
}

async function ensureBackgroundUploadDirectory() {
  const uploadDir = await getBackgroundUploadDirectory();
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

function containsPath(root, filePath) {
  const relative = path.relative(root, filePath);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function removeMissingBackgrounds(backgrounds) {
  const missing = [];
  for (const background of backgrounds) {
    try {
      await fs.stat(background.path);
    } catch (error) {
      if (error.code === 'ENOENT') {
        missing.push(background);
      } else {
        console.warn('[BACKGROUNDS] Cannot check image; retaining record:', background.id, error);
      }
    }
  }
  if (missing.length === 0) return backgrounds;

  const configuredPath = await getConfiguredBackgroundStoragePath();
  const roots = [getDefaultBackgroundDirectory()];
  if (configuredPath) roots.unshift(resolveConfiguredStoragePath(configuredPath));
  const accessibleRoots = new Map();
  const confirmedMissing = [];

  for (const background of missing) {
    const filePath = path.resolve(background.path);
    const root = roots.find(directory => containsPath(directory, filePath)) || path.dirname(filePath);
    if (!accessibleRoots.has(root)) {
      try {
        // A missing mount/share must not be mistaken for deleted image files.
        await fs.readdir(root);
        accessibleRoots.set(root, true);
      } catch (error) {
        console.warn('[BACKGROUNDS] Storage unavailable; retaining image records:', root, error);
        accessibleRoots.set(root, false);
      }
    }
    if (accessibleRoots.get(root)) {
      try {
        await fs.stat(background.path);
      } catch (error) {
        if (error.code === 'ENOENT') {
          confirmedMissing.push(background);
        } else {
          console.warn('[BACKGROUNDS] Cannot recheck image; retaining record:', background.id, error);
        }
      }
    }
  }
  if (confirmedMissing.length === 0) return backgrounds;

  const result = await prisma.backgroundImage.deleteMany({
    where: { OR: confirmedMissing.map(({ id, path: imagePath }) => ({ id, path: imagePath })) }
  });
  console.log(`[BACKGROUNDS] Automatically removed ${result.count} missing image records`);
  const removedIds = new Set(confirmedMissing.map(background => background.id));
  return backgrounds.filter(background => !removedIds.has(background.id));
}

module.exports = {
  getConfiguredBackgroundStoragePath,
  resolveConfiguredStoragePath,
  getBackgroundUploadDirectory,
  ensureBackgroundUploadDirectory,
  removeMissingBackgrounds
};
