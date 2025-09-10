/**
 * Performance Monitoring Middleware
 * Tracks API response times and identifies slow endpoints
 */

const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    
    // Log performance metrics
    const metrics = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      memoryUsed: `${Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024 * 100) / 100}MB`,
      timestamp: new Date().toISOString()
    };

    // Log slow requests (>1s)
    if (duration > 1000) {
      console.warn('🐌 [SLOW REQUEST]', metrics);
    } else if (duration > 500) {
      console.log('⚠️ [MODERATE REQUEST]', metrics);
    } else {
      console.log('⚡ [FAST REQUEST]', metrics);
    }

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
};

module.exports = performanceMonitor;
