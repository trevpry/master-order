const SUPPORTED_GREAT_COURSES_DOMAINS = [
  'thegreatcoursesplus.com',
  'thegreatcourses.com',
  'wondrium.com'
];

function normalizeHostname(inputUrl) {
  const hostname = new URL(inputUrl).hostname.toLowerCase();
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

function isSupportedGreatCoursesUrl(inputUrl) {
  try {
    const hostname = normalizeHostname(inputUrl);
    return SUPPORTED_GREAT_COURSES_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch (_error) {
    return false;
  }
}

function getGreatCoursesAnchorSelectors() {
  return SUPPORTED_GREAT_COURSES_DOMAINS.map(domain => `a[href*="${domain}"]`);
}

const GREAT_COURSES_CANONICAL_HOST = 'plus.thegreatcourses.com';
const GREAT_COURSES_REWRITABLE_DOMAINS = ['thegreatcoursesplus.com', 'thegreatcourses.com'];
const GREAT_COURSES_LECTURE_PATH = /\/lecture[-_]?(\d+)\/*$/i;

/**
 * Rewrites legacy Great Courses Plus URLs into the current canonical format.
 * https://www.thegreatcoursesplus.com/some-course/lecture-31
 *   -> https://plus.thegreatcourses.com/some-course?lecplay=31
 */
function normalizeGreatCoursesUrl(inputUrl) {
  if (typeof inputUrl !== 'string' || inputUrl.trim() === '') {
    return inputUrl;
  }

  let url;
  try {
    url = new URL(inputUrl.trim());
  } catch (_error) {
    return inputUrl;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const isRewritable = GREAT_COURSES_REWRITABLE_DOMAINS.some(domain =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isRewritable) {
    return inputUrl;
  }

  const lectureMatch = url.pathname.match(GREAT_COURSES_LECTURE_PATH);
  if (lectureMatch) {
    url.pathname = url.pathname.slice(0, lectureMatch.index);
    url.searchParams.set('lecplay', String(Number(lectureMatch[1])));
  }

  url.protocol = 'https:';
  url.hostname = GREAT_COURSES_CANONICAL_HOST;
  url.port = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');

  return url.toString();
}

/**
 * Returns a copy of a record with its `url` field normalized.
 */
function withNormalizedGreatCoursesUrl(record) {
  if (!record || typeof record !== 'object' || typeof record.url !== 'string') {
    return record;
  }

  const normalized = normalizeGreatCoursesUrl(record.url);
  return normalized === record.url ? record : { ...record, url: normalized };
}

module.exports = {
  SUPPORTED_GREAT_COURSES_DOMAINS,
  GREAT_COURSES_CANONICAL_HOST,
  isSupportedGreatCoursesUrl,
  getGreatCoursesAnchorSelectors,
  normalizeGreatCoursesUrl,
  withNormalizedGreatCoursesUrl
};
