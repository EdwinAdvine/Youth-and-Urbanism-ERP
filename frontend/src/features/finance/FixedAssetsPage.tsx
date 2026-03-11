import React, { useState } from 'react'
import {
  cn,
  Button,
  Input,
  Select,
  Badge,
  Card,
  Spinner,
  Modal,
  Table,
  toast,
} from '../../components/ui'
import {
  useFixedAssets,
  useCreateFixedAsset,
  useUpdateFixedAsset,
  useDepreciateAsset,
  useDisposeAsset,
  type FixedAsset,
  type AssetStatus,
  type DepreciationMethod,
} from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatPct(pct: number) {
  return `${pct.toFixed(1)}%`
}

const STATUS_BADGE: Record<AssetStatus, 'default' | 'info' | 'success' | 'warning' | 'danger' | 'primary'> = {
  active: 'success',
  fully_depreciated: 'warning',
  disposed: 'danger',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'fully_depreciated', label: 'Fully Depreciated' },
  { value: 'disposed', label: 'Disposed' },
]

const DEPRECIATION_OPTIONS: { value: DepreciationMethod; label: string }[] = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'sum_of_years', label: 'Sum of Years Digits' },
]

const CATEGORY_OPTIONS = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'buildings', label: 'Buildings' },
  { value: 'land', label: 'Land' },
  { value: 'software', label: 'Software' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'other', label: 'Other' },
]

// ─── Dispose Modal ───────────────────────────────────────────────────────────

function DisposeModal({ open, onClose, asset }: { open: boolean; onClose: () => void; asset: FixedAsset | null }) {
  const [disposalAmount, setDisposalAmount] = useState('')
  const disposeMut = useDisposeAsset()

  React.useEffect(() => {
    if (open && asset) {
      setDisposalAmount(String(asset.current_value))
    }
  }, [open, asset])

  async function handleDispose(ev: React.FormEvent) {
    ev.preventDefault()
    if (!asset) return
    const amt = Number(disposalAmount)
    if (isNaN(amt) || amt < 0) { toast('error', 'Valid disposal amount is required'); return }
    try {
      await disposeMut.mutateAsync({ id: asset.id, disposal_amount: amt })
      toast('success', 'Asset disposed successfully')
      onClose()
    } catch {
      toast('error', 'Failed to dispose asset')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Dispose Asset" size="sm">
      <form onSubmit={handleDispose} className="space-y-4">
        {asset && (
          <p className="text-sm text-gray-600">
            Disposing <strong>{asset.name}</strong> (current value: {formatCurrency(asset.current_value)})
          </p>
        )}
        <Input
          label="Disposal Amount *"
          type="number"
          min="0"
          step="0.01"
          value={disposalAmount}
          onChange={(e) => setDisposalAmount(e.target.value)}
          placeholder="0.00"
        />
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={disposeMut.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={disposeMut.isPending}>
            Dispose
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Asset Modal ─────────────────────────────────────────────────────────────

interface AssetModalProps {
  open: boolean
  onClose: () => void
  editing: FixedAsset | null
}

function AssetModal({ open, onClose, editing }: AssetModalProps) {
  const createMut = useCreateFixedAsset()
  const updateMut = useUpdateFixedAsset()

  const [name, setName] = useState('')
  const [assetCode, setAssetCode] = useState('')
  const [category, setCategory] = useState('equipment')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchaseCost, setPurchaseCost] = useState('')
  const [salvageValue, setSalvageValue] = useState('')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [depreciationMethod, setDepreciationMethod] = useState<DepreciationMethod>('straight_line')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name)
      setAssetCode(editing.asset_code)
      setCategory(editing.category)
      setPurchaseDate(editing.purchase_date?.split('T')[0] || '')
      setPurchaseCost(String(editing.purchase_cost))
      setSalvageValue(String(editing.salvage_value))
      setUsefulLifeYears(String(editing.useful_life_years))
      setDepreciationMethod(editing.depreciation_method)
      setNotes(editing.notes || '')
    } else if (open && !editing) {
      setName('')
      setAssetCode('')
      setCategory('equipment')
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setPurchaseCost('')
      setSalvageValue('0')
      setUsefulLifeYears('')
      setDepreciationMethod('straight_line')
      setNotes('')
    }
    setErrors({})
  }, [open, editing])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!assetCode.trim()) e.assetCode = 'Asset code is required'
    if (!purchaseDate) e.purchaseDate = 'Purchase date is required'
    if (!purchaseCost || Number(purchaseCost) <= 0) e.purchaseCost = 'Valid purchase cost is required'
    if (!usefulLifeYears || Number(usefulLifeYears) <= 0) e.usefulLifeYears = 'Valid useful life is required'
    return e
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }

    try {
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          name: name.trim(),
          asset_code: assetCode.trim(),
          category,
          purchase_date: purchaseDate,
          purchase_cost: Number(purchaseCost),
          salvage_value: Number(salvageValue) || 0,
          useful_life_years: Number(usefulLifeYears),
          depreciation_method: depreciationMethod,
          notes: notes || undefined,
        })
        toast('success', 'Asset updated')
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          asset_code: assetCode.trim(),
          category,
          purchase_date: purchaseDate,
          purchase_cost: Number(purchaseCost),
          salvage_value: Number(salvageValue) || 0,
          useful_life_years: Number(usefulLifeYears),
          depreciation_method: depreciationMethod,
          notes: notes || undefined,
        })
        toast('success', 'Asset created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save asset')
    }
  }

  const isBusy = createMut.isPending || updateMut.isPending

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Fixed Asset' : 'New Fixed Asset'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Asset Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. Dell Laptop XPS 15"
          />
          <Input
            label="Asset Code *"
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            error={errors.assetCode}
            placeholder="e.g. FA-001"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Category *"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <Input
            label="Purchase Date *"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            error={errors.purchaseDate}
          />
          <Select
            label="Depreciation Method *"
            options={DEPRECIATION_OPTIONS}
            value={depreciationMethod}
            onChange={(e) => setDepreciationMethod(e.target.value as DepreciationMethod)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Purchase Cost *"
            type="number"
            min="0"
            step="0.01"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
            error={errors.purchaseCost}
            placeholder="0.00"
          />
          <Input
            label="Salvage Value"
            type="number"
            min="0"
            step="0.01"
            value={salvageValue}
            onChange={(e) => setSalvageValue(e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Useful Life (Years) *"
            type="number"
            min="1"
            value={usefulLifeYears}
            onChange={(e) => setUsefulLifeYears(e.target.value)}
            error={errors.usefulLifeYears}
            placeholder="e.g. 5"
          />
        </div>

        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" loading={isBusy}>
            {editing ? 'Save Changes' : 'Create Asset'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── FixedAssetsPage ─────────────────────────────────────────────────────────

export default function FixedAssetsPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FixedAsset | null>(null)
  const [disposeModalOpen, setDisposeModalOpen] = useState(false)
  const [disposingAsset, setDisposingAsset] = useState<FixedAsset | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useFixedAssets({ status: statusFilter || undefined })
  const depreciateMut = useDepreciateAsset()

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(asset: FixedAsset) {
    setEditing(asset)
    setModalOpen(true)
  }

  function openDispose(asset: FixedAsset) {
    setDisposingAsset(asset)
    setDisposeModalOpen(true)
  }

  async function handleDepreciate(id: string) {
    try {
      await depreciateMut.mutateAsync(id)
      toast('success', 'Depreciation applied successfully')
    } catch {
      toast('error', 'Failed to run depreciation')
    }
  }

  const items = data?.items ?? []

  const columns = [
    {
      key: 'asset_code',
      label: 'Code',
      render: (row: FixedAsset) => <span className="font-mono text-sm text-gray-700">{row.asset_code}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      render: (row: FixedAsset) => (
        <div>
          <span className="font-medium text-gray-900">{row.name}</span>
          <p className="text-xs text-gray-500 capitalize">{row.category}</p>
        </div>
      ),
    },
    {
      key: 'purchase_cost',
      label: 'Purchase Cost',
      render: (row: FixedAsset) => <span className="font-medium">{formatCurrency(row.purchase_cost)}</span>,
    },
    {
      key: 'accumulated_depreciation',
      label: 'Depreciation',
      render: (row: FixedAsset) => {
        const pct = row.purchase_cost > 0 ? (row.accumulated_depreciation / row.purchase_cost) * 100 : 0
        return (
          <div>
            <span className="text-gray-700">{formatCurrency(row.accumulated_depreciation)}</span>
            <p className="text-xs text-gray-500">{formatPct(pct)} of cost</p>
          </div>
        )
      },
    },
    {
      key: 'current_value',
      label: 'Current Value',
      render: (row: FixedAsset) => (
        <span className={cn('font-semibold', row.current_value <= 0 ? 'text-danger' : 'text-green-700')}>
          {formatCurrency(row.current_value)}
        </span>
      ),
    },
    {
      key: 'depreciation_method',
      label: 'Method',
      render: (row: FixedAsset) => (
        <span className="text-gray-700 text-xs capitalize">
          {row.depreciation_method.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: FixedAsset) => (
        <Badge variant={STATUS_BADGE[row.status]}>
          {row.status === 'fully_depreciated'
            ? 'Fully Depreciated'
            : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: FixedAsset) => (
        <div className="flex items-center gap-2">
          {row.status === 'active' && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDepreciate(row.id)}
                loading={depreciateMut.isPending}
              >
                Depreciate
              </Button>
              <Button size="sm" variant="danger" onClick={() => openDispose(row)}>
                Dispose
              </Button>
            </>
          )}
          {row.status === 'fully_depreciated' && (
            <Button size="sm" variant="danger" onClick={() => openDispose(row)}>
              Dispose
            </Button>
          )}
          {row.status === 'disposed' && row.disposed_at && (
            <span className="text-xs text-gray-500">
              Disposed {formatDate(row.disposed_at)}
              {row.disposal_amount != null && ` for ${formatCurrency(row.disposal_amount)}`}
            </span>
          )}
        </div>
      ),
    },
  ]

  // Summary stats
  const totalCost = items.reduce((s, a) => s + a.purchase_cost, 0)
  const totalCurrent = items.reduce((s, a) => s + a.current_value, 0)
  const totalDepreciation = items.reduce((s, a) => s + a.accumulated_depreciation, 0)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Assets</h1>
          <p className="text-sm text-gray-500 mt-1">Track assets, depreciation, and disposals</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Asset
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900">{items.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCost)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Current Value</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalCurrent)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Total Depreciation</p>
          <p className="text-2xl font-bold text-gray-700">{formatCurrency(totalDepreciation)}</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-end gap-3 mb-4">
        <div className="w-48">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <span className="text-sm text-gray-500 mb-2">{data?.total ?? 0} assets</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table<FixedAsset>
            columns={columns}
            data={items}
            loading={isLoading}
            emptyText="No fixed assets found"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <AssetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      <DisposeModal
        open={disposeModalOpen}
        onClose={() => setDisposeModalOpen(false)}
        asset={disposingAsset}
      />
    </div>
  )
}
