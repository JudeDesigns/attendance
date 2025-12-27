/**
 * Real-world UI scenario tests for WorkSync frontend.
 * 
 * These tests simulate actual user interactions and workflows
 * to ensure the frontend behaves correctly under realistic conditions.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { WebSocketProvider } from '../contexts/WebSocketContext';

// Import components to test
import ClockIn from '../pages/ClockIn';
import TimeTracking from '../pages/TimeTracking';
import LeaveManagement from '../pages/LeaveManagement';
import AssetManagement from '../pages/AssetManagement';
import Reports from '../pages/Reports';
import AdminDashboard from '../pages/AdminDashboard';

// Mock API responses
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Test utilities
const createTestWrapper = (initialAuth = null) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider initialAuth={initialAuth}>
          <WebSocketProvider>
            {children}
          </WebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Mock server for API responses
const server = setupServer(
  // Authentication endpoints
  rest.post('/api/auth/login/', (req, res, ctx) => {
    return res(
      ctx.json({
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
        user: {
          id: 1,
          username: 'test@company.com',
          first_name: 'Test',
          last_name: 'User',
          employee_profile: {
            id: 1,
            employee_id: 'EMP001',
            role: 'EMPLOYEE',
            employment_status: 'ACTIVE'
          }
        }
      })
    );
  }),

  // Clock-in endpoint
  rest.post('/api/attendance/clock-in/', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 1,
        employee: 1,
        clock_in_time: new Date().toISOString(),
        location: 1,
        notes: 'Clocked in successfully'
      })
    );
  }),

  // Time logs endpoint
  rest.get('/api/attendance/time-logs/', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [
          {
            id: 1,
            employee: 1,
            clock_in_time: '2024-01-15T09:00:00Z',
            clock_out_time: '2024-01-15T17:00:00Z',
            duration_hours: 8.0,
            location_name: 'Main Office',
            breaks: [
              {
                id: 1,
                start_time: '2024-01-15T12:00:00Z',
                end_time: '2024-01-15T13:00:00Z',
                break_type: 'LUNCH',
                duration_minutes: 60
              }
            ]
          }
        ]
      })
    );
  }),

  // Locations endpoint
  rest.get('/api/attendance/locations/', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [
          {
            id: 1,
            name: 'Main Office',
            address: '123 Business St',
            latitude: 40.7128,
            longitude: -74.0060,
            radius: 100
          }
        ]
      })
    );
  }),

  // Leave management endpoints
  rest.get('/api/scheduling/leave-types/', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [
          {
            id: 1,
            name: 'Vacation',
            display_name: 'Vacation Leave',
            max_days_per_year: 20,
            requires_approval: true
          }
        ]
      })
    );
  }),

  rest.get('/api/scheduling/my-leave-balances/', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 1,
          leave_type_name: 'Vacation Leave',
          total_allocated: 20,
          used_days: 5,
          available_days: 15,
          pending_days: 0
        }
      ])
    );
  }),

  // Asset management endpoints
  rest.get('/api/assets/assets/', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [
          {
            id: 1,
            asset_tag: 'LAPTOP-001',
            name: 'MacBook Pro 16"',
            category_name: 'Laptops',
            status: 'AVAILABLE',
            condition: 'EXCELLENT',
            assigned_to_name: null
          }
        ]
      })
    );
  }),

  rest.get('/api/assets/categories/', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [
          {
            id: 1,
            name: 'Laptops',
            description: 'Company laptops',
            asset_count: 5
          }
        ]
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Real-World Employee Workflows', () => {
  const mockEmployee = {
    user: {
      id: 1,
      username: 'employee@company.com',
      first_name: 'John',
      last_name: 'Doe'
    },
    employee_profile: {
      id: 1,
      employee_id: 'EMP001',
      role: 'EMPLOYEE',
      employment_status: 'ACTIVE'
    }
  };

  test('Complete daily clock-in workflow', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper(mockEmployee);

    render(
      <TestWrapper>
        <ClockIn />
      </TestWrapper>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/clock in/i)).toBeInTheDocument();
    });

    // Select location
    const locationSelect = screen.getByRole('combobox');
    await user.selectOptions(locationSelect, '1');

    // Add notes
    const notesInput = screen.getByPlaceholderText(/notes/i);
    await user.type(notesInput, 'Starting my workday!');

    // Click clock in button
    const clockInButton = screen.getByRole('button', { name: /clock in/i });
    await user.click(clockInButton);

    // Verify success message appears
    await waitFor(() => {
      expect(screen.getByText(/clocked in successfully/i)).toBeInTheDocument();
    });
  });

  test('Employee views time tracking history', async () => {
    const TestWrapper = createTestWrapper(mockEmployee);

    render(
      <TestWrapper>
        <TimeTracking />
      </TestWrapper>
    );

    // Wait for time logs to load
    await waitFor(() => {
      expect(screen.getByText(/time tracking/i)).toBeInTheDocument();
    });

    // Verify time log entry appears
    await waitFor(() => {
      expect(screen.getByText('Main Office')).toBeInTheDocument();
      expect(screen.getByText('8.0')).toBeInTheDocument(); // Duration hours
    });

    // Verify break information
    expect(screen.getByText(/lunch/i)).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument(); // Break duration
  });

  test('Employee submits leave request', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper(mockEmployee);

    // Mock leave request submission
    server.use(
      rest.post('/api/scheduling/leave-requests/', (req, res, ctx) => {
        return res(
          ctx.json({
            id: 1,
            leave_type: 1,
            start_date: '2024-02-15',
            end_date: '2024-02-16',
            days_requested: 2,
            status: 'PENDING',
            reason: 'Personal time off'
          })
        );
      })
    );

    render(
      <TestWrapper>
        <LeaveManagement />
      </TestWrapper>
    );

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/leave management/i)).toBeInTheDocument();
    });

    // Click "Request Leave" button
    const requestButton = screen.getByRole('button', { name: /request leave/i });
    await user.click(requestButton);

    // Fill out leave request form
    await waitFor(() => {
      expect(screen.getByText(/new leave request/i)).toBeInTheDocument();
    });

    // Select leave type
    const leaveTypeSelect = screen.getByLabelText(/leave type/i);
    await user.selectOptions(leaveTypeSelect, '1');

    // Set dates
    const startDateInput = screen.getByLabelText(/start date/i);
    await user.type(startDateInput, '2024-02-15');

    const endDateInput = screen.getByLabelText(/end date/i);
    await user.type(endDateInput, '2024-02-16');

    // Add reason
    const reasonInput = screen.getByLabelText(/reason/i);
    await user.type(reasonInput, 'Personal time off');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit request/i });
    await user.click(submitButton);

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/request submitted/i)).toBeInTheDocument();
    });
  });

  test('Employee views leave balances', async () => {
    const TestWrapper = createTestWrapper(mockEmployee);

    render(
      <TestWrapper>
        <LeaveManagement />
      </TestWrapper>
    );

    // Navigate to balances tab
    const balancesTab = screen.getByRole('tab', { name: /leave balances/i });
    await userEvent.click(balancesTab);

    // Wait for balances to load
    await waitFor(() => {
      expect(screen.getByText('Vacation Leave')).toBeInTheDocument();
    });

    // Verify balance information
    expect(screen.getByText('15 days')).toBeInTheDocument(); // Available
    expect(screen.getByText('5 days')).toBeInTheDocument(); // Used
    expect(screen.getByText('20 days')).toBeInTheDocument(); // Total allocated
  });
});

describe('Real-World Admin Workflows', () => {
  const mockAdmin = {
    user: {
      id: 2,
      username: 'admin@company.com',
      first_name: 'Admin',
      last_name: 'User'
    },
    employee_profile: {
      id: 2,
      employee_id: 'ADMIN001',
      role: 'ADMIN',
      employment_status: 'ACTIVE'
    }
  };

  test('Admin manages assets', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper(mockAdmin);

    render(
      <TestWrapper>
        <AssetManagement />
      </TestWrapper>
    );

    // Wait for assets to load
    await waitFor(() => {
      expect(screen.getByText(/asset management/i)).toBeInTheDocument();
    });

    // Verify asset appears in list
    expect(screen.getByText('LAPTOP-001')).toBeInTheDocument();
    expect(screen.getByText('MacBook Pro 16"')).toBeInTheDocument();
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();

    // Click "Add Asset" button
    const addAssetButton = screen.getByRole('button', { name: /add asset/i });
    await user.click(addAssetButton);

    // Verify form opens
    await waitFor(() => {
      expect(screen.getByText(/add new asset/i)).toBeInTheDocument();
    });
  });

  test('Admin views dashboard statistics', async () => {
    const TestWrapper = createTestWrapper(mockAdmin);

    // Mock dashboard statistics
    server.use(
      rest.get('/api/employees/dashboard-stats/', (req, res, ctx) => {
        return res(
          ctx.json({
            total_employees: 25,
            active_employees: 23,
            clocked_in_employees: 18,
            on_break_employees: 3,
            pending_leave_requests: 2
          })
        );
      })
    );

    render(
      <TestWrapper>
        <AdminDashboard />
      </TestWrapper>
    );

    // Wait for dashboard to load
    await waitFor(() => {
      expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
    });

    // Verify statistics appear
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument(); // Total employees
      expect(screen.getByText('18')).toBeInTheDocument(); // Clocked in
      expect(screen.getByText('3')).toBeInTheDocument(); // On break
    });
  });

  test('Admin generates reports', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper(mockAdmin);

    // Mock report generation
    server.use(
      rest.post('/api/reports/generate/', (req, res, ctx) => {
        return res(
          ctx.json({
            id: 1,
            status: 'COMPLETED',
            template_name: 'Attendance Summary',
            created_at: new Date().toISOString()
          })
        );
      }),

      rest.get('/api/reports/templates/', (req, res, ctx) => {
        return res(
          ctx.json({
            results: [
              {
                id: 1,
                name: 'Attendance Summary',
                report_type: 'ATTENDANCE_SUMMARY'
              }
            ]
          })
        );
      }),

      rest.get('/api/reports/executions/', (req, res, ctx) => {
        return res(
          ctx.json({
            results: []
          })
        );
      })
    );

    render(
      <TestWrapper>
        <Reports />
      </TestWrapper>
    );

    // Wait for reports page to load
    await waitFor(() => {
      expect(screen.getByText(/reports & analytics/i)).toBeInTheDocument();
    });

    // Select report type
    const attendanceReport = screen.getByText(/attendance summary/i);
    await user.click(attendanceReport);

    // Set date range
    const startDateInput = screen.getByLabelText(/start date/i);
    await user.type(startDateInput, '2024-01-01');

    const endDateInput = screen.getByLabelText(/end date/i);
    await user.type(endDateInput, '2024-01-31');

    // Generate report
    const generateButton = screen.getByRole('button', { name: /generate report/i });
    await user.click(generateButton);

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/report generated successfully/i)).toBeInTheDocument();
    });
  });
});

describe('Error Handling and Edge Cases', () => {
  test('Handles network errors gracefully', async () => {
    const TestWrapper = createTestWrapper();

    // Mock network error
    server.use(
      rest.get('/api/attendance/locations/', (req, res, ctx) => {
        return res.networkError('Network error');
      })
    );

    render(
      <TestWrapper>
        <ClockIn />
      </TestWrapper>
    );

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/error loading/i)).toBeInTheDocument();
    });
  });

  test('Handles unauthorized access', async () => {
    const TestWrapper = createTestWrapper();

    // Mock unauthorized response
    server.use(
      rest.get('/api/assets/assets/', (req, res, ctx) => {
        return res(ctx.status(401), ctx.json({ detail: 'Unauthorized' }));
      })
    );

    render(
      <TestWrapper>
        <AssetManagement />
      </TestWrapper>
    );

    // Should show access denied message
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });

  test('Handles form validation errors', async () => {
    const user = userEvent.setup();
    const TestWrapper = createTestWrapper();

    // Mock validation error
    server.use(
      rest.post('/api/scheduling/leave-requests/', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({
            start_date: ['Start date cannot be in the past'],
            days_requested: ['Insufficient leave balance']
          })
        );
      })
    );

    render(
      <TestWrapper>
        <LeaveManagement />
      </TestWrapper>
    );

    // Try to submit invalid form
    const requestButton = screen.getByRole('button', { name: /request leave/i });
    await user.click(requestButton);

    // Fill form with invalid data and submit
    // ... form filling code ...

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/start date cannot be in the past/i)).toBeInTheDocument();
      expect(screen.getByText(/insufficient leave balance/i)).toBeInTheDocument();
    });
  });
});
