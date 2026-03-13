import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, toast } from '../../components/ui'
import { useEcomStores } from '../../api/ecommerce'
import apiClient from '../../api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlashSale {
  id: string
  store_id: string
  product_id: string
  product_name?: string
  sale_price: string
  start_at: string
  end_at: string
  inventory_limit: number | null
  sold_count: number
  is_active: boolean
  countdown_visible: boolean
  created_at: string
}

interface FlashSaleCreate {
  store_id: string
  product_id: string
  sale_price: number
  start_at: string
  end_at: string
  inventory_limit?: number
  is_active: boolean
  countdown_visible: boolean
}

// ─── API hooks ────────────────────────────────────────────────────────────────

function useFlashSales(storeId: string) {
  return useQuery({
    queryKey: ['ecommerce', 'flash-sales', storeId],
    queryFn: async () => {
      const { data } = await apiClient.get<FlashSale[]>('/ecommerce/flash-sales', {
        params: storeId ? { store_id: storeId } : {},
      })
      return data
    },
    enabled: true,
  })
}

function useCreateFlashSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: FlashSaleCreate) =>
      apiClient.post<FlashSale>('/ecommerce/flash-sales', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'flash-sales'] }),
  })
}

function useUpdateFlashSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: Partial<FlashSaleCreate> & { id: string }) =>
      apiClient.put<FlashSale>(`/ecommerce/flash-sales/${id}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'flash-sales'] }),
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function saleStatus(sale: FlashSale): 'upcoming' | 'active' | 'ended' {
  const now = Date.now()
  const start = new Date(sale.start_at).getTime()
  const end = new Date(sale.end_at).getTime()
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'active'
}

function countdown(endAt: string): string {
  const diff = new Date(endAt).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

const emptyForm: FlashSaleCreate = {
  store_id: '',
  product_id: '',
  sale_price: 0,
  start_at: new Date().toISOString().slice(0, 16),
  end_at: new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16),
  inventory_limit: undefined,
  is_active: true,
  countdown_visible: true,
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FlashSalesPage() {
  const [selectedStore, setSelectedStore] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FlashSale | null>(null)
  const [form, setForm] = useState<FlashSaleCreate>(emptyForm)
  const [tick, setTick] = useState(0)

  const { data: stores = [] } = useEcomStores()
  const { data: flashSales = [], isLoading } = useFlashSales(selectedStore)
  const createSale = useCreateFlashSale()
  const updateSale = useUpdateFlashSale()

  // Refresh countdowns every 30s
  useState(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(interval)
  })

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, store_id: selectedStore || (stores[0]?.id ?? '') })
    setModalOpen(true)
  }

  function openEdit(sale: FlashSale) {
    setEditing(sale)
    setForm({
      store_id: sale.store_id,
      product_id: sale.product_id,
      sale_price: parseFloat(sale.sale_price),
      start_at: sale.start_at.slice(0, 16),
      end_at: sale.end_at.slice(0, 16),
      inventory_limit: sale.inventory_limit ?? undefined,
      is_active: sale.is_active,
      countdown_visible: sale.countdown_visible,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editing) {
        await updateSale.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Flash sale updated')
      } else {
        await createSale.mutateAsync(form)
        toast('success', 'Flash sale created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save flash sale')
    }
  }

  async function toggleActive(sale: FlashSale) {
    try {
      await updateSale.mutateAsync({ id: sale.id, is_active: !sale.is_active })
    } catch {
      toast('error', 'Failed to update flash sale')
    }
  }

  const statusColors = {
    upcoming: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    ended: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flash Sales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create time-limited sales with countdown timers</p>
        </div>
        <Button onClick={openCreate} size="sm">
          + New Flash Sale
        </Button>
      </div>

      {/* Store filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Store:</label>
        <select
          value={selectedStore}
          onChange={e => setSelectedStore(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        >
          <option value="">All stores</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Sales grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading…</div>
      ) : flashSales.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-4xl mb-3">⚡</p>
          <p className="text-lg font-medium text-gray-700">No flash sales yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first flash sale to drive urgency and conversions</p>
          <Button className="mt-4" onClick={openCreate}>Create Flash Sale</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flashSales.map(sale => {
            const status = saleStatus(sale)
            return (
              <Card key={sale.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">
                      {sale.product_name ?? sale.product_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {stores.find(s => s.id === sale.store_id)?.name ?? 'Unknown store'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Sale Price</p>
                    <p className="font-bold text-[#51459d] text-lg">${sale.sale_price}</p>
                  </div>
                  {sale.inventory_limit && (
                    <div>
                      <p className="text-xs text-gray-400">Remaining</p>
                      <p className="font-semibold text-gray-700">
                        {Math.max(0, sale.inventory_limit - sale.sold_count)} / {sale.inventory_limit}
                      </p>
                    </div>
                  )}
                </div>

                {/* Countdown */}
                {status === 'active' && sale.countdown_visible && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-orange-500 font-medium">Ends in</p>
                    <p className="text-lg font-bold text-orange-600">{countdown(sale.end_at)}</p>
                  </div>
                )}

                <div className="text-xs text-gray-400 space-y-0.5">
                  <p>Start: {new Date(sale.start_at).toLocaleString()}</p>
                  <p>End: {new Date(sale.end_at).toLocaleString()}</p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                  <button
                    onClick={() => toggleActive(sale)}
                    className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      sale.is_active
                        ? 'bg-green-50 text-green-600 hover:bg-green-100'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {sale.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(sale)}>
                    Edit
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[10px] shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Flash Sale' : 'New Flash Sale'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select
                  required
                  value={form.store_id}
                  onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select store…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                <input
                  required
                  type="text"
                  value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  placeholder="Product UUID"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.sale_price}
                    onChange={e => setForm(f => ({ ...f, sale_price: parseFloat(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.inventory_limit ?? ''}
                    onChange={e => setForm(f => ({ ...f, inventory_limit: e.target.value ? parseInt(e.target.value) : undefined }))}
                    placeholder="Unlimited"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.start_at}
                    onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.end_at}
                    onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="accent-[#51459d]"
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.countdown_visible}
                    onChange={e => setForm(f => ({ ...f, countdown_visible: e.target.checked }))}
                    className="accent-[#51459d]"
                  />
                  Show countdown
                </label>
              </div>

              {/* Preview countdown */}
              {form.end_at && (
                <div className="bg-orange-50 rounded-lg px-4 py-2 text-center">
                  <p className="text-xs text-orange-400">Countdown preview</p>
                  <p className="text-lg font-bold text-orange-600">{countdown(new Date(form.end_at).toISOString())}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={createSale.isPending || updateSale.isPending}>
                  {editing ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
