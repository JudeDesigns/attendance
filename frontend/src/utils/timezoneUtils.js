/**
 * Timezone utilities for WorkSync
 * 
 * The application uses America/Los_Angeles (PST/PDT) as the canonical timezone.
 * All dates sent to the backend should be in PST, not the user's local timezone.
 */

/**
 * Get the current date in PST timezone as a string in 'yyyy-MM-dd' format
 * This ensures that "today" means "today in Los Angeles", not "today in user's timezone"
 * 
 * @returns {string} Date string in 'yyyy-MM-dd' format (PST timezone)
 */
export const getPSTDateString = () => {
  // Create a date in PST timezone
  const pstDate = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  // Parse the MM/DD/YYYY format and convert to YYYY-MM-DD
  const [month, day, year] = pstDate.split(',')[0].split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/**
 * Get the current datetime in PST timezone
 * 
 * @returns {Date} Date object representing current time in PST
 */
export const getPSTDate = () => {
  const pstString = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles'
  });
  return new Date(pstString);
};

/**
 * Format a date for display in PST timezone
 * 
 * @param {Date|string} date - Date to format
 * @param {string} formatString - Format string (e.g., 'EEEE, MMMM do, yyyy')
 * @returns {string} Formatted date string
 */
export const formatPSTDate = (date, formatString) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Convert to PST
  const pstString = dateObj.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles'
  });
  const pstDate = new Date(pstString);

  // Use date-fns format on the PST date
  const { format } = require('date-fns');
  return format(pstDate, formatString);
};

/**
 * Get start and end of day in PST timezone as ISO strings
 * 
 * @param {Date|string} date - Date to get start/end for (optional, defaults to today PST)
 * @returns {{start: string, end: string}} ISO strings for start and end of day in PST
 */
export const getPSTDayRange = (date = null) => {
  const targetDate = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();

  // Get the date string in PST
  const pstDateString = targetDate.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const [month, day, year] = pstDateString.split(',')[0].split('/');
  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  return {
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T23:59:59`
  };
};

/**
 * Convert a date string from user's local timezone to PST date string
 * 
 * @param {string} localDateString - Date string in 'yyyy-MM-dd' format (local timezone)
 * @returns {string} Date string in 'yyyy-MM-dd' format (PST timezone)
 */
export const convertLocalDateToPST = (localDateString) => {
  const localDate = new Date(localDateString);
  return getPSTDateString(localDate);
};

/**
 * Get the current time display string in PST
 * 
 * @returns {string} Formatted time string (e.g., "3:20 PM PST")
 */
export const getPSTTimeString = () => {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
};

/**
 * Check if a given date is "today" in PST timezone
 * 
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if the date is today in PST
 */
export const isPSTToday = (date) => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const todayPST = getPSTDateString();
  const datePST = dateObj.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [month, day, year] = datePST.split(',')[0].split('/');
  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  return dateStr === todayPST;
};

/**
 * Parse a naive PST/PDT datetime string from the backend.
 * Backend sends strings like "2026-01-28 08:47:00" or "2026-01-28T08:47:00"
 * These represent Los Angeles local time but have NO timezone indicator.
 *
 * @param {string} dtString - Naive datetime string in PST/PDT
 * @returns {Date|null} Proper Date object (UTC-adjusted)
 */
export const parsePSTDateTime = (dtString) => {
  if (!dtString) return null;

  // If it already has an explicit timezone (Z or ±HH:MM) parse directly
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dtString.trim())) {
    return new Date(dtString);
  }

  // Naive string — extract components and append correct LA offset
  const parts = dtString.match(/(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2}):(\d{2})/);
  if (!parts) return null;
  const [, year, month, day, hour, minute, second] = parts;
  // America/Los_Angeles: UTC-8 (PST) Nov–Mar, UTC-7 (PDT) Mar–Nov
  const monthNum = parseInt(month);
  const offset = (monthNum >= 3 && monthNum <= 10) ? '-07:00' : '-08:00';
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
};

/**
 * Format any date value for display in America/Los_Angeles timezone.
 * Accepts a Date, an ISO string (with timezone), or a naive PST string from the backend.
 *
 * @param {Date|string} dateValue - The value to format
 * @param {object} options - Intl.DateTimeFormat options (default: 'h:mm a')
 * @returns {string} Formatted string in PST/PDT
 */
export const formatInPST = (dateValue, options = {}) => {
  if (!dateValue) return '-';
  let dateObj;
  if (typeof dateValue === 'string') {
    // Try parsePSTDateTime first (handles naive + ISO strings)
    dateObj = /Z$|[+-]\d{2}:\d{2}$/.test(dateValue.trim())
      ? new Date(dateValue)
      : parsePSTDateTime(dateValue);
  } else {
    dateObj = dateValue;
  }
  if (!dateObj || isNaN(dateObj.getTime())) return '-';

  const defaultOptions = {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  };
  return dateObj.toLocaleString('en-US', defaultOptions);
};

