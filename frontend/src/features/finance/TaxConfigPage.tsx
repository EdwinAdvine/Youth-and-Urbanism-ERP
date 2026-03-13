import React, { useState } from 'react'
import {
  Button,
  Input,
  Badge,
  Card,
  Spinner,
  Modal,
  Table,
  toast,
} from '../../components/ui'
import {
  useTaxRates,
  useCreateTaxRate,
  useUpdateTaxRate,
  type TaxRate,
} from '../../api/finance'

// ─── Tax Rate Modal ───────────────────────────────────────────────────────────

interface TaxRateModalProps {
  open: boolean
  onClose: () => void
  editing: TaxRate | null
}

function TaxRateModal({ open, onClose, editing }: TaxRateModalProps) {
  const createMut = useCreateTaxRate()
  const updateMut = useUpdateTaxRate()

  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name)
      setRate(String(editing.rate))
      setIsDefault(editing.is_default)
    } else if (open && !editing) {
      setName('')
      setRate('')
      setIsDefault(false)
    }
    setErrors({})
  }, [open, editing])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    const r = parseFloat(rate)
    if (isNaN(r) || r < 0 || r > 100) e.rate = 'Rate must be between 0 and 100'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    const payload = {
      name: name.trim(),
      rate: parseFloat(rate),
      is_default: isDefault,
    }

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Tax rate updated')
      } else {
        await createMut.mutateAsync(payload)
        toast('success', 'Tax rate created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save tax rate')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Tax Rate' : 'New Tax Rate'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. VAT 16%"
        />
        <Input
          label="Rate (%) *"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          error={errors.rate}
          placeholder="0.00"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-gray-700">Set as default tax rate</span>
        </label>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Tax Rate'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── TaxConfigPage ────────────────────────────────────────────────────────────

export default function TaxConfigPage() {
  const { data: taxRates, isLoading } = useTaxRates()
  const updateMut = useUpdateTaxRate()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(t: TaxRate) {
    setEditing(t)
    setModalOpen(true)
  }

  async function handleToggleActive(t: TaxRate) {
    try {
      await updateMut.mutateAsync({ id: t.id, is_active: !t.is_active })
      toast('success', `Tax rate ${t.is_active ? 'deactivated' : 'activated'}`)
    } catch {
      toast('error', 'Failed to update tax rate')
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: TaxRate) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.is_default && (
            <span
              title="Default tax rate"
              className="text-yellow-500 text-base leading-none"
            >
              ★
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'rate',
      label: 'Rate (%)',
      render: (row: TaxRate) => (
        <span className="font-medium text-gray-900">{row.rate.toFixed(2)}%</span>
      ),
    },
    {
      key: 'is_default',
      label: 'Default',
      render: (row: TaxRate) =>
        row.is_default ? (
          <Badge variant="primary">Default</Badge>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: TaxRate) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: TaxRate) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant={row.is_active ? 'secondary' : 'ghost'}
            onClick={() => handleToggleActive(row)}
            loading={updateMut.isPending}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tax Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage tax rates applied to invoices and transactions
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Tax Rate
        </Button>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
        <Table<TaxRate>
          columns={columns}
          data={taxRates ?? []}
          loading={isLoading}
          emptyText="No tax rates configured"
          keyExtractor={(row) => row.id}
        />
        </div>
      </Card>

      <TaxRateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />
    </div>
  )
}
