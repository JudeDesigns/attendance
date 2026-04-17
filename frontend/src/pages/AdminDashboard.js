import { useState } from 'react';
import { employeeAPI, attendanceAPI, locationAPI, schedulingAPI } from '../services/api';
import { useQuery, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { formatDurationCompact } from '../utils/helpers';
import DashboardStats from '../components/DashboardStats';
import RecentActivity from '../components/RecentActivity';
import QuickActions from '../components/QuickActions';
import StuckClockInAlert from '../components/StuckClockInAlert';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import { useAuth } from '../contexts/AuthContext';
import {
  UserGroupIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  MapPinIcon as LocationMarkerIcon,
  ArrowRightStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { getPSTDateString } from '../utils/timezoneUtils';

const AdminDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(getPSTDateString());
  const [forceClockoutTarget, setForceClockoutTarget] = useState(null); // { employee_id, employee_name }
  const [forceClockoutLoading, setForceClockoutLoading] = useState(false);
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();

  // Get all employees
  const { data: employeesData } = useQuery('employees', () => employeeAPI.list());

  // Get today's attendance
  const { data: attendanceData } = useQuery(
    ['attendance', selectedDate],
    () => {
      const dateStr = selectedDate;
      return attendanceAPI.timeLogs({
        start_date: `${dateStr}T00:00:00`,
        end_date: `${dateStr}T23:59:59`,
        page_size: 1000
      });
    },
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  // Get locations
  const { data: locationsData } = useQuery('locations', locationAPI.list);

  // Get ALL currently clocked-in employees (regardless of date — catches stuck clock-ins)
  const { data: activeClockedInData } = useQuery(
    'active-clockedin',
    () => attendanceAPI.timeLogs({ status: 'CLOCKED_IN', page_size: 1000 }),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  // Get today's shifts (actual scheduled shifts)
  const { data: shiftsData } = useQuery(
    ['shifts', selectedDate],
    () => schedulingAPI.shifts({
      start_date: selectedDate,
      end_date: selectedDate,
    }),
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );

  const employees = Array.isArray(employeesData?.data) ? employeesData.data : (employeesData?.data?.results || []);
  const attendanceLogs = attendanceData?.data?.results || [];
  const allActiveClockIns = activeClockedInData?.data?.results || [];
  const locations = locationsData?.data?.results || locationsData?.results || [];
  const shifts = Array.isArray(shiftsData?.data) ? shiftsData.data : (shiftsData?.data?.results || []);

  // Calculate statistics
  const totalEmployees = employees.length;
  // Use the dedicated active query — catches stuck clock-ins from ANY date
  const currentlyClockedIn = allActiveClockIns.length;
  // Use actual scheduled shifts instead of attendance logs
  const completedShifts = shifts.filter(shift => {
    const shiftDate = new Date(shift.date + 'T00:00:00');
    const today = new Date(selectedDate + 'T00:00:00');
    return shiftDate.toDateString() === today.toDateString();
  }).length;
  const overtimeShifts = attendanceLogs.filter(log => log.duration_hours > 8).length;

  // Pagination for attendance logs
  const {
    currentData: paginatedAttendanceLogs,
    totalItems: totalAttendanceLogs,
    totalPages: attendancePages,
    currentPage: attendancePage,
    goToPage: goToAttendancePage
  } = usePagination(attendanceLogs, 10);

  const handleForceClockout = async () => {
    if (!forceClockoutTarget) return;
    setForceClockoutLoading(true);
    try {
      await attendanceAPI.forceClockout({
        employee_id: forceClockoutTarget.employee_id,
        reason: 'Admin force clock-out from dashboard',
      });
      queryClient.invalidateQueries(['attendance', selectedDate]);
      setForceClockoutTarget(null);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Failed to force clock-out');
    } finally {
      setForceClockoutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

        {/* Date Selector */}
        <div className="mt-4 sm:mt-0">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Stuck Clock-In Alert */}
      <StuckClockInAlert isAdmin={true} />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium glass-text-secondary truncate">
                    Total Employees
                  </dt>
                  <dd className="text-lg font-medium glass-text-primary">
                    {totalEmployees}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium glass-text-secondary truncate">
                    Currently Clocked In
                  </dt>
                  <dd className="text-lg font-medium glass-text-primary">
                    {currentlyClockedIn}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium glass-text-secondary truncate">
                    Completed Shifts
                  </dt>
                  <dd className="text-lg font-medium glass-text-primary">
                    {completedShifts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium glass-text-secondary truncate">
                    Overtime Shifts
                  </dt>
                  <dd className="text-lg font-medium glass-text-primary">
                    {overtimeShifts}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <LocationMarkerIcon className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium glass-text-secondary truncate">
                    Active Locations
                  </dt>
                  <dd className="text-lg font-medium glass-text-primary">
                    {locations.filter(loc => loc.is_active).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="glass-card glass-slide-up">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium glass-text-primary mb-4">
            Current Employee Status ({format(new Date(selectedDate + 'T00:00:00'), 'MMM d, yyyy')})
          </h3>

          {attendanceLogs.length === 0 ? (
            <div className="glass-empty-state">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium glass-text-primary">No attendance records</h3>
              <p className="mt-1 text-sm glass-text-secondary">
                No employees have clocked in for the selected date.
              </p>
            </div>
          ) : (
            <div className="glass-table overflow-x-auto">
              <table className="min-w-full">
                <thead className="glass-table-header">
                  <tr>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Method
                    </th>
                    <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttendanceLogs.map((log) => (
                    <tr key={log.id} className="glass-table-row">
                      <td className="glass-table-cell whitespace-nowrap">
                        <div className="text-sm font-medium glass-text-primary">
                          {log.employee_name}
                        </div>
                      </td>
                      <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                        {format(new Date(log.clock_in_time), 'h:mm a')}
                      </td>
                      <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                        {log.clock_out_time
                          ? format(new Date(log.clock_out_time), 'h:mm a')
                          : '-'
                        }
                      </td>
                      <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                        {log.duration_hours
                          ? formatDurationCompact(log.duration_hours)
                          : '-'
                        }
                      </td>
                      <td className="glass-table-cell whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium focus:outline-none ${log.attendance_status === 'COMPLETED' ? 'glass-status-success' :
                            (log.attendance_status === 'EARLY_DEPARTURE' || log.attendance_status === 'OVERTIME') ? 'glass-status-warning' :
                              log.attendance_status === 'UNSCHEDULED' ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                          }`}>
                          {log.attendance_status ? log.attendance_status.replace('_', ' ') : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="glass-table-cell whitespace-nowrap text-sm glass-text-secondary">
                        {log.clock_in_method}
                      </td>
                      <td className="glass-table-cell whitespace-nowrap">
                        {!log.clock_out_time && hasPermission('force_clockout') && (
                          <button
                            onClick={() => setForceClockoutTarget({ employee_id: log.employee_id, employee_name: log.employee_name })}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5 mr-1" />
                            Clock Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination for attendance logs */}
          {attendanceLogs.length > 10 && (
            <Pagination
              currentPage={attendancePage}
              totalPages={attendancePages}
              totalItems={totalAttendanceLogs}
              itemsPerPage={10}
              onPageChange={goToAttendancePage}
              className="mt-4"
            />
          )}
        </div>
      </div>

      {/* Employee List */}
      <div className="glass-card glass-slide-up">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium glass-text-primary mb-4">
            All Employees
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => {
              const fullName = `${employee.user?.first_name || ''} ${employee.user?.last_name || ''}`.trim() || employee.user?.username || employee.employee_id;
              const todayAttendance = attendanceLogs.filter(log =>
                log.employee_name === fullName || log.employee_id === employee.employee_id
              );
              const isActive = todayAttendance.some(log => !log.clock_out_time);

              return (
                <div key={employee.employee_id} className="glass-employee-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium glass-text-primary capitalize">
                        {fullName.toLowerCase()}
                      </h4>
                      <p className="text-sm glass-text-secondary">
                        {employee.employee_id} • {employee.role_name || 'No Role'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${employee.employment_status === 'ACTIVE'
                          ? 'glass-status-success'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {employee.employment_status}
                      </span>
                      {isActive && (
                        <span className="mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Currently Working
                        </span>
                      )}
                    </div>
                  </div>

                  {todayAttendance.length > 0 && (
                    <div className="mt-2 text-xs glass-text-muted">
                      Today: {todayAttendance.reduce((total, log) =>
                        total + (log.duration_hours || 0), 0
                      ).toFixed(1)}h worked
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>





      {/* Advanced Dashboard Features */}
      <div className="space-y-6">
        {/* Dashboard Statistics with Charts */}
        <DashboardStats />

        {/* Quick Actions and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickActions />
          <RecentActivity limit={8} />
        </div>
      </div>

      {/* Force Clock-Out Confirmation Modal */}
      {forceClockoutTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setForceClockoutTarget(null)} />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Force Clock-Out</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to clock out <strong>{forceClockoutTarget.employee_name}</strong>? This will end their current session and any active breaks.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setForceClockoutTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none"
                disabled={forceClockoutLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleForceClockout}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                disabled={forceClockoutLoading}
              >
                {forceClockoutLoading ? 'Clocking Out...' : 'Confirm Clock-Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
