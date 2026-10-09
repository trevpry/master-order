const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGreatCoursesLectures } = require('../services/parsers/GreatCoursesLectureParser');
const CourseScrapingService = require('../services/CourseScrapingService');

const course = { id: 10, title: 'Example Course', url: 'https://plus.thegreatcourses.com/example-course' };

function lecturePage(count = 2) {
  return `<h1>Example Course</h1><h3>Trailer</h3><div id="lectures-list" class="lectures-list">${
    Array.from({ length: count }, (_, index) => {
      const number = index + 1;
      const title = `${String(number).padStart(2, '0')}: Topic ${number}`;
      return `<div class="media media-table media-pdp">
        <div class="media-left"><div class="play-lecture" data-idx="${number}" data-title=" ${title}" data-sku="EX-L${number}"></div></div>
        <div class="media-body"><div><h3><span class="title"><span class="count">${number}:</span> Topic ${number}</span></h3><p>Description ${number}</p></div></div>
      </div>`;
    }).join('')
  }</div>`;
}

test('extracts all 36 lectures from current playback attributes and h3 markup without duplicates', () => {
  const videos = parseGreatCoursesLectures(lecturePage(36), course);
  assert.equal(videos.length, 36);
  assert.deepEqual(videos[0], {
    courseId: 10,
    order: 1,
    title: 'Lecture 1: Topic 1',
    url: 'https://plus.thegreatcourses.com/example-course?lecplay=1',
    description: 'Description 1'
  });
  assert.equal(videos[35].order, 36);
  assert.equal(videos[35].url, 'https://plus.thegreatcourses.com/example-course?lecplay=36');
});

test('supports legacy h4 headings, numbered h3 headings, sorting and whitespace', () => {
  const videos = parseGreatCoursesLectures(`
    <h4>Lecture 2: Second topic</h4><h3> 01: First\n topic </h3>
    <h4>2. Second topic</h4><h4>Trailer</h4><h4>0: Preview</h4>
  `, course);
  assert.deepEqual(videos.map(video => video.order), [1, 2]);
  assert.equal(videos[0].title, 'Lecture 1: First topic');
  assert.equal(videos[0].description, 'Lecture 1 from Example Course');
});

test('prefers lecture list over unrelated numbered headings and replaces existing lecture query and fragment', () => {
  const videos = parseGreatCoursesLectures(`<h3>99: Related item</h3>${lecturePage(1)}`, {
    ...course, url: `${course.url}?source=library&lecplay=4#episodes`
  });
  assert.equal(videos.length, 1);
  assert.equal(videos[0].url, `${course.url}?source=library&lecplay=1`);
});

function mockService(context, html, initialVideos = [], failAt) {
  context.mock.method(global, 'fetch', async () => ({
    ok: true, text: async () => html
  }));
  context.mock.method(console, 'log', () => {});
  context.mock.method(console, 'error', () => {});
  const database = {
    videos: structuredClone(initialVideos),
    async $transaction(callback) {
      const pending = structuredClone(database.videos);
      let created = 0;
      const result = await callback({
        historyCourseVideo: {
          findFirst: async ({ where }) => pending.find(video =>
            video.url === where.OR[0].url ||
            (video.courseId === where.OR[1].courseId && video.order === where.OR[1].order)) || null,
          create: async ({ data }) => {
            if (++created === failAt) throw new Error('Insert failed');
            const video = { id: pending.length + 100, ...data };
            pending.push(video);
            return video;
          },
          update: async ({ where, data }) => {
            const video = pending.find(video => video.id === where.id);
            Object.assign(video, data);
            return video;
          }
        }
      });
      database.videos = pending;
      return result;
    }
  };
  const service = new CourseScrapingService(database);
  const link = context.mock.method(service, 'linkOrCreateHistoryVideo', async () => {});
  return { service, database, link };
}

test('imports detected lectures and reports a repeat import as skipped', async (context) => {
  const { service, database, link } = mockService(context, lecturePage(36));
  const result = await service.scrapeVideosForCourse(course);
  assert.equal(result.videosFound, 36);
  assert.equal(result.videosAdded, 36);
  assert.equal(result.videosSkipped, 0);
  assert.equal(result.videosUpdated, 0);
  assert.equal(database.videos.length, 36);
  assert.equal(link.mock.callCount(), 36);
  const repeated = await service.scrapeVideosForCourse(course);
  assert.equal(repeated.videosFound, 36);
  assert.equal(repeated.videosAdded, 0);
  assert.equal(repeated.videosSkipped, 36);
  assert.equal(database.videos.length, 36);
  assert.equal(link.mock.callCount(), 36);
});

test('updates legacy placeholder URLs without duplicating lectures or resetting watch state', async (context) => {
  const { service, database } = mockService(context, lecturePage(1), [{
    id: 5, courseId: course.id, order: 1,
    title: 'Lecture 1: Topic 1', url: `${course.url}/lecture-1`, watched: true
  }]);
  const result = await service.scrapeVideosForCourse(course);
  assert.equal(result.videosUpdated, 1);
  assert.equal(result.videosAdded, 0);
  assert.equal(database.videos.length, 1);
  assert.equal(database.videos[0].url, `${course.url}?lecplay=1`);
  assert.equal(database.videos[0].watched, true);
  assert.equal(database.videos[0].id, 5);
});

test('a page without lectures fails explicitly rather than returning success with zero videos', async (context) => {
  const { service, database } = mockService(context, '<h3>Sign In</h3>');
  await assert.rejects(service.scrapeVideosForCourse(course), /No lectures found/);
  assert.equal(database.videos.length, 0);
});

test('insert failures roll back the batch and do not return success', async (context) => {
  const { service, database, link } = mockService(context, lecturePage(2), [], 2);
  await assert.rejects(service.scrapeVideosForCourse(course), /Insert failed/);
  assert.equal(database.videos.length, 0);
  assert.equal(link.mock.callCount(), 0);
});

test('HTTP errors do not report successful empty imports', async (context) => {
  const { service } = mockService(context, '');
  context.mock.method(global, 'fetch', async () => ({
    ok: false, status: 403, statusText: 'Forbidden'
  }));
  await assert.rejects(service.scrapeVideosForCourse(course), /403 Forbidden/);
});
