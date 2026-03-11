import { useState } from 'react'
import { Button, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useSyncContactToEcommerce, useImportFromEcommerce } from '../../api/crm'

// ─── Sync Contact to E-Commerce ──────────────────────────────────────────────

interface SyncProps {
  open: boolean
  onClose: () => void
  contactId: string
  contactName: string
}

export function SyncToEcommerceDialog({ open, onClose, contactId, contactName }: SyncProps) {
  const mutation = useSyncContactToEcommerce()
  const [storeId, setStoreId] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId.trim()) return

    try {
      const result = await mutation.mutateAsync({ contactId, store_id: storeId.trim() })
      toast('success', result.message)
      setStoreId('')
      onClose()
    } catch {
      toast('error', 'Failed to sync contact to e-commerce')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Sync to E-Commerce: ${contactName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Store ID"
          required
          placeholder="Enter the e-commerce store UUID"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          This will create an e-commerce customer account linked to this CRM contact.
          If a customer with the same email already exists, they will be linked instead.
        </p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Sync to E-Commerce
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Import from E-Commerce ──────────────────────────────────────────────────

interface ImportProps {
  open: boolean
  onClose: () => void
}

export function ImportFromEcommerceDialog({ open, onClose }: ImportProps) {
  const mutation = useImportFromEcommerce()
  const [storeId, setStoreId] = useState('')
  const [result, setResult] = useState<{ imported: number; linked: number; skipped: number } | null>(null)

  const reset = () => {
    setStoreId('')
    setResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId.trim()) return

    try {
      const res = await mutation.mutateAsync({ store_id: storeId.trim() })
      setResult({ imported: res.imported, linked: res.linked, skipped: res.skipped })
      toast('success', `Imported ${res.imported} contacts, linked ${res.linked}`)
    } catch {
      toast('error', 'Failed to import from e-commerce')
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import from E-Commerce" size="md">
      {result ? (
        <div className="space-y-4">
          <div className="rounded-[10px] bg-green-50 border border-green-200 p-4">
            <p className="text-sm font-medium text-green-800">Import complete</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-[10px] bg-gray-50 dark:bg-gray-950 p-3">
              <p className="text-2xl font-bold text-primary">{result.imported}</p>
              <p className="text-xs text-gray-500">New contacts</p>
            </div>
            <div className="rounded-[10px] bg-gray-50 dark:bg-gray-950 p-3">
              <p className="text-2xl font-bold text-info">{result.linked}</p>
              <p className="text-xs text-gray-500">Linked existing</p>
            </div>
            <div className="rounded-[10px] bg-gray-50 dark:bg-gray-950 p-3">
              <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
              <p className="text-xs text-gray-500">Skipped</p>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Store ID"
            required
            placeholder="Enter the e-commerce store UUID"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Import all active e-commerce customers as CRM contacts. Customers already linked
            to CRM contacts will be skipped. Matching emails will be auto-linked.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Import Customers
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
