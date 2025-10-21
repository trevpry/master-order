/**
 * Response Utilities
 * Standardized response formatting to eliminate code duplication
 * 
 * Usage: Import required response functions and use instead of manual res.status().json()
 * Example: return sendBadRequest(res, 'Invalid parameters')
 */

/**
 * Send a standardized 400 Bad Request response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 */
const sendBadRequest = (res, message) => {
  return res.status(400).json({ error: message });
};

/**
 * Send a standardized 401 Unauthorized response
 * @param {Response} res - Express response object
 * @param {string} message - Error message (optional)
 */
const sendUnauthorized = (res, message = 'Unauthorized') => {
  return res.status(401).json({ error: message });
};

/**
 * Send a standardized 403 Forbidden response
 * @param {Response} res - Express response object
 * @param {string} message - Error message (optional)
 */
const sendForbidden = (res, message = 'Forbidden') => {
  return res.status(403).json({ error: message });
};

/**
 * Send a standardized 404 Not Found response
 * @param {Response} res - Express response object
 * @param {string} message - Error message (optional)
 */
const sendNotFound = (res, message = 'Not found') => {
  return res.status(404).json({ error: message });
};

/**
 * Send a standardized 500 Internal Server Error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message (optional)
 */
const sendServerError = (res, message = 'Internal server error') => {
  return res.status(500).json({ error: message });
};

/**
 * Send a standardized 200 Success response with data
 * @param {Response} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message (optional)
 */
const sendSuccess = (res, data, message = null) => {
  // Serialize BigInt values to prevent JSON serialization errors
  const serializedData = serializeBigInt(data);
  
  const response = { success: true, data: serializedData };
  if (message) {
    response.message = message;
  }
  return res.status(200).json(response);
};

/**
 * Send a standardized 201 Created response
 * @param {Response} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Success message (optional)
 */
const sendCreated = (res, data, message = 'Created successfully') => {
  return res.status(201).json({ data, message });
};

/**
 * Send a standardized 204 No Content response
 * @param {Response} res - Express response object
 */
const sendNoContent = (res) => {
  return res.status(204).end();
};

/**
 * Catch-all error handler for async routes
 * Wraps route handlers to automatically catch and handle errors
 * @param {Function} fn - Async route handler function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Standardized error logger
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 */
const logError = (error, context = 'Unknown') => {
  console.error(`[${context}] Error:`, error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', error.stack);
  }
};

/**
 * Convert BigInt values to Numbers in an object for JSON serialization
 * Recursively handles nested objects and arrays
 * @param {any} obj - Object to convert
 * @returns {any} Object with BigInt values converted to Numbers
 */
const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item));
  }
  
  if (typeof obj === 'object') {
    const serialized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }
  
  return obj;
};

module.exports = {
  sendBadRequest,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendServerError,
  sendSuccess,
  sendCreated,
  sendNoContent,
  asyncHandler,
  logError,
  serializeBigInt
};
