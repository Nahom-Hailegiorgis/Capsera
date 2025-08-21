const CACHE_NAME = "capsera-v1";
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

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("Cache install failed:", error);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  // Skip caching for API calls and external resources
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("supabase.") ||
    event.request.url.includes("openai.") ||
    event.request.url.includes("translate.googleapis.")
  ) {
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
      .catch(() => {
        // Offline fallback
        if (event.request.destination === "document") {
          return caches.match("/index.html");
        }
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
