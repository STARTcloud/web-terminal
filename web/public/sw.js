/**
 * Web-Terminal PWA Service Worker
 * Provides offline support and caching for the terminal application
 * I am not sure why this is hardcoded to a version, it absolutley should not be
 */

const CACHE_NAME = "web-terminal-v1.13.3";
const STATIC_CACHE = "web-terminal-static-v1.13.3";
const API_CACHE = "web-terminal-api-v1.13.3";

// Resources to cache immediately
// NOTE: Do NOT cache "/" or "/index.html" as they depend on authentication state
const STATIC_RESOURCES = [
  "/favicon.ico",
  "/images/logo192.png",
  "/images/logo512.png",
  "/manifest.json",
];

// API patterns to cache (minimal for terminal app)
const API_PATTERNS = [
  /^\/api\/terminal\/sessions/, // Terminal sessions
];

// Install event - cache static resources
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static resources");
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log("[SW] Service worker installed successfully");
        self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error("[SW] Installation failed:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE &&
              cacheName !== API_CACHE
            ) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests, browser extension requests, SSE endpoints, and auth-dependent pages
  if (
    request.method !== "GET" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.protocol === "chrome-extension:" ||
    url.protocol === "moz-extension:" ||
    url.pathname.startsWith("/api/events") ||
    request.headers.get("accept")?.includes("text/event-stream") ||
    request.headers.get("cache-control") === "no-cache"
  ) {
    return;
  }

  // Handle different types of requests
  if (isStaticResource(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isAPIRequest(url.pathname)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request, CACHE_NAME));
  }
});

// Background sync for offline uploads
self.addEventListener("sync", (event) => {
  if (event.tag === "upload-sync") {
    console.log("[SW] Background sync: processing queued uploads");
    event.waitUntil(processQueuedUploads());
  }
});

// Push notifications (if needed later)
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log("[SW] Push notification received:", data);

    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/images/logo192.png",
        badge: "/images/logo192.png",
        tag: "web-terminal-notification",
      })
    );
  }
});

// Helper functions
function isStaticResource(pathname) {
  return (
    pathname.startsWith("/images/") ||
    pathname.startsWith("/assets/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname === "/manifest.json"
  );
}

function isAPIRequest(pathname) {
  return API_PATTERNS.some((pattern) => pattern.test(pathname));
}

// Cache strategies
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      console.log("[SW] Cache hit:", request.url);
      return cached;
    }

    console.log("[SW] Cache miss, fetching:", request.url);
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error("[SW] Cache first strategy failed:", error);
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstStrategy(request, cacheName) {
  try {
    console.log("[SW] Network first:", request.url);
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url);
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "This request requires an internet connection",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

async function processQueuedUploads() {
  // Implementation for background upload sync
  // This would read from IndexedDB queue and retry failed uploads
  console.log("[SW] Processing queued uploads...");

  try {
    // Get queued uploads from IndexedDB
    const db = await openIndexedDB();
    const uploads = await getQueuedUploads(db);

    for (const upload of uploads) {
      try {
        await retryUpload(upload);
        await removeFromQueue(db, upload.id);
        console.log("[SW] Successfully synced upload:", upload.fileName);
      } catch (error) {
        console.error("[SW] Failed to sync upload:", upload.fileName, error);
      }
    }
  } catch (error) {
    console.error("[SW] Background sync failed:", error);
  }
}

// IndexedDB helpers for upload queue
async function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("Web-TerminalUploadQueue", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("uploads")) {
        const store = db.createObjectStore("uploads", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function getQueuedUploads(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["uploads"], "readonly");
    const store = transaction.objectStore("uploads");
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function retryUpload(uploadData) {
  const formData = new FormData();
  formData.append("file", uploadData.file);

  const response = await fetch(uploadData.url, {
    method: "POST",
    body: formData,
    headers: uploadData.headers,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response;
}

async function removeFromQueue(db, uploadId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["uploads"], "readwrite");
    const store = transaction.objectStore("uploads");
    const request = store.delete(uploadId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
