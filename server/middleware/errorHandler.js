/**
 * Global Error Handling Middleware
 * Provides consistent error responses across all API endpoints
 */

const errorHandler = (err, req, res, next) => {
  console.error('🚨 [ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Prisma errors
  if (err.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Database validation error',
      details: err.message
    });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      error: 'Database error',
      details: err.message
    });
  }

  // Network/API errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'External service unavailable',
      details: err.message
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.message
    });
  }

  // Default error
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

module.exports = errorHandler;
