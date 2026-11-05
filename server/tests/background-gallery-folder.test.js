const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const express = require('express');
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

let prisma;
let databaseDir;
let fixtureDir;
let sourceDir;
let uploadDir;
let gallery;
const originalUploadDir = process.env.UPLOAD_DIR;
const originalCopyFile = fs.copyFile;
const originalCreate = {};
const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: new Proxy({}, { get: (_, property) => prisma[property] })
};
const {
  getGalleryFolderFiles, importGalleryImages, resolveConfiguredStoragePath
} = require('../services/backgroundImageService');
const app = express();
app.use(express.json());
app.use('/api/background-galleries', require('../routes/backgroundGalleries'));

test.before(async () => {
  databaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'master-order-gallery-db-'));
  prisma = new PrismaClient({ datasources: {
    db: { url: `file:${path.join(databaseDir, 'test.db')}` }
  } });
  await prisma.$executeRawUnsafe(`CREATE TABLE "Settings" (
    "id" INTEGER PRIMARY KEY, "backgroundImageStoragePath" TEXT)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "BackgroundGallery" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT NOT NULL, "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL)`);
  await prisma.$executeRawUnsafe(`CREATE TABLE "BackgroundImage" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT, "filename" TEXT NOT NULL, "originalName" TEXT,
    "path" TEXT NOT NULL, "url" TEXT, "size" INTEGER, "mimetype" TEXT, "galleryId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    "height" INTEGER, "width" INTEGER,
    FOREIGN KEY ("galleryId") REFERENCES "BackgroundGallery" ("id"))`);
  await prisma.$executeRawUnsafe(`INSERT INTO "BackgroundGallery" ("name", "updatedAt") VALUES ('Existing', CURRENT_TIMESTAMP)`);
  const sql = await fs.readFile(path.join(__dirname, '..', 'prisma', 'migrations',
    '20261105175000_add_background_gallery_network_folder', 'migration.sql'), 'utf8');
  for (const statement of sql.split(';').filter(statement => statement.trim())) {
    await prisma.$executeRawUnsafe(statement);
  }
  const existing = await prisma.backgroundGallery.findFirst();
  assert.equal(existing.name, 'Existing');
  assert.equal(existing.networkFolderPath, null);
  originalCreate.value = prisma.backgroundImage.create;
});

test.beforeEach(async () => {
  fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'master-order-gallery-folder-'));
  sourceDir = path.join(fixtureDir, 'network-source');
  uploadDir = path.join(fixtureDir, 'uploads', 'backgrounds');
  process.env.UPLOAD_DIR = path.join(fixtureDir, 'uploads');
  await fs.mkdir(path.join(sourceDir, 'nested'), { recursive: true });
  await fs.writeFile(path.join(sourceDir, 'first.JPG'), 'first image');
  await fs.writeFile(path.join(sourceDir, 'nested', 'second.png'), 'second image');
  await fs.writeFile(path.join(sourceDir, 'notes.txt'), 'not an image');
  await prisma.backgroundImage.deleteMany();
  await prisma.backgroundGallery.deleteMany();
  gallery = await prisma.backgroundGallery.create({ data: { name: 'Test Gallery' } });
});

test.afterEach(async () => {
  fs.copyFile = originalCopyFile;
  prisma.backgroundImage.create = originalCreate.value;
  if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = originalUploadDir;
  await fs.rm(fixtureDir, { recursive: true, force: true });
});

test.after(async () => {
  await prisma.$disconnect();
  await fs.rm(databaseDir, { recursive: true, force: true });
});

async function request(method, url, data) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      ...(data === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

async function save(data = {}) {
  return request('PUT', `/api/background-galleries/${gallery.id}`, {
    name: 'Updated Gallery', networkFolderPath: sourceDir, ...data
  });
}

test('saving persists the folder and copies nested images into the selected gallery', async () => {
  const { status, body } = await save({ networkFolderPath: ` ${sourceDir} ` });
  assert.equal(status, 200);
  assert.equal(body.gallery.networkFolderPath, sourceDir);
  assert.deepEqual(body.folderImport.stats, { scanned: 2, imported: 2, skipped: 0, failed: 0 });
  const images = await prisma.backgroundImage.findMany();
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(image.galleryId, gallery.id);
    assert.equal(path.dirname(image.path), path.join(uploadDir, 'gallery-imports'));
    assert.notEqual(image.path, image.sourcePath);
    assert.equal(await fs.readFile(image.path, 'utf8'), await fs.readFile(image.sourcePath, 'utf8'));
  }
  assert.deepEqual(images.map(image => image.mimetype).sort(), ['image/jpeg', 'image/png']);
  const list = await request('GET', '/api/background-galleries');
  assert.equal(list.body.galleries[0].imageCount, 2);
  assert.equal(list.body.galleries[0].networkFolderPath, sourceDir);
});

test('saving again skips existing imports and imports newly added images', async () => {
  await save();
  await fs.writeFile(path.join(sourceDir, 'third.webp'), 'new image');
  const { body } = await save();
  assert.deepEqual(body.folderImport.stats, { scanned: 3, imported: 1, skipped: 2, failed: 0 });
  assert.equal(await prisma.backgroundImage.count(), 3);
  const result = await request('PUT', `/api/background-galleries/${gallery.id}`, { description: 'Changed' });
  assert.equal(result.status, 200);
  assert.equal(result.body.folderImport.stats.skipped, 3);
});

test('the same source can be imported into two galleries without stealing images', async () => {
  await save();
  const secondGallery = await prisma.backgroundGallery.create({ data: { name: 'Second Gallery' } });
  const result = await request('PUT', `/api/background-galleries/${secondGallery.id}`, {
    networkFolderPath: sourceDir
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.folderImport.stats.imported, 2);
  assert.equal(await prisma.backgroundImage.count({ where: { galleryId: gallery.id } }), 2);
  assert.equal(await prisma.backgroundImage.count({ where: { galleryId: secondGallery.id } }), 2);
});

test('clearing or changing the folder leaves existing images and originals untouched', async () => {
  await save();
  const cleared = await save({ networkFolderPath: null });
  assert.equal(cleared.body.gallery.networkFolderPath, null);
  assert.equal(cleared.body.folderImport, null);
  assert.equal(await prisma.backgroundImage.count(), 2);
  const anotherDir = path.join(fixtureDir, 'another');
  await fs.mkdir(anotherDir);
  await fs.writeFile(path.join(anotherDir, 'new.jpg'), 'another image');
  const changed = await save({ networkFolderPath: anotherDir });
  assert.equal(changed.body.folderImport.stats.imported, 1);
  assert.equal(await prisma.backgroundImage.count(), 3);
  assert.equal(await fs.readFile(path.join(sourceDir, 'first.JPG'), 'utf8'), 'first image');
});

test('missing folders, files rather than folders, and folders without images fail before saving', async () => {
  const emptyDir = path.join(fixtureDir, 'empty');
  await fs.mkdir(emptyDir);
  for (const folder of [path.join(fixtureDir, 'offline'), path.join(sourceDir, 'first.JPG'), emptyDir]) {
    const { status, body } = await save({ networkFolderPath: folder });
    assert.equal(status, 400);
    assert.equal(body.success, false);
    assert.ok(body.message);
    assert.equal((await prisma.backgroundGallery.findUnique({ where: { id: gallery.id } })).name, 'Test Gallery');
  }
});

test('invalid fields, unknown galleries, and duplicate names return appropriate errors', async () => {
  for (const data of [{ networkFolderPath: 42 }, { name: ' ' }, { description: {} }]) {
    assert.equal((await save(data)).status, 400);
  }
  assert.equal((await request('PUT', '/api/background-galleries/0', {})).status, 400);
  assert.equal((await request('PUT', '/api/background-galleries/1junk', {})).status, 400);
  assert.equal((await request('PUT', '/api/background-galleries/99999', {})).status, 404);
  await prisma.backgroundGallery.create({ data: { name: 'Duplicate' } });
  assert.equal((await save({ name: ' Duplicate ' })).status, 400);
  assert.equal(await prisma.backgroundImage.count(), 0);
});

test('partial copy failures are reported and failed images are imported on retry', async () => {
  fs.copyFile = async (source, ...args) => {
    if (source.endsWith('.png')) throw Object.assign(new Error('Share disconnected'), { code: 'EIO' });
    return originalCopyFile(source, ...args);
  };
  const { body } = await save();
  assert.deepEqual(body.folderImport.stats, { scanned: 2, imported: 1, skipped: 0, failed: 1 });
  assert.equal(body.folderImport.errors[0].error, 'Share disconnected');
  assert.equal((await fs.readdir(path.join(uploadDir, 'gallery-imports'))).length, 1);
  fs.copyFile = originalCopyFile;
  const retry = await save();
  assert.deepEqual(retry.body.folderImport.stats, { scanned: 2, imported: 1, skipped: 1, failed: 0 });
});

test('database failures clean copied files and do not delete source images', async () => {
  prisma.backgroundImage.create = async () => { throw new Error('Database write failed'); };
  const { body } = await save();
  assert.equal(body.folderImport.stats.failed, 2);
  assert.equal((await fs.readdir(path.join(uploadDir, 'gallery-imports'))).length, 0);
  assert.equal(await fs.readFile(path.join(sourceDir, 'first.JPG'), 'utf8'), 'first image');
});

test('concurrent imports remain unique and do not leave orphaned copies', async () => {
  const files = await getGalleryFolderFiles(sourceDir);
  const results = await Promise.all([
    importGalleryImages(gallery.id, files), importGalleryImages(gallery.id, files)
  ]);
  assert.equal(results.reduce((sum, result) => sum + result.stats.failed, 0), 0);
  assert.equal(await prisma.backgroundImage.count(), 2);
  assert.equal((await fs.readdir(path.join(uploadDir, 'gallery-imports'))).length, 2);
});

test('a deleted imported copy is recreated from its original on the next save', async () => {
  await save();
  const image = await prisma.backgroundImage.findFirst();
  await fs.unlink(image.path);
  const result = await save();
  assert.deepEqual(result.body.folderImport.stats, { scanned: 2, imported: 1, skipped: 1, failed: 0 });
  assert.equal(await prisma.backgroundImage.count(), 2);
});

test('folders within upload storage work without recursively reimporting managed copies', async () => {
  const sharedFolder = path.join(uploadDir, 'source-gallery');
  await fs.mkdir(sharedFolder, { recursive: true });
  await fs.writeFile(path.join(sharedFolder, 'source.jpg'), 'shared image');
  const first = await save({ networkFolderPath: uploadDir });
  assert.equal(first.body.folderImport.stats.imported, 1);
  const second = await save({ networkFolderPath: uploadDir });
  assert.deepEqual(second.body.folderImport.stats, { scanned: 1, imported: 0, skipped: 1, failed: 0 });
  assert.equal((await save({ networkFolderPath: path.join(uploadDir, 'gallery-imports') })).status, 400);
});

test('Windows UNC folder paths retain the existing network-path resolution', () => {
  const unc = '\\\\tower\\Media\\Images\\Gallery';
  if (process.platform === 'win32') assert.equal(resolveConfiguredStoragePath(unc), path.resolve(unc));
});
