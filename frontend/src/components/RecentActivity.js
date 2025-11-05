import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { 
  ClockIcon, 
  ArrowRightOnRectangleIcon as LoginIcon,
  ArrowLeftOnRectangleIcon as LogoutIcon,
  UserIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { attendanceAPI, notificationAPI } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';

const RecentActivity = ({ limit = 10 }) => {
  const [activities, setActivities] = useState([]);

  // WebSocket connection for real-time activity updates
  const { lastMessage } = useWebSocket('/ws/notifications/', {
    onMessage: (message) => {
      if (message.type === 'attendance_update') {
        // Add new activity to the top of the list
        const newActivity = {
          id: `activity_${Date.now()}`,
          type: message.data.action,
          user: message.data.employee_name,
          timestamp: message.data.timestamp,
          details: message.data
        };
        setActivities(prev => [newActivity, ...prev.slice(0, limit - 1)]);
      }
    }
  });

  // Fetch recent time logs
  const { data: timeLogs } = useQuery(
    'recentTimeLogs',
    () => attendanceAPI.list({ limit: 20, ordering: '-created_at' }),
    {
      refetchInterval: 60000, // Refetch every minute
    }
  );

  // Fetch recent notifications for activity context
  const { data: notifications } = useQuery(
    'recentNotifications',
    () => notificationAPI.list({ limit: 10 }),
    {
      refetchInterval: 60000,
    }
  );

  // Process and combine activities
  useEffect(() => {
    const processedActivities = [];

    // Process time logs
    if (timeLogs?.results) {
      timeLogs.results.forEach(log => {
        // Clock in activity
        processedActivities.push({
          id: `clock_in_${log.id}`,
          type: 'clock_in',
          user: log.employee_name,
          timestamp: log.clock_in_time,
          details: {
            location: log.clock_in_location_name,
            coordinates: log.clock_in_coordinates
          }
        });

        // Clock out activity (if completed)
        if (log.clock_out_time) {
          processedActivities.push({
            id: `clock_out_${log.id}`,
            type: 'clock_out',
            user: log.employee_name,
            timestamp: log.clock_out_time,
            details: {
              duration: log.duration_hours,
              location: log.clock_out_location_name,
              overtime: log.is_overtime
            }
          });
        }
      });
    }

    // Process notifications for additional context
    if (notifications?.results) {
      notifications.results.forEach(notification => {
        if (notification.notification_type === 'ATTENDANCE_ALERT') {
          processedActivities.push({
            id: `notification_${notification.id}`,
            type: 'alert',
            user: 'System',
            timestamp: notification.created_at,
            details: {
              message: notification.message,
              data: notification.data
            }
          });
        }
      });
    }

    // Sort by timestamp and limit
    const sortedActivities = processedActivities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);

    setActivities(sortedActivities);
  }, [timeLogs, notifications, limit]);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'clock_in':
        return <LoginIcon className="h-5 w-5 text-green-500" />;
      case 'clock_out':
        return <LogoutIcon className="h-5 w-5 text-blue-500" />;
      case 'alert':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'break_start':
        return <ClockIcon className="h-5 w-5 text-orange-500" />;
      case 'break_end':
        return <ClockIcon className="h-5 w-5 text-purple-500" />;
      default:
        return <UserIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'clock_in':
        return (
          <span>
            <span className="font-medium">{activity.user}</span> clocked in
            {activity.details.location && (
              <span className="text-gray-500"> at {activity.details.location}</span>
            )}
          </span>
        );
      case 'clock_out':
        return (
          <span>
            <span className="font-medium">{activity.user}</span> clocked out
            {activity.details.duration && (
              <span className="text-gray-500"> ({activity.details.duration}h worked)</span>
            )}
            {activity.details.overtime && (
              <span className="text-orange-600 font-medium"> - Overtime</span>
            )}
          </span>
        );
      case 'alert':
        return (
          <span>
            <span className="font-medium">System Alert:</span> {activity.details.message}
          </span>
        );
      case 'break_start':
        return (
          <span>
            <span className="font-medium">{activity.user}</span> started break
          </span>
        );
      case 'break_end':
        return (
          <span>
            <span className="font-medium">{activity.user}</span> ended break
          </span>
        );
      default:
        return (
          <span>
            <span className="font-medium">{activity.user}</span> performed an action
          </span>
        );
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  };

  return (
    <div className="glass-card glass-slide-up">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium glass-text-primary">
            Recent Activity
          </h3>
          <CalendarIcon className="h-5 w-5 glass-text-secondary" />
        </div>

        {activities.length > 0 ? (
          <div className="flow-root">
            <ul className="-mb-8">
              {activities.map((activity, index) => (
                <li key={activity.id}>
                  <div className="relative pb-8">
                    {index !== activities.length - 1 && (
                      <span
                        className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                        aria-hidden="true"
                      />
                    )}
                    <div className="relative flex space-x-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div>
                          <p className="text-sm text-gray-900">
                            {getActivityMessage(activity)}
                          </p>
                        </div>
                        <div className="whitespace-nowrap text-right text-sm text-gray-500">
                          <time dateTime={activity.timestamp}>
                            {formatTimeAgo(activity.timestamp)}
                          </time>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-6">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
            <p className="mt-1 text-sm text-gray-500">
              Activity will appear here as employees clock in and out.
            </p>
          </div>
        )}

        {activities.length >= limit && (
          <div className="mt-6">
            <button
              onClick={() => {
                // Navigate to full activity log if it exists
                // window.location.href = '/activity';
              }}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
            >
              View all activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;
