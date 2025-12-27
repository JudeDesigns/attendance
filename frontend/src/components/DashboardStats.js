import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  UsersIcon,
  ClockIcon,
  ArrowTrendingUpIcon as TrendingUpIcon,
  CalendarIcon,
  ArrowPathIcon as RefreshIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI, employeeAPI } from '../services/api';
import { useQuery } from 'react-query';
import { formatDurationCompact } from '../utils/helpers';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const DashboardStats = () => {
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Fetch attendance statistics with automatic polling
  const { data: attendanceStats, refetch: refetchStats, isLoading, error } = useQuery(
    'attendanceStats',
    () => attendanceAPI.statistics(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds for near real-time updates
      onSuccess: () => {
        setLastUpdated(new Date());
      }
    }
  );

  // Fetch employee statistics for total employee count
  const { data: employeeStats, refetch: refetchEmployeeStats } = useQuery(
    'employeeStats',
    () => employeeAPI.statistics(),
    {
      refetchInterval: 300000, // Refetch every 5 minutes
    }
  );

  const handleRefresh = () => {
    refetchStats();
    refetchEmployeeStats();
    setLastUpdated(new Date());
  };

  // Combine data from different sources
  const stats = {
    active_employees: employeeStats?.active || 0,
    today_attendance: attendanceStats?.today?.total || 0,
    currently_clocked_in: attendanceStats?.today?.clocked_in || 0,
    week_total_hours: attendanceStats?.this_week?.total_hours || 0
  };

  // Prepare chart data using real API data only (no dummy data)
  const weeklyHoursData = {
    labels: attendanceStats?.weekly_breakdown?.map(day => day.day_name) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Hours Worked',
        data: attendanceStats?.weekly_breakdown?.map(day => day.hours) || [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
    ],
  };

  const attendanceStatusData = {
    labels: ['Present', 'Clocked In', 'Absent'],
    datasets: [
      {
        data: [
          stats.today_attendance || 0,
          stats.currently_clocked_in || 0,
          Math.max(0, (stats.active_employees || 0) - (stats.today_attendance || 0))
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Monthly trend - use real data from monthly_breakdown
  const monthlyTrendData = {
    labels: attendanceStats?.monthly_breakdown?.map(week => week.label) || [],
    datasets: [
      {
        label: 'Weekly Hours',
        data: attendanceStats?.monthly_breakdown?.map(week => week.hours) || [],
        fill: true,
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };



  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white overflow-hidden shadow rounded-lg animate-pulse">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-6 w-6 bg-gray-300 rounded"></div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <div className="h-4 bg-gray-300 rounded mb-2"></div>
                    <div className="h-6 bg-gray-300 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h2>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshIcon className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading analytics data
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>Unable to fetch dashboard statistics. Please try refreshing or contact support if the issue persists.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Analytics</h2>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
              Auto-refresh: 30s
            </span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Employees
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.active_employees}
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
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Today's Attendance
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.today_attendance}
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
                <ClockIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Currently Clocked In
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.currently_clocked_in}
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
                <TrendingUpIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Week Total Hours
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {formatDurationCompact(stats.week_total_hours)}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Hours Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Hours</h3>
          <div className="h-64">
            <Bar data={weeklyHoursData} options={chartOptions} />
          </div>
        </div>

        {/* Attendance Status Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Today's Attendance</h3>
          <div className="h-64">
            <Doughnut data={attendanceStatusData} options={doughnutOptions} />
          </div>
        </div>

        {/* Monthly Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Trend</h3>
          <div className="h-64">
            <Line data={monthlyTrendData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
