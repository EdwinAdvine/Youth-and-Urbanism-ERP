import { useCallback, useEffect, useRef, useState } from 'react';
import apiClient from '@/api/client';
import {
  cacheProductCatalog,
  countPending,
  getCatalogSyncedAt,
  type OfflineProduct,
} from './posOfflineDb';

// Background Sync API augmentation
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface ServiceWorkerRegistrationWithSync extends ServiceWorkerRegistration {
  sync?: SyncManager;
}

// ---------------------------------------------------------------------------
// Catalog sync helper (server-wins conflict strategy)
// ---------------------------------------------------------------------------

async function syncProductCatalog(): Promise<void> {
  const response = await apiClient.get<{ items: OfflineProduct[] }>('/pos/products/catalog-export');
  const products = response.data.items ?? [];
  await cacheProductCatalog(products);
}

// ---------------------------------------------------------------------------
// Service worker message types
// ---------------------------------------------------------------------------

interface SWMessageQueued {
  type: 'POS_TX_QUEUED';
  pendingCount: number;
}

interface SWMessageSyncComplete {
  type: 'POS_SYNC_COMPLETE';
  synced: number;
  failed: number;
  pendingCount: number;
}

interface SWMessagePendingCount {
  type: 'POS_PENDING_COUNT';
  pendingCount: number;
}

type SWMessage = SWMessageQueued | SWMessageSyncComplete | SWMessagePendingCount;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface OfflineSyncState {
  /** True when the browser reports no network connectivity */
  isOffline: boolean;
  /** Number of transactions queued in IndexedDB */
  pendingCount: number;
  /** True while a sync operation is in progress */
  isSyncing: boolean;
  /** Result of the last sync attempt */
  lastSyncResult: { synced: number; failed: number } | null;
  /** Manually trigger a sync (useful as a retry button) */
  syncNow: () => Promise<void>;
  /** Epoch ms of last product catalog sync (null = never synced) */
  catalogSyncedAt: number | null;
  /** Manually refresh the product catalog from the server */
  refreshCatalog: () => Promise<void>;
  /** True while catalog is being refreshed */
  isCatalogRefreshing: boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useOfflineSync(): OfflineSyncState {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<number | null>(null);
  const [isCatalogRefreshing, setIsCatalogRefreshing] = useState(false);
  const swRef = useRef<ServiceWorkerRegistrationWithSync | null>(null);

  // -- Register service worker --
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/pos-sw.js', { scope: '/' })
      .then((reg) => {
        swRef.current = reg;
      })
      .catch((err) => {
        console.error('[POS Offline] SW registration failed:', err);
      });

    // Request initial pending count once SW is ready
    navigator.serviceWorker.ready.then(() => {
      navigator.serviceWorker.controller?.postMessage({ type: 'POS_GET_PENDING_COUNT' });
    });
  }, []);

  // -- Read initial state from IDB on mount --
  useEffect(() => {
    countPending()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
    getCatalogSyncedAt()
      .then(setCatalogSyncedAt)
      .catch(() => setCatalogSyncedAt(null));
  }, []);

  // -- Online / Offline listeners --
  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      // Attempt sync via Background Sync API or fallback
      if (swRef.current?.sync) {
        swRef.current.sync.register('pos-sync-transactions').catch(() => {
          navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
        });
      } else {
        navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
      }
      setIsSyncing(true);

      // Refresh catalog if stale (>1h) or never synced
      getCatalogSyncedAt().then((ts) => {
        const stale = !ts || Date.now() - ts > 60 * 60 * 1000;
        if (stale) {
          syncProductCatalog()
            .then(() => getCatalogSyncedAt().then(setCatalogSyncedAt))
            .catch((e) => console.warn('[POS Offline] Catalog refresh failed:', e));
        }
      });
    };

    const goOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // -- Listen for SW messages --
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent<SWMessage>) => {
      const { data } = event;

      switch (data.type) {
        case 'POS_TX_QUEUED':
          setPendingCount(data.pendingCount);
          break;

        case 'POS_SYNC_COMPLETE':
          setPendingCount(data.pendingCount);
          setIsSyncing(false);
          setLastSyncResult({ synced: data.synced, failed: data.failed });
          break;

        case 'POS_PENDING_COUNT':
          setPendingCount(data.pendingCount);
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
    };
  }, []);

  // -- Manual sync trigger --
  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      if (swRef.current?.sync) {
        await swRef.current.sync.register('pos-sync-transactions');
      } else {
        navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
      }
    } catch {
      // Fallback
      navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
    }

    // isSyncing will be set to false by the POS_SYNC_COMPLETE message
  }, [isSyncing]);

  // -- Manual catalog refresh --
  const refreshCatalog = useCallback(async () => {
    if (isCatalogRefreshing || isOffline) return;
    setIsCatalogRefreshing(true);
    try {
      await syncProductCatalog();
      const ts = await getCatalogSyncedAt();
      setCatalogSyncedAt(ts);
    } catch (e) {
      console.error('[POS Offline] Manual catalog refresh failed:', e);
    } finally {
      setIsCatalogRefreshing(false);
    }
  }, [isCatalogRefreshing, isOffline]);

  return {
    isOffline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncNow,
    catalogSyncedAt,
    refreshCatalog,
    isCatalogRefreshing,
  };
}
