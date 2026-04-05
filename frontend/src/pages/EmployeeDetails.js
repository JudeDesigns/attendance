import React, { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import {
  ArrowLeftIcon,
  ClockIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { attendanceAPI, employeeAPI, schedulingAPI, reportsAPI } from '../services/api';
import { getPSTDate } from '../utils/timezoneUtils';
import TimesheetModal from '../components/TimesheetModal';
import { useAuth } from '../contexts/AuthContext';

const EmployeeDetails = () => {
  const { employeeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState('week');
  const [selectedDate, setSelectedDate] = useState(getPSTDate());
  const [showTimesheetPreview, setShowTimesheetPreview] = useState(false);
  const [timesheetData, setTimesheetData] = useState(null);
  const [isLoadingTimesheet, setIsLoadingTimesheet] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [forceClockoutModal, setForceClockoutModal] = useState(false);
  const [forceClockoutTime, setForceClockoutTime] = useState('');
  const [forceClockoutReason, setForceClockoutReason] = useState('');

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
      page_size: 500,
    }),
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  // Get breaks for this employee
  const { data: breaksData, isLoading: breaksLoading } = useQuery(
    ['employee-breaks', employeeId, start, end],
    () => attendanceAPI.breaks({
      time_log__employee: employeeId,
      start_date: `${start}T00:00:00`,
      end_date: `${end}T23:59:59`,
      page_size: 500,
    }),
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  // Get active clock-in for this employee (regardless of date range — catches stuck sessions)
  const { data: activeClockInData } = useQuery(
    ['employee-active-clockin', employeeId],
    () => attendanceAPI.timeLogs({
      employee: employeeId,
      status: 'CLOCKED_IN',
      page_size: 5,
    }),
    { refetchInterval: 60000, staleTime: 30000 }
  );

  // Get scheduled shifts for this employee
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery(
    ['employee-shifts', employeeId, start, end],
    () => schedulingAPI.shifts({
      employee: employeeId,
      start_date: start,
      end_date: end,
    }),
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const timeLogs = timeLogsData?.data?.results || timeLogsData?.results || [];
  const breaks = breaksData?.data?.results || breaksData?.results || [];
  const shifts = Array.isArray(shiftsData?.data) ? shiftsData.data : (shiftsData?.data?.results || shiftsData?.results || []);

  // Group breaks by their parent TimeLog ID
  const breaksByTimeLog = breaks.reduce((map, breakItem) => {
    const tlId = breakItem.time_log;
    if (!map[tlId]) map[tlId] = [];
    map[tlId].push(breakItem);
    return map;
  }, {});

  // Build timeline: each TimeLog is a parent entry with its breaks nested
  const timeLogEntries = timeLogs.map(log => ({
    type: 'timelog',
    id: log.id,
    timestamp: log.clock_in_time,
    data: log,
    breaks: (breaksByTimeLog[log.id] || []).sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    ),
  }));

  // Only show breaks that belong to a TimeLog in the current view — drop orphans
  const activityTimeline = [...timeLogEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Group by date for display
  const activitiesByDate = activityTimeline.reduce((groups, activity) => {
    const date = format(new Date(activity.timestamp), 'yyyy-MM-dd');
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {});

  const groupedActivities = Object.entries(activitiesByDate)
    .map(([date, activities]) => ({ date, activities }))
    .sort((a, b) => new Date(b.date + 'T00:00:00') - new Date(a.date + 'T00:00:00'));

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

  const formatBreakDuration = (minutes) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  // Detect active (stuck) clock-in session — from dedicated query, NOT the date-filtered timeLogs
  const activeClockIns = activeClockInData?.data?.results || [];
  const activeLog = activeClockIns[0] || null;
  const activeHours = activeLog
    ? ((Date.now() - new Date(activeLog.clock_in_time).getTime()) / 3600000).toFixed(1)
    : null;

  // Force clock-out mutation
  const forceClockoutMutation = useMutation(
    (data) => attendanceAPI.forceClockout(data),
    {
      onSuccess: () => {
        toast.success('Employee force-clocked out successfully');
        setForceClockoutModal(false);
        setForceClockoutTime('');
        setForceClockoutReason('');
        queryClient.invalidateQueries(['employee-timelogs']);
        queryClient.invalidateQueries(['employee-time-logs']);
        queryClient.invalidateQueries(['employee-breaks']);
        queryClient.invalidateQueries(['employee-active-clockin']);
      },
      onError: (err) => {
        toast.error(err?.response?.data?.detail || 'Failed to force clock-out');
      },
    }
  );

  const openForceClockoutModal = () => {
    // Default to current PST time
    const now = new Date();
    const pstParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const get = (type) => pstParts.find(p => p.type === type)?.value || '';
    setForceClockoutTime(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`);
    setForceClockoutReason('');
    setForceClockoutModal(true);
  };

  const handleForceClockout = () => {
    if (!activeLog || !forceClockoutTime) return;
    forceClockoutMutation.mutate({
      employee_id: employee?.employee_id,
      clockout_time: new Date(forceClockoutTime).toISOString(),
      reason: forceClockoutReason || 'Admin force clock-out from employee details',
    });
  };

  // --- Edit Time Log handlers ---
  const openEditModal = (log) => {
    // Get breaks for this time log from the breaks array
    const logBreaks = breaks.filter(b => b.time_log === log.id);
    const form = {
      clock_in_time: log.clock_in_time ? format(new Date(log.clock_in_time), "yyyy-MM-dd'T'HH:mm") : '',
      clock_out_time: log.clock_out_time ? format(new Date(log.clock_out_time), "yyyy-MM-dd'T'HH:mm") : '',
      notes: '',
      breaks: logBreaks.map(b => ({
        id: b.id,
        start_time: b.start_time ? format(new Date(b.start_time), "yyyy-MM-dd'T'HH:mm") : '',
        end_time: b.end_time ? format(new Date(b.end_time), "yyyy-MM-dd'T'HH:mm") : '',
        break_number: b.break_number || null,
        display_name: b.display_name || b.break_type,
        delete: false,
      })),
    };
    setEditForm(form);
    setEditingLog(log);
  };

  const handleEditSave = async () => {
    if (!editingLog) return;
    setEditSaving(true);
    try {
      const payload = {};
      if (editForm.clock_in_time) payload.clock_in_time = editForm.clock_in_time;
      if (editForm.clock_out_time) payload.clock_out_time = editForm.clock_out_time;
      if (editForm.notes) payload.notes = editForm.notes;
      if (editForm.breaks?.length) {
        payload.breaks = editForm.breaks.map(b => ({
          id: b.id,
          start_time: b.start_time || undefined,
          end_time: b.end_time || undefined,
          break_number: b.break_number || undefined,
          delete: b.delete || false,
        }));
      }
      await attendanceAPI.adminEditTimeLog(editingLog.id, payload);
      toast.success('Time log updated successfully');
      setEditingLog(null);
      queryClient.invalidateQueries(['employee-time-logs', employeeId]);
      queryClient.invalidateQueries(['employee-breaks', employeeId]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update time log');
    } finally {
      setEditSaving(false);
    }
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

  const handlePreviewTimesheet = async () => {
    setShowTimesheetPreview(true);
    setIsLoadingTimesheet(true);
    try {
      const res = await reportsAPI.getDetailedTimesheet({
        start_date: start,
        end_date: end,
        employee_ids: employee?.employee_id,
      });
      setTimesheetData(res.data || res);
    } catch (error) {
      console.error('Failed to load timesheet:', error);
      setTimesheetData([]);
    } finally {
      setIsLoadingTimesheet(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'CLOCKED_IN') {
      return (
        <span className="glass-status-success inline-flex items-center">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
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
              onClick={handlePreviewTimesheet}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <ChartBarIcon className="h-4 w-4 mr-2" />
              Preview Timesheet
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

      {/* Active / Stuck Clock-In Alert */}
      {activeLog && isAdmin && (
        <div className={`rounded-lg border-l-4 p-4 shadow ${
          parseFloat(activeHours) >= 12 ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className={`text-sm font-semibold ${
                parseFloat(activeHours) >= 12 ? 'text-red-800' : 'text-amber-800'
              }`}>
                ⚠️ Active Clock-In — {activeHours} hours
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Clocked in since {format(new Date(activeLog.clock_in_time), 'MMM d, yyyy h:mm a')} and has not clocked out.
              </p>
            </div>
            <button
              onClick={openForceClockoutModal}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              Force Clock-Out
            </button>
          </div>
        </div>
      )}

      {/* Force Clock-Out Modal */}
      {forceClockoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Force Clock-Out</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will clock out <strong>{employee?.first_name} {employee?.last_name}</strong> who has been clocked in for <strong>{activeHours} hours</strong>.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clock-Out Time</label>
                <input
                  type="datetime-local"
                  value={forceClockoutTime}
                  onChange={(e) => setForceClockoutTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea
                  value={forceClockoutReason}
                  onChange={(e) => setForceClockoutReason(e.target.value)}
                  placeholder="e.g., Employee forgot to clock out"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setForceClockoutModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleForceClockout}
                disabled={forceClockoutMutation.isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {forceClockoutMutation.isLoading ? 'Clocking out...' : 'Confirm Force Clock-Out'}
              </button>
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
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
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
                        {(shift.start_time_local || shift.start_time) ? format(new Date(shift.start_time_local || shift.start_time), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(shift.start_time_local || shift.start_time) ? format(new Date(shift.start_time_local || shift.start_time), 'h:mm a') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(shift.end_time_local || shift.end_time) ? format(new Date(shift.end_time_local || shift.end_time), 'h:mm a') : '-'}
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

      {/* Activity Timeline - Card-Based View */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Activity Timeline
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {activityTimeline.length} total entries: {timeLogs.length} time logs, {breaks.length} breaks
              </p>
            </div>
          </div>

          {(isLoading || breaksLoading) ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : activityTimeline.length === 0 ? (
            <div className="text-center py-12">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No activity found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No time logs or breaks found for the selected period.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedActivities.map(({ date, activities }) => (
                <div key={date} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Date Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">
                        {format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {activities.length} {activities.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                  </div>

                  {/* Activities for this day */}
                  <div className="divide-y divide-gray-100">
                    {activities.map((activity) => (
                      <div
                        key={`${activity.type}-${activity.id}`}
                        className="px-4 py-4 hover:bg-gray-50 transition-colors"
                      >
                        {activity.type === 'timelog' && (
                          // Time Log Card with nested breaks
                          <div>
                            <div className="flex items-start space-x-4">
                              {/* Icon */}
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <ClockIcon className="w-5 h-5 text-blue-600" />
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">
                                      Work Shift
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                      {format(new Date(activity.data.clock_in_time), 'h:mm a')}
                                      {' → '}
                                      {activity.data.clock_out_time
                                        ? format(new Date(activity.data.clock_out_time), 'h:mm a')
                                        : <span className="text-green-600 font-medium">Active</span>
                                      }
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {activity.data.duration_hours && (
                                      <span className={`text-sm font-medium ${activity.data.duration_hours > 8 ? 'text-orange-600' : 'text-gray-700'}`}>
                                        {formatDuration(activity.data.duration_hours)}
                                      </span>
                                    )}
                                    {activity.data.clock_out_time ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Completed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-1.5"></div>
                                        In Progress
                                      </span>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => openEditModal(activity.data)}
                                        className="ml-2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                        title="Edit Time Log"
                                      >
                                        <PencilSquareIcon className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {activity.data.notes && (
                                  <p className="text-xs text-gray-500 mt-2 italic">
                                    {activity.data.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Nested breaks for this shift */}
                            {activity.breaks && activity.breaks.length > 0 && (
                              <div className="ml-14 mt-3 border-l-2 border-purple-200 pl-4 space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                  Breaks ({activity.breaks.length})
                                </p>
                                {activity.breaks.map((brk) => (
                                  <div key={brk.id} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-6 h-6 bg-purple-50 rounded flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <span className="text-xs text-gray-600">
                                        {brk.display_name || brk.break_type || 'Break'}
                                        {brk.notes && brk.notes.startsWith('WAIVED') && (
                                          <span className="ml-1 text-yellow-600 font-medium">(Waived)</span>
                                        )}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {format(new Date(brk.start_time), 'h:mm a')}
                                        {' → '}
                                        {brk.end_time
                                          ? format(new Date(brk.end_time), 'h:mm a')
                                          : <span className="text-orange-600 font-medium">On Break</span>
                                        }
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {brk.duration_minutes ? (
                                        <span className="text-xs font-medium text-gray-600">
                                          {formatBreakDuration(brk.duration_minutes)}
                                        </span>
                                      ) : null}
                                      {brk.end_time ? (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                          Done
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-1"></div>
                                          Active
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}

                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Time Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Time Log</h3>
              <button onClick={() => setEditingLog(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Clock In */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clock In</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editForm.clock_in_time || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, clock_in_time: e.target.value }))}
                />
              </div>

              {/* Clock Out */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clock Out</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={editForm.clock_out_time || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, clock_out_time: e.target.value }))}
                />
              </div>

              {/* Breaks */}
              {editForm.breaks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Breaks</h4>
                  <div className="space-y-3">
                    {editForm.breaks.map((brk, idx) => (
                      <div key={brk.id} className={`p-3 rounded-lg border ${brk.delete ? 'bg-red-50 border-red-200 opacity-60' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {brk.display_name || `Break ${brk.break_number || idx + 1}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editForm.breaks];
                              updated[idx] = { ...updated[idx], delete: !updated[idx].delete };
                              setEditForm(f => ({ ...f, breaks: updated }));
                            }}
                            className={`text-xs px-2 py-1 rounded ${brk.delete ? 'bg-gray-200 text-gray-600' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                          >
                            {brk.delete ? 'Undo Delete' : 'Delete'}
                          </button>
                        </div>
                        {!brk.delete && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Start</label>
                              <input
                                type="datetime-local"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                                value={brk.start_time || ''}
                                onChange={(e) => {
                                  const updated = [...editForm.breaks];
                                  updated[idx] = { ...updated[idx], start_time: e.target.value };
                                  setEditForm(f => ({ ...f, breaks: updated }));
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">End</label>
                              <input
                                type="datetime-local"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                                value={brk.end_time || ''}
                                onChange={(e) => {
                                  const updated = [...editForm.breaks];
                                  updated[idx] = { ...updated[idx], end_time: e.target.value };
                                  setEditForm(f => ({ ...f, breaks: updated }));
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Reason for editing..."
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Timesheet Modal */}
      <TimesheetModal
        visible={showTimesheetPreview}
        onClose={() => { setShowTimesheetPreview(false); setTimesheetData(null); }}
        title={`Timesheet — ${employee.user.first_name} ${employee.user.last_name} — ${start} to ${end}`}
        timesheetData={timesheetData}
        isLoading={isLoadingTimesheet}
        csvFilename={`${employee.user.first_name}_${employee.user.last_name}_timesheet_${start}_to_${end}.csv`}
      />
    </div>
  );
};

export default EmployeeDetails;
