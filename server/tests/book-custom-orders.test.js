const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { BookCustomOrderService, normalizeBookPartProgress } = require('../services/BookCustomOrderService');
const BookCompletionService = require('../services/BookCompletionService');
const createBookCustomOrdersRouter = require('../routes/bookCustomOrders');
const createItemManagementRoutes = require('../routes/customOrders/itemManagement');
const ReadingSessionService = require('../services/watchlog/readingSessionService');

let prisma;
let directory;
let databasePath;

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'master-order-book-parts-'));
  databasePath = path.join(directory, 'test.db');
  const url = `file:${databasePath}`;
  execFileSync(process.execPath, [
    require.resolve('prisma/build/index.js'), 'db', 'push',
    '--schema', path.join(__dirname, '..', 'prisma', 'schema.sqlite.prisma'),
    '--skip-generate'
  ], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe'
  });
  prisma = new PrismaClient({ datasources: { db: { url } } });
});

after(async () => {
  if (prisma) await prisma.$disconnect();
  if (databasePath) {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const file = databasePath + suffix;
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }
  if (directory) fs.rmdirSync(directory);
});

async function fixture() {
  const book = await prisma.book.create({
    data: {
      title: 'Test Book', author: 'Test Author', pageCount: 100,
      coverUrl: 'https://example.com/book-cover.jpg',
      chapters: {
        create: [
          {
            chapterNumber: 1, title: 'First Chapter', pageStart: 1, pageEnd: 50,
            sections: { create: [
              { sectionNumber: 1, title: 'First Section', pageStart: 1, pageEnd: 25 },
              { sectionNumber: 2, title: 'Second Section', pageStart: 26, pageEnd: 50 }
            ] }
          },
          { chapterNumber: 2, title: 'Second Chapter', pageStart: 51, pageEnd: 100 }
        ]
      }
    },
    include: { chapters: { include: { sections: true }, orderBy: { chapterNumber: 'asc' } } }
  });
  const order = await prisma.customOrder.create({ data: { name: 'Test Order', isActive: false } });
  return {
    book, order, chapter: book.chapters[0], section: book.chapters[0].sections[0],
    secondSection: book.chapters[0].sections[1], service: new BookCustomOrderService(prisma)
  };
}

test('mixed selections are appended in book order with proper references and repeat-safe duplicates', async () => {
  const { book, order, chapter, section, service } = await fixture();
  await prisma.customOrderItem.create({
    data: { customOrderId: order.id, mediaType: 'webvideo', title: 'Existing item', sortOrder: 9 }
  });
  const selections = [
    { type: 'chapter', id: book.chapters[1].id },
    { type: 'section', id: section.id },
    { type: 'chapter', id: chapter.id },
    { type: 'section', id: section.id }
  ];
  const result = await service.addParts(book.id, order.id, selections);
  assert.equal(result.added, 3);
  assert.equal(result.skipped, 0);
  const items = await prisma.customOrderItem.findMany({
    where: { customOrderId: order.id, bookId: book.id }, orderBy: { sortOrder: 'asc' }
  });
  assert.deepEqual(items.map(item => item.mediaType), ['chapter', 'section', 'chapter']);
  assert.deepEqual(items.map(item => item.sortOrder), [10, 11, 12]);
  assert.equal(items[0].chapterId, chapter.id);
  assert.equal(items[0].sectionId, null);
  assert.equal(items[1].chapterId, chapter.id);
  assert.equal(items[1].sectionId, section.id);
  assert.equal(items[0].isWatched, false);
  const repeat = await service.addParts(book.id, order.id, selections);
  assert.equal(repeat.added, 0);
  assert.equal(repeat.skipped, 3);
  assert.equal(await prisma.customOrderItem.count({ where: { customOrderId: order.id } }), 4);
});

test('foreign chapter or section IDs and missing parents fail without any items being inserted', async () => {
  const first = await fixture();
  const second = await fixture();
  for (const [bookId, orderId, selections, status] of [
    [first.book.id, first.order.id, [{ type: 'chapter', id: second.chapter.id }], 400],
    [first.book.id, first.order.id, [{ type: 'section', id: second.section.id }], 400],
    [999999, first.order.id, [{ type: 'chapter', id: first.chapter.id }], 404],
    [first.book.id, 999999, [{ type: 'chapter', id: first.chapter.id }], 404]
  ]) {
    const result = await first.service.addParts(bookId, orderId, selections);
    assert.equal(result.status, status);
    assert.ok(result.error);
  }
  assert.equal(await prisma.customOrderItem.count({ where: { customOrderId: first.order.id } }), 0);
});

test('adding a completed library chapter inherits its status without adding the whole book', async () => {
  const { book, order, chapter, service } = await fixture();
  await new BookCompletionService(prisma).markChapterCompleted(chapter.id);
  await service.addParts(book.id, order.id, [{ type: 'chapter', id: chapter.id }]);
  const items = await prisma.customOrderItem.findMany({ where: { customOrderId: order.id } });
  assert.equal(items.length, 1);
  assert.equal(items[0].isWatched, true);
  assert.equal(items[0].mediaType, 'chapter');
  const completion = await prisma.bookCompletion.findFirst({ where: { bookId: book.id } });
  assert.equal(completion.isCompleted, false);
  assert.equal(completion.percentRead, 50);
});

test('section completion is shared across orders, does not complete the whole book, and resets on unread', async () => {
  const { book, order, chapter, section, secondSection, service } = await fixture();
  const anotherOrder = await prisma.customOrder.create({ data: { name: 'Another Order', isActive: false } });
  const selections = [{ type: 'chapter', id: chapter.id }, { type: 'section', id: section.id }];
  await service.addParts(book.id, order.id, selections);
  await service.addParts(book.id, anotherOrder.id, selections);
  const sectionItem = await prisma.customOrderItem.findFirst({
    where: { customOrderId: order.id, mediaType: 'section' }
  });
  await service.setCompleted(sectionItem, true);
  const shared = await prisma.customOrderItem.findMany({
    where: { mediaType: 'section', sectionId: section.id }
  });
  assert.ok(shared.every(item => item.isWatched));
  assert.equal((await prisma.sectionCompletion.findFirst({ where: { sectionId: section.id } })).isCompleted, true);
  assert.equal(await prisma.chapterCompletion.count({ where: { chapterId: chapter.id, isCompleted: true } }), 0);
  await new BookCompletionService(prisma).markSectionCompleted(secondSection.id);
  assert.equal(await prisma.customOrderItem.count({
    where: { mediaType: 'chapter', chapterId: chapter.id, isWatched: true }
  }), 2);
  assert.equal((await prisma.bookCompletion.findFirst({ where: { bookId: book.id } })).percentRead, 50);
  await service.setCompleted(sectionItem, false);
  assert.equal(await prisma.customOrderItem.count({
    where: { chapterId: chapter.id, isWatched: true }
  }), 0);
  assert.equal((await prisma.sectionCompletion.findFirst({ where: { sectionId: section.id } })).isCompleted, false);
  assert.equal((await prisma.bookCompletion.findFirst({ where: { bookId: book.id } })).isCompleted, false);
});

test('library chapter toggles synchronize custom orders and non-default users do not overwrite them', async () => {
  const { book, order, chapter, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'chapter', id: chapter.id }]);
  const completionService = new BookCompletionService(prisma);
  await completionService.markChapterCompleted(chapter.id, 'another-reader');
  assert.equal((await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } })).isWatched, false);
  await completionService.toggleChapterCompletion(chapter.id);
  assert.equal((await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } })).isWatched, true);
  await completionService.toggleChapterCompletion(chapter.id);
  assert.equal((await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } })).isWatched, false);
});

test('reading progress completes only the selected content at 100 percent or its final page', async () => {
  const { book, order, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  assert.equal(await service.updateReadingProgress(item, { percentComplete: 60 }), false);
  assert.equal(await service.updateReadingProgress(item, { currentPage: 24, totalPages: 100 }), false);
  assert.equal(await service.updateReadingProgress(item, { currentPage: 25, totalPages: 100 }), true);
  await service.setCompleted(item, false);
  assert.equal(await service.updateReadingProgress(item, { percentComplete: 100 }), true);
  const report = await new BookCompletionService(prisma).getBookProgressReport(book.id);
  assert.equal(report.isCompleted, false);
});

test('deleting a section or chapter cascades only its dependent custom-order items', async () => {
  const { book, order, chapter, section, secondSection, service } = await fixture();
  await service.addParts(book.id, order.id, [
    { type: 'chapter', id: chapter.id },
    { type: 'section', id: section.id },
    { type: 'section', id: secondSection.id },
    { type: 'chapter', id: book.chapters[1].id }
  ]);
  await prisma.bookSection.delete({ where: { id: section.id } });
  assert.equal(await prisma.customOrderItem.count({ where: { customOrderId: order.id } }), 3);
  await prisma.bookChapter.delete({ where: { id: chapter.id } });
  const remaining = await prisma.customOrderItem.findMany({ where: { customOrderId: order.id } });
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].chapterId, book.chapters[1].id);
  assert.ok(await prisma.book.findUnique({ where: { id: book.id } }));
});

test('reading logs preserve book, chapter and section context without History Plus markers', async () => {
  const { book, order, chapter, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  const reading = new ReadingSessionService(prisma);
  const log = await reading.startReading({
    mediaType: 'book', title: item.title, customOrderItemId: item.id,
    bookId: book.id, chapterId: chapter.id, sectionId: section.id
  });
  assert.equal(log.activityType, 'read');
  assert.equal(log.bookId, book.id);
  assert.equal(log.chapterId, chapter.id);
  assert.equal(log.sectionId, section.id);
  assert.equal(log.seriesTitle, null);
  await prisma.watchLog.update({ where: { id: log.id }, data: { endTime: new Date() } });
});

function loadWithDependencies(targetName, dependencies) {
  const cached = new Map();
  const target = require.resolve(targetName);
  cached.set(target, require.cache[target]);
  try {
    for (const [name, exports] of Object.entries(dependencies)) {
      const modulePath = require.resolve(name);
      cached.set(modulePath, require.cache[modulePath]);
      require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
    }
    delete require.cache[target];
    return require(target);
  } finally {
    for (const [modulePath, module] of cached) {
      if (module) require.cache[modulePath] = module;
      else delete require.cache[modulePath];
    }
  }
}

async function withApi(callback, androidUpNext = null) {
  const app = express();
  app.use(express.json());
  app.use('/api/books', createBookCustomOrdersRouter(prisma));
  app.use('/api/custom-orders', createItemManagementRoutes(prisma, {}));
  const createWatchTrackingRoutes = loadWithDependencies('../routes/watchTracking', {
    '../prismaClient': prisma,
    '../getNextCustomOrder': {
      markCustomOrderItemAsWatched: async id => prisma.customOrderItem.update({
        where: { id }, data: { isWatched: true }
      })
    }
  });
  app.use('/api', createWatchTrackingRoutes({ emit() {} }));
  const createAndroidReadingRoutes = loadWithDependencies('../routes/android/readingSession', {
    '../prismaClient': prisma,
    '../services/musicPlaybackService': {
      getInstance: () => ({
        updateAndroidPlayback: async () => null,
        stopAndroidPlayback: async () => null
      })
    }
  });
  app.use('/api/android', createAndroidReadingRoutes(prisma));
  const createContentDiscoveryRoutes = loadWithDependencies('../routes/android/contentDiscovery', {
    '../services/upNextService': { resolveUpNext: async () => androidUpNext }
  });
  app.use('/api/android', createContentDiscoveryRoutes());
  app.use('/api/android', require('../routes/android/customOrders')(prisma));
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('API validates selection shape and adds selected items with the standard response envelope', async () => {
  const { book, order, chapter } = await fixture();
  await withApi(async baseUrl => {
    const options = await fetch(`${baseUrl}/books/custom-order-options`).then(response => response.json());
    assert.equal(options.success, true);
    assert.ok(options.data.some(option => option.id === order.id));
    for (const selections of [[], null, [{ type: 'book', id: book.id }], [{ type: 'chapter', id: '1' }], [null]]) {
      const response = await fetch(`${baseUrl}/books/${book.id}/custom-orders/${order.id}/parts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selections })
      });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
    }
    const response = await fetch(`${baseUrl}/books/${book.id}/custom-orders/${order.id}/parts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections: [{ type: 'chapter', id: chapter.id }] })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.success, true);
    assert.equal(result.data.added, 1);
    assert.equal(result.data.customOrderId, order.id);
  });
});

test('custom-order watched/unwatched API updates library chapter completion', async () => {
  const { book, order, chapter, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'chapter', id: chapter.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  await withApi(async baseUrl => {
    const invalidReselection = await fetch(`${baseUrl}/custom-orders/${order.id}/items/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: book.id + 1000 })
    });
    assert.equal(invalidReselection.status, 400);
    for (const isWatched of [true, false]) {
      const response = await fetch(`${baseUrl}/custom-orders/${order.id}/items/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isWatched })
      });
      assert.equal(response.status, 200, JSON.stringify(await response.json()));
      const completion = await prisma.chapterCompletion.findFirst({ where: { chapterId: chapter.id, userId: 'default' } });
      assert.equal(completion.isCompleted, isWatched);
    }
  });
});

test('web reading API persists scoped context and completes the section without completing its parent book', async () => {
  const { book, order, chapter, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  await withApi(async baseUrl => {
    const startResponse = await fetch(`${baseUrl}/reading/start`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'book', title: item.title, customOrderItemId: item.id })
    });
    assert.equal(startResponse.status, 200);
    const start = await startResponse.json();
    assert.equal(start.data.chapterId, chapter.id);
    assert.equal(start.data.sectionId, section.id);
    await prisma.watchLog.update({
      where: { id: start.data.id }, data: { startTime: new Date(Date.now() - 120000) }
    });
    const invalid = await fetch(`${baseUrl}/reading/stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: { percentComplete: 101 } })
    });
    assert.equal(invalid.status, 400);
    const stop = await fetch(`${baseUrl}/reading/stop`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: { percentComplete: 100 } })
    });
    assert.equal(stop.status, 200);
    const result = await stop.json();
    assert.equal(result.success, true);
    assert.equal((await prisma.customOrderItem.findUnique({ where: { id: item.id } })).isWatched, true);
    assert.equal((await prisma.sectionCompletion.findFirst({ where: { sectionId: section.id } })).isCompleted, true);
    assert.equal(await prisma.bookCompletion.count({ where: { bookId: book.id, isCompleted: true } }), 0);
  });
});

test('Up Next manual completion API logs book-part identity as reading activity', async () => {
  const { book, order, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  await withApi(async baseUrl => {
    const response = await fetch(`${baseUrl}/mark-custom-order-item-watched/${item.id}`, { method: 'POST' });
    assert.equal(response.status, 200);
    const log = await prisma.watchLog.findFirst({ where: { customOrderItemId: item.id } });
    assert.equal(log.activityType, 'read');
    assert.equal(log.mediaType, 'book');
    assert.equal(log.bookId, book.id);
    assert.equal(log.sectionId, section.id);
    assert.equal((await prisma.sectionCompletion.findFirst({ where: { sectionId: section.id } })).isCompleted, true);
  });
});

test('failed completion synchronization rolls back library completion and all order changes', async () => {
  const { book, order, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  const failingService = new BookCustomOrderService({
    $transaction: callback => prisma.$transaction(tx => callback({
      ...tx,
      customOrderItem: {
        ...tx.customOrderItem,
        updateMany: async () => { throw new Error('Completion synchronization failed'); }
      }
    }))
  });
  await assert.rejects(failingService.setCompleted(item, true), /Completion synchronization failed/);
  assert.equal(await prisma.sectionCompletion.count({ where: { sectionId: section.id } }), 0);
  assert.equal((await prisma.customOrderItem.findUnique({ where: { id: item.id } })).isWatched, false);
});

test('book-part reading progress rejects malformed values instead of reporting success', () => {
  for (const progress of [
    { percentComplete: '100invalid' }, { percentage: '' }, { percentRead: true },
    { currentPage: -1 }, { totalPages: 0 }, { currentPage: 'invalid' }, [], '100'
  ]) {
    assert.throws(() => normalizeBookPartProgress(progress), /progress|finite|range/);
  }
  assert.deepEqual(normalizeBookPartProgress({ percentCompleted: '100', currentPage: '10' }), {
    percentComplete: 100, currentPage: 10
  });
});

test('Android reading API requires linked book parts and validates progress before stopping', async () => {
  const { book, order, section, service } = await fixture();
  await service.addParts(book.id, order.id, [{ type: 'section', id: section.id }]);
  const item = await prisma.customOrderItem.findFirst({ where: { customOrderId: order.id } });
  await withApi(async baseUrl => {
    const post = (path, body) => fetch(`${baseUrl}/android/reading/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal((await post('start', { mediaType: 'section', title: item.title })).status, 400);
    assert.equal((await post('start', { mediaType: 'chapter', title: item.title, id: item.id })).status, 400);
    assert.equal((await post('start', { mediaType: 'section', title: item.title, id: `${item.id}invalid` })).status, 400);
    const start = await post('start', { mediaType: 'section', title: item.title, id: item.id });
    assert.equal(start.status, 200);
    const log = await prisma.watchLog.findFirst({ where: { customOrderItemId: item.id } });
    assert.equal(log.mediaType, 'book');
    assert.equal(log.bookId, book.id);
    assert.equal(log.sectionId, section.id);
    await prisma.watchLog.update({ where: { id: log.id }, data: { startTime: new Date(Date.now() - 120000) } });
    assert.equal((await post('stop', { id: item.id, progress: { percentComplete: 'invalid' } })).status, 400);
    assert.equal((await prisma.watchLog.findUnique({ where: { id: log.id } })).endTime, null);
    const stop = await post('stop', { id: item.id, progress: { percentage: '100' } });
    assert.equal(stop.status, 200);
    const result = await stop.json();
    assert.equal(result.data.markedAsRead, true);
    assert.equal(result.data.mediaType, 'book');
    assert.equal((await prisma.customOrderItem.findUnique({ where: { id: item.id } })).isWatched, true);
    assert.equal(await prisma.bookCompletion.count({ where: { bookId: book.id, isCompleted: true } }), 0);
  });
});

test('Up Next uses the book filter and returns chapter/section identities and book artwork', async () => {
  const { book, order, chapter, section, service } = await fixture();
  await service.addParts(book.id, order.id, [
    { type: 'chapter', id: chapter.id }, { type: 'section', id: section.id }
  ]);
  await prisma.customOrder.update({ where: { id: order.id }, data: { isActive: true } });
  const dependencies = {
    '../prismaClient': prisma,
    '../tvdbCachedService': {},
    '../comicVineService': {},
    '../openLibraryService': {},
    '../plexDatabaseService': class {},
    '../artworkCacheService': class { async getArtworkUrl(item) { return item.book.coverUrl; } },
    '../subOrderService': {}
  };
  const { getNextCustomOrder } = loadWithDependencies('../getNextCustomOrder', dependencies);
  const nextChapter = await getNextCustomOrder(null, { book: true, movie: false });
  assert.equal(nextChapter.type, 'chapter');
  assert.equal(nextChapter.orderType, 'CUSTOM_ORDER');
  assert.equal(nextChapter.bookId, book.id);
  assert.equal(nextChapter.chapterId, chapter.id);
  assert.equal(nextChapter.chapterNumber, 1);
  assert.equal(nextChapter.thumb, book.coverUrl);
  const chapterItem = await prisma.customOrderItem.findUnique({ where: { id: nextChapter.customOrderItemId } });
  await service.setCompleted(chapterItem, true);
  const nextSection = await getNextCustomOrder(null, { book: true, movie: false });
  assert.equal(nextSection.type, 'section');
  assert.equal(nextSection.sectionId, section.id);
  assert.equal(nextSection.chapterId, chapter.id);
  assert.equal(nextSection.pageEnd, 25);
  await withApi(async baseUrl => {
    const response = await fetch(`${baseUrl}/android/up-next`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.type, 'PLAY_CUSTOM_ORDER_ITEM');
    assert.equal(result.data.type, 'book');
    assert.equal(result.data.readingContentType, 'section');
    assert.equal(result.data.bookId, book.id);
    assert.equal(result.data.sectionId, section.id);
    assert.equal(result.data.customOrderItemId, nextSection.customOrderItemId);
    const orderResponse = await fetch(`${baseUrl}/android/custom-orders/${order.id}/items`);
    assert.equal(orderResponse.status, 200);
    const orderResult = await orderResponse.json();
    const sectionItem = orderResult.data.items.find(item => item.sectionId === section.id);
    assert.equal(sectionItem.mediaType, 'book');
    assert.equal(sectionItem.readingContentType, 'section');
    assert.equal(sectionItem.bookTitle, book.title);
  }, nextSection);
  await prisma.customOrder.update({ where: { id: order.id }, data: { isActive: false } });
});
