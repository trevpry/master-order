/**
 * Timezone utilities for consistent date handling across the application
 * Fetches timezone from Eddie Settings and provides timezone-aware date functions
 */

import config from '../config';

let cachedTimezone = null;
let eddieSettings = null;
let lastFetch = 0;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Fetch Eddie Settings including timezone
 */
const fetchEddieSettings = async () => {
  try {
    const response = await fetch(`${config.apiBaseUrl}/api/settings/eddie`);
    if (!response.ok) throw new Error('Failed to fetch Eddie settings');
    const data = await response.json();
    eddieSettings = data;
    cachedTimezone = data.timezone || 'UTC';
    return data;
  } catch (err) {
    console.error('Error fetching Eddie settings:', err);
    cachedTimezone = 'UTC'; // fallback
    return { timezone: 'UTC' };
  }
};

/**
 * Get the current timezone from Eddie Settings
 * @returns {Promise<string>} The timezone string (e.g., 'America/New_York')
 */
export const getTimezone = async () => {
  // Check if we need to refresh the cache
  const now = Date.now();
  if (cachedTimezone && (now - lastFetch) < CACHE_DURATION) {
    return cachedTimezone;
  }
  
  // Fetch fresh timezone
  const settings = await fetchEddieSettings();
  lastFetch = now;
  return settings.timezone || 'UTC';
};

/**
 * Force refresh the timezone cache
 */
export const refreshTimezone = () => {
  cachedTimezone = null;
  lastFetch = 0;
};

/**
 * Get the current timezone synchronously (uses cached value)
 * @returns {string} The timezone string, defaults to 'UTC' if not cached
 */
export const getTimezoneSync = () => {
  return cachedTimezone || 'UTC';
};

/**
 * Initialize timezone cache on module load
 */
export const initializeTimezone = async () => {
  await fetchEddieSettings();
};

/**
 * Format a date using the Eddie Settings timezone
 * @param {string|Date} dateInput - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {Promise<string>} Formatted date string
 */
export const formatDateWithTimezone = async (dateInput, options = {}) => {
  const timezone = await getTimezone();
  const date = new Date(dateInput);
  
  const defaultOptions = {
    timeZone: timezone,
    ...options
  };
  
  return date.toLocaleDateString('en-US', defaultOptions);
};

/**
 * Format a date and time using the Eddie Settings timezone
 * @param {string|Date} dateInput - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {Promise<string>} Formatted date and time string
 */
export const formatDateTimeWithTimezone = async (dateInput, options = {}) => {
  const timezone = await getTimezone();
  const date = new Date(dateInput);
  
  const defaultOptions = {
    timeZone: timezone,
    ...options
  };
  
  return date.toLocaleString('en-US', defaultOptions);
};

/**
 * Get current date in the Eddie Settings timezone
 * @returns {Promise<Date>} Current date
 */
export const getCurrentDate = async () => {
  const timezone = await getTimezone();
  const now = new Date();
  
  // Create a date in the specified timezone
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  
  // Get timezone offset for the target timezone
  const tempDate = new Date();
  const targetDate = new Date(tempDate.toLocaleString('en-US', { timeZone: timezone }));
  const localDate = new Date(tempDate.toLocaleString('en-US'));
  const diff = localDate.getTime() - targetDate.getTime();
  
  return new Date(utc + diff);
};

/**
 * Get today's date string in YYYY-MM-DD format using Eddie Settings timezone
 * @returns {Promise<string>} Today's date in YYYY-MM-DD format
 */
export const getTodayDateString = async () => {
  const timezone = await getTimezone();
  console.log('getTodayDateString: Using timezone:', timezone);
  
  // Use Intl.DateTimeFormat for more reliable timezone handling
  const now = new Date();
  console.log('getTodayDateString: Current time:', now.toString());
  
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const dateString = formatter.format(now);
  console.log('getTodayDateString: Formatted date:', dateString);
  return dateString;
};

/**
 * Check if two dates are the same day in the Eddie Settings timezone
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {Promise<boolean>} True if same day
 */
export const isSameDay = async (date1, date2) => {
  const timezone = await getTimezone();
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const d1InTimezone = new Date(d1.toLocaleString('en-US', { timeZone: timezone }));
  const d2InTimezone = new Date(d2.toLocaleString('en-US', { timeZone: timezone }));
  
  return d1InTimezone.toDateString() === d2InTimezone.toDateString();
};

// Initialize timezone cache when module loads
initializeTimezone();