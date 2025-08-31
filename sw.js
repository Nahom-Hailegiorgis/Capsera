// Service Worker with versioned caches and offline-first strategy
const CACHE_VERSION = '2025-08-31-1'; // Update this on each deploy
const CACHE_NAME = `capsera-cache-v${CACHE_VERSION}`;

const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.json",
  "/app.js",
  "/src/db.js",
  "/src/supabase.js",
  "/src/validation.js",
  "/src/translate.js",
];

// Install event - cache resources and take control immediately
self.addEventListener("install", (event) => {
  console.log(`SW installing with cache version: ${CACHE_VERSION}`);
  
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache:", CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("Cache install failed:", error);
      })
  );
  
  // Skip waiting to take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  console.log(`SW activating with cache version: ${CACHE_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('capsera-cache-v')) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
  
  // Notify clients that a new version is available
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NEW_VERSION_AVAILABLE',
        version: CACHE_VERSION
      });
    });
  });
});

// Fetch event - implement different strategies for different request types
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip caching for API calls and external resources
  if (
    request.url.includes("/api/") ||
    request.url.includes("supabase.") ||
    request.url.includes("openai.") ||
    request.url.includes("translate.googleapis.") ||
    url.protocol !== "https:" && url.protocol !== "http:"
  ) {
    return;
  }

  // Handle navigation requests (HTML pages) - Network first
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If network succeeds, update cache and return response
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then(response => {
            return response || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // Handle manifest.json with no-cache for version checking
  if (request.url.includes('/manifest.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Handle static assets - Cache first with stale-while-revalidate
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // If we have a cached response, return it immediately
        if (cachedResponse) {
          // Stale-while-revalidate: update cache in background
          fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, response.clone());
                });
              }
            })
            .catch(() => {
              // Network failed, but we already have cached version
            });
          
          return cachedResponse;
        }
        
        // No cached response, fetch from network
        return fetch(request)
          .then(response => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Network failed and no cache - return offline fallback for documents
            if (request.destination === "document") {
              return caches.match("/index.html");
            }
            throw new Error('Network failed and no cached version available');
          });
      })
  );
});

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(
      // Notify clients to sync their offline data
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_OFFLINE_DATA' });
        });
      })
    );
  }
});

// Handle push notifications (future feature)
self.addEventListener('push', (event) => {
  console.log('Push notification received');
  // TODO: Implement push notification handling
});

// Cleanup on error
self.addEventListener('error', (event) => {
  console.error('SW error:', event.error);
});

// Cleanup on unhandled promise rejection
self.addEventListener('unhandledrejection', (event) => {
  console.error('SW unhandled rejection:', event.reason);
});
