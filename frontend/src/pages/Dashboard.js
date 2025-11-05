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

  // Get employee status
  const { data: statusData, refetch: refetchStatus } = useQuery(
    ['employeeStatus', user?.employee_profile?.id],
    () => employeeAPI.status(user?.employee_profile?.id),
    {
      enabled: !!user?.employee_profile?.id,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Get today's time logs
  const { data: timeLogsData } = useQuery(
    ['timeLogs', user?.employee_profile?.id],
    () => attendanceAPI.timeLogs({
      employee: user?.employee_profile?.id,
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(), 'yyyy-MM-dd'),
    }),
    {
      enabled: !!user?.employee_profile?.id,
    }
  );

  useEffect(() => {
    if (statusData?.data) {
      setCurrentStatus(statusData.data);
    }
  }, [statusData]);

  const quickClockIn = async () => {
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
  const currentLog = todaysLogs.find(log => !log.clock_out_time);
  const completedLogs = todaysLogs.filter(log => log.clock_out_time);

  // Calculate total hours including current active session
  const totalHoursToday = todaysLogs.reduce((total, log) => {
    return total + (log.duration_hours || 0);
  }, 0);

  const isCurrentlyClockedIn = currentStatus?.current_status === 'CLOCKED_IN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.first_name}!
        </h1>
        <p className="text-gray-600">
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </p>
      </div>

      {/* Break Manager */}
      <BreakManager />

      {/* Quick Actions */}
      <div className="glass-card glass-fade-in p-6">
        <h2 className="text-lg font-medium glass-text-primary mb-4">Quick Actions</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          {isCurrentlyClockedIn ? (
            <button
              onClick={quickClockOut}
              className="glass-button flex items-center justify-center text-red-600 hover:text-red-700 font-semibold"
            >
              <ClockIcon className="h-4 w-4 mr-2" />
              Clock Out
            </button>
          ) : (
            <button
              onClick={quickClockIn}
              className="glass-button flex items-center justify-center text-green-600 hover:text-green-700 font-semibold"
            >
              <ClockIcon className="h-4 w-4 mr-2" />
              Clock In
            </button>
          )}

          {/* Break Button */}
          <BreakButton className="flex-1 sm:flex-initial" />

          <button
            onClick={() => navigate('/schedule')}
            className="glass-button flex items-center justify-center glass-text-secondary hover:glass-text-primary"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            View Schedule
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current Status */}
        <div className="glass-card glass-fade-in overflow-hidden">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Current Status
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {currentStatus?.current_status?.replace('_', ' ') || 'Loading...'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className={`px-5 py-3 ${
            isCurrentlyClockedIn ? 'bg-green-50' : 'bg-gray-50'
          }`}>
            <div className="text-sm">
              <span className={`font-medium ${
                isCurrentlyClockedIn ? 'text-green-700' : 'text-gray-700'
              }`}>
                {isCurrentlyClockedIn ? 'Currently Working' : 'Not Clocked In'}
              </span>
            </div>
          </div>
        </div>

        {/* Hours Today */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Hours Today
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalHoursToday.toFixed(1)}h
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className={`px-5 py-3 ${
            totalHoursToday > 8 ? 'bg-yellow-50' : 'bg-gray-50'
          }`}>
            <div className="text-sm">
              <span className={`font-medium ${
                totalHoursToday > 8 ? 'text-yellow-700' : 'text-gray-700'
              }`}>
                {totalHoursToday > 8 ? 'Overtime' : 'Regular Hours'}
              </span>
            </div>
          </div>
        </div>

        {/* Clock In Time */}
        {currentLog && (
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CalendarIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Clocked In At
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
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
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ExclamationIcon className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Alert
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      Overtime
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-yellow-700">
                  You've worked {totalHoursToday.toFixed(1)} hours today
                </span>
              </div>
            </div>
          </div>
        )}
      </div>



      {/* Recent Activity */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Today's Activity
          </h3>
          
          {todaysLogs.length === 0 ? (
            <p className="text-gray-500">No activity recorded today.</p>
          ) : (
            <div className="space-y-3">
              {todaysLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Clock In: {format(new Date(log.clock_in_time), 'h:mm a')}
                    </p>
                    {log.clock_out_time && (
                      <p className="text-sm text-gray-500">
                        Clock Out: {format(new Date(log.clock_out_time), 'h:mm a')} 
                        ({log.duration_hours?.toFixed(1)}h)
                      </p>
                    )}
                    {log.notes && (
                      <p className="text-xs text-gray-400 mt-1">{log.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.clock_out_time 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {log.clock_out_time ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
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
