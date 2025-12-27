import { format, parseISO, isValid } from 'date-fns';
import { DATE_FORMATS } from './constants';

/**
 * Format date for display
 */
export const formatDate = (date, formatString = DATE_FORMATS.DISPLAY_DATE) => {
  if (!date) return '';
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  if (!isValid(parsedDate)) return '';
  
  return format(parsedDate, formatString);
};

/**
 * Format time for display (UTC-aware to avoid timezone conversion)
 */
export const formatTime = (time, formatString = DATE_FORMATS.DISPLAY_TIME) => {
  if (!time) return '';

  try {
    const date = typeof time === 'string' ? new Date(time) : time;

    if (!isValid(date)) return '';

    // Use UTC methods to avoid local timezone conversion for shift times
    if (typeof time === 'string' && time.includes('T') && time.includes('Z')) {
      // This is likely a shift datetime - keep in UTC
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();

      if (formatString === DATE_FORMATS.DISPLAY_TIME) {
        // Convert to 12-hour format
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const displayMinutes = minutes.toString().padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${period}`;
      } else {
        // For other formats, use UTC values
        const utcHours = hours.toString().padStart(2, '0');
        const utcMinutes = minutes.toString().padStart(2, '0');
        return formatString.replace('HH', utcHours).replace('mm', utcMinutes);
      }
    }

    // For non-shift times (like attendance logs), use local timezone
    return format(date, formatString);
  } catch (error) {
    return time;
  }
};

/**
 * Format datetime for display
 */
export const formatDateTime = (datetime, formatString = DATE_FORMATS.DISPLAY_DATETIME) => {
  if (!datetime) return '';
  
  const parsedDateTime = typeof datetime === 'string' ? parseISO(datetime) : datetime;
  
  if (!isValid(parsedDateTime)) return '';
  
  return format(parsedDateTime, formatString);
};

/**
 * Format duration in hours and minutes
 */
export const formatDuration = (hours) => {
  if (!hours || hours === 0) return '0h 0m';

  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;
};

/**
 * Format duration in hours and minutes (compact version for single values)
 */
export const formatDurationCompact = (hours) => {
  if (!hours || hours === 0) return '0h';

  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;
};

/**
 * Calculate duration between two dates in hours
 */
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  let end = typeof endTime === 'string' ? parseISO(endTime) : endTime;

  if (!isValid(start) || !isValid(end)) return 0;

  // Handle overnight shifts - if end time is earlier than start time,
  // it means the shift crosses midnight and end time is the next day
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000); // Add 24 hours
  }

  const diffMs = end - start;
  return diffMs / (1000 * 60 * 60); // Convert to hours
};

/**
 * Check if a shift is overtime (>8 hours)
 */
export const isOvertime = (hours) => {
  return hours > 8;
};

/**
 * Get status color class
 */
export const getStatusColor = (status) => {
  const statusColors = {
    'CLOCKED_IN': 'bg-green-100 text-green-800',
    'CLOCKED_OUT': 'bg-gray-100 text-gray-800',
    'ON_BREAK': 'bg-yellow-100 text-yellow-800',
    'BACK_FROM_BREAK': 'bg-blue-100 text-blue-800',
    'ACTIVE': 'bg-green-100 text-green-800',
    'INACTIVE': 'bg-gray-100 text-gray-800',
    'TERMINATED': 'bg-red-100 text-red-800',
    'ON_LEAVE': 'bg-yellow-100 text-yellow-800',
  };
  
  return statusColors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    'EMPLOYEE': 'Employee',
    'DRIVER': 'Driver',
    'ADMIN': 'Administrator',
    'SUPER_ADMIN': 'Super Administrator',
  };
  
  return roleNames[role] || role;
};

/**
 * Validate employee ID format
 */
export const validateEmployeeId = (employeeId) => {
  if (!employeeId) return false;
  
  const pattern = /^[A-Z0-9-]+$/;
  return pattern.test(employeeId) && employeeId.length >= 3 && employeeId.length <= 20;
};

/**
 * Validate phone number format
 */
export const validatePhoneNumber = (phone) => {
  if (!phone) return true; // Phone is optional
  
  const pattern = /^\+?1?\d{9,15}$/;
  return pattern.test(phone.replace(/\s/g, ''));
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
};

/**
 * Generate QR code data URL
 */
export const generateQRCode = async (text) => {
  try {
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(text, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return null;
  }
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Check if user has permission
 */
export const hasPermission = (user, permission) => {
  if (!user || !user.employee_profile) return false;
  
  const role = user.employee_profile.role;
  
  // Super admin has all permissions
  if (role === 'SUPER_ADMIN') return true;
  
  // Admin has most permissions
  if (role === 'ADMIN') {
    const adminPermissions = [
      'view_employees',
      'view_attendance',
      'manage_schedules',
      'view_reports',
    ];
    return adminPermissions.includes(permission);
  }
  
  // Regular employees have limited permissions
  const employeePermissions = [
    'view_own_attendance',
    'clock_in_out',
    'view_own_schedule',
  ];
  
  return employeePermissions.includes(permission);
};

/**
 * Get current location
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
};

/**
 * Calculate distance between two coordinates (in meters)
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in meters
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
