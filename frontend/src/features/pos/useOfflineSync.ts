import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// IndexedDB wrapper (mirrors the service worker's DB for direct reads)
// ---------------------------------------------------------------------------

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-transactions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useOfflineSync(): OfflineSyncState {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

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

  // -- Read pending count from IDB on mount --
  useEffect(() => {
    getPendingCount()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
  }, []);

  // -- Online / Offline listeners --
  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      // Attempt sync via Background Sync API or fallback
      if (swRef.current?.sync) {
        swRef.current.sync.register('pos-sync-transactions').catch(() => {
          // Fallback: tell SW to sync directly
          navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
        });
      } else {
        navigator.serviceWorker.controller?.postMessage({ type: 'POS_TRIGGER_SYNC' });
      }
      setIsSyncing(true);
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

  return {
    isOffline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    syncNow,
  };
}
