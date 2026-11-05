const path = require('path');
const fs = require('fs/promises');
const { constants } = require('fs');
const { randomUUID } = require('crypto');
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

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.avif'].includes(ext);
}

async function walkImageFilesRecursive(rootDir, maxFiles = 5000, excludedDir = null) {
  const files = [];
  async function walk(dir) {
    if (files.length >= maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);
      if (excludedDir && path.relative(excludedDir, fullPath) === '') continue;
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && isImageFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  await walk(rootDir);
  return files;
}

async function getGalleryFolderFiles(networkFolderPath) {
  const sourceDir = resolveConfiguredStoragePath(networkFolderPath);
  const importDir = path.join(await getBackgroundUploadDirectory(), 'gallery-imports');
  if (path.relative(importDir, sourceDir) === '' || containsPath(importDir, sourceDir)) {
    const error = new Error('Choose a source folder outside the managed gallery-imports directory');
    error.status = 400;
    throw error;
  }
  try {
    const files = await walkImageFilesRecursive(sourceDir, Infinity, importDir);
    if (files.length === 0) {
      const error = new Error('No supported image files found in the selected folder');
      error.status = 400;
      throw error;
    }
    return files;
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) {
      error.status = 400;
      error.message = `Cannot read network folder: ${error.message}`;
    }
    throw error;
  }
}

async function importGalleryImages(galleryId, sourceFiles) {
  const uploadDir = path.join(await ensureBackgroundUploadDirectory(), 'gallery-imports');
  await fs.mkdir(uploadDir, { recursive: true });
  const existing = await removeMissingBackgrounds(await prisma.backgroundImage.findMany({
    where: { galleryId },
    select: { id: true, sourcePath: true, path: true }
  }));
  const existingPaths = new Set(existing.map(image => path.resolve(image.sourcePath || image.path)));
  const stats = { scanned: sourceFiles.length, imported: 0, skipped: 0, failed: 0 };
  const errors = [];
  for (const sourcePath of sourceFiles) {
    if (existingPaths.has(sourcePath)) {
      stats.skipped++;
      continue;
    }
    const filename = `bg-${randomUUID()}${path.extname(sourcePath).toLowerCase()}`;
    const destination = path.join(uploadDir, filename);
    let copied = false;
    try {
      await fs.copyFile(sourcePath, destination, constants.COPYFILE_EXCL);
      copied = true;
      const fileStats = await fs.stat(destination);
      const ext = path.extname(sourcePath).toLowerCase();
      const mimetype = {
        '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
        '.bmp': 'image/bmp', '.avif': 'image/avif', '.tif': 'image/tiff', '.tiff': 'image/tiff'
      }[ext] || 'image/jpeg';
      await prisma.backgroundImage.create({
        data: {
          filename, originalName: path.basename(sourcePath), path: destination,
          sourcePath, galleryId, mimetype, size: fileStats.size
        }
      });
      existingPaths.add(sourcePath);
      stats.imported++;
    } catch (error) {
      console.error('[BACKGROUND-GALLERIES] Failed to import image:', sourcePath, error);
      if (copied) {
        try {
          await fs.unlink(destination);
        } catch (cleanupError) {
          console.error('[BACKGROUND-GALLERIES] Failed to clean up imported file:', destination, cleanupError);
        }
      }
      // Another save may have imported this source concurrently.
      if (error.code === 'P2002') {
        stats.skipped++;
      } else {
        stats.failed++;
        errors.push({ filePath: sourcePath, error: error.message });
      }
    }
  }
  return { stats, errors };
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
  walkImageFilesRecursive,
  getGalleryFolderFiles,
  importGalleryImages,
  removeMissingBackgrounds
};
