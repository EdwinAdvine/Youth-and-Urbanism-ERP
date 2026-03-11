/**
 * Urban ERP Service Worker — offline-first for key finance flows.
 * Caches: app shell, static assets.
 * Queues: expense creation requests when offline (POST /finance/expenses).
 */
const CACHE_NAME = "urban-erp-v1";
const OFFLINE_QUEUE_NAME = "urban-erp-offline-queue";

const APP_SHELL = [
  "/",
  "/finance/expenses",
  "/finance",
];

// Install — cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Queue expense POST requests when offline
  if (event.request.method === "POST" && url.pathname.startsWith("/api/v1/finance/expenses")) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        // Store in IndexedDB queue for later sync
        const body = await event.request.clone().json().catch(() => ({}));
        await _queueOfflineRequest({
          url: event.request.url,
          method: "POST",
          body,
          timestamp: Date.now(),
        });
        return new Response(
          JSON.stringify({ queued: true, message: "Expense queued for sync when online" }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // API requests: network-first, no cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: "Offline" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    ));
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response.ok && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("/"))
    )
  );
});

// Background sync — retry queued expense requests when online
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-expenses") {
    event.waitUntil(_syncQueuedRequests());
  }
});

async function _queueOfflineRequest(req) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("urban-erp-offline", 1);
    open.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("queue", { autoIncrement: true });
    };
    open.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction("queue", "readwrite");
      tx.objectStore("queue").add(req);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    };
    open.onerror = reject;
  });
}

async function _syncQueuedRequests() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("urban-erp-offline", 1);
    open.onsuccess = async (e) => {
      const db = e.target.result;
      const tx = db.transaction("queue", "readwrite");
      const store = tx.objectStore("queue");
      const all = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
      });
      for (const item of all) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          });
          if (res.ok) {
            store.delete(item.id);
          }
        } catch {
          // keep in queue for next sync
        }
      }
      resolve();
    };
    open.onerror = reject;
  });
}
