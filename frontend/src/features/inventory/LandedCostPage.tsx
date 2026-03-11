import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useLandedCosts, useCreateLandedCost, useApplyLandedCost, type LandedCostVoucher } from '../../api/inventory'

const STATUS_COLORS: Record<string, 'default' | 'success' | 'danger'> = { draft: 'default', applied: 'success', cancelled: 'danger' }
const COST_TYPE_OPTIONS = [
  { value: 'freight', label: 'Freight' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'duty', label: 'Customs Duty' },
  { value: 'customs', label: 'Customs Fees' },
  { value: 'handling', label: 'Handling' },
]

export default function LandedCostPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ purchase_order_id: '', notes: '' })
  const [costLines, setCostLines] = useState<{ cost_type: string; amount: string; description: string }[]>([{ cost_type: 'freight', amount: '', description: '' }])

  const { data: vouchers, isLoading } = useLandedCosts()
  const createVoucher = useCreateLandedCost()
  const applyVoucher = useApplyLandedCost()

  function addLine() {
    setCostLines([...costLines, { cost_type: 'freight', amount: '', description: '' }])
  }

  async function handleCreate() {
    const validLines = costLines.filter(l => l.cost_type && l.amount)
    if (validLines.length === 0) {
      toast('warning', 'At least one cost line is required')
      return
    }
    try {
      await createVoucher.mutateAsync({
        purchase_order_id: form.purchase_order_id || undefined,
        notes: form.notes || undefined,
        cost_lines: validLines.map(l => ({ cost_type: l.cost_type, amount: parseFloat(l.amount), description: l.description || undefined })),
      })
      toast('success', 'Landed cost voucher created')
      setModalOpen(false)
      setForm({ purchase_order_id: '', notes: '' })
      setCostLines([{ cost_type: 'freight', amount: '', description: '' }])
    } catch {
      toast('error', 'Failed to create voucher')
    }
  }

  async function handleApply(id: string) {
    try {
      const result = await applyVoucher.mutateAsync({ id })
      toast('success', `Applied $${result.total_cost_applied} in landed costs`)
    } catch {
      toast('error', 'Failed to apply voucher')
    }
  }

  const columns = [
    { key: 'voucher_number', label: 'Voucher #', render: (row: LandedCostVoucher) => <span className="font-mono font-medium text-primary">{row.voucher_number}</span> },
    { key: 'status', label: 'Status', render: (row: LandedCostVoucher) => <Badge variant={STATUS_COLORS[row.status] ?? 'default'}>{row.status}</Badge> },
    { key: 'cost_lines', label: 'Cost Types', render: (row: LandedCostVoucher) => row.cost_lines.map(l => l.cost_type).join(', ') },
    { key: 'total_cost', label: 'Total', render: (row: LandedCostVoucher) => <span className="font-semibold">${row.total_cost.toLocaleString()}</span> },
    { key: 'created_at', label: 'Created', render: (row: LandedCostVoucher) => new Date(row.created_at).toLocaleDateString() },
    {
      key: 'actions', label: '',
      render: (row: LandedCostVoucher) => row.status === 'draft' && (
        <Button size="sm" variant="outline" onClick={() => handleApply(row.id)} loading={applyVoucher.isPending}>Apply</Button>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Landed Costs</h1>
          <p className="text-sm text-gray-500 mt-1">Allocate freight, duty, and other costs to received goods</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>New Voucher</Button>
      </div>

      <Card padding={false}>
        <Table<LandedCostVoucher>
          columns={columns}
          data={vouchers ?? []}
          loading={isLoading}
          emptyText="No landed cost vouchers found."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Landed Cost Voucher" size="sm">
        <div className="space-y-4">
          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cost Lines</label>
              <Button size="sm" variant="ghost" onClick={addLine}>+ Add Line</Button>
            </div>
            <div className="space-y-2">
              {costLines.map((line, index) => (
                <div key={index} className="grid grid-cols-3 gap-2 items-center">
                  <Select label="" options={COST_TYPE_OPTIONS} value={line.cost_type} onChange={(e) => setCostLines(costLines.map((l, i) => i === index ? { ...l, cost_type: e.target.value } : l))} />
                  <Input label="" type="number" value={line.amount} onChange={(e) => setCostLines(costLines.map((l, i) => i === index ? { ...l, amount: e.target.value } : l))} placeholder="Amount" step="0.01" />
                  <Input label="" value={line.description} onChange={(e) => setCostLines(costLines.map((l, i) => i === index ? { ...l, description: e.target.value } : l))} placeholder="Note" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createVoucher.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
