import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ClockIcon,
  UserIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { employeeAPI, attendanceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EmployeeStatusDashboard = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get all employees
  const { data: employeesData, isLoading: employeesLoading } = useQuery(
    'employees',
    () => employeeAPI.list(),
    {
      enabled: isAdmin, // Only fetch if admin
    }
  );

  // Get today's attendance for all employees
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery(
    ['attendance-status', format(selectedDate, 'yyyy-MM-dd')],
    () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      return attendanceAPI.timeLogs({
        start_date: `${dateStr}T00:00:00`,
        end_date: `${dateStr}T23:59:59`,
        page_size: 1000 // Get all records
      });
    },
    {
      enabled: isAdmin, // Only fetch if admin
      refetchInterval: isAdmin ? 30000 : false, // Refresh every 30 seconds if admin
    }
  );

  // Get currently clocked-in employees (regardless of when they clocked in)
  const { data: currentlyActiveData, isLoading: activeLoading } = useQuery(
    ['currently-active'],
    () => attendanceAPI.timeLogs({
      status: 'CLOCKED_IN',
      page_size: 1000 // Get all currently active employees
    }),
    {
      enabled: isAdmin,
      refetchInterval: isAdmin ? 30000 : false,
    }
  );

  // Redirect non-admins to regular time tracking
  if (!isAdmin) {
    navigate('/time-tracking');
    return null;
  }

  const employees = employeesData?.data?.results || employeesData?.results || [];
  const attendanceLogs = attendanceData?.data?.results || attendanceData?.results || [];
  const currentlyActiveLogs = currentlyActiveData?.data?.results || currentlyActiveData?.results || [];

  // Debug: Log the attendance data to see what we're getting
  console.log('Attendance logs:', attendanceLogs.slice(0, 3)); // Log first 3 entries
  console.log('Currently active logs:', currentlyActiveLogs.slice(0, 3)); // Log first 3 active entries
  console.log('Employees:', employees.slice(0, 3).map(e => ({ id: e.id, employee_id: e.employee_id, name: e.user?.first_name + ' ' + e.user?.last_name })));

  // Create employee status map
  const employeeStatusMap = {};

  // Group logs by employee first (use employee UUID, not employee_id)
  const logsByEmployee = {};
  attendanceLogs.forEach(log => {
    const empId = log.employee; // Use UUID, not employee_id string
    if (!logsByEmployee[empId]) {
      logsByEmployee[empId] = [];
    }
    logsByEmployee[empId].push(log);
  });

  // Group currently active logs by employee (use employee UUID, not employee_id)
  const activeLogsByEmployee = {};
  currentlyActiveLogs.forEach(log => {
    const empId = log.employee; // Use UUID, not employee_id string
    if (!activeLogsByEmployee[empId]) {
      activeLogsByEmployee[empId] = [];
    }
    activeLogsByEmployee[empId].push(log);
  });

  // Process each employee's logs
  Object.entries(logsByEmployee).forEach(([empId, logs]) => {
    employeeStatusMap[empId] = {
      logs: logs,
      currentStatus: 'CLOCKED_OUT',
      totalHours: 0,
      clockInTime: null,
      clockOutTime: null,
    };

    // Sort logs by time to process them in order
    const sortedLogs = logs.sort((a, b) => new Date(a.clock_in_time) - new Date(b.clock_in_time));

    // Check if employee is currently clocked in (from active logs)
    const activeLog = activeLogsByEmployee[empId]?.[0]; // Should only be one active log per employee
    if (activeLog && activeLog.status === 'CLOCKED_IN' && !activeLog.clock_out_time) {
      employeeStatusMap[empId].currentStatus = 'CLOCKED_IN';
      employeeStatusMap[empId].clockInTime = activeLog.clock_in_time;
    }

    // Calculate total hours only from completed sessions (logs with both clock_in and clock_out)
    sortedLogs.forEach(log => {
      if (log.clock_in_time && log.clock_out_time && log.status === 'CLOCKED_OUT') {
        const clockIn = new Date(log.clock_in_time);
        const clockOut = new Date(log.clock_out_time);
        const diffMs = clockOut - clockIn;
        const hours = diffMs / (1000 * 60 * 60);

        // Only add reasonable hours (max 24 hours per session)
        if (hours > 0 && hours <= 24) {
          employeeStatusMap[empId].totalHours += hours;
        }
      }

      // Track the most recent clock out time
      if (log.clock_out_time) {
        employeeStatusMap[empId].clockOutTime = log.clock_out_time;
      }
    });
  });

  // Ensure all employees are in the status map, even if they don't have logs for today
  employees.forEach(employee => {
    const empId = employee.id; // Use UUID directly, no need to convert to string
    if (!employeeStatusMap[empId]) {
      employeeStatusMap[empId] = {
        logs: [],
        currentStatus: 'CLOCKED_OUT',
        totalHours: 0,
        clockInTime: null,
        clockOutTime: null,
      };

      // Check if this employee is currently clocked in (from active logs)
      const activeLog = activeLogsByEmployee[empId]?.[0];
      if (activeLog && activeLog.status === 'CLOCKED_IN' && !activeLog.clock_out_time) {
        employeeStatusMap[empId].currentStatus = 'CLOCKED_IN';
        employeeStatusMap[empId].clockInTime = activeLog.clock_in_time;
      }
    }
  });

  // Debug: Log the employee status map
  console.log('Employee Status Map:', Object.keys(employeeStatusMap).map(empId => ({
    empId,
    status: employeeStatusMap[empId].currentStatus,
    clockInTime: employeeStatusMap[empId].clockInTime,
    totalHours: employeeStatusMap[empId].totalHours
  })));
  console.log('Active logs by employee:', Object.keys(activeLogsByEmployee));

  // Debug: Log the total hours calculation
  const totalHours = Object.values(employeeStatusMap).reduce((sum, s) => sum + s.totalHours, 0);
  console.log('Attendance logs count:', attendanceLogs.length);
  console.log('Employee status map:', Object.keys(employeeStatusMap).length, 'employees with logs');
  console.log('Total hours calculated:', totalHours);
  console.log('Selected date:', format(selectedDate, 'yyyy-MM-dd'));
  if (Object.values(employeeStatusMap)[0]) {
    console.log('Sample employee data:', Object.values(employeeStatusMap)[0]);
  }

  // If no logs for today, totalHours should be 0
  if (attendanceLogs.length === 0) {
    console.log('No attendance logs found for selected date - this is correct if no one clocked in today');
  }

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const empStatus = employeeStatusMap[employee.id];
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'CLOCKED_IN' && empStatus?.currentStatus === 'CLOCKED_IN') ||
      (statusFilter === 'CLOCKED_OUT' && (!empStatus || empStatus.currentStatus === 'CLOCKED_OUT'));
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (employee) => {
    navigate(`/employee-details/${employee.id}`, {
      state: { 
        employee, 
        statusData: employeeStatusMap[employee.id],
        selectedDate: format(selectedDate, 'yyyy-MM-dd')
      }
    });
  };

  const handleExportEmployee = async (employee) => {
    try {
      // This would call an export API endpoint
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await attendanceAPI.exportEmployee({
        employee_id: employee.id,
        start_date: dateStr,
        end_date: dateStr
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${employee.user.first_name}_${employee.user.last_name}_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
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

  const formatDuration = (hours) => {
    if (!hours || hours < 0) return '0h 0m';

    // Cap at reasonable maximum (999 hours)
    const cappedHours = Math.min(hours, 999);
    const h = Math.floor(cappedHours);
    const m = Math.round((cappedHours - h) * 60);

    // Ensure minutes don't exceed 59
    const finalMinutes = Math.min(m, 59);

    return `${h}h ${finalMinutes}m`;
  };

  const getCurrentDuration = (clockInTime) => {
    if (!clockInTime) return '0h 0m';
    const now = new Date();
    const clockIn = new Date(clockInTime);
    const diffMs = now - clockIn;
    const hours = diffMs / (1000 * 60 * 60);
    return formatDuration(hours);
  };

  if (employeesLoading || attendanceLoading || activeLoading) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold glass-text-primary">Employee Status Dashboard</h1>
            <p className="mt-2 text-sm glass-text-secondary">
              Monitor real-time employee attendance and work hours
            </p>
          </div>

          {/* Date Selector */}
          <div className="mt-4 sm:mt-0">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="glass-input"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          {/* Status Filter */}
          <div className="flex items-center space-x-4">
            <FunnelIcon className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="CLOCKED_IN">Clocked In</option>
              <option value="CLOCKED_OUT">Clocked Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Employees</dt>
                  <dd className="text-lg font-medium text-gray-900">{employees.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Currently Clocked In</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {Object.values(employeeStatusMap).filter(s => s.currentStatus === 'CLOCKED_IN').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Currently Clocked Out</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {employees.length - Object.values(employeeStatusMap).filter(s => s.currentStatus === 'CLOCKED_IN').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Hours Today</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {attendanceLogs.length === 0 ? '0h 0m' : formatDuration(Math.min(Object.values(employeeStatusMap).reduce((sum, s) => sum + s.totalHours, 0), 999))}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Status Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Employee Status ({filteredEmployees.length})
          </h3>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No employees found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clock In Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current/Total Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Clock Out
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmployees.map((employee) => {
                    const statusData = employeeStatusMap[employee.id] || {
                      currentStatus: 'CLOCKED_OUT',
                      totalHours: 0,
                      clockInTime: null,
                      clockOutTime: null,
                    };

                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {employee.user.first_name?.[0]}{employee.user.last_name?.[0]}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.user.first_name} {employee.user.last_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {employee.employee_id} • {employee.role?.name || employee.role_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(statusData.currentStatus)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {statusData.clockInTime ? (
                            <div>
                              <div>{format(new Date(statusData.clockInTime), 'h:mm a')}</div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(statusData.clockInTime), 'MMM d')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {statusData.currentStatus === 'CLOCKED_IN' ? (
                            <div>
                              <div className="font-medium text-green-600">
                                {getCurrentDuration(statusData.clockInTime)}
                              </div>
                              <div className="text-xs text-gray-500">Current session</div>
                            </div>
                          ) : (
                            <div>
                              <div>{formatDuration(statusData.totalHours)}</div>
                              <div className="text-xs text-gray-500">Total today</div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {statusData.clockOutTime ? (
                            <div>
                              <div>{format(new Date(statusData.clockOutTime), 'h:mm a')}</div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(statusData.clockOutTime), 'MMM d')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDetails(employee)}
                              className="text-indigo-600 hover:text-indigo-900 flex items-center"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              Details
                            </button>
                            <button
                              onClick={() => handleExportEmployee(employee)}
                              className="text-green-600 hover:text-green-900 flex items-center"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                              Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeStatusDashboard;
