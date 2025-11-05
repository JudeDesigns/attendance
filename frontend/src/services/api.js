import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post('/api/v1/auth/refresh/', {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('token', access);
          originalRequest.headers.Authorization = `Bearer ${access}`;

          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Export the main API instance
export { api };

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login/', credentials),
  refresh: (refreshToken) => api.post('/auth/refresh/', { refresh: refreshToken }),
  verify: (token) => api.post('/auth/verify/', { token }),
  profile: () => api.get('/auth/profile/'),
};

// Employee API
export const employeeAPI = {
  list: (params) => api.get('/employees/', { params }),
  get: (id) => api.get(`/employees/${id}/`),
  create: (data) => api.post('/employees/', data),
  update: (id, data) => api.put(`/employees/${id}/`, data),
  delete: (id) => api.delete(`/employees/${id}/`),
  me: () => api.get('/employees/me/'),
  status: (employeeId) => api.get(`/employees/${employeeId}/status/`),
  activate: (id) => api.post(`/employees/${id}/activate/`),
  deactivate: (id) => api.post(`/employees/${id}/deactivate/`),
  terminate: (id) => api.post(`/employees/${id}/terminate/`),
  statistics: () => api.get('/employees/statistics/'),
  getRoles: () => api.get('/roles/'),

  // QR Code endpoints removed - individual employee QR codes no longer supported
};

// Attendance API
export const attendanceAPI = {
  clockIn: (data) => api.post('/attendance/logs/clock_in/', data),
  clockOut: (data) => api.post('/attendance/logs/clock_out/', data),
  timeLogs: (params) => api.get('/attendance/logs/', { params }),
  currentStatus: () => api.get('/attendance/logs/current_status/'),
  getCurrentStatus: () => api.get('/attendance/logs/current_status/'),
  myLogs: (params) => api.get('/attendance/logs/my_logs/', { params }),
  qrScan: (data) => api.post('/attendance/logs/qr_scan/', data),
  summary: (params) => api.get('/attendance/logs/summary/', { params }),
  statistics: () => api.get('/attendance/logs/statistics/'),
  qrEnforcementStatus: () => api.get('/attendance/logs/qr_enforcement_status/'),
  shiftStatus: () => api.get('/attendance/logs/shift_status/'),

  // Break management
  breaks: (params) => api.get('/attendance/breaks/', { params }),
  startBreak: (data) => api.post('/attendance/breaks/', data),
  endBreak: (id) => api.patch(`/attendance/breaks/${id}/`, { end_time: new Date().toISOString() }),

  // Break compliance endpoints
  get: (endpoint) => api.get(`/attendance${endpoint}`),
  post: (endpoint, data) => api.post(`/attendance${endpoint}`, data),

  exportEmployee: (params) => api.get('/attendance/logs/export/', { params, responseType: 'blob' }),
};

// Scheduling API
export const schedulingAPI = {
  list: (params) => api.get('/scheduling/shifts/', { params }),
  get: (id) => api.get(`/scheduling/shifts/${id}/`),
  create: (data) => api.post('/scheduling/shifts/', data),
  update: (id, data) => api.put(`/scheduling/shifts/${id}/`, data),
  delete: (id) => api.delete(`/scheduling/shifts/${id}/`),
  mySchedule: (params) => api.get('/scheduling/shifts/my_schedule/', { params }),
  bulkCreate: (data) => api.post('/scheduling/shifts/bulk_create/', data),
  importSpreadsheet: (data) => api.post('/scheduling/shifts/import_spreadsheet/', data),

  // Shift Templates
  getShiftTemplates: (params) => api.get('/scheduling/templates/', { params }),
  getShiftTemplate: (id) => api.get(`/scheduling/templates/${id}/`),
  createShiftTemplate: (data) => api.post('/scheduling/templates/', data),
  updateShiftTemplate: (id, data) => api.put(`/scheduling/templates/${id}/`, data),
  deleteShiftTemplate: (id) => api.delete(`/scheduling/templates/${id}/`),

  // Legacy aliases for backward compatibility
  shifts: (params) => api.get('/scheduling/shifts/', { params }),
  createShift: (data) => api.post('/scheduling/shifts/', data),
  updateShift: (id, data) => api.put(`/scheduling/shifts/${id}/`, data),
  deleteShift: (id) => api.delete(`/scheduling/shifts/${id}/`),
  bulkCreateShifts: (data) => api.post('/scheduling/shifts/bulk_create/', data),

  // Leave Management
  // Leave Types
  getLeaveTypes: (params = {}) => api.get('/scheduling/leave-types/', { params }),
  getLeaveType: (id) => api.get(`/scheduling/leave-types/${id}/`),
  createLeaveType: (data) => api.post('/scheduling/leave-types/', data),
  updateLeaveType: (id, data) => api.put(`/scheduling/leave-types/${id}/`, data),
  deleteLeaveType: (id) => api.delete(`/scheduling/leave-types/${id}/`),

  // Leave Balances
  getLeaveBalances: (params = {}) => api.get('/scheduling/leave-balances/', { params }),
  getMyLeaveBalances: () => api.get('/scheduling/leave-balances/my_balances/'),
  initializeLeaveBalances: (year) => api.post('/scheduling/leave-balances/initialize_balances/', { year }),
  createOrUpdateLeaveBalance: (data) => api.post('/scheduling/leave-balances/create_or_update_balance/', data),

  // Leave Requests
  getLeaveRequests: (params = {}) => api.get('/scheduling/leave-requests/', { params }),
  getMyLeaveRequests: (params = {}) => api.get('/scheduling/leave-requests/my_requests/', { params }),
  getPendingLeaveApprovals: () => api.get('/scheduling/leave-requests/pending_approvals/'),
  getLeaveRequest: (id) => api.get(`/scheduling/leave-requests/${id}/`),
  createLeaveRequest: (data) => api.post('/scheduling/leave-requests/', data),
  updateLeaveRequest: (id, data) => api.put(`/scheduling/leave-requests/${id}/`, data),
  deleteLeaveRequest: (id) => api.delete(`/scheduling/leave-requests/${id}/`),
  approveLeaveRequest: (id) => api.post(`/scheduling/leave-requests/${id}/approve/`),
  rejectLeaveRequest: (id, reason) => api.post(`/scheduling/leave-requests/${id}/reject/`, { reason }),
  cancelLeaveRequest: (id) => api.post(`/scheduling/leave-requests/${id}/cancel/`),
  getLeaveCalendar: (startDate, endDate) => api.get('/scheduling/leave-requests/calendar/', {
    params: { start_date: startDate, end_date: endDate }
  }),

  // Leave Workflows
  getLeaveWorkflows: (params = {}) => api.get('/scheduling/leave-workflows/', { params }),
  createLeaveWorkflow: (data) => api.post('/scheduling/leave-workflows/', data),
  updateLeaveWorkflow: (id, data) => api.put(`/scheduling/leave-workflows/${id}/`, data),
  deleteLeaveWorkflow: (id) => api.delete(`/scheduling/leave-workflows/${id}/`),
};

// Location API
export const locationAPI = {
  list: () => api.get('/locations/'),
  get: (id) => api.get(`/locations/${id}/`),
  create: (data) => api.post('/locations/', data),
  update: (id, data) => api.put(`/locations/${id}/`, data),
  delete: (id) => api.delete(`/locations/${id}/`),
};



export const reportsAPI = {
  // Report templates
  getTemplates: () => api.get('/reports/templates/'),
  getTemplate: (id) => api.get(`/reports/templates/${id}/`),
  createTemplate: (data) => api.post('/reports/templates/', data),
  updateTemplate: (id, data) => api.put(`/reports/templates/${id}/`, data),
  deleteTemplate: (id) => api.delete(`/reports/templates/${id}/`),

  // Report executions
  getExecutions: () => api.get('/reports/executions/'),
  getExecution: (id) => api.get(`/reports/executions/${id}/`),
  downloadReport: (id) => api.get(`/reports/executions/${id}/download/`, { responseType: 'blob' }),

  // Report generation
  generateReport: (data) => api.post('/reports/generate/', data),

  // Report data endpoints
  getLateArrivals: (params) => api.get('/reports/late_arrivals/', { params }),
  getOvertime: (params) => api.get('/reports/overtime/', { params }),
  getDepartmentSummary: (params) => api.get('/reports/department_summary/', { params }),
  getAttendanceSummary: (params) => api.get('/reports/attendance_summary/', { params }),

  // Report statistics
  getStats: () => api.get('/reports/stats/'),

  // Report schedules
  getSchedules: () => api.get('/reports/schedules/'),
  createSchedule: (data) => api.post('/reports/schedules/', data),
  updateSchedule: (id, data) => api.put(`/reports/schedules/${id}/`, data),
  deleteSchedule: (id) => api.delete(`/reports/schedules/${id}/`),
};

// Notification API
export const notificationAPI = {
  // Notification logs
  list: (params) => api.get('/notifications/', { params }),
  getLogs: (params) => api.get('/notifications/logs/', { params }),
  getMyNotifications: (params) => api.get('/notifications/logs/my_notifications/', { params }),
  markAsRead: (data) => api.post('/notifications/logs/mark_as_read/', data),
  markAllAsRead: () => api.post('/notifications/logs/mark_all_as_read/'),

  // Templates
  getTemplates: (params) => api.get('/notifications/templates/', { params }),
  getTemplate: (id) => api.get(`/notifications/templates/${id}/`),
  createTemplate: (data) => api.post('/notifications/templates/', data),
  updateTemplate: (id, data) => api.put(`/notifications/templates/${id}/`, data),
  deleteTemplate: (id) => api.delete(`/notifications/templates/${id}/`),

  // Statistics
  getStats: () => api.get('/notifications/management/statistics/'),

  // Webhooks
  webhooks: () => api.get('/notifications/webhooks/'),
  createWebhook: (data) => api.post('/notifications/webhooks/', data),
};

// Webhook API
export const webhookAPI = {
  // Endpoints
  getEndpoints: (params) => api.get('/webhooks/endpoints/', { params }),
  getEndpoint: (id) => api.get(`/webhooks/endpoints/${id}/`),
  createEndpoint: (data) => api.post('/webhooks/endpoints/', data),
  updateEndpoint: (id, data) => api.put(`/webhooks/endpoints/${id}/`, data),
  deleteEndpoint: (id) => api.delete(`/webhooks/endpoints/${id}/`),
  testEndpoint: (id, data) => api.post(`/webhooks/endpoints/${id}/test/`, data),
  getEndpointDeliveries: (id, params) => api.get(`/webhooks/endpoints/${id}/deliveries/`, { params }),
  retryFailedDeliveries: (id) => api.post(`/webhooks/endpoints/${id}/retry_failed/`),
  bulkAction: (data) => api.post('/webhooks/endpoints/bulk_action/', data),
  getStats: () => api.get('/webhooks/endpoints/stats/'),

  // Deliveries
  getDeliveries: (params) => api.get('/webhooks/deliveries/', { params }),
  getDelivery: (id) => api.get(`/webhooks/deliveries/${id}/`),
  retryDelivery: (id) => api.post(`/webhooks/deliveries/${id}/retry/`),

  // Events
  getEvents: (params) => api.get('/webhooks/events/', { params }),
  getEvent: (id) => api.get(`/webhooks/events/${id}/`),

  // Templates
  getTemplates: (params) => api.get('/webhooks/templates/', { params }),
  getTemplate: (id) => api.get(`/webhooks/templates/${id}/`),
  createTemplate: (data) => api.post('/webhooks/templates/', data),
  updateTemplate: (id, data) => api.put(`/webhooks/templates/${id}/`, data),
  deleteTemplate: (id) => api.delete(`/webhooks/templates/${id}/`),
  createEndpointFromTemplate: (id, data) => api.post(`/webhooks/templates/${id}/create_endpoint/`, data),
};

export default api;
