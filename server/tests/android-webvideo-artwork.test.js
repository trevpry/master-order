const test = require('node:test');
const assert = require('node:assert/strict');
const { getAndroidArtworkUrl, getYouTubeThumbnailUrl } = require('../routes/android/utilities/androidHelpers');

const BASE = 'http://server:3001';

test('YouTube URLs in every common form map to the video thumbnail', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=10',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
  ]) {
    assert.equal(getYouTubeThumbnailUrl(url), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', url);
  }
  for (const url of [null, '', 'https://vimeo.com/123', 'https://notyoutube.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(getYouTubeThumbnailUrl(url), null, String(url));
  }
});

test('Android web video artwork prefers cached artwork, then the YouTube thumbnail', () => {
  assert.equal(
    getAndroidArtworkUrl({ type: 'webvideo', webUrl: 'https://youtu.be/dQw4w9WgXcQ' }, BASE),
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  );
  assert.equal(
    getAndroidArtworkUrl({ type: 'webvideo', webUrl: 'https://youtu.be/dQw4w9WgXcQ', localArtworkPath: 'artwork\\web-1.jpg' }, BASE),
    `${BASE}/api/artwork/web-1.jpg`
  );
  assert.equal(getAndroidArtworkUrl({ type: 'webvideo', webUrl: 'https://example.com/video.mp4' }, BASE), null);
});
