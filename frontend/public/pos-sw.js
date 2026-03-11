/// <reference lib="webworker" />

const CACHE_NAME = 'pos-offline-v1';
const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-transactions';

const POS_CACHE_URLS = [
  '/api/v1/pos/products',
  '/api/v1/pos/sessions/active',
];

// --- IndexedDB helpers ---

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function enqueueTransaction(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({
      payload: data.body,
      url: data.url,
      headers: data.headers,
      createdAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deletePending(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPendingCount() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Service Worker lifecycle ---

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache is optional; real caching happens on fetch
      return cache;
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('pos-offline-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- Fetch interception ---

function isPOSGetRequest(request) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    POS_CACHE_URLS.some((pattern) => url.pathname.startsWith(pattern))
  );
}

function isPOSTransactionCreate(request) {
  const url = new URL(request.url);
  return (
    request.method === 'POST' &&
    url.pathname.match(/\/api\/v1\/pos\/transactions\/?$/)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Cache POS GET requests (network-first, fallback to cache)
  if (isPOSGetRequest(request)) {
    event.respondWith(
      fetch(request.clone())
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response(
            JSON.stringify({ detail: 'Offline and no cached data available' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }))
    );
    return;
  }

  // Queue POS transaction creation when offline
  if (isPOSTransactionCreate(request)) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        const body = await request.text();
        const headers = {};
        request.headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'content-length') {
            headers[key] = value;
          }
        });

        await enqueueTransaction({
          url: request.url,
          body,
          headers,
        });

        const count = await getPendingCount();
        notifyClients({ type: 'POS_TX_QUEUED', pendingCount: count });

        return new Response(
          JSON.stringify({
            id: `offline-${Date.now()}`,
            status: 'queued_offline',
            message: 'Transaction saved offline. Will sync when back online.',
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
});

// --- Background sync ---

self.addEventListener('sync', (event) => {
  if (event.tag === 'pos-sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  const pending = await getAllPending();
  if (pending.length === 0) {
    notifyClients({ type: 'POS_SYNC_COMPLETE', synced: 0, failed: 0, pendingCount: 0 });
    return;
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const response = await fetch(item.url, {
        method: 'POST',
        headers: item.headers,
        body: item.payload,
      });

      if (response.ok || response.status === 201) {
        await deletePending(item.id);
        synced++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error — remove from queue, it won't succeed on retry
        await deletePending(item.id);
        failed++;
      } else {
        // Server error — keep in queue for next retry
        failed++;
      }
    } catch {
      // Network still down — stop trying
      failed++;
      break;
    }
  }

  const pendingCount = await getPendingCount();
  notifyClients({ type: 'POS_SYNC_COMPLETE', synced, failed, pendingCount });
}

// --- Online event (fallback if Background Sync API is unavailable) ---

self.addEventListener('message', async (event) => {
  if (event.data?.type === 'POS_TRIGGER_SYNC') {
    await syncPendingTransactions();
  }

  if (event.data?.type === 'POS_GET_PENDING_COUNT') {
    const count = await getPendingCount();
    event.source?.postMessage({ type: 'POS_PENDING_COUNT', pendingCount: count });
  }
});

// --- Notify all clients ---

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}
