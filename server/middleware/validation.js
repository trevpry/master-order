/**
 * Validation Middleware Collection
 * Modular validation functions to eliminate code duplication across routes
 * 
 * Usage: Import required validators and use as middleware functions
 * Example: router.post('/api/endpoint', validateMediaType, validateTitle, handler)
 */

/**
 * Validates that mediaType and title are present in request body
 * Returns 400 error if validation fails
 */
const validateMediaTypeAndTitle = (req, res, next) => {
  const { mediaType, title } = req.body;
  
  if (!mediaType || !title) {
    return res.status(400).json({ error: 'mediaType and title are required' });
  }
  
  next();
};

/**
 * Validates that required fields are present (flexible field validation)
 * @param {string|Array} fields - Field name(s) to validate
 * @param {string} errorMessage - Custom error message
 */
const validateRequiredFields = (fields, errorMessage) => {
  return (req, res, next) => {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    const missing = fieldsArray.filter(field => !req.body[field] && !req.query[field] && !req.params[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({ error: errorMessage });
    }
    
    next();
  };
};

/**
 * Validates media type for reading operations
 * Allows: book, comic, shortstory
 */
const validateReadingMediaType = (req, res, next) => {
  const { mediaType } = req.body;
  const validReadingTypes = ['book', 'comic', 'shortstory'];
  
  if (!validReadingTypes.includes(mediaType)) {
    return res.status(400).json({ error: 'Invalid media type for reading' });
  }
  
  next();
};

/**
 * Validates media type for viewing operations  
 * Allows: movie, episode, music, webvideo, standup
 */
const validateViewingMediaType = (req, res, next) => {
  const { mediaType } = req.body;
  const validViewingTypes = ['movie', 'episode', 'music', 'webvideo', 'standup'];
  
  if (!validViewingTypes.includes(mediaType)) {
    return res.status(400).json({ error: 'Invalid media type for viewing' });
  }
  
  next();
};

/**
 * Validates media type for episode/movie operations
 * Only allows: episode, movie
 */
const validateEpisodeMovieMediaType = (req, res, next) => {
  const { mediaType } = req.body;
  
  if (!['episode', 'movie'].includes(mediaType)) {
    return res.status(400).json({ error: 'Unsupported media type. Only episode and movie are supported.' });
  }
  
  next();
};

/**
 * Validates required fields for comic media type
 */
const validateComicFields = (req, res, next) => {
  const { mediaType, comicSeries, comicIssue } = req.body;
  
  if (mediaType === 'comic' && (!comicSeries || !comicIssue)) {
    return res.status(400).json({ error: 'For comics: comicSeries and comicIssue are required' });
  }
  
  next();
};

/**
 * Validates required fields for book media type
 */
const validateBookFields = (req, res, next) => {
  const { mediaType, bookTitle, bookAuthor } = req.body;
  
  if (mediaType === 'book' && (!bookTitle || !bookAuthor)) {
    return res.status(400).json({ error: 'For books: bookTitle and bookAuthor are required' });
  }
  
  next();
};

/**
 * Validates required fields for short story media type
 */
const validateShortStoryFields = (req, res, next) => {
  const { mediaType, storyTitle } = req.body;
  
  if (mediaType === 'shortstory' && !storyTitle) {
    return res.status(400).json({ error: 'For short stories: storyTitle is required' });
  }
  
  next();
};

/**
 * Validates required fields for web video media type
 */
const validateWebVideoFields = (req, res, next) => {
  const { mediaType, webTitle, webUrl } = req.body;
  
  if (mediaType === 'webvideo' && (!webTitle || !webUrl)) {
    return res.status(400).json({ error: 'For web videos: webTitle and webUrl are required' });
  }
  
  // Validate URL format if webUrl is provided
  if (webUrl) {
    try {
      new URL(webUrl);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid webUrl format' });
    }
  }
  
  next();
};

/**
 * Validates plexKey for media types that require it
 */
const validatePlexKeyForMediaType = (req, res, next) => {
  const { mediaType, plexKey } = req.body;
  const plexRequiredTypes = ['movie', 'episode', 'music'];
  
  if (plexRequiredTypes.includes(mediaType) && !plexKey) {
    return res.status(400).json({ error: 'plexKey is required for this media type' });
  }
  
  next();
};

/**
 * Validates URL format for imgur galleries
 */
const validateImgurGalleryUrl = (req, res, next) => {
  const { url } = req.body;
  
  if (url && !url.match(/^https?:\/\/(www\.)?imgur\.com\/a\/[a-zA-Z0-9]+$/)) {
    return res.status(400).json({ error: 'Invalid imgur gallery URL format' });
  }
  
  next();
};

/**
 * Validates general gallery URL format
 */
const validateGalleryUrl = (req, res, next) => {
  const { url } = req.body;
  
  if (url && !url.match(/^https?:\/\/.+/)) {
    return res.status(400).json({ error: 'Invalid gallery URL format' });
  }
  
  next();
};

/**
 * Composite validator for complete custom order item validation
 * Combines all media-type specific validations
 */
const validateCustomOrderItem = [
  validateMediaTypeAndTitle,
  validateComicFields,
  validateBookFields,
  validateShortStoryFields,
  validateWebVideoFields,
  validatePlexKeyForMediaType
];

/**
 * Composite validator for reading operations
 */
const validateReadingOperation = [
  validateMediaTypeAndTitle,
  validateReadingMediaType
];

/**
 * Composite validator for viewing operations
 */
const validateViewingOperation = [
  validateMediaTypeAndTitle,
  validateViewingMediaType
];

module.exports = {
  // Individual validators
  validateMediaTypeAndTitle,
  validateRequiredFields,
  validateReadingMediaType,
  validateViewingMediaType,
  validateEpisodeMovieMediaType,
  validateComicFields,
  validateBookFields,
  validateShortStoryFields,
  validateWebVideoFields,
  validatePlexKeyForMediaType,
  validateImgurGalleryUrl,
  validateGalleryUrl,
  
  // Composite validators
  validateCustomOrderItem,
  validateReadingOperation,
  validateViewingOperation
};
