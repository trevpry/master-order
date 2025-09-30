// Test timestamp normalization
const VideoScraperService = require('./server/services/VideoScraperService');

const scraper = new VideoScraperService();

const testUrls = [
  'https://www.youtube.com/watch?v=I5LmdUlqHqI&t=130s',
  'https://www.youtube.com/watch?v=I5LmdUlqHqI',
  'https://youtu.be/I5LmdUlqHqI?t=130s',
  'https://youtu.be/I5LmdUlqHqI',
  'https://www.youtube.com/watch?v=I5LmdUlqHqI&t=2m10s',
  'https://www.youtube.com/watch?v=I5LmdUlqHqI&list=PLxyz&t=130s',
  'https://www.youtube.com/embed/I5LmdUlqHqI?t=130'
];

console.log('Testing YouTube URL normalization with timestamps:\n');

testUrls.forEach(url => {
  const normalized = scraper.normalizeYouTubeURL(url);
  console.log(`Original:   ${url}`);
  console.log(`Normalized: ${normalized}`);
  console.log('---');
});