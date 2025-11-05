import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  ArrowLeftIcon,
  ClockIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { attendanceAPI, employeeAPI, schedulingAPI } from '../services/api';

const EmployeeDetails = () => {
  const { employeeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('week');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get employee data from navigation state or fetch it
  const employeeFromState = location.state?.employee;
  const statusDataFromState = location.state?.statusData;
  const selectedDateFromState = location.state?.selectedDate;

  // Fetch employee if not provided in state
  const { data: employeeData } = useQuery(
    ['employee', employeeId],
    () => employeeAPI.get(employeeId),
    {
      enabled: !employeeFromState,
    }
  );

  const employee = employeeFromState || employeeData?.data;

  // Calculate date range for detailed logs
  const getDateRange = () => {
    const today = selectedDate;
    switch (dateRange) {
      case 'day':
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start: format(startOfWeek(today), 'yyyy-MM-dd'),
          end: format(endOfWeek(today), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start: format(startOfMonth(today), 'yyyy-MM-dd'),
          end: format(endOfMonth(today), 'yyyy-MM-dd'),
        };
      default:
        return {
          start: format(startOfWeek(today), 'yyyy-MM-dd'),
          end: format(endOfWeek(today), 'yyyy-MM-dd'),
        };
    }
  };

  const { start, end } = getDateRange();

  // Get detailed time logs for this employee
  const { data: timeLogsData, isLoading } = useQuery(
    ['employee-time-logs', employeeId, start, end],
    () => attendanceAPI.timeLogs({
      employee: employeeId,
      start_date: start,
      end_date: end,
    })
  );

  // Get scheduled shifts for this employee
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery(
    ['employee-shifts', employeeId, start, end],
    () => schedulingAPI.shifts({
      employee: employeeId,
      start_date: start,
      end_date: end,
    })
  );

  const timeLogs = timeLogsData?.data?.results || timeLogsData?.results || [];
  const shifts = shiftsData?.data?.results || shiftsData?.results || [];

  // Calculate statistics
  const totalHours = timeLogs.reduce((sum, log) => sum + (log.duration_hours || 0), 0);

  // Count unique working days (not total entries)
  const uniqueDates = new Set(
    timeLogs
      .filter(log => log.clock_out_time) // Only completed logs
      .map(log => {
        // Extract date from clock_in_time
        const clockInDate = new Date(log.clock_in_time);
        return clockInDate.toDateString(); // Convert to date string for comparison
      })
  );
  const totalDays = uniqueDates.size;

  const averageHours = totalDays > 0 ? totalHours / totalDays : 0;
  const overtimeHours = timeLogs.reduce((sum, log) => {
    const hours = log.duration_hours || 0;
    return sum + (hours > 8 ? hours - 8 : 0);
  }, 0);

  // Calculate shift statistics
  const scheduledHours = shifts.reduce((sum, shift) => sum + (shift.duration_hours || 0), 0);
  const publishedShifts = shifts.filter(shift => shift.is_published).length;
  const upcomingShifts = shifts.filter(shift => shift.is_future).length;

  const formatDuration = (hours) => {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const handleExportData = async () => {
    try {
      // This would call an export API endpoint
      const response = await attendanceAPI.exportEmployee({
        employee_id: employeeId,
        start_date: start,
        end_date: end,
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${employee?.user?.first_name}_${employee?.user?.last_name}_${start}_to_${end}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'CLOCKED_IN') {
      return (
        <span className="glass-status-success inline-flex items-center">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
          Clocked In
        </span>
      );
    }
    return (
      <span className="glass-status-info inline-flex items-center">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-1"></div>
        Clocked Out
      </span>
    );
  };

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card glass-fade-in p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="glass-button p-2 rounded-md"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold glass-text-primary">
                {employee.user.first_name} {employee.user.last_name}
              </h1>
              <p className="text-sm glass-text-secondary">
                {employee.employee_id} • {employee.role?.name || employee.role_name}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => navigate(`/admin/scheduling?employee=${employeeId}`)}
              className="uber-button-primary inline-flex items-center"
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Schedule Shift
            </button>
            <button
              onClick={handleExportData}
              className="uber-button-secondary inline-flex items-center"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* Employee Info Card */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {employee.user.first_name} {employee.user.last_name}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">{employee.user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{employee.employee_id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1 text-sm text-gray-900">{employee.role?.name || employee.role_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Employment Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  employee.employment_status === 'ACTIVE' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {employee.employment_status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Hire Date</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {employee.hire_date ? format(new Date(employee.hire_date), 'MMM d, yyyy') : 'N/A'}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Current Status (if from today) */}
      {statusDataFromState && selectedDateFromState === format(new Date(), 'yyyy-MM-dd') && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Current Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">{getStatusBadge(statusDataFromState.currentStatus)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Clock In Time</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {statusDataFromState.clockInTime 
                    ? format(new Date(statusDataFromState.clockInTime), 'h:mm a')
                    : 'Not clocked in'
                  }
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Hours Today</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDuration(statusDataFromState.totalHours)}
                </dd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Date Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium text-gray-900">Time Logs</h2>
        
        <div className="mt-4 sm:mt-0 flex items-center space-x-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="space-y-6">
        {/* Time Tracking Statistics */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Time Tracking Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Hours</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatDuration(totalHours)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-8 w-8 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Days Worked</dt>
                  <dd className="text-lg font-medium text-gray-900">{totalDays}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-indigo-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Average Hours/Day</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatDuration(averageHours)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-8 w-8 text-orange-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Overtime Hours</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatDuration(overtimeHours)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>

        {/* Shift Scheduling Statistics */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Shift Scheduling Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CalendarIcon className="h-8 w-8 text-purple-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Scheduled Shifts</dt>
                      <dd className="text-lg font-medium text-gray-900">{shifts.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-8 w-8 text-indigo-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Scheduled Hours</dt>
                      <dd className="text-lg font-medium text-gray-900">{formatDuration(scheduledHours)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Published Shifts</dt>
                      <dd className="text-lg font-medium text-gray-900">{publishedShifts}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Upcoming Shifts</dt>
                      <dd className="text-lg font-medium text-gray-900">{upcomingShifts}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled Shifts Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Scheduled Shifts ({shifts.length})
          </h3>

          {shiftsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No scheduled shifts</h3>
              <p className="mt-1 text-sm text-gray-500">
                No shifts scheduled for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shift Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {shift.start_time ? format(new Date(shift.start_time), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.start_time ? format(new Date(shift.start_time), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.end_time ? format(new Date(shift.end_time), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.duration_hours ? (
                          <span className={shift.duration_hours > 8 ? 'text-orange-600 font-medium' : ''}>
                            {formatDuration(shift.duration_hours)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          shift.shift_type === 'REGULAR' ? 'bg-blue-100 text-blue-800' :
                          shift.shift_type === 'OVERTIME' ? 'bg-orange-100 text-orange-800' :
                          shift.shift_type === 'SPECIAL' ? 'bg-purple-100 text-purple-800' :
                          shift.shift_type === 'FLEXIBLE' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {shift.shift_type || 'REGULAR'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shift.location || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          shift.is_published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {shift.is_published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {shift.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Time Logs Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Detailed Time Logs ({timeLogs.length})
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : timeLogs.length === 0 ? (
            <div className="text-center py-12">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No time logs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No time logs found for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timeLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.clock_in_time ? format(new Date(log.clock_in_time), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.clock_in_time ? format(new Date(log.clock_in_time), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.clock_out_time ? format(new Date(log.clock_out_time), 'h:mm a') : (
                          <span className="text-green-600 font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.duration_hours ? (
                          <span className={log.duration_hours > 8 ? 'text-orange-600 font-medium' : ''}>
                            {formatDuration(log.duration_hours)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {log.clock_in_method || 'PORTAL'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {log.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;
