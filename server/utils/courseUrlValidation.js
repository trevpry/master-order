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

module.exports = {
  SUPPORTED_GREAT_COURSES_DOMAINS,
  isSupportedGreatCoursesUrl,
  getGreatCoursesAnchorSelectors
};
