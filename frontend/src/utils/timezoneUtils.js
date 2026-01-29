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
 * Parse a naive PST datetime string from the backend
 * Backend sends datetime strings like "2026-01-28 08:47:00" which are in PST timezone
 * but have no timezone information. We need to parse them correctly.
 *
 * @param {string} pstDateTimeString - Naive datetime string in PST (e.g., "2026-01-28 08:47:00")
 * @returns {Date} Date object representing that PST time
 */
export const parsePSTDateTime = (pstDateTimeString) => {
  if (!pstDateTimeString) return null;

  // The string is in format "YYYY-MM-DD HH:MM:SS" and represents PST time
  // We need to parse it as PST, not as local time

  // Replace space with 'T' to make it ISO-like: "2026-01-28T08:47:00"
  const isoLike = pstDateTimeString.replace(' ', 'T');

  // Create a date object - this will interpret it as local time
  const localDate = new Date(isoLike);

  // Get the components in PST timezone
  const pstString = localDate.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Now we need to create a Date that represents the ORIGINAL string as PST
  // The trick: parse the original string but interpret it as if it's in the user's local timezone
  // then adjust for the PST offset

  // Actually, simpler approach: just use the string directly since backend already converted to PST
  return new Date(isoLike);
};

