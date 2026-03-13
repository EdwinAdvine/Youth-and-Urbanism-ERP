/**
 * posOfflineDb.ts — Centralized IndexedDB access for POS offline mode.
 *
 * DB: pos-offline-db (version 2)
 * Stores:
 *   - pending-transactions  : offline transactions queued for sync
 *   - product-catalog       : cached inventory items for offline product lookup
 *   - cache-meta            : metadata (e.g., last catalog sync timestamp)
 *
 * Upgrade strategy (v1→v2): adds product-catalog + cache-meta stores.
 */

export const DB_NAME = 'pos-offline-db'
export const DB_VERSION = 2

export const STORE_PENDING = 'pending-transactions'
export const STORE_CATALOG = 'product-catalog'
export const STORE_META = 'cache-meta'

export interface OfflineProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: string
  category: string | null
  stock_on_hand: number
  variants?: OfflineVariant[]
  cached_at: number  // epoch ms
}

export interface OfflineVariant {
  id: string
  sku: string
  attributes: Record<string, string>
  selling_price: string
  stock_on_hand: number
}

export interface PendingTransaction {
  id?: number          // IDB autoincrement key
  local_id: string     // client-generated UUID
  payload: unknown     // same shape as POST /pos/transactions
  created_at: number   // epoch ms
  retries: number
  last_error: string | null
}

// ── DB open ───────────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null

export function openPosDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      // Store 1 (existed in v1)
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true })
      }

      // Stores added in v2
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          const catalogStore = db.createObjectStore(STORE_CATALOG, { keyPath: 'id' })
          catalogStore.createIndex('barcode', 'barcode', { unique: false })
          catalogStore.createIndex('sku', 'sku', { unique: false })
          catalogStore.createIndex('category', 'category', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' })
        }
      }
    }

    req.onsuccess = () => {
      _db = req.result
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Pending transactions ───────────────────────────────────────────────────────

export async function queueTransaction(payload: unknown): Promise<number> {
  const db = await openPosDB()
  const record: PendingTransaction = {
    local_id: crypto.randomUUID(),
    payload,
    created_at: Date.now(),
    retries: 0,
    last_error: null,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const req = tx.objectStore(STORE_PENDING).add(record)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly')
    const req = tx.objectStore(STORE_PENDING).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function deletePendingTransaction(id: number): Promise<void> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const req = tx.objectStore(STORE_PENDING).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function incrementRetry(id: number, error: string): Promise<void> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite')
    const store = tx.objectStore(STORE_PENDING)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record = getReq.result as PendingTransaction
      if (!record) { resolve(); return }
      record.retries += 1
      record.last_error = error
      const putReq = store.put(record)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function countPending(): Promise<number> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly')
    const req = tx.objectStore(STORE_PENDING).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Product catalog cache ─────────────────────────────────────────────────────

/**
 * Replace the entire product catalog in IndexedDB.
 * Uses server-wins conflict strategy: local catalog is fully replaced on each sync.
 */
export async function cacheProductCatalog(products: OfflineProduct[]): Promise<void> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_CATALOG, STORE_META], 'readwrite')
    const catalogStore = tx.objectStore(STORE_CATALOG)
    const metaStore = tx.objectStore(STORE_META)

    // Clear existing catalog
    catalogStore.clear()

    // Insert all products
    const now = Date.now()
    for (const product of products) {
      catalogStore.put({ ...product, cached_at: now })
    }

    // Update sync timestamp
    metaStore.put({ key: 'catalog_synced_at', value: now })

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineProducts(): Promise<OfflineProduct[]> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOG, 'readonly')
    const req = tx.objectStore(STORE_CATALOG).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function searchOfflineProducts(query: string): Promise<OfflineProduct[]> {
  const products = await getOfflineProducts()
  const q = query.toLowerCase()
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.barcode ?? '').includes(q) ||
    (p.category ?? '').toLowerCase().includes(q)
  )
}

export async function getOfflineProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CATALOG, 'readonly')
    const index = tx.objectStore(STORE_CATALOG).index('barcode')
    const req = index.get(barcode)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

// ── Meta helpers ──────────────────────────────────────────────────────────────

export async function getCatalogSyncedAt(): Promise<number | null> {
  const db = await openPosDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly')
    const req = tx.objectStore(STORE_META).get('catalog_synced_at')
    req.onsuccess = () => resolve(req.result?.value ?? null)
    req.onerror = () => reject(req.error)
  })
}
