// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Employee Roles
export const EMPLOYEE_ROLES = {
  EMPLOYEE: 'Employee',
  DRIVER: 'Driver',
  ADMIN: 'Administrator',
  SUPER_ADMIN: 'Super Administrator',
};

// Employment Status
export const EMPLOYMENT_STATUS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  TERMINATED: 'Terminated',
  ON_LEAVE: 'On Leave',
};

// Attendance Status
export const ATTENDANCE_STATUS = {
  CLOCKED_IN: 'Clocked In',
  ON_BREAK: 'On Break',
  BACK_FROM_BREAK: 'Back from Break',
  CLOCKED_OUT: 'Clocked Out',
};

// Clock Methods
export const CLOCK_METHODS = {
  PORTAL: 'Portal Button',
  QR_CODE: 'QR Code Scan',
  API: 'External API',
  ADMIN: 'Admin Override',
};

// Break Types
export const BREAK_TYPES = {
  LUNCH: 'Lunch Break',
  SHORT: 'Short Break',
  PERSONAL: 'Personal Break',
};

// Violation Types
export const VIOLATION_TYPES = {
  OVERTIME: 'Overtime Violation',
  MISSING_BREAK: 'Missing Break',
  LATE_ARRIVAL: 'Late Arrival',
  EARLY_DEPARTURE: 'Early Departure',
  MISSING_CLOCK_OUT: 'Missing Clock Out',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  SMS: 'SMS',
  EMAIL: 'Email',
  WEBHOOK: 'Webhook',
  PUSH: 'Push Notification',
};

// Webhook Events
export const WEBHOOK_EVENTS = {
  OVERTIME_THRESHOLD_REACHED: 'overtime.threshold.reached',
  ATTENDANCE_VIOLATION: 'attendance.violation',
  EMPLOYEE_CLOCKED_IN: 'employee.clocked_in',
  EMPLOYEE_CLOCKED_OUT: 'employee.clocked_out',
  BREAK_STARTED: 'break.started',
  BREAK_ENDED: 'break.ended',
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY_DATE: 'MMM d, yyyy',
  DISPLAY_TIME: 'h:mm a',
  DISPLAY_DATETIME: 'MMM d, yyyy h:mm a',
  API_DATE: 'yyyy-MM-dd',
  API_DATETIME: "yyyy-MM-dd'T'HH:mm:ss'Z'",
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
  THEME: 'theme',
};

// Query Keys
export const QUERY_KEYS = {
  EMPLOYEES: 'employees',
  EMPLOYEE_STATUS: 'employeeStatus',
  TIME_LOGS: 'timeLogs',
  SHIFTS: 'shifts',
  LOCATIONS: 'locations',
  NOTIFICATIONS: 'notifications',
  ATTENDANCE: 'attendance',
  BREAKS: 'breaks',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  CAMERA_ACCESS_DENIED: 'Camera access is required for QR code scanning.',
  LOCATION_ACCESS_DENIED: 'Location access was denied.',
  INVALID_QR_CODE: 'Invalid QR code. Please try again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CLOCK_IN_SUCCESS: 'Clocked in successfully!',
  CLOCK_OUT_SUCCESS: 'Clocked out successfully!',
  BREAK_START_SUCCESS: 'Break started successfully!',
  BREAK_END_SUCCESS: 'Break ended successfully!',
  PROFILE_UPDATE_SUCCESS: 'Profile updated successfully!',
  SETTINGS_SAVE_SUCCESS: 'Settings saved successfully!',
};

// Validation Rules
export const VALIDATION_RULES = {
  EMPLOYEE_ID: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 20,
    PATTERN: /^[A-Z0-9-]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
  },
  PHONE: {
    PATTERN: /^\+?1?\d{9,15}$/,
  },
};

// Theme Colors
export const THEME_COLORS = {
  PRIMARY: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  DANGER: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
};
