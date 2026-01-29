import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { attendanceAPI, employeeAPI } from '../services/api';
import { useQuery } from 'react-query';
import {
  ClockIcon,
  CalendarIcon,
  ChartBarIcon,
  ExclamationTriangleIcon as ExclamationIcon,
} from '@heroicons/react/24/outline';
import { format, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import BreakManager from '../components/BreakManager';
import BreakButton from '../components/BreakButton';
import { getPSTDateString, formatPSTDate } from '../utils/timezoneUtils';


const Dashboard = () => {
  const { user, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [currentStatus, setCurrentStatus] = useState(null);

  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, navigate]);

  // Get employee status using the robust shift_status endpoint (which is confirmed working)
  // USER-SPECIFIC CACHE KEY to prevent data leakage between users
  const {
    data: statusData,
    refetch: refetchStatus,
    isLoading: isStatusLoading,
    error: statusError
  } = useQuery(
    ['shiftStatus', user?.employee_profile?.id],
    () => attendanceAPI.shiftStatus(),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 30000, // Refetch every 30 seconds
      retry: 3,
      onError: (err) => {
        console.error('Error fetching status:', err);
      }
    }
  );

  // Get QR enforcement status - USER-SPECIFIC CACHE KEY
  const { data: qrEnforcementData } = useQuery(
    ['qrEnforcementStatus', user?.employee_profile?.id],
    () => attendanceAPI.qrEnforcementStatus(),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 30000,
    }
  );

  // Get today's time logs (using PST timezone, not user's local timezone)
  const { data: timeLogsData } = useQuery(
    ['timeLogs', user?.employee_profile?.id],
    () => {
      const pstToday = getPSTDateString(); // Get "today" in PST, not user's local timezone
      return attendanceAPI.timeLogs({
        employee: user?.employee_profile?.id,
        start_date: pstToday,
        end_date: pstToday,
      });
    },
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  // Get today's breaks (using PST timezone)
  const { data: breaksData } = useQuery(
    ['breaks', user?.employee_profile?.id],
    () => {
      const pstToday = getPSTDateString(); // Get "today" in PST, not user's local timezone
      return attendanceAPI.breaks({
        start_date: `${pstToday}T00:00:00`,
        end_date: `${pstToday}T23:59:59`,
      });
    },
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  useEffect(() => {
    if (statusData?.data) {
      // Normalize data structure to match what the UI expects
      // The shift_status endpoint now returns { is_clocked_in: boolean, ... }
      // The UI expects { current_status: 'CLOCKED_IN' | 'CLOCKED_OUT' }
      const status = statusData.data.is_clocked_in ? 'CLOCKED_IN' : 'CLOCKED_OUT';
      setCurrentStatus({
        current_status: status,
        ...statusData.data
      });
    }
  }, [statusData]);

  const shiftStatus = statusData?.data || {};
  const qrEnforcement = qrEnforcementData?.data || {};

  const quickClockIn = async () => {
    // Check if shift exists and clock-in is allowed
    if (!shiftStatus?.can_clock_in) {
      toast.error('No scheduled shift found. You can only clock in during scheduled shifts or within 15 minutes before shift start.');
      return;
    }

    // Check QR enforcement
    if (qrEnforcement?.requires_qr_for_clock_in) {
      toast.error('QR code required for clock-in. Please use the Clock In/Out page.');
      return;
    }

    try {
      await attendanceAPI.clockIn({
        method: 'PORTAL',
        notes: 'Quick clock-in from dashboard',
      });
      toast.success('Clocked in successfully!');
      refetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Clock-in failed');
    }
  };

  const quickClockOut = async () => {
    // Check if clock-out is allowed
    if (!shiftStatus?.can_clock_out) {
      toast.error('No active scheduled shift found. You can only clock out during an active scheduled shift.');
      return;
    }

    // Check QR enforcement
    if (qrEnforcement?.requires_qr_for_clock_out) {
      toast.error('QR code required for clock-out. Please use the Clock In/Out page.');
      return;
    }

    try {
      await attendanceAPI.clockOut({
        method: 'PORTAL',
        notes: 'Quick clock-out from dashboard',
      });
      toast.success('Clocked out successfully!');
      refetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.message || 'Clock-out failed');
    }
  };

  const todaysLogs = timeLogsData?.data?.results || [];
  const todaysBreaks = breaksData?.data?.results || [];
  const currentLog = todaysLogs.find(log => !log.clock_out_time);
  const completedLogs = todaysLogs.filter(log => log.clock_out_time);

  // Merge time logs and breaks into a unified activity timeline
  const todaysActivity = [
    ...todaysLogs.map(log => ({
      type: 'timelog',
      id: log.id,
      timestamp: log.clock_in_time,
      data: log
    })),
    ...todaysBreaks.map(breakItem => ({
      type: 'break',
      id: breakItem.id,
      timestamp: breakItem.start_time,
      data: breakItem
    }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by most recent first

  // Calculate total hours including current active session
  const totalHoursToday = todaysLogs.reduce((total, log) => {
    return total + (log.duration_hours || 0);
  }, 0);

  // Helper function to format duration
  const formatDuration = (hours) => {
    if (!hours || hours === 0) return '0h 0m';

    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);

    if (h === 0) {
      return `${m}m`;
    } else if (m === 0) {
      return `${h}h`;
    } else {
      return `${h}h ${m}m`;
    }
  };

  const isCurrentlyClockedIn = currentStatus?.current_status === 'CLOCKED_IN';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name}!
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          {formatPSTDate(new Date(), 'EEEE, MMMM do, yyyy')} PST
        </p>
      </div>

      {/* Break Manager */}
      <BreakManager />

      {/* Quick Actions - Mobile Responsive */}
      <div className="glass-card glass-fade-in p-4 md:p-6">
        <h2 className="text-base md:text-lg font-medium glass-text-primary mb-3 md:mb-4">Quick Actions</h2>
        <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
          {isCurrentlyClockedIn ? (
            <button
              onClick={quickClockOut}
              className="glass-button flex items-center justify-center text-red-600 hover:text-red-700 font-semibold py-3 md:py-2 text-sm md:text-base"
            >
              <ClockIcon className="h-5 w-5 md:h-4 md:w-4 mr-2" />
              Clock Out
            </button>
          ) : (
            <button
              onClick={quickClockIn}
              className="glass-button flex items-center justify-center text-green-600 hover:text-green-700 font-semibold py-3 md:py-2 text-sm md:text-base"
            >
              <ClockIcon className="h-5 w-5 md:h-4 md:w-4 mr-2" />
              Clock In
            </button>
          )}

          {/* Break Button */}
          <BreakButton
            className="flex-1 sm:flex-initial py-3 md:py-2"
            currentStatus={currentStatus}
          />

          <button
            onClick={() => navigate('/schedule')}
            className="glass-button flex items-center justify-center glass-text-secondary hover:glass-text-primary py-3 md:py-2 text-sm md:text-base"
          >
            <CalendarIcon className="h-5 w-5 md:h-4 md:w-4 mr-2" />
            View Schedule
          </button>
        </div>
      </div>

      {/* Status Cards - Mobile Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Current Status */}
        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-4 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
              </div>
              <div className="ml-3 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium text-gray-500 truncate">
                    Current Status
                  </dt>
                  <dd className="text-base md:text-lg font-medium text-gray-900">
                    {isStatusLoading ? 'Loading...' :
                      statusError ? 'Status Unavailable' :
                        currentStatus?.current_status?.replace('_', ' ') || 'Not Clocked In'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className={`px-4 md:px-5 py-2 md:py-3 ${isStatusLoading || statusError ? 'bg-red-50' :
            isCurrentlyClockedIn ? 'bg-green-50' : 'bg-gray-50'
            }`}>
            <div className="text-xs md:text-sm">
              <span className={`font-medium ${isStatusLoading ? 'text-gray-500' :
                statusError ? 'text-red-700' :
                  isCurrentlyClockedIn ? 'text-green-700' : 'text-gray-700'
                }`}>
                {isStatusLoading ? 'Checking status...' :
                  statusError ? `Error: ${statusError.response?.data?.detail || statusError.message || 'Connection Failed'}` :
                    isCurrentlyClockedIn ? 'Currently Working' : 'Not Clocked In'}
              </span>
            </div>
          </div>
        </div>

        {/* Hours Today */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-4 md:p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
              </div>
              <div className="ml-3 md:ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-xs md:text-sm font-medium text-gray-500 truncate">
                    Hours Today
                  </dt>
                  <dd className="text-base md:text-lg font-medium text-gray-900">
                    {formatDuration(totalHoursToday)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className={`px-4 md:px-5 py-2 md:py-3 ${totalHoursToday > 8 ? 'bg-yellow-50' : 'bg-gray-50'
            }`}>
            <div className="text-xs md:text-sm">
              <span className={`font-medium ${totalHoursToday > 8 ? 'text-yellow-700' : 'text-gray-700'
                }`}>
                {totalHoursToday > 8 ? 'Overtime' : 'Regular Hours'}
              </span>
            </div>
          </div>
        </div>

        {/* Clock In Time */}
        {currentLog && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4 md:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarIcon className="h-5 w-5 md:h-6 md:w-6 text-gray-400" />
                </div>
                <div className="ml-3 md:ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-xs md:text-sm font-medium text-gray-500 truncate">
                      Clocked In At
                    </dt>
                    <dd className="text-base md:text-lg font-medium text-gray-900">
                      {format(new Date(currentLog.clock_in_time), 'h:mm a')}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {totalHoursToday > 8 && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-4 md:p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationIcon className="h-5 w-5 md:h-6 md:w-6 text-yellow-400" />
                </div>
                <div className="ml-3 md:ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-xs md:text-sm font-medium text-gray-500 truncate">
                      Alert
                    </dt>
                    <dd className="text-base md:text-lg font-medium text-gray-900">
                      Overtime
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 px-4 md:px-5 py-2 md:py-3">
              <div className="text-xs md:text-sm">
                <span className="font-medium text-yellow-700">
                  You've worked {formatDuration(totalHoursToday)} today
                </span>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Recent Activity - Mobile Responsive */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-4 sm:p-6">
          <h3 className="text-base md:text-lg leading-6 font-medium text-gray-900 mb-3 md:mb-4">
            Today's Activity
          </h3>

          {todaysActivity.length === 0 ? (
            <p className="text-sm md:text-base text-gray-500">No activity recorded today.</p>
          ) : (
            <div className="space-y-3">
              {todaysActivity.map((activity) => (
                <div key={`${activity.type}-${activity.id}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-200 last:border-b-0 gap-2">
                  {activity.type === 'timelog' ? (
                    // Time Log Display
                    <>
                      <div className="flex-1">
                        <p className="text-sm md:text-base font-medium text-gray-900">
                          Clock In: {format(new Date(activity.data.clock_in_time), 'h:mm a')}
                        </p>
                        {activity.data.clock_out_time && (
                          <p className="text-xs md:text-sm text-gray-500">
                            Clock Out: {format(new Date(activity.data.clock_out_time), 'h:mm a')}
                            ({formatDuration(activity.data.duration_hours)})
                          </p>
                        )}
                        {!activity.data.clock_out_time && activity.data.duration_hours && (
                          <p className="text-xs md:text-sm text-green-600">
                            Currently working: {formatDuration(activity.data.duration_hours)}
                          </p>
                        )}
                        {activity.data.notes && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{activity.data.notes}</p>
                        )}
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activity.data.clock_out_time
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {activity.data.clock_out_time ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                    </>
                  ) : (
                    // Break Display
                    <>
                      <div className="flex-1">
                        <p className="text-sm md:text-base font-medium text-gray-900">
                          Break Started: {format(new Date(activity.data.start_time), 'h:mm a')}
                        </p>
                        {activity.data.end_time && (
                          <p className="text-xs md:text-sm text-gray-500">
                            Break Ended: {format(new Date(activity.data.end_time), 'h:mm a')}
                            ({activity.data.duration_minutes} minutes)
                          </p>
                        )}
                        {!activity.data.end_time && (
                          <p className="text-xs md:text-sm text-orange-600">
                            Break in progress
                          </p>
                        )}
                        {activity.data.notes && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{activity.data.notes}</p>
                        )}
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activity.data.end_time
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                          }`}>
                          {activity.data.end_time ? 'Break Completed' : 'On Break'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
