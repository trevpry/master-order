const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeGreatCoursesUrl, withNormalizedGreatCoursesUrl } = require('../utils/courseUrlValidation');

test('converts legacy lecture paths to the canonical lecplay format', () => {
  assert.equal(
    normalizeGreatCoursesUrl('https://www.thegreatcoursesplus.com/the-other-side-of-history-daily-life-in-the-ancient-world/lecture-31'),
    'https://plus.thegreatcourses.com/the-other-side-of-history-daily-life-in-the-ancient-world?lecplay=31'
  );
});

test('rewrites the legacy domain, trailing slashes and fragments while keeping other query params', () => {
  assert.equal(
    normalizeGreatCoursesUrl('http://www.thegreatcoursesplus.com/history-of-ancient-egypt/?source=library&lecplay=08#player'),
    'https://plus.thegreatcourses.com/history-of-ancient-egypt?source=library&lecplay=08'
  );
  assert.equal(
    normalizeGreatCoursesUrl('https://plus.thegreatcourses.com/history-of-ancient-egypt?lecplay=5'),
    'https://plus.thegreatcourses.com/history-of-ancient-egypt?lecplay=5'
  );
});

test('leaves unrelated or invalid URLs untouched', () => {
  const youtube = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const wondrium = 'https://www.wondrium.com/some-course/lecture-3';
  assert.equal(normalizeGreatCoursesUrl(youtube), youtube);
  assert.equal(normalizeGreatCoursesUrl(wondrium), wondrium);
  assert.equal(normalizeGreatCoursesUrl('not a url'), 'not a url');
  assert.equal(normalizeGreatCoursesUrl(null), null);
});

test('withNormalizedGreatCoursesUrl only copies records that change', () => {
  const unchanged = { id: 1, url: 'https://plus.thegreatcourses.com/example-course?lecplay=1' };
  assert.equal(withNormalizedGreatCoursesUrl(unchanged), unchanged);

  const legacy = { id: 2, title: 'Lecture 31', url: 'https://www.thegreatcoursesplus.com/example-course/lecture-31' };
  assert.deepEqual(withNormalizedGreatCoursesUrl(legacy), {
    id: 2,
    title: 'Lecture 31',
    url: 'https://plus.thegreatcourses.com/example-course?lecplay=31'
  });

  assert.equal(withNormalizedGreatCoursesUrl(null), null);
});

test('normalizes legacy course URLs when building lecture links', () => {
  const { parseGreatCoursesLectures } = require('../services/parsers/GreatCoursesLectureParser');
  const videos = parseGreatCoursesLectures(
    '<div id="lectures-list"><div class="media"><div class="play-lecture" data-idx="2" data-title="02: Topic"></div></div></div>',
    { id: 1, title: 'Example', url: 'https://www.thegreatcoursesplus.com/example-course/lecture-31' }
  );
  assert.equal(videos[0].url, 'https://plus.thegreatcourses.com/example-course?lecplay=2');
});
