const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const express = require('express');
const fetch = require('node-fetch');

let records;
let storagePath;
let fixtureDir;
let deletions;
const originalUploadDir = process.env.UPLOAD_DIR;
const originalStat = fs.stat;
const originalReaddir = fs.readdir;
const db = {
  settings: { findUnique: async () => ({ backgroundImageStoragePath: storagePath }) },
  backgroundImage: {
    findMany: async () => records.map(record => ({ ...record })),
    findUnique: async ({ where }) => records.find(record => record.id === where.id) || null,
    deleteMany: async ({ where }) => {
      deletions.push(where);
      const before = records.length;
      records = records.filter(record => !where.OR.some(match =>
        match.id === record.id && match.path === record.path));
      return { count: before - records.length };
    }
  },
  backgroundGallery: {
    findMany: async () => [{ id: 1, name: 'Gallery', _count: {
      backgrounds: records.filter(record => record.galleryId === 1).length
    } }],
    findUnique: async ({ where }) => where.id === 1 ? {
      id: 1, name: 'Gallery', backgrounds: records.filter(record => record.galleryId === 1)
    } : null
  }
};
const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: db };
const { removeMissingBackgrounds, getBackgroundUploadDirectory, ensureBackgroundUploadDirectory } =
  require('../services/backgroundImageService');
const app = express();
app.use('/api/backgrounds', require('../routes/backgrounds'));
app.use('/api/background-galleries', require('../routes/backgroundGalleries'));

test.beforeEach(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'master-order-background-test-'));
  process.env.UPLOAD_DIR = fixtureDir;
  storagePath = path.join(fixtureDir, 'backgrounds');
  await fs.mkdir(storagePath);
  records = [
    { id: 1, path: path.join(storagePath, 'existing.jpg'), galleryId: 1, mimetype: 'image/jpeg' },
    { id: 2, path: path.join(storagePath, 'missing.jpg'), galleryId: 1, mimetype: 'image/jpeg' }
  ];
  await fs.writeFile(records[0].path, 'image contents');
  deletions = [];
});

test.afterEach(async () => {
  fs.stat = originalStat;
  fs.readdir = originalReaddir;
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

async function request(url, check) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
    await check(response);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('cleanup deletes only missing records and leaves existing files untouched', async () => {
  const available = await removeMissingBackgrounds(records);
  assert.deepEqual(available.map(record => record.id), [1]);
  assert.deepEqual(records.map(record => record.id), [1]);
  assert.deepEqual(deletions, [{ OR: [{ id: 2, path: path.join(storagePath, 'missing.jpg') }] }]);
  assert.equal(await fs.readFile(records[0].path, 'utf8'), 'image contents');
});

test('repeated cleanup is idempotent and skips database deletion for existing images', async () => {
  await removeMissingBackgrounds(records);
  await removeMissingBackgrounds(records);
  assert.equal(deletions.length, 1);
  assert.deepEqual(await removeMissingBackgrounds([]), []);
});

test('missing nested folders are cleaned when the configured storage root is accessible', async () => {
  const externalRoot = path.join(fixtureDir, 'external');
  await fs.mkdir(externalRoot);
  storagePath = externalRoot;
  records = [{ id: 3, path: path.join(externalRoot, 'removed-folder', 'image.jpg') }];
  assert.deepEqual(await removeMissingBackgrounds(records), []);
  assert.equal(records.length, 0);
});

test('unavailable storage preserves records even when all images are missing', async () => {
  await fs.rm(storagePath, { recursive: true });
  const before = [...records];
  assert.deepEqual(await removeMissingBackgrounds(records), before);
  assert.equal(deletions.length, 0);
});

test('permission and I/O errors retain records instead of treating them as missing', async () => {
  fs.stat = async () => { throw Object.assign(new Error('Permission denied'), { code: 'EACCES' }); };
  assert.equal((await removeMissingBackgrounds(records)).length, 2);
  assert.equal(deletions.length, 0);
  fs.stat = originalStat;
  fs.readdir = async () => { throw Object.assign(new Error('Storage I/O error'), { code: 'EIO' }); };
  assert.equal((await removeMissingBackgrounds(records)).length, 2);
  assert.equal(deletions.length, 0);
});

test('legacy paths outside configured storage require an accessible parent', async () => {
  const legacyDir = path.join(fixtureDir, 'legacy');
  await fs.mkdir(legacyDir);
  records = [{ id: 3, path: path.join(legacyDir, 'missing.jpg') }];
  assert.deepEqual(await removeMissingBackgrounds(records), []);
  records = [{ id: 4, path: path.join(fixtureDir, 'offline', 'missing.jpg') }];
  assert.equal((await removeMissingBackgrounds(records)).length, 1);
});

test('images restored during a storage check are not removed', async () => {
  fs.readdir = async directory => {
    await fs.writeFile(records[1].path, 'restored image');
    return originalReaddir(directory);
  };
  assert.equal((await removeMissingBackgrounds(records)).length, 2);
  assert.equal(deletions.length, 0);
});

test('storage helpers preserve configured paths and default upload behavior', async () => {
  assert.equal(await getBackgroundUploadDirectory(), storagePath);
  storagePath = '';
  assert.equal(await getBackgroundUploadDirectory(), path.join(fixtureDir, 'backgrounds'));
  assert.equal(await ensureBackgroundUploadDirectory(), path.join(fixtureDir, 'backgrounds'));
});

test('background listing cleans records and preserves response URLs and count', async () => {
  await request('/api/backgrounds', async response => {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.deepEqual(body.backgrounds.map(record => record.id), [1]);
    assert.match(body.backgrounds[0].url, /\/api\/backgrounds\/1\/image$/);
  });
  assert.equal(records.length, 1);
});

test('gallery listing reports counts after cleanup without removing the gallery', async () => {
  await request('/api/background-galleries', async response => {
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.galleries[0].imageCount, 1);
    assert.equal(body.count, 1);
  });
});

test('gallery detail and background endpoints both exclude missing images', async () => {
  await request('/api/background-galleries/1', async response => {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.gallery.backgrounds.map(record => record.id), [1]);
    assert.deepEqual(body.gallery.images.map(record => record.id), [1]);
  });
  records.push({ id: 3, path: path.join(storagePath, 'another-missing.jpg'), galleryId: 1 });
  await request('/api/background-galleries/1/backgrounds', async response => {
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).map(record => record.id), [1]);
  });
});

test('missing image requests return 404 and automatically remove stale records', async () => {
  await request('/api/backgrounds/2/image', async response => {
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Background file not found on disk');
  });
  assert.deepEqual(records.map(record => record.id), [1]);
});

test('image requests on unavailable storage return 404 but preserve records', async () => {
  await fs.rm(storagePath, { recursive: true });
  await request('/api/backgrounds/2/image', async response => {
    assert.equal(response.status, 404);
  });
  assert.equal(records.length, 2);
});

test('existing image requests still serve the image and cache headers', async () => {
  await request('/api/backgrounds/1/image', async response => {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000');
    assert.equal(await response.text(), 'image contents');
  });
  assert.equal(deletions.length, 0);
});

test('cleanup database failures surface as a failed API response', async () => {
  const originalDelete = db.backgroundImage.deleteMany;
  db.backgroundImage.deleteMany = async () => { throw new Error('Database unavailable'); };
  try {
    await request('/api/backgrounds', async response => {
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.message, 'Database unavailable');
    });
    assert.equal(records.length, 2);
  } finally {
    db.backgroundImage.deleteMany = originalDelete;
  }
});
