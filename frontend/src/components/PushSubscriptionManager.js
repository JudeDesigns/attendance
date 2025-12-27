import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

// VAPID public key (same as in service worker)
const VAPID_PUBLIC_KEY = 'BIFRY7ks2fBSSUocrKsSYStvdQllFIsyBU73EMloPUJMFqxoqhBbtxirFcymNs-yJ0eLNJUxP3W2N_9sQ4HoiTw';

const PushSubscriptionManager = ({ onSubscriptionChange }) => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    checkPushSupport();
    checkServiceWorker();
  }, []);

  useEffect(() => {
    if (serviceWorkerReady && isSupported) {
      checkExistingSubscription();
    }
  }, [serviceWorkerReady, isSupported]);

  const checkPushSupport = () => {
    const supported = 'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  };

  const checkServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        console.log('Checking Service Worker readiness...');
        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker is ready:', registration);
        setServiceWorkerReady(!!registration);
      } catch (error) {
        console.error('Service worker not ready:', error);
      }
    } else {
      console.warn('Service Worker not supported in this browser');
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        setSubscription(existingSubscription);
        setIsSubscribed(true);
        console.log('Existing push subscription found:', existingSubscription);
      } else {
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error checking existing subscription:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);

      if (permission === 'granted') {
        toast.success('Notification permission granted!');
        return true;
      } else if (permission === 'denied') {
        toast.error('Notification permission denied. Please enable in browser settings.');
        return false;
      } else {
        toast('Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to request notification permission');
      return false;
    }
  };

  const subscribeToPush = async () => {
    if (!user) {
      toast.error('Please log in to enable push notifications');
      return;
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      if (permission !== 'granted') {
        const permissionGranted = await requestNotificationPermission();
        if (!permissionGranted) {
          setIsLoading(false);
          return;
        }
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log('Push subscription created:', pushSubscription);

      // Send subscription to backend
      const response = await fetch('/api/v1/notifications/push/subscriptions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          subscription: pushSubscription.toJSON()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(pushSubscription);
        setIsSubscribed(true);
        toast.success('Push notifications enabled successfully!');

        if (onSubscriptionChange) {
          onSubscriptionChange(true, pushSubscription);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to save subscription:', errorData);
        toast.error('Failed to save push subscription');

        // Unsubscribe from push manager if backend save failed
        await pushSubscription.unsubscribe();
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast.error('Failed to enable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribeFromPush = async () => {
    setIsLoading(true);

    try {
      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from backend
        const response = await fetch('/api/v1/notifications/push/subscriptions/unsubscribe_all/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (response.ok) {
          setSubscription(null);
          setIsSubscribed(false);
          toast.success('Push notifications disabled successfully!');

          if (onSubscriptionChange) {
            onSubscriptionChange(false, null);
          }
        } else {
          toast.error('Failed to disable push notifications');
        }
      }
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const testPushNotification = async () => {
    if (!isSubscribed) {
      toast.error('Please enable push notifications first');
      return;
    }

    try {
      const response = await fetch('/api/v1/notifications/push/subscriptions/test_notification/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Test notification sent! Check your notifications.');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  // Convert VAPID key from base64url to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  if (!isSupported) {
    return (
      <div className="glass-card p-4 border border-red-200">
        <h3 className="text-lg font-semibold text-red-600 mb-2">
          Push Notifications Not Supported
        </h3>
        <p className="text-red-600 text-sm">
          Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Push Notifications
      </h3>

      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm font-medium ${isSubscribed ? 'text-green-600' : 'text-gray-500'
            }`}>
            {isSubscribed ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Permission:</span>
          <span className={`text-sm font-medium ${permission === 'granted' ? 'text-green-600' :
            permission === 'denied' ? 'text-red-600' : 'text-yellow-600'
            }`}>
            {permission.charAt(0).toUpperCase() + permission.slice(1)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col space-y-2">
          {!isSubscribed ? (
            <button
              onClick={subscribeToPush}
              disabled={isLoading}
              className="glass-button bg-green-500 bg-opacity-20 text-green-600 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Enabling...' : 'Enable Push Notifications'}
            </button>
          ) : (
            <>
              <button
                onClick={unsubscribeFromPush}
                disabled={isLoading}
                className="glass-button bg-red-500 bg-opacity-20 text-red-600 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Disabling...' : 'Disable Push Notifications'}
              </button>

              <button
                onClick={testPushNotification}
                disabled={isLoading}
                className="glass-button bg-blue-500 bg-opacity-20 text-blue-600 hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Test Notification
              </button>
            </>
          )}
        </div>

        {/* Help text */}
        {permission === 'denied' && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
            <strong>Permission Denied:</strong> To enable notifications, please:
            <br />• Click the lock icon in your address bar
            <br />• Allow notifications for this site
            <br />• Refresh the page
          </div>
        )}
      </div>
    </div>
  );
};

export default PushSubscriptionManager;
