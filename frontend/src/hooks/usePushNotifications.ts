/**
 * usePushNotifications — Web Push subscription management hook.
 *
 * Wraps the browser PushManager API to:
 * 1. Check existing push subscription status on mount
 * 2. Request notification permission when `subscribe()` is called
 * 3. Subscribe to push notifications using the VAPID public key
 *    (read from `VITE_VAPID_PUBLIC_KEY` env var)
 * 4. POST the PushSubscription object to `/api/v1/notifications/push-subscribe`
 *    so the backend can send server-initiated push events
 * 5. Unsubscribe via the PushManager when `unsubscribe()` is called
 *
 * Requires a registered service worker (`/sw.js`) to receive push events.
 * Falls back gracefully when the Notification API is not available.
 */
import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

/**
 * Hook for managing push notification subscriptions.
 * Requests permission, subscribes via PushManager, and POSTs
 * the subscription to /api/v1/notifications/push-subscribe.
 *
 * VAPID public key is read from VITE_VAPID_PUBLIC_KEY env var.
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as PermissionState)

    // Check if already subscribed
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setSubscribed(true)
        })
      )
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const result = await Notification.requestPermission()
    setPermission(result as PermissionState)
    if (result !== 'granted') return

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set')
      return
    }

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await axios.post('/api/v1/notifications/push-subscribe', sub.toJSON())
      setSubscribed(true)
    } catch (err) {
      console.error('[Push] Subscription failed:', err)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      setSubscribed(false)
    }
  }, [])

  return { permission, subscribed, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}
