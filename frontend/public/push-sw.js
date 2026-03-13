/**
 * push-sw.js — Push notification handlers for Urban Vibes Dynamics.
 *
 * Imported by the VitePWA-generated service worker via workbox.importScripts.
 * Handles `push` events (shows notifications) and `notificationclick` events
 * (focuses or opens the relevant URL).
 *
 * Also handles the SKIP_WAITING message so useAppUpdate.applyUpdate() works.
 */

// Allow the app to trigger an immediate SW update
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Show a notification when the backend sends a push event
self.addEventListener('push', event => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Urban Vibes Dynamics', body: event.data.text() }
  }
  const {
    title = 'Urban Vibes Dynamics',
    body = '',
    icon = '/icons/icon-192.png',
    badge = '/icons/icon-192.png',
    url = '/',
    tag,
  } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      renotify: !!tag,
    })
  )
})

// Focus the existing window or open a new one when the user taps a notification
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
