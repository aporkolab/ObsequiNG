// Service Worker for ObsequiNG PWA
const CACHE_NAME = 'obsequing-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Resources to cache on install
const CACHE_RESOURCES = [
  '/',
  '/home',
  '/security',
  '/testing',
  '/manifest.json',
  OFFLINE_URL,
  // Add your static assets here
  // '/assets/icons/icon-192x192.png',
  // '/assets/icons/icon-512x512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install Event');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(CACHE_RESOURCES);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate Event');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Claim all clients immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached resources or fetch from network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!event.request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }
        
        // Fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Cache the fetched resource
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If network fails, try to serve offline page for navigation requests
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background Sync', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Perform background sync operations here
      syncData()
    );
  }
});

// Push notification
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push Event', event);
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/assets/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/icons/xmark.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('ObsequiNG', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification Click', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // Open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    event.notification.close();
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Utility functions
async function syncData() {
  try {
    // Implement your background sync logic here
    console.log('Service Worker: Syncing data...');
    
    // Example: sync offline actions, send analytics, etc.
    const offlineActions = await getOfflineActions();
    
    for (const action of offlineActions) {
      try {
        await sendToServer(action);
        await removeOfflineAction(action.id);
      } catch (error) {
        console.error('Service Worker: Sync failed for action', action, error);
      }
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Sync failed', error);
    return Promise.reject(error);
  }
}

async function getOfflineActions() {
  // Mock implementation - in real app, get from IndexedDB
  return [];
}

async function sendToServer(action) {
  // Mock implementation - send to your API
  return fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(action)
  });
}

async function removeOfflineAction(actionId) {
  // Mock implementation - remove from IndexedDB
  console.log('Service Worker: Removed offline action', actionId);
}

// Cache management
async function cleanOldCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames
      .filter(name => name !== CACHE_NAME)
      .map(name => caches.delete(name))
  );
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('Service Worker: Periodic Sync', event.tag);
  
  if (event.tag === 'content-sync') {
    event.waitUntil(
      // Perform periodic sync
      syncPeriodicContent()
    );
  }
});

async function syncPeriodicContent() {
  try {
    // Update app content in background
    console.log('Service Worker: Periodic content sync');
    
    // Example: pre-cache updated resources, sync user preferences, etc.
    const response = await fetch('/api/updates');
    const updates = await response.json();
    
    if (updates.newVersion) {
      // Notify clients about update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: updates.newVersion
        });
      });
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Service Worker: Periodic sync failed', error);
    return Promise.reject(error);
  }
}
