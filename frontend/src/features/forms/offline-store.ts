import Dexie, { type Table } from 'dexie'

export interface FormDraft {
  id?: number           // auto-increment
  formId: string
  answers: Record<string, unknown>
  deviceId: string
  createdAt: string    // ISO string
  syncedAt?: string
}

export interface CachedForm {
  id: string           // form UUID
  data: Record<string, unknown>
  cachedAt: string
}

class FormsOfflineDB extends Dexie {
  drafts!: Table<FormDraft>
  cachedForms!: Table<CachedForm>

  constructor() {
    super('FormsOfflineDB')
    this.version(1).stores({
      drafts: '++id, formId, createdAt',
      cachedForms: 'id, cachedAt',
    })
  }
}

export const offlineDB = new FormsOfflineDB()

export async function saveDraft(formId: string, answers: Record<string, unknown>): Promise<number> {
  return offlineDB.drafts.add({
    formId,
    answers,
    deviceId: getDeviceId(),
    createdAt: new Date().toISOString(),
  })
}

export async function getPendingDrafts(formId: string): Promise<FormDraft[]> {
  return offlineDB.drafts.where('formId').equals(formId).filter(d => !d.syncedAt).toArray()
}

export async function getAllPendingDrafts(): Promise<FormDraft[]> {
  return offlineDB.drafts.filter(d => !d.syncedAt).toArray()
}

export async function markDraftSynced(id: number): Promise<void> {
  await offlineDB.drafts.update(id, { syncedAt: new Date().toISOString() })
}

export async function cacheForm(formId: string, data: Record<string, unknown>): Promise<void> {
  await offlineDB.cachedForms.put({ id: formId, data, cachedAt: new Date().toISOString() })
}

export async function getCachedForm(formId: string): Promise<CachedForm | undefined> {
  return offlineDB.cachedForms.get(formId)
}

export async function countPendingDrafts(formId?: string): Promise<number> {
  if (formId) {
    return offlineDB.drafts.where('formId').equals(formId).filter(d => !d.syncedAt).count()
  }
  return offlineDB.drafts.filter(d => !d.syncedAt).count()
}

function getDeviceId(): string {
  let id = localStorage.getItem('urban_erp_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('urban_erp_device_id', id)
  }
  return id
}
