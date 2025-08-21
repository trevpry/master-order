// Database utility functions with retry logic and concurrency control
const prisma = require('./prismaClient');

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,        // Increased from 3 to 5
  baseDelay: 2000,      // Increased from 1s to 2s base delay
  maxDelay: 15000       // Increased from 10s to 15s max delay
};

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Calculate exponential backoff delay
const getRetryDelay = (attempt) => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(2, attempt), 
    RETRY_CONFIG.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

// Generic retry wrapper for database operations
const withRetry = async (operation, operationName = 'database operation') => {
  let lastError = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry for non-timeout errors
      if (!error.message?.includes('timeout') && 
          !error.message?.includes('disk I/O error') &&
          !error.message?.includes('database is locked')) {
        throw error;
      }
      
      if (attempt === RETRY_CONFIG.maxRetries) {
        console.error(`❌ ${operationName} failed after ${RETRY_CONFIG.maxRetries + 1} attempts:`, error.message);
        throw error;
      }
      
      const delay = getRetryDelay(attempt);
      console.warn(`⚠️ ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

// Settings cache to reduce database queries
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 30000; // 30 seconds

// Get settings with caching and retry logic
const getSettings = async (useCache = true) => {
  const now = Date.now();
  
  // Return cached settings if fresh
  if (useCache && settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
    return settingsCache;
  }
  
  const settings = await withRetry(async () => {
    return await prisma.settings.findUnique({
      where: { id: 1 }
    });
  }, 'getSettings');
  
  // Cache the result
  if (settings) {
    settingsCache = settings;
    settingsCacheTime = now;
  }
  
  return settings;
};

// Update settings and invalidate cache
const updateSettings = async (data) => {
  const result = await withRetry(async () => {
    return await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { 
        id: 1, 
        ...data 
      }
    });
  }, 'updateSettings');
  
  // Invalidate cache
  settingsCache = null;
  settingsCacheTime = 0;
  
  return result;
};

// Clear settings cache (useful for testing or manual invalidation)
const clearSettingsCache = () => {
  settingsCache = null;
  settingsCacheTime = 0;
};

// Generic database query with retry
const queryWithRetry = async (queryFn, operationName) => {
  return await withRetry(queryFn, operationName);
};

module.exports = {
  getSettings,
  updateSettings,
  clearSettingsCache,
  withRetry,
  queryWithRetry,
  prisma
};
