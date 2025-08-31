const CACHE_VERSION = '2025-08-31-1'; // Update this on each deploy
const CACHE_NAME = `capsera-cache-v${CACHE_VERSION}`;

const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css", 
  "/manifest.json",
  "/src/app.js",
  "/src/db.js",
  "/src/supabase.js", 
  "/src/validation.js",
  "/src/translate.js",
];

// Install event - cache resources and skip waiting
self.addEventListener("install", (event) => {
  console.log(`SW v${CACHE_VERSION} installing`);
  
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
  
  // Take control immediately on install
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener("activate", (event) => {
  console.log(`SW v${CACHE_VERSION} activating`);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all([
        // Delete old caches
        ...cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('capsera-cache-v')) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
        // Take control of all clients immediately
        self.clients.claim()
      ]);
    }).then(() => {
      // Notify clients of new version
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NEW_VERSION_AVAILABLE',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

// Fetch event - implement network-first for navigation, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for API calls and external resources
  if (
    request.url.includes("/api/") ||
    request.url.includes("supabase.") ||
    request.url.includes("openai.") ||
    request.url.includes("translate.googleapis.")
  ) {
    return;
  }

  // Network-first strategy for navigation requests (HTML)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response for offline fallback
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback - serve cached HTML
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match("/index.html");
          });
        })
    );
    return;
  }

  // Cache-first with stale-while-revalidate for static assets
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache immediately, then update cache in background
          fetch(request).then((fetchResponse) => {
            if (fetchResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, fetchResponse.clone());
              });
            }
          }).catch(() => {
            // Ignore network errors for background updates
          });
          return cachedResponse;
        }
        
        // Not in cache - fetch from network
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});
