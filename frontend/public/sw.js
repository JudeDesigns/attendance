// WorkSync Service Worker
const CACHE_NAME = 'worksync-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico'
];

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BIFRY7ks2fBSSUocrKsSYStvdQllFIsyBU73EMloPUJMFqxoqhBbtxirFcymNs-yJ0eLNJUxP3W2N_9sQ4HoiTw';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Attempt to cache, but don't fail installation if some files are missing
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Failed to cache some resources:', err);
        });
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - serve from cache when offline, but skip API requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't intercept API requests - let them go directly to the backend
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          return response;
        }

        // Otherwise fetch from network with error handling
        return fetch(event.request).catch((error) => {
          console.warn('Fetch failed for:', event.request.url, error);
          // Return a basic response for failed requests
          return new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let notificationData = {
    title: 'WorkSync',
    body: 'New notification from WorkSync',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'worksync-notification',
    requireInteraction: false,
    silent: false,
    data: {
      timestamp: Date.now(),
      url: '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/favicon.ico'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/favicon.ico'
      }
    ]
  };

  // Parse notification data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      console.log('Push data received:', pushData);

      // Update notification data with received data
      notificationData = {
        ...notificationData,
        title: pushData.title || notificationData.title,
        body: pushData.body || notificationData.body,
        icon: pushData.icon || notificationData.icon,
        badge: pushData.badge || notificationData.badge,
        tag: pushData.tag || notificationData.tag,
        requireInteraction: pushData.requireInteraction || notificationData.requireInteraction,
        silent: pushData.silent || notificationData.silent,
        data: {
          ...notificationData.data,
          ...pushData.data
        },
        actions: pushData.actions || notificationData.actions
      };

      // Add vibration pattern if not silent
      if (!notificationData.silent) {
        notificationData.vibrate = [200, 100, 200];
      }

    } catch (error) {
      console.error('Error parsing push data:', error);
      // Use text data as body if JSON parsing fails
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      silent: notificationData.silent,
      vibrate: notificationData.vibrate,
      data: notificationData.data,
      actions: notificationData.actions,
      timestamp: notificationData.data.timestamp
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  if (event.action === 'view' || !event.action) {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if app is already open
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              // Focus existing window and navigate to target URL
              return client.focus().then(() => {
                if (targetUrl !== '/') {
                  return client.navigate(targetUrl);
                }
                return client;
              });
            }
          }

          // Open new window if app is not open
          if (clients.openWindow) {
            return clients.openWindow(targetUrl);
          }
        })
        .catch((error) => {
          console.error('Error handling notification click:', error);
        })
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification (already done above)
    console.log('Notification dismissed');
  }
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Implement background sync logic here
  // For example, sync offline clock-in/out data
  return Promise.resolve();
}

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker received message:', event.data);

  if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    // Handle push subscription request
    event.waitUntil(
      subscribeToPush()
        .then((subscription) => {
          // Send subscription back to main thread
          event.ports[0].postMessage({
            type: 'PUSH_SUBSCRIPTION_SUCCESS',
            subscription: subscription
          });
        })
        .catch((error) => {
          console.error('Push subscription failed:', error);
          event.ports[0].postMessage({
            type: 'PUSH_SUBSCRIPTION_ERROR',
            error: error.message
          });
        })
    );
  } else if (event.data && event.data.type === 'UNSUBSCRIBE_PUSH') {
    // Handle push unsubscription request
    event.waitUntil(
      unsubscribeFromPush()
        .then(() => {
          event.ports[0].postMessage({
            type: 'PUSH_UNSUBSCRIPTION_SUCCESS'
          });
        })
        .catch((error) => {
          console.error('Push unsubscription failed:', error);
          event.ports[0].postMessage({
            type: 'PUSH_UNSUBSCRIPTION_ERROR',
            error: error.message
          });
        })
    );
  }
});

// Subscribe to push notifications
async function subscribeToPush() {
  try {
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('Push subscription successful:', subscription);
    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    throw error;
  }
}

// Unsubscribe from push notifications
async function unsubscribeFromPush() {
  try {
    const subscription = await self.registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Push unsubscription successful');
    }
  } catch (error) {
    console.error('Push unsubscription failed:', error);
    throw error;
  }
}

// Convert VAPID key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
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
}
