/**
 * useOffline — network connectivity and offline draft management hook.
 *
 * Tracks browser online/offline status via `window` events, initialises the
 * IndexedDB offline store (via `lib/offlineStore`), counts pending drafts
 * saved while offline, registers the service worker (`/sw.js`), and
 * auto-syncs pending drafts 2 seconds after network connectivity is restored.
 *
 * Mount once at AppShell level so the service worker registers on first load
 * and the pending draft count badge stays accurate across all pages.
 *
 * Pending draft count refreshes every 10 seconds via a polling interval as
 * a fallback when the sync callback is not provided.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initOfflineDB,
  getDrafts,
  syncDrafts as syncOfflineDrafts,
  isOnline as checkOnline,
} from '../lib/offlineStore';

interface UseOfflineReturn {
  /** Whether the browser currently has network connectivity */
  isOnline: boolean;
  /** Number of drafts saved offline that are pending sync */
  pendingDrafts: number;
  /** Manually trigger a sync of offline drafts */
  syncDrafts: (sendFn: (draft: any) => Promise<void>) => Promise<{ sent: number; failed: number }>;
  /** Whether the service worker has been registered and is active */
  isServiceWorkerReady: boolean;
}

export function useOffline(): UseOfflineReturn {
  const [isOnline, setIsOnline] = useState<boolean>(checkOnline());
  const [pendingDrafts, setPendingDrafts] = useState<number>(0);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState<boolean>(false);
  const sendFnRef = useRef<((draft: any) => Promise<void>) | null>(null);

  // ─── Track online/offline status ────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Initialize IndexedDB and count pending drafts ──────────────────────────

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await initOfflineDB();
        const drafts = await getDrafts();
        if (mounted) {
          setPendingDrafts(drafts.filter((d: any) => d._offline).length);
        }
      } catch (error) {
        console.error('[useOffline] Failed to initialize offline DB:', error);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Register Service Worker ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function registerSW() {
      if (!('serviceWorker' in navigator)) {
        console.warn('[useOffline] Service workers not supported');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Check if the SW is already active
        if (registration.active) {
          if (mounted) setIsServiceWorkerReady(true);
        }

        // Listen for the SW becoming active
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && mounted) {
              setIsServiceWorkerReady(true);
            }
          });
        });

        // Also handle the case where it transitions to active after registration
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated' && mounted) {
              setIsServiceWorkerReady(true);
            }
          });
        } else if (registration.waiting) {
          registration.waiting.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated' && mounted) {
              setIsServiceWorkerReady(true);
            }
          });
        }
      } catch (error) {
        console.error('[useOffline] Service worker registration failed:', error);
      }
    }

    registerSW();

    return () => {
      mounted = false;
    };
  }, []);

  // ─── Auto-sync when coming back online ──────────────────────────────────────

  useEffect(() => {
    if (!isOnline || pendingDrafts === 0 || !sendFnRef.current) return;

    // Small delay to ensure network is stable
    const timeout = setTimeout(async () => {
      if (sendFnRef.current) {
        try {
          const result = await syncOfflineDrafts(sendFnRef.current);
          setPendingDrafts((prev) => Math.max(0, prev - result.sent));
        } catch (error) {
          console.error('[useOffline] Auto-sync failed:', error);
        }
      }
    }, 2000);

    return () => clearTimeout(timeout);
  }, [isOnline, pendingDrafts]);

  // ─── Manual sync function ───────────────────────────────────────────────────

  const syncDrafts = useCallback(
    async (sendFn: (draft: any) => Promise<void>) => {
      // Store the sendFn for auto-sync use
      sendFnRef.current = sendFn;

      const result = await syncOfflineDrafts(sendFn);
      setPendingDrafts((prev) => Math.max(0, prev - result.sent));
      return result;
    },
    []
  );

  // ─── Refresh pending count periodically ─────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const drafts = await getDrafts();
        setPendingDrafts(drafts.filter((d: any) => d._offline).length);
      } catch {
        // Silently ignore — DB might not be ready
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    pendingDrafts,
    syncDrafts,
    isServiceWorkerReady,
  };
}

export default useOffline;
