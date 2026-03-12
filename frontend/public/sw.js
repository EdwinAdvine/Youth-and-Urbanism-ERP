/**
 * Urban ERP Service Worker
 * - Finance: offline expense queueing + background sync
 * - Era Mail: cache-first static assets, network-first mail API, push notifications
 */

// ─── Cache Names ───────────────────────────────────────────────────────────────

const CACHE_NAME = 'urban-erp-v2';
const STATIC_CACHE = 'era-static-v1';
const MAIL_CACHE = 'era-mail-cache';
const MAX_CACHED_MESSAGES = 500;

const APP_SHELL = [
  '/',
  '/finance/expenses',
  '/finance',
  '/mail',
  '/index.html',
  '/manifest.json',
];

const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.ico'];

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext));
}

function isMailAPI(url) {
  return url.pathname.startsWith('/api/v1/mail');
}

// ─── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const CURRENT_CACHES = [CACHE_NAME, STATIC_CACHE, MAIL_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !CURRENT_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── Finance: Queue expense POST requests when offline ──
  if (event.request.method === 'POST' && url.pathname.startsWith('/api/v1/finance/expenses')) {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        const body = await event.request.clone().json().catch(() => ({}));
        await _queueOfflineRequest({
          url: event.request.url,
          method: 'POST',
          body,
          timestamp: Date.now(),
        });
        return new Response(
          JSON.stringify({ queued: true, message: 'Expense queued for sync when online' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // ── Era Mail: Cache-first for static assets ──
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(event.request));
    return;
  }

  // ── Era Mail: Network-first for mail API ──
  if (isMailAPI(url)) {
    event.respondWith(networkFirstMail(event.request));
    return;
  }

  // ── General API: network-first, no cache ──
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // ── Navigation requests: network-first with cache fallback ──
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/') || caches.match(event.request))
    );
    return;
  }

  // ── Default: cache-first for remaining assets ──
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/'))
    )
  );
});

// ─── Cache-First Strategy (static assets) ──────────────────────────────────────

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline - asset unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// ─── Network-First Strategy (mail API) ─────────────────────────────────────────

async function networkFirstMail(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(MAIL_CACHE);
      cache.put(request, response.clone());
      await trimMailCache();
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You are offline. This mail data is not available in cache.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ─── Trim Mail Cache to MAX_CACHED_MESSAGES ────────────────────────────────────

async function trimMailCache() {
  const cache = await caches.open(MAIL_CACHE);
  const keys = await cache.keys();

  if (keys.length > MAX_CACHED_MESSAGES) {
    const toDelete = keys.slice(0, keys.length - MAX_CACHED_MESSAGES);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// ─── Push Notifications (Era Mail) ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {
    title: 'Era Mail',
    body: 'You have a new message',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'era-mail-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        ...data,
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        tag: payload.tag || data.tag,
        data: payload.data || {},
      };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: data.data,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ─── Notification Click ────────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/mail';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/mail') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync (Finance) ─────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-expenses') {
    event.waitUntil(_syncQueuedRequests());
  }
});

// ─── Finance Offline Queue Helpers ─────────────────────────────────────────────

async function _queueOfflineRequest(req) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('urban-erp-offline', 1);
    open.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('queue', { autoIncrement: true });
    };
    open.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('queue', 'readwrite');
      tx.objectStore('queue').add(req);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    };
    open.onerror = reject;
  });
}

async function _syncQueuedRequests() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('urban-erp-offline', 1);
    open.onsuccess = async (e) => {
      const db = e.target.result;
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const all = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
      });
      for (const item of all) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
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
