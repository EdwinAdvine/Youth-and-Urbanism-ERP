/**
 * useAppUpdate — service worker update detection and hot-reload hook.
 *
 * Detects when a new version of the app is available (new service worker in
 * `waiting` state) and surfaces an `updateAvailable` flag for the UI to
 * display a "New version available — refresh" banner.
 *
 * Calling `applyUpdate()` sends `SKIP_WAITING` to the waiting service worker,
 * which activates it immediately. The page then reloads automatically via
 * the `controllerchange` event to pick up the new assets.
 *
 * Mount once at AppShell level. Users see a non-blocking notification rather
 * than an automatic forced refresh.
 */
import { useEffect, useState, useCallback } from 'react'

/**
 * Detects when a new service worker is waiting and provides
 * an `applyUpdate()` function to trigger the update and reload.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      setRegistration(reg)

      // Already a waiting worker?
      if (reg.waiting) {
        setUpdateAvailable(true)
      }

      // Listen for future updates
      const handleUpdate = () => {
        if (reg.waiting) setUpdateAvailable(true)
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true)
          }
        })
      })
      reg.addEventListener('updatefound', handleUpdate)
      return () => reg.removeEventListener('updatefound', handleUpdate)
    })
  }, [])

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    }, { once: true })
  }, [registration])

  return { updateAvailable, applyUpdate }
}
