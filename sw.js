// sw.js - Capsera PWA Service Worker with Offline-First Strategy
// IMPORTANT: Update this version number whenever you deploy new code
const APP_VERSION = "1.3.0"; // Change this with each deployment
const CACHE_NAME = `capsera-v${APP_VERSION}`;
const STATIC_CACHE_NAME = `capsera-static-v${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = `capsera-dynamic-v${APP_VERSION}`;

// Core app shell assets that should always be cached
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/manifest.json",
  "/db.js",
  "/supabase.js",
  "/validation.js",
  "/translate.js"
];

// API endpoints that should use stale-while-revalidate
const API_PATTERNS = [
  /supabase\.co/,
  /googleapis\.com/,
  /\/api\//,
  /\/functions\/v1\//
];

// Install event - cache shell assets and force immediate activation
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker version:", APP_VERSION);
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching shell assets");
        // Add cache-busting query params to ensure fresh downloads
        const cacheBustUrls = SHELL_ASSETS.map(url => `${url}?v=${APP_VERSION}&t=${Date.now()}`);
        return cache.addAll(cacheBustUrls.concat(SHELL_ASSETS));
      })
      .then(() => {
        console.log("[SW] Shell assets cached successfully");
        // Force immediate activation - skip waiting
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Cache install failed:", error);
      })
  );
});

// Activate event - aggressively clean up old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker version:", APP_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches, not just versioned ones
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Immediately claim all clients to force refresh
      self.clients.claim()
    ])
      .then(() => {
        console.log("[SW] Cache cleanup complete, clients claimed");
        // Notify all clients that a new version is available
        return self.clients.matchAll();
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: "NEW_VERSION_AVAILABLE",
            version: APP_VERSION,
            message: "New version available! Please refresh the page."
          });
        });
      })
  );
});

// Fetch event - implement offline-first strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension URLs
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return;
  }

  // Handle shell assets - cache first
  if (SHELL_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
    event.respondWith(handleShellAssets(request));
    return;
  }

  // Handle API requests - network first with background sync notification
  if (API_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(handleApiRequests(request));
    return;
  }

  // Handle other requests - stale while revalidate
  event.respondWith(handleOtherRequests(request));
});

// Cache-first strategy for shell assets with network update
async function handleShellAssets(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  
  try {
    // Try network first for shell assets to get updates quickly
    console.log("[SW] Fetching shell asset from network:", request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the new version
      await cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (networkError) {
    console.log("[SW] Network failed for shell asset, trying cache:", request.url);
  }
  
  // Fallback to cache
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    console.log("[SW] Serving shell asset from cache:", request.url);
    return cachedResponse;
  }
  
  // Final fallback for navigation requests
  if (request.destination === "document") {
    const indexResponse = await cache.match("/index.html");
    if (indexResponse) {
      return indexResponse;
    }
  }
  
  // If all fails, throw error
  throw new Error(`No cache or network response available for ${request.url}`);
}

// Network-first strategy for API requests
async function handleApiRequests(request) {
  try {
    console.log("[SW] Fetching API request from network:", request.url);
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.ok && request.method === "GET") {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log("[SW] API network request failed, trying cache:", request.url);
    
    // Try cache as fallback
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log("[SW] Serving API response from cache:", request.url);
      // Notify the app about offline mode
      notifyClientsOfflineMode();
      return cachedResponse;
    }
    
    // If no cache available, notify app and throw error
    notifyClientsOfflineMode();
    throw error;
  }
}

// Stale-while-revalidate strategy for other requests
async function handleOtherRequests(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  
  try {
    // Try cache first
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in the background
    const networkPromise = fetch(request).then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => {
      // Network failed, but we might have cache
    });

    // Return cached response immediately if available
    if (cachedResponse) {
      console.log("[SW] Serving from cache (stale-while-revalidate):", request.url);
      return cachedResponse;
    }

    // If no cache, wait for network
    console.log("[SW] No cache, waiting for network:", request.url);
    return await networkPromise;
  } catch (error) {
    console.error("[SW] Request failed:", request.url, error);
    throw error;
  }
}

// Notify all clients about offline mode
function notifyClientsOfflineMode() {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "OFFLINE_MODE",
        message: "Working in offline mode"
      });
    });
  });
}

// Listen for sync events (for background sync when connection returns)
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync event:", event.tag);
  
  if (event.tag === "sync-offline-data") {
    event.waitUntil(syncOfflineData());
  }
});

// Background sync handler
async function syncOfflineData() {
  console.log("[SW] Starting background sync");
  
  try {
    // Notify app to perform sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: "SYNC_OFFLINE_DATA",
        message: "Starting offline data sync"
      });
    });
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
  }
}

// Handle push notifications (for future use)
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");
  
  const options = {
    body: event.data ? event.data.text() : "New update available",
    icon: "/public/logo.png",
    badge: "/public/logo.png",
    tag: "capsera-notification"
  };

  event.waitUntil(
    self.registration.showNotification("Capsera", options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked");
  
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll().then((clients) => {
      // Focus existing window or open new one
      if (clients.length > 0) {
        return clients[0].focus();
      } else {
        return self.clients.openWindow("/");
      }
    })
  );
});

console.log("[SW] Service worker script loaded");
