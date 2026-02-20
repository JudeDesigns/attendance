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
  PlayCircleIcon,
  StopCircleIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import BreakManager from '../components/BreakManager';
import BreakButton from '../components/BreakButton';
import { getPSTDateString, formatPSTDate } from '../utils/timezoneUtils';

const Dashboard = () => {
  const { user, isDriver, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [currentStatus, setCurrentStatus] = useState(null);
  const [clockLoading, setClockLoading] = useState(false);

  // Redirect admin users to admin dashboard
  useEffect(() => {
    if (isAdmin) navigate('/admin', { replace: true });
  }, [isAdmin, navigate]);

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
      refetchInterval: 30000,
      retry: 3,
    }
  );

  const { data: qrEnforcementData } = useQuery(
    ['qrEnforcementStatus', user?.employee_profile?.id],
    () => attendanceAPI.qrEnforcementStatus(),
    { enabled: !!user?.employee_profile?.id, refetchInterval: 30000 }
  );

  const { data: timeLogsData } = useQuery(
    ['timeLogs', user?.employee_profile?.id],
    () => {
      const pstToday = getPSTDateString();
      return attendanceAPI.timeLogs({
        employee: user?.employee_profile?.id,
        start_date: pstToday,
        end_date: pstToday,
      });
    },
    { enabled: !!user?.employee_profile?.id }
  );

  const { data: breaksData } = useQuery(
    ['breaks', user?.employee_profile?.id],
    () => {
      const pstToday = getPSTDateString();
      return attendanceAPI.breaks({
        start_date: `${pstToday}T00:00:00`,
        end_date: `${pstToday}T23:59:59`,
      });
    },
    { enabled: !!user?.employee_profile?.id }
  );

  useEffect(() => {
    if (statusData?.data) {
      const status = statusData.data.is_clocked_in ? 'CLOCKED_IN' : 'CLOCKED_OUT';
      setCurrentStatus({ current_status: status, ...statusData.data });
    }
  }, [statusData]);

  const shiftStatus = statusData?.data || {};
  const qrEnforcement = qrEnforcementData?.data || {};
  const isCurrentlyClockedIn = currentStatus?.current_status === 'CLOCKED_IN';

  const todaysLogs = timeLogsData?.data?.results || [];
  const todaysBreaks = breaksData?.data?.results || [];
  const currentLog = todaysLogs.find(log => !log.clock_out_time);

  const totalHoursToday = todaysLogs.reduce((total, log) => total + (log.duration_hours || 0), 0);

  const todaysActivity = [
    ...todaysLogs.map(log => ({ type: 'timelog', id: log.id, timestamp: log.clock_in_time, data: log })),
    ...todaysBreaks.map(b => ({ type: 'break', id: b.id, timestamp: b.start_time, data: b })),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const formatDuration = (hours) => {
    if (!hours || hours === 0) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getGPS = async () => {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation?.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch { return {}; }
  };

  const quickClockIn = async () => {
    if (!shiftStatus?.can_clock_in) {
      toast.error('No scheduled shift. You can only clock in within 15 min of your shift start.');
      return;
    }
    if (qrEnforcement?.requires_qr_for_clock_in) {
      toast.error('QR code required. Please use the Clock In/Out page.');
      navigate('/clock-in');
      return;
    }
    setClockLoading(true);
    try {
      const gpsData = await getGPS();
      await attendanceAPI.clockIn({ method: 'PORTAL', notes: 'Quick clock-in from dashboard', ...gpsData });
      toast.success('✅ Clocked in successfully!');
      refetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Clock-in failed');
    } finally {
      setClockLoading(false);
    }
  };

  const quickClockOut = async () => {
    if (!shiftStatus?.can_clock_out) {
      toast.error('No active shift found to clock out from.');
      return;
    }
    if (qrEnforcement?.requires_qr_for_clock_out) {
      toast.error('QR code required. Please use the Clock In/Out page.');
      navigate('/clock-in');
      return;
    }
    setClockLoading(true);
    try {
      const gpsData = await getGPS();
      await attendanceAPI.clockOut({ method: 'PORTAL', notes: 'Quick clock-out from dashboard', ...gpsData });
      toast.success('✅ Clocked out successfully!');
      refetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Clock-out failed');
    } finally {
      setClockLoading(false);
    }
  };

  // ── Clock-in start time display ────────────────────────────────────────────
  const clockInDisplayTime = currentLog?.clock_in_time
    ? format(new Date(currentLog.clock_in_time), 'h:mm a')
    : null;

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hi, {user?.first_name}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {formatPSTDate(new Date(), 'EEEE, MMMM do')}
        </p>
      </div>

      {/* ── Break Manager (shown when on break) ───────────────────────────── */}
      <BreakManager />

      {/* ── Hero Status Card ─────────────────────────────────────────────── */}
      <div
        className={`rounded-2xl p-5 md:p-6 shadow-lg transition-all duration-500 ${isStatusLoading
            ? 'bg-gray-100'
            : isCurrentlyClockedIn
              ? 'bg-gradient-to-br from-green-50 to-emerald-100 border border-emerald-200'
              : 'bg-gradient-to-br from-slate-50 to-gray-100 border border-gray-200'
          }`}
      >
        <div className="flex items-center justify-between">
          {/* Status indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${isCurrentlyClockedIn ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
              >
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              {isCurrentlyClockedIn && (
                <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-40 status-pulse" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
              <p className={`text-lg font-bold leading-tight ${isCurrentlyClockedIn ? 'text-emerald-700' : 'text-gray-700'}`}>
                {isStatusLoading ? 'Loading…' : isCurrentlyClockedIn ? 'Clocked In' : 'Clocked Out'}
              </p>
              {clockInDisplayTime && (
                <p className="text-xs text-gray-500 mt-0.5">Since {clockInDisplayTime}</p>
              )}
            </div>
          </div>

          {/* Hours pill */}
          <div className="text-right">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Today</p>
            <p className={`text-2xl font-bold ${totalHoursToday > 8 ? 'text-amber-600' : 'text-gray-800'}`}>
              {formatDuration(totalHoursToday)}
            </p>
            {totalHoursToday > 8 && (
              <p className="text-xs text-amber-600 font-medium">Overtime</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          {isCurrentlyClockedIn ? (
            <button
              onClick={quickClockOut}
              disabled={clockLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold py-3.5 px-5 rounded-xl shadow transition-all duration-150 disabled:opacity-60 text-base"
            >
              <StopCircleIcon className="h-5 w-5" />
              {clockLoading ? 'Processing…' : 'Clock Out'}
            </button>
          ) : (
            <button
              onClick={quickClockIn}
              disabled={clockLoading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold py-3.5 px-5 rounded-xl shadow transition-all duration-150 disabled:opacity-60 text-base"
            >
              <PlayCircleIcon className="h-5 w-5" />
              {clockLoading ? 'Processing…' : 'Clock In'}
            </button>
          )}

          <BreakButton
            currentStatus={currentStatus}
            className="flex-1 sm:flex-initial py-3.5 text-base font-semibold rounded-xl"
          />

          <button
            onClick={() => navigate('/clock-in')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3.5 px-5 rounded-xl shadow-sm transition-all duration-150 text-base"
          >
            <ClockIcon className="h-5 w-5" />
            QR Scan
          </button>
        </div>
      </div>

      {/* ── Quick nav tiles (mobile) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[
          { label: 'Schedule', icon: CalendarIcon, href: '/schedule', color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'Time Logs', icon: ChartBarIcon, href: '/time-tracking', color: 'bg-purple-50 text-purple-600 border-purple-100' },
        ].map(tile => (
          <button
            key={tile.label}
            onClick={() => navigate(tile.href)}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border ${tile.color} active:scale-95 transition-transform duration-100`}
          >
            <tile.icon className="h-7 w-7" />
            <span className="text-sm font-semibold">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* ── Today's Activity Timeline ─────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Today's Activity</h3>
        </div>

        {todaysActivity.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <ClockIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No activity recorded today.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todaysActivity.map(activity => (
              <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 px-5 py-3.5">
                {/* Icon */}
                <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${activity.type === 'timelog'
                    ? 'bg-blue-100'
                    : 'bg-orange-100'
                  }`}>
                  <ClockIcon className={`h-4 w-4 ${activity.type === 'timelog' ? 'text-blue-600' : 'text-orange-500'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {activity.type === 'timelog' ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.data.clock_out_time ? 'Work Session' : 'Working now'}
                      </p>
                      <p className="text-xs text-gray-500">
                        In: {format(new Date(activity.data.clock_in_time), 'h:mm a')}
                        {activity.data.clock_out_time && (
                          <> · Out: {format(new Date(activity.data.clock_out_time), 'h:mm a')}</>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.data.end_time ? 'Break' : 'On break now'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(activity.data.start_time), 'h:mm a')}
                        {activity.data.end_time && (
                          <> – {format(new Date(activity.data.end_time), 'h:mm a')} ({activity.data.duration_minutes}m)</>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {/* Badge */}
                <span className={`flex-shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${activity.type === 'timelog'
                    ? activity.data.clock_out_time
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                    : activity.data.end_time
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                  {activity.type === 'timelog'
                    ? (activity.data.clock_out_time
                      ? formatDuration(activity.data.duration_hours)
                      : 'Active')
                    : (activity.data.end_time ? `${activity.data.duration_minutes}m` : 'Active')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
