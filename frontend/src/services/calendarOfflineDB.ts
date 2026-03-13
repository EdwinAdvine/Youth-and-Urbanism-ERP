/**
 * IndexedDB wrapper for offline calendar storage.
 * DB: era-calendar | version: 1
 * Stores: events, sync_queue
 */

const DB_NAME = 'era-calendar'
const DB_VERSION = 1

export interface OfflineEvent {
  id: string
  title: string
  start_time: string
  end_time: string
  description?: string
  location?: string
  color?: string
  all_day?: boolean
  synced?: boolean
}

export type SyncAction = 'create' | 'update' | 'delete'

export interface SyncQueueEntry {
  id: string        // UUID
  type: SyncAction
  eventId: string
  payload?: Partial<OfflineEvent>
  createdAt: number  // Date.now()
  retries: number
}

let _db: IDBDatabase | null = null

async function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('events')) {
        const evStore = db.createObjectStore('events', { keyPath: 'id' })
        evStore.createIndex('start_time', 'start_time', { unique: false })
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' })
      }
    }
    req.onsuccess = () => { _db = req.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

function txn<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return getDB().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function saveEvent(event: OfflineEvent): Promise<void> {
  await txn('events', 'readwrite', store => store.put(event))
}

export async function getEvent(id: string): Promise<OfflineEvent | undefined> {
  return txn('events', 'readonly', store => store.get(id))
}

export async function getAllEvents(): Promise<OfflineEvent[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('events', 'readonly')
    const req = tx.objectStore('events').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteEvent(id: string): Promise<void> {
  await txn('events', 'readwrite', store => store.delete(id))
}

// ── Sync Queue ────────────────────────────────────────────────────────────────

export async function enqueue(entry: Omit<SyncQueueEntry, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  const full: SyncQueueEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    retries: 0,
  }
  await txn('sync_queue', 'readwrite', store => store.put(full))
}

export async function getQueue(): Promise<SyncQueueEntry[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly')
    const req = tx.objectStore('sync_queue').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeFromQueue(id: string): Promise<void> {
  await txn('sync_queue', 'readwrite', store => store.delete(id))
}

export async function updateQueueEntry(entry: SyncQueueEntry): Promise<void> {
  await txn('sync_queue', 'readwrite', store => store.put(entry))
}

export async function clearQueue(): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite')
    const req = tx.objectStore('sync_queue').clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
