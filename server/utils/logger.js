/**
 * Performance-optimized logging utility
 * Reduces console.log overhead in production
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isDebug = process.env.DEBUG === 'true';

// Create optimized logging functions
const logger = {
  info: isDevelopment ? console.log : () => {},
  warn: console.warn, // Always show warnings
  error: console.error, // Always show errors
  debug: isDevelopment || isDebug ? console.log : () => {},
  
  // Specific loggers for different components
  api: isDevelopment ? (...args) => console.log('🌐 [API]', ...args) : () => {},
  database: isDevelopment ? (...args) => console.log('🗄️ [DB]', ...args) : () => {},
  background: isDevelopment ? (...args) => console.log('📸 [BG]', ...args) : () => {},
  stash: isDevelopment ? (...args) => console.log('🎬 [STASH]', ...args) : () => {},
  plex: isDevelopment ? (...args) => console.log('📺 [PLEX]', ...args) : () => {},
  performance: isDevelopment || isDebug ? (...args) => console.log('⚡ [PERF]', ...args) : () => {},
  
  // Always log critical startup information
  startup: console.log,
  critical: console.error
};

// Performance tracking utilities
const performance = {
  timers: new Map(),
  
  start: (label) => {
    if (isDevelopment || isDebug) {
      logger.timers.set(label, Date.now());
    }
  },
  
  end: (label) => {
    if (isDevelopment || isDebug) {
      const start = logger.timers.get(label);
      if (start) {
        const duration = Date.now() - start;
        logger.performance(`${label}: ${duration}ms`);
        logger.timers.delete(label);
      }
    }
  },
  
  measure: (label, fn) => {
    if (isDevelopment || isDebug) {
      const start = Date.now();
      const result = fn();
      const duration = Date.now() - start;
      logger.performance(`${label}: ${duration}ms`);
      return result;
    }
    return fn();
  },
  
  measureAsync: async (label, fn) => {
    if (isDevelopment || isDebug) {
      const start = Date.now();
      const result = await fn();
      const duration = Date.now() - start;
      logger.performance(`${label}: ${duration}ms`);
      return result;
    }
    return await fn();
  }
};

module.exports = { logger, performance };
