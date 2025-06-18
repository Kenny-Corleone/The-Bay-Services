const CACHE_NAME = 'bay-report-app-v1';
const DYNAMIC_CACHE = 'bay-report-dynamic-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://thebayservices.com/wp-content/uploads/2022/07/bay-services-logo.png',
  'icons/icon-72x72.png',
  'icons/icon-96x96.png',
  'icons/icon-128x128.png',
  'icons/icon-144x144.png',
  'icons/icon-152x152.png',
  'icons/icon-192x192.png',
  'icons/icon-384x384.png',
  'icons/icon-512x512.png'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        console.log('[ServiceWorker] App shell cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE))
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Helper function to determine if request is for an API
const isApiRequest = (url) => {
  return (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebaseauth.googleapis.com') ||
    url.includes('firebase-settings.crashlytics.com')
  );
};

// Helper function to determine if request is for static assets
const isStaticAsset = (url) => {
  return (
    url.endsWith('.png') ||
    url.endsWith('.jpg') ||
    url.endsWith('.jpeg') ||
    url.endsWith('.svg') ||
    url.endsWith('.css') ||
    url.endsWith('.js') ||
    url.endsWith('.woff2') ||
    url.endsWith('.woff') ||
    url.endsWith('.ttf')
  );
};

// Fetch event with improved strategies
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin && !isStaticAsset(url.pathname)) {
    return;
  }

  // API requests - Network Only
  if (isApiRequest(url.href)) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets - Cache First with Network Fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then(networkResponse => {
              if (!networkResponse || networkResponse.status !== 200) {
                return networkResponse;
              }
              return caches.open(DYNAMIC_CACHE)
                .then(cache => {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
                });
            })
            .catch(() => {
              // Return offline asset if available
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // HTML pages - Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const responseToCache = networkResponse.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request)
            .then(response => {
              if (response) {
                return response;
              }
              // Return offline page if available
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // Default strategy - Stale While Revalidate
  event.respondWith(
    caches.match(request)
      .then(cacheResponse => {
        const fetchPromise = fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, networkResponse.clone()));
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('[ServiceWorker] Fetch failed:', error);
          });

        return cacheResponse || fetchPromise;
      })
  );
});

// Handle sync events for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(
      // Implement background sync logic here
      Promise.resolve()
    );
  }
});
