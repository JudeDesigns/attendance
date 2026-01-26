import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, CogIcon } from '@heroicons/react/24/outline';
import { BellIcon as BellSolidIcon } from '@heroicons/react/24/solid';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { notificationAPI } from '../services/api';
import useWebSocket from '../hooks/useWebSocket';
import PushSubscriptionManager from './PushSubscriptionManager';
import { useAuth } from '../contexts/AuthContext';

const NotificationBell = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const queryClient = useQueryClient();

  // WebSocket connection for real-time notifications
  // eslint-disable-next-line no-unused-vars
  const { lastMessage } = useWebSocket('/ws/notifications/', {
    onMessage: (message) => {
      if (message.type === 'initial_data') {
        setUnreadCount(message.unread_notifications);
      } else if (message.type === 'notification') {
        // New notification received
        setUnreadCount(prev => prev + 1);
        queryClient.invalidateQueries(['notifications', user?.id]);

        // Show browser notification if permission granted
        if (Notification.permission === 'granted') {
          new Notification('WorkSync Notification', {
            body: message.message || 'You have a new notification',
            icon: '/favicon.ico'
          });
        }
      }
    }
  });

  // Fetch notifications - USER-SPECIFIC CACHE KEY
  const { data: notificationsData, isLoading, error } = useQuery(
    ['notifications', user?.id],
    () => notificationAPI.getMyNotifications({ limit: 10 }),
    {
      enabled: !!user?.id,
      refetchInterval: 30000, // Refetch every 30 seconds as fallback
      onError: (error) => {
        console.error('NotificationBell - API Error:', error);
      }
    }
  );

  // Extract notifications from API response structure - my_notifications returns { notifications: [...], unread_count: N }
  const notifications = notificationsData?.data?.notifications || notificationsData?.notifications || [];

  // Update unread count from API response if available
  React.useEffect(() => {
    const apiUnreadCount = notificationsData?.data?.unread_count || notificationsData?.unread_count;
    if (typeof apiUnreadCount === 'number') {
      setUnreadCount(apiUnreadCount);
    }

    // Debug logging
    if (notificationsData) {
      console.log('NotificationBell - API Response:', notificationsData);
      console.log('NotificationBell - Extracted notifications:', notifications);
      console.log('NotificationBell - Unread count:', apiUnreadCount);
    }
  }, [notificationsData, notifications]);

  // Mark notification as read mutation
  const markAsReadMutation = useMutation(
    (notificationId) => notificationAPI.markAsRead({ notification_ids: [notificationId] }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['notifications', user?.id]);
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  );

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation(
    () => notificationAPI.markAllAsRead(),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['notifications', user?.id]);
        setUnreadCount(0);
      }
    }
  );

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    // Mark as read if status is PENDING or SENT (unread)
    if (notification.status === 'PENDING' || notification.status === 'SENT') {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
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
    <div className="relative z-50" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-button p-2 rounded-full"
      >
        {unreadCount > 0 ? (
          <BellSolidIcon className="h-6 w-6 text-blue-600" />
        ) : (
          <BellIcon className="h-6 w-6 glass-text-secondary" />
        )}

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile Backdrop Blur Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-[9998] md:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Dropdown Panel - Mobile Responsive */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-80 max-w-[calc(100vw-2rem)] glass-notification-dropdown z-[9999]">
          <div className="py-1">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white border-opacity-20">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium glass-text-primary">
                    {showSettings ? 'Push Notification Settings' : 'Notifications'}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="glass-button text-xs p-1"
                    title="Notification Settings"
                  >
                    <CogIcon className="h-4 w-4" />
                  </button>
                  {!showSettings && unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={markAllAsReadMutation.isLoading}
                      className="glass-button text-xs disabled:opacity-50"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="max-h-96 overflow-y-auto">
              {showSettings ? (
                <div className="p-4">
                  <PushSubscriptionManager
                    onSubscriptionChange={(isSubscribed, subscription) => {
                      console.log('Push subscription changed:', isSubscribed, subscription);
                    }}
                  />
                </div>
              ) : (
                <>
                  {/* Notifications List */}
                  {isLoading ? (
                    <div className="px-4 py-6 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-sm glass-text-secondary">Loading notifications...</p>
                    </div>
                  ) : Array.isArray(notifications) && notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`px-4 py-3 hover:bg-white hover:bg-opacity-20 cursor-pointer border-l-4 transition-all duration-200 ${
                          notification.status === 'DELIVERED'
                            ? 'border-transparent'
                            : 'border-blue-500 bg-blue-500 bg-opacity-10'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${
                              notification.status === 'DELIVERED' ? 'glass-text-secondary' : 'glass-text-primary font-medium'
                            }`}>
                              {notification.message}
                            </p>
                            <p className="text-xs glass-text-muted mt-1">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                            {notification.subject && (
                              <p className="text-xs text-blue-600 mt-1 font-medium">
                                {notification.subject}
                              </p>
                            )}
                            {notification.event_type && (
                              <p className="text-xs glass-text-muted mt-1">
                                {notification.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                            )}
                          </div>
                          {(notification.status === 'PENDING' || notification.status === 'SENT') && (
                            <div className="flex-shrink-0 ml-2">
                              <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="glass-empty-state mx-4 my-6">
                      <BellIcon className="mx-auto h-12 w-12 text-blue-500" />
                      <h3 className="mt-2 text-sm font-medium glass-text-primary">No notifications</h3>
                      <p className="mt-1 text-sm glass-text-secondary">
                        You're all caught up!
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {!showSettings && Array.isArray(notifications) && notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-white border-opacity-20">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    // Navigate to notifications page if it exists
                    // window.location.href = '/notifications';
                  }}
                  className="glass-button w-full text-center text-sm"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
