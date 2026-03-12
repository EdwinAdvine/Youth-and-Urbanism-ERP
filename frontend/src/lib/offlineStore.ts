/**
 * Era Mail Offline Store
 *
 * Lightweight IndexedDB wrapper for offline mail support.
 * Uses the raw IndexedDB API — no external dependencies.
 */

const DB_NAME = 'era-mail-offline';
const DB_VERSION = 1;

const STORE_MESSAGES = 'messages';
const STORE_DRAFTS = 'drafts';
const STORE_CONTACTS = 'contacts';

const MAX_CACHED_MESSAGES = 500;

let dbInstance: IDBDatabase | null = null;

// ─── Database Initialization ───────────────────────────────────────────────────

export function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Messages store — indexed by folder and date for efficient queries
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messageStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('folder', 'folder', { unique: false });
        messageStore.createIndex('date', 'date', { unique: false });
        messageStore.createIndex('folder_date', ['folder', 'date'], { unique: false });
      }

      // Drafts store
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        const draftStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
        draftStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      // Contacts store
      if (!db.objectStoreNames.contains(STORE_CONTACTS)) {
        const contactStore = db.createObjectStore(STORE_CONTACTS, { keyPath: 'email' });
        contactStore.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;

      // Handle connection closing unexpectedly
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`));
    };
  });
}

// ─── Helper: Get Object Store ──────────────────────────────────────────────────

async function getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await initOfflineDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrapTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ─── Messages ──────────────────────────────────────────────────────────────────

export async function cacheMessages(messages: any[]): Promise<void> {
  if (!messages.length) return;

  const db = await initOfflineDB();
  const tx = db.transaction(STORE_MESSAGES, 'readwrite');
  const store = tx.objectStore(STORE_MESSAGES);

  // Add/update all incoming messages
  for (const message of messages) {
    store.put({
      ...message,
      _cachedAt: Date.now(),
    });
  }

  await wrapTransaction(tx);

  // Enforce the 500-message limit — remove oldest by date
  await trimMessages();
}

async function trimMessages(): Promise<void> {
  const db = await initOfflineDB();
  const tx = db.transaction(STORE_MESSAGES, 'readwrite');
  const store = tx.objectStore(STORE_MESSAGES);

  const countReq = store.count();
  const count = await wrapRequest(countReq);

  if (count <= MAX_CACHED_MESSAGES) return;

  // Get all keys sorted by date index (ascending — oldest first)
  const index = store.index('date');
  const toRemove = count - MAX_CACHED_MESSAGES;
  let removed = 0;

  const cursorReq = index.openCursor('prev'); // This opens newest-first; we want oldest
  // Re-open with ascending order
  const ascCursorReq = index.openCursor();

  await new Promise<void>((resolve, reject) => {
    ascCursorReq.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && removed < toRemove) {
        cursor.delete();
        removed++;
        cursor.continue();
      } else {
        resolve();
      }
    };
    ascCursorReq.onerror = () => reject(ascCursorReq.error);
  });
}

export async function getCachedMessages(folder: string, limit: number = 50): Promise<any[]> {
  const db = await initOfflineDB();
  const tx = db.transaction(STORE_MESSAGES, 'readonly');
  const store = tx.objectStore(STORE_MESSAGES);
  const index = store.index('folder');
  const results: any[] = [];

  return new Promise((resolve, reject) => {
    // Get all messages in the folder, then sort by date descending
    const request = index.getAll(folder);

    request.onsuccess = () => {
      const messages = request.result || [];
      // Sort by date descending (newest first)
      messages.sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
      resolve(messages.slice(0, limit));
    };

    request.onerror = () => reject(request.error);
  });
}

// ─── Drafts ────────────────────────────────────────────────────────────────────

export async function saveDraft(draft: any): Promise<void> {
  const store = await getStore(STORE_DRAFTS, 'readwrite');
  const record = {
    ...draft,
    id: draft.id || crypto.randomUUID(),
    updated_at: new Date().toISOString(),
    _offline: true,
  };
  await wrapRequest(store.put(record));
}

export async function getDrafts(): Promise<any[]> {
  const store = await getStore(STORE_DRAFTS, 'readonly');
  const all = await wrapRequest(store.getAll());
  // Sort by updated_at descending
  return (all || []).sort((a: any, b: any) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

export async function removeDraft(id: string): Promise<void> {
  const store = await getStore(STORE_DRAFTS, 'readwrite');
  await wrapRequest(store.delete(id));
}

// ─── Contacts ──────────────────────────────────────────────────────────────────

export async function cacheContacts(contacts: any[]): Promise<void> {
  if (!contacts.length) return;

  const db = await initOfflineDB();
  const tx = db.transaction(STORE_CONTACTS, 'readwrite');
  const store = tx.objectStore(STORE_CONTACTS);

  for (const contact of contacts) {
    store.put(contact);
  }

  await wrapTransaction(tx);
}

export async function getCachedContacts(): Promise<any[]> {
  const store = await getStore(STORE_CONTACTS, 'readonly');
  return wrapRequest(store.getAll());
}

// ─── Online Status ─────────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

// ─── Sync Drafts ───────────────────────────────────────────────────────────────

export async function syncDrafts(
  sendFn: (draft: any) => Promise<void>
): Promise<{ sent: number; failed: number }> {
  const drafts = await getDrafts();
  let sent = 0;
  let failed = 0;

  for (const draft of drafts) {
    if (!draft._offline) continue;

    try {
      await sendFn(draft);
      await removeDraft(draft.id);
      sent++;
    } catch (error) {
      console.error(`[OfflineStore] Failed to sync draft ${draft.id}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}
