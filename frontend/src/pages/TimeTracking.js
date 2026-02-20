import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { attendanceAPI, employeeAPI } from '../services/api';
import { useQuery } from 'react-query';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import Pagination from '../components/Pagination';
import usePagination from '../hooks/usePagination';
import {
  CalendarIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon as ExclamationIcon,
} from '@heroicons/react/24/outline';
import { getPSTDate } from '../utils/timezoneUtils';

const TimeTracking = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('week');
  const [selectedDate, setSelectedDate] = useState(getPSTDate());
  const [selectedEmployee, setSelectedEmployee] = useState('me');

  // Check if user is admin
  const isAdmin = user?.employee_profile?.role?.name === 'Administrator' || user?.is_staff;

  // Get employees list for admin
  const { data: employeesData } = useQuery(
    'employees',
    () => employeeAPI.list(),
    {
      enabled: isAdmin,
    }
  );

  // Calculate date range
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

  // Get time logs for the selected period
  const { data: timeLogsData, isLoading } = useQuery(
    ['timeLogs', selectedEmployee === 'me' ? user?.employee_profile?.id : selectedEmployee, start, end],
    () => {
      const params = {
        start_date: start,
        end_date: end,
      };

      // If not admin or selected 'me', filter by current user
      if (!isAdmin || selectedEmployee === 'me') {
        params.employee = user?.employee_profile?.id;
      } else if (selectedEmployee !== 'all') {
        params.employee = selectedEmployee;
      }

      return attendanceAPI.timeLogs(params);
    },
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  const timeLogs = timeLogsData?.data?.results || [];

  // Pagination for time logs
  const {
    currentData: paginatedTimeLogs,
    totalItems: totalTimeLogs,
    totalPages: timeLogPages,
    currentPage: timeLogPage,
    goToPage: goToTimeLogPage
  } = usePagination(timeLogs, 10);

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

  const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {['day', 'week', 'month'].map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${dateRange === range ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {range === 'day' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="glass-input text-sm flex-1 min-w-0"
          />

          {isAdmin && (
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="glass-input text-sm flex-1 min-w-0"
            >
              <option value="me">My Logs</option>
              <option value="all">All Employees</option>
              {(employeesData?.data?.results || employeesData?.results || []).map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.user.first_name} {employee.user.last_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Statistics Cards - Mobile Responsive */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="glass-card glass-slide-up">
          <div className="p-3 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
              </div>
              <div className="ml-2 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium glass-text-secondary truncate">
                    Total Hours
                  </dt>
                  <dd className="text-sm md:text-lg font-medium glass-text-primary">
                    {formatDuration(totalHours)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-slide-up">
          <div className="p-3 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
              <div className="ml-2 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium glass-text-secondary truncate">
                    Days Worked
                  </dt>
                  <dd className="text-sm md:text-lg font-medium glass-text-primary">
                    {totalDays}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-slide-up">
          <div className="p-3 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
              <div className="ml-2 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium glass-text-secondary truncate">
                    Avg Hours/Day
                  </dt>
                  <dd className="text-sm md:text-lg font-medium glass-text-primary">
                    {formatDuration(averageHours)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card glass-slide-up">
          <div className="p-3 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationIcon className={`h-5 w-5 md:h-6 md:w-6 ${overtimeHours > 0 ? 'text-orange-500' : 'text-gray-400'
                  }`} />
              </div>
              <div className="ml-2 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium glass-text-secondary truncate">
                    Overtime
                  </dt>
                  <dd className={`text-sm md:text-lg font-medium ${overtimeHours > 0 ? 'text-orange-600' : 'glass-text-primary'
                    }`}>
                    {formatDuration(overtimeHours)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Logs Table - Mobile Responsive */}
      <div className="glass-card glass-slide-up">
        <div className="px-3 py-4 sm:px-4 sm:py-5 md:p-6">
          <h3 className="text-base md:text-lg leading-6 font-medium glass-text-primary mb-3 md:mb-4">
            Time Logs ({format(new Date(start), 'MMM d')} - {format(new Date(end), 'MMM d, yyyy')})
          </h3>

          {timeLogs.length === 0 ? (
            <div className="glass-empty-state py-8">
              <ClockIcon className="mx-auto h-10 w-10 md:h-12 md:w-12 text-blue-500" />
              <h3 className="mt-2 text-sm md:text-base font-medium glass-text-primary">No time logs</h3>
              <p className="mt-1 text-xs md:text-sm glass-text-secondary">
                No time entries found for the selected period.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-3">
                {paginatedTimeLogs.map((log) => (
                  <div key={log.id} className="glass-card p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm font-medium glass-text-primary">
                          {log.clock_in_time ? format(new Date(log.clock_in_time), 'MMM d, yyyy') : '-'}
                        </p>
                        <p className="text-xs glass-text-secondary">
                          {log.clock_in_time ? format(new Date(log.clock_in_time), 'h:mm a') : '-'} - {log.clock_out_time ? format(new Date(log.clock_out_time), 'h:mm a') : 'In Progress'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.attendance_status === 'IN_PROGRESS' ? 'glass-status-info' :
                          log.attendance_status === 'COMPLETED' ? 'glass-status-success' :
                            log.attendance_status === 'OVERTIME' ? 'glass-status-warning' :
                              log.attendance_status === 'EARLY_DEPARTURE' ? 'glass-status-error' :
                                log.attendance_status === 'UNSCHEDULED' ? 'glass-status-warning' :
                                  'glass-status-secondary'
                        }`}>
                        {log.attendance_status === 'IN_PROGRESS' ? 'In Progress' :
                          log.attendance_status === 'COMPLETED' ? 'Completed' :
                            log.attendance_status === 'OVERTIME' ? 'Overtime' :
                              log.attendance_status === 'EARLY_DEPARTURE' ? 'Early' :
                                log.attendance_status === 'UNSCHEDULED' ? 'Unscheduled' :
                                  log.attendance_status || 'Unknown'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="glass-text-secondary">Duration:</span>
                      <span className="font-medium glass-text-primary">{log.duration_hours ? formatDuration(log.duration_hours) : '-'}</span>
                    </div>
                    {log.notes && (
                      <p className="text-xs glass-text-secondary line-clamp-2">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block glass-table overflow-x-auto">
                <table className="min-w-full">
                  <thead className="glass-table-header">
                    <tr>
                      <th className="glass-table-cell text-left text-xs font-medium glass-text-secondary uppercase tracking-wider">
                        Date
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
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTimeLogs.map((log) => (
                      <tr key={log.id} className="glass-table-row">
                        <td className="glass-table-cell whitespace-nowrap text-sm font-medium glass-text-primary">
                          {log.clock_in_time ? format(new Date(log.clock_in_time), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                          {log.clock_in_time ? format(new Date(log.clock_in_time), 'h:mm a') : '-'}
                        </td>
                        <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                          {log.clock_out_time
                            ? format(new Date(log.clock_out_time), 'h:mm a')
                            : '-'
                          }
                        </td>
                        <td className="glass-table-cell whitespace-nowrap text-sm glass-text-primary">
                          {log.duration_hours ? formatDuration(log.duration_hours) : '-'}
                        </td>
                        <td className="glass-table-cell whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.attendance_status === 'IN_PROGRESS' ? 'glass-status-info' :
                              log.attendance_status === 'COMPLETED' ? 'glass-status-success' :
                                log.attendance_status === 'OVERTIME' ? 'glass-status-warning' :
                                  log.attendance_status === 'EARLY_DEPARTURE' ? 'glass-status-error' :
                                    log.attendance_status === 'UNSCHEDULED' ? 'glass-status-warning' :
                                      'glass-status-secondary'
                            }`}>
                            {log.attendance_status === 'IN_PROGRESS' ? 'In Progress' :
                              log.attendance_status === 'COMPLETED' ? 'Completed' :
                                log.attendance_status === 'OVERTIME' ? 'Overtime' :
                                  log.attendance_status === 'EARLY_DEPARTURE' ? 'Early Departure' :
                                    log.attendance_status === 'UNSCHEDULED' ? 'Unscheduled' :
                                      log.attendance_status || 'Unknown'
                            }
                          </span>
                        </td>
                        <td className="glass-table-cell text-sm glass-text-secondary max-w-xs truncate">
                          {log.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination for time logs */}
          {timeLogs.length > 10 && (
            <Pagination
              currentPage={timeLogPage}
              totalPages={timeLogPages}
              totalItems={totalTimeLogs}
              itemsPerPage={10}
              onPageChange={goToTimeLogPage}
              className="mt-4"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeTracking;
