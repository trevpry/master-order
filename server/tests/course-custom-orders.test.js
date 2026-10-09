const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const CourseCustomOrderService = require('../services/CourseCustomOrderService');
const createCourseCustomOrdersRouter = require('../routes/courseCustomOrders');

function createDatabase({ courseMissing = false, orderMissing = false, videos, items = [], failAt } = {}) {
  const course = {
    id: 1,
    title: 'Science',
    description: 'Course description',
    videos: videos || [
      { id: 11, title: 'First lecture', url: 'https://example.com/lecture-1', description: 'Lecture description', order: 1 },
      { id: 12, title: 'Second lecture', url: 'https://example.com/lecture-2', description: null, order: 2 },
      { id: 13, title: 'Third lecture', url: 'https://example.com/lecture-3', description: null, order: 3 }
    ]
  };
  const database = {
    items: structuredClone(items),
    customOrder: {
      findMany: async () => [{ id: 2, name: 'Learning' }]
    },
    async $transaction(callback) {
      const pending = structuredClone(database.items);
      let created = 0;
      const tx = {
        historyCourse: {
          findUnique: async (args) => {
            assert.equal(args.where.id, 1);
            assert.deepEqual(args.include.videos.orderBy, [{ order: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]);
            return courseMissing ? null : course;
          }
        },
        customOrder: {
          findUnique: async (args) => {
            assert.equal(args.where.id, 2);
            return orderMissing ? null : { id: 2, name: 'Learning' };
          },
          update: async (args) => {
            assert.equal(args.where.id, 2);
            assert.ok(args.data.updatedAt instanceof Date);
            return { id: 2, name: 'Learning' };
          }
        },
        customOrderItem: {
          findMany: async (args) => {
            assert.equal(args.where.customOrderId, 2);
            return pending.filter(item => item.customOrderId === 2 &&
              (!args.where.plexKey || args.where.plexKey.in.includes(item.plexKey)));
          },
          createMany: async ({ data }) => {
            for (const itemData of data) {
              if (++created === failAt) throw new Error('Database write failed');
              pending.push({ id: pending.length + 100, ...itemData });
            }
            return { count: data.length };
          }
        }
      };
      const result = await callback(tx);
      database.items = pending;
      return result;
    }
  };
  return database;
}

test('adds all course videos as independently tracked web videos without History Plus access', async () => {
  const database = createDatabase();
  const result = await new CourseCustomOrderService(database).addVideos(1, 2);
  assert.equal(result.added, 3);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.items.map(item => item.sortOrder), [0, 1, 2]);
  assert.deepEqual(result.items[0], {
    id: 100,
    customOrderId: 2,
    mediaType: 'webvideo',
    plexKey: 'webvideo-course-11',
    title: 'Science - First lecture',
    webTitle: 'First lecture',
    webUrl: 'https://example.com/lecture-1',
    webDescription: 'Lecture description',
    sortOrder: 0,
    isWatched: false
  });
  assert.equal(result.items[1].webDescription, 'Course description');
});

test('selected videos are appended in lecture order, not selection order', async () => {
  const database = createDatabase({
    items: [{ customOrderId: 2, sortOrder: 7, plexKey: 'other', webUrl: null }]
  });
  const result = await new CourseCustomOrderService(database).addVideos(1, 2, [13, 11, 13]);
  assert.deepEqual(result.items.map(item => item.plexKey), ['webvideo-course-11', 'webvideo-course-13']);
  assert.deepEqual(result.items.map(item => item.sortOrder), [8, 9]);
});

test('skips duplicates by course identity or URL and is repeat-safe', async () => {
  const database = createDatabase({
    items: [
      { customOrderId: 2, sortOrder: 2, plexKey: 'webvideo-course-11', webUrl: 'https://example.com/old-url' },
      { customOrderId: 2, sortOrder: 5, plexKey: 'manual-webvideo', webUrl: 'https://example.com/lecture-2' }
    ]
  });
  const service = new CourseCustomOrderService(database);
  const result = await service.addVideos(1, 2);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.items[0].sortOrder, 6);
  const repeat = await service.addVideos(1, 2);
  assert.equal(repeat.added, 0);
  assert.equal(repeat.skipped, 3);
  assert.equal(database.items.length, 3);
});

test('rejects missing courses, missing orders, foreign videos and empty courses without writes', async () => {
  for (const [options, videoIds, status] of [
    [{ courseMissing: true }, undefined, 404],
    [{ orderMissing: true }, undefined, 404],
    [{}, [11, 999], 400],
    [{ videos: [] }, undefined, 400]
  ]) {
    const database = createDatabase(options);
    const result = await new CourseCustomOrderService(database).addVideos(1, 2, videoIds);
    assert.equal(result.status, status);
    assert.ok(result.error);
    assert.equal(database.items.length, 0);
  }
});

test('a failed batch rolls back and propagates the database error', async () => {
  const database = createDatabase({ failAt: 2 });
  await assert.rejects(new CourseCustomOrderService(database).addVideos(1, 2), /Database write failed/);
  assert.equal(database.items.length, 0);
});

test('videos in other orders and course watch state do not affect a new order', async () => {
  const database = createDatabase({
    videos: [{ id: 11, title: 'First lecture', url: 'https://example.com/lecture-1', watched: true }],
    items: [{ customOrderId: 3, sortOrder: 8, plexKey: 'webvideo-course-11', webUrl: 'https://example.com/lecture-1', isWatched: true }]
  });
  const result = await new CourseCustomOrderService(database).addVideos(1, 2);
  assert.equal(result.added, 1);
  assert.equal(result.items[0].sortOrder, 0);
  assert.equal(result.items[0].isWatched, false);
  assert.equal(database.items[0].isWatched, true);
});

test('created web video fields match the generated Prisma model', async () => {
  const { Prisma } = require('@prisma/client');
  const model = Prisma.dmmf.datamodel.models.find(model => model.name === 'CustomOrderItem');
  const fields = new Set(model.fields.map(field => field.name));
  const result = await new CourseCustomOrderService(createDatabase()).addVideos(1, 2, [11]);
  for (const field of Object.keys(result.items[0])) {
    assert.ok(fields.has(field), `CustomOrderItem does not support ${field}`);
  }
});

async function withApi(database, callback) {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', createCourseCustomOrdersRouter(database));
  app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await callback(`http://127.0.0.1:${server.address().port}/api/courses`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('API provides lightweight order options and accepts selected or all lectures', async () => {
  const database = createDatabase();
  await withApi(database, async (baseUrl) => {
    const options = await fetch(`${baseUrl}/custom-order-options`);
    assert.deepEqual(await options.json(), { success: true, data: [{ id: 2, name: 'Learning' }] });
    const selected = await fetch(`${baseUrl}/1/custom-orders/2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoIds: [12] })
    });
    assert.equal(selected.status, 200);
    const selectedResult = await selected.json();
    assert.equal(selectedResult.success, true);
    assert.equal(selectedResult.data.added, 1);
    assert.equal(selectedResult.data.items[0].webTitle, 'Second lecture');
    const all = await fetch(`${baseUrl}/1/custom-orders/2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    const allResult = await all.json();
    assert.equal(allResult.data.added, 2);
    assert.equal(allResult.data.skipped, 1);
  });
});

test('API rejects malformed IDs and selections before querying the database', async () => {
  await withApi({ $transaction: () => assert.fail('Invalid input queried database') }, async (baseUrl) => {
    for (const [path, body] of [
      ['/bad/custom-orders/2', {}],
      ['/1/custom-orders/0', {}],
      ['/1/custom-orders/2', { videoIds: [] }],
      ['/1/custom-orders/2', { videoIds: ['11'] }],
      ['/1/custom-orders/2', { videoIds: [1.5] }],
      ['/1/custom-orders/2', { videoIds: null }]
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
    }
  });
});

test('API preserves not-found and validation errors and does not report write failures as success', async () => {
  for (const [options, body, status] of [
    [{ courseMissing: true }, {}, 404],
    [{ orderMissing: true }, {}, 404],
    [{}, { videoIds: [999] }, 400],
    [{ failAt: 2 }, {}, 500]
  ]) {
    await withApi(createDatabase(options), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/1/custom-orders/2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      assert.equal(response.status, status);
      assert.ok((await response.json()).error);
    });
  }
});
