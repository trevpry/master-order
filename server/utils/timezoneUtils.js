/**
 * Timezone utility functions for date calculations
 */

/**
 * Get timezone-aware period boundaries
 * @param {string} period - Time period ('today', 'week', 'month', 'year')
 * @param {string} timezone - Timezone identifier (e.g., 'America/Los_Angeles')
 * @returns {Object} Object with startDate and endDate
 */
function getTimezoneAwarePeriodBounds(period, timezone) {
  const now = new Date();
  
  // Get "today" in the configured timezone
  const todayInTZ = now.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const [year, month, day] = todayInTZ.split('-').map(n => parseInt(n));
  
  let startDateInTZ, endDateInTZ;
  
  switch (period) {
    case 'today':
      startDateInTZ = `${todayInTZ}T00:00:00`;
      endDateInTZ = `${todayInTZ}T23:59:59.999`;
      break;
      
    case 'week':
      // Start of current week (Sunday) in timezone
      const todayDate = new Date(year, month - 1, day);
      const startOfWeek = new Date(todayDate);
      startOfWeek.setDate(day - todayDate.getDay());
      
      const weekStartStr = startOfWeek.toLocaleDateString('en-CA');
      startDateInTZ = `${weekStartStr}T00:00:00`;
      endDateInTZ = `${todayInTZ}T23:59:59.999`;
      break;
      
    case 'month':
      // Start of current month in timezone
      const monthStartStr = `${year}-${month.toString().padStart(2, '0')}-01`;
      startDateInTZ = `${monthStartStr}T00:00:00`;
      endDateInTZ = `${todayInTZ}T23:59:59.999`;
      break;
      
    case 'year':
      // Start of current year in timezone
      const yearStartStr = `${year}-01-01`;
      startDateInTZ = `${yearStartStr}T00:00:00`;
      endDateInTZ = `${todayInTZ}T23:59:59.999`;
      break;
      
    default:
      return { startDate: null, endDate: null };
  }
  
  // Convert timezone dates to UTC
  const startTzDate = new Date(`${startDateInTZ}`);
  const endTzDate = new Date(`${endDateInTZ}`);
  
  // Calculate timezone offset
  const testDate = new Date(`${todayInTZ}T12:00:00`);
  const utcTime = testDate.getTime();
  const tzTime = new Date(testDate.toLocaleString('en-US', { timeZone: timezone })).getTime();
  const offsetMs = utcTime - tzTime;
  
  const startDate = new Date(startTzDate.getTime() + offsetMs);
  const endDate = new Date(endTzDate.getTime() + offsetMs);
  
  return { startDate, endDate };
}

/**
 * Get timezone-aware date grouping for statistics
 * @param {Date} utcDate - UTC date to convert
 * @param {string} groupBy - Grouping type ('day', 'week', 'month', 'year')
 * @param {string} timezone - Timezone identifier
 * @returns {string} Formatted key for grouping
 */
function getTimezoneAwareDateGrouping(utcDate, groupBy, timezone) {
  // Convert the UTC timestamp to the configured timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(utcDate);
  const year = parseInt(parts.find(part => part.type === 'year').value);
  const month = parseInt(parts.find(part => part.type === 'month').value);
  const day = parseInt(parts.find(part => part.type === 'day').value);
  
  switch (groupBy) {
    case 'day':
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'week':
      const weekStart = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
      weekStart.setDate(day - weekStart.getDay());
      return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
    case 'month':
      return `${year}-${String(month).padStart(2, '0')}`;
    case 'year':
      return year.toString();
    default:
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
}

/**
 * Format date for display in the configured timezone
 * @param {string|Date} dateString - Date to format
 * @param {string} timezone - Timezone identifier
 * @returns {string} Formatted date string
 */
function formatDateInTimezone(dateString, timezone) {
  return new Date(dateString).toLocaleDateString('en-US', { timeZone: timezone });
}

module.exports = {
  getTimezoneAwarePeriodBounds,
  getTimezoneAwareDateGrouping,
  formatDateInTimezone
};
