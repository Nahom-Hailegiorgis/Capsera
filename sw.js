// sw.js - Enhanced Service Worker with versioned caches and offline-first strategy
const CACHE_VERSION = '2025-08-31-1'; // Increment this on each deploy
const CACHE_NAME = `capsera-cache-v${CACHE_VERSION}`;

const urlsToCache = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/manifest.json",
  "/src/db.js",
  "/src/supabase.js",
  "/src/validation.js",
  "/src/translate.js",
];

// Install event - cache app shell
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
  
  // Take control immediately
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
            if (cacheName !== CACHE_NAME && cacheName.startsWith('capsera-cache-')) {
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

  // Notify clients about new version
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NEW_VERSION_AVAILABLE',
        version: CACHE_VERSION
      });
    });
  });
});

// Fetch event - implement different strategies based on request type
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip caching for API calls and external resources
  if (
    url.pathname.includes("/api/") ||
    url.hostname.includes("supabase.") ||
    url.hostname.includes("openai.") ||
    url.hostname.includes("translate.googleapis.") ||
    request.method !== 'GET'
  ) {
    return;
  }

  // Special handling for manifest.json - always fetch fresh for version checks
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navigation requests - network-first strategy
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh HTML response
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached version when offline
          return caches.match(request)
            .then(response => response || caches.match('/index.html'));
        })
    );
    return;
  }

  // Static assets - cache-first with stale-while-revalidate
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Return cached version immediately
          // Update cache in background (stale-while-revalidate)
          fetch(request)
            .then(fetchResponse => {
              if (fetchResponse.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, fetchResponse);
                });
              }
            })
            .catch(() => {
              // Ignore fetch errors for background updates
            });
          
          return response;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(fetchResponse => {
            if (fetchResponse.ok) {
              const responseClone = fetchResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return fetchResponse;
          });
      })
  );
});

// Handle sync event for background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Notify clients to sync offline data
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_OFFLINE_DATA' });
        });
      })
    );
  }
});
