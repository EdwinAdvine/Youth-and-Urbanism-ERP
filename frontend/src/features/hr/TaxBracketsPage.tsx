import { useState } from 'react'
import { Button, Card, Input, Modal, Table, Badge, toast } from '../../components/ui'
import {
  useTaxBrackets,
  useCreateTaxBracket,
  useUpdateTaxBracket,
  useDeleteTaxBracket,
  useStatutoryDeductions,
  useCreateStatutoryDeduction,
  useUpdateStatutoryDeduction,
  useDeleteStatutoryDeduction,
  type TaxBracket,
  type StatutoryDeduction,
} from '../../api/hr'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(2)}%`
}

export default function TaxBracketsPage() {
  const { data: brackets, isLoading: bracketsLoading } = useTaxBrackets()
  const { data: deductions, isLoading: deductionsLoading } = useStatutoryDeductions()
  const createBracket = useCreateTaxBracket()
  const updateBracket = useUpdateTaxBracket()
  const deleteBracket = useDeleteTaxBracket()
  const createDeduction = useCreateStatutoryDeduction()
  const updateDeduction = useUpdateStatutoryDeduction()
  const deleteDeduction = useDeleteStatutoryDeduction()

  // Bracket modal
  const [showBracketModal, setShowBracketModal] = useState(false)
  const [editBracket, setEditBracket] = useState<TaxBracket | null>(null)
  const [bName, setBName] = useState('')
  const [bMin, setBMin] = useState('')
  const [bMax, setBMax] = useState('')
  const [bRate, setBRate] = useState('')
  const [bFrom, setBFrom] = useState('')

  // Deduction modal
  const [showDeductionModal, setShowDeductionModal] = useState(false)
  const [editDeduction, setEditDeduction] = useState<StatutoryDeduction | null>(null)
  const [dName, setDName] = useState('')
  const [dType, setDType] = useState<'percentage' | 'fixed'>('percentage')
  const [dValue, setDValue] = useState('')
  const [dMax, setDMax] = useState('')

  function openBracketCreate() {
    setEditBracket(null)
    setBName(''); setBMin(''); setBMax(''); setBRate(''); setBFrom(new Date().toISOString().split('T')[0])
    setShowBracketModal(true)
  }

  function openBracketEdit(b: TaxBracket) {
    setEditBracket(b)
    setBName(b.name); setBMin(String(b.min_amount)); setBMax(b.max_amount ? String(b.max_amount) : '')
    setBRate(String(b.rate)); setBFrom(b.effective_from)
    setShowBracketModal(true)
  }

  async function handleSaveBracket() {
    if (!bName || !bMin || !bRate || !bFrom) { toast('warning', 'Fill required fields'); return }
    try {
      const payload = {
        name: bName,
        min_amount: parseFloat(bMin),
        max_amount: bMax ? parseFloat(bMax) : null,
        rate: parseFloat(bRate),
        effective_from: bFrom,
      }
      if (editBracket) {
        await updateBracket.mutateAsync({ id: editBracket.id, ...payload })
        toast('success', 'Tax bracket updated')
      } else {
        await createBracket.mutateAsync(payload)
        toast('success', 'Tax bracket created')
      }
      setShowBracketModal(false)
    } catch { toast('error', 'Failed to save bracket') }
  }

  function openDeductionCreate() {
    setEditDeduction(null)
    setDName(''); setDType('percentage'); setDValue(''); setDMax('')
    setShowDeductionModal(true)
  }

  function openDeductionEdit(d: StatutoryDeduction) {
    setEditDeduction(d)
    setDName(d.name); setDType(d.calculation_type); setDValue(String(d.value))
    setDMax(d.max_amount ? String(d.max_amount) : '')
    setShowDeductionModal(true)
  }

  async function handleSaveDeduction() {
    if (!dName || !dValue) { toast('warning', 'Fill required fields'); return }
    try {
      const payload = {
        name: dName,
        calculation_type: dType,
        value: parseFloat(dValue),
        max_amount: dMax ? parseFloat(dMax) : null,
      }
      if (editDeduction) {
        await updateDeduction.mutateAsync({ id: editDeduction.id, ...payload })
        toast('success', 'Deduction updated')
      } else {
        await createDeduction.mutateAsync(payload)
        toast('success', 'Deduction created')
      }
      setShowDeductionModal(false)
    } catch { toast('error', 'Failed to save deduction') }
  }

  const bracketCols = [
    { key: 'name', label: 'Name' },
    { key: 'min_amount', label: 'Min Amount', render: (b: TaxBracket) => formatCurrency(b.min_amount) },
    { key: 'max_amount', label: 'Max Amount', render: (b: TaxBracket) => b.max_amount ? formatCurrency(b.max_amount) : <span className="text-gray-400">No cap</span> },
    { key: 'rate', label: 'Rate', render: (b: TaxBracket) => <Badge variant="info">{formatPercent(b.rate)}</Badge> },
    { key: 'effective_from', label: 'From', render: (b: TaxBracket) => b.effective_from },
    {
      key: 'actions', label: '', render: (b: TaxBracket) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openBracketEdit(b)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => {
            if (confirm('Delete?')) { await deleteBracket.mutateAsync(b.id); toast('success', 'Deleted') }
          }}>Delete</Button>
        </div>
      )
    },
  ]

  const deductionCols = [
    { key: 'name', label: 'Name' },
    { key: 'calculation_type', label: 'Type', render: (d: StatutoryDeduction) => <Badge variant={d.calculation_type === 'percentage' ? 'info' : 'default'}>{d.calculation_type}</Badge> },
    { key: 'value', label: 'Value', render: (d: StatutoryDeduction) => d.calculation_type === 'percentage' ? formatPercent(d.value) : formatCurrency(d.value) },
    { key: 'max_amount', label: 'Max', render: (d: StatutoryDeduction) => d.max_amount ? formatCurrency(d.max_amount) : '-' },
    { key: 'is_active', label: 'Active', render: (d: StatutoryDeduction) => d.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="default">Inactive</Badge> },
    {
      key: 'actions', label: '', render: (d: StatutoryDeduction) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openDeductionEdit(d)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={async () => {
            if (confirm('Delete?')) { await deleteDeduction.mutateAsync(d.id); toast('success', 'Deleted') }
          }}>Delete</Button>
        </div>
      )
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tax & Statutory Deductions</h1>
        <p className="text-sm text-gray-500 mt-1">Configure tax brackets and mandatory deductions for payroll</p>
      </div>

      {/* Tax Brackets */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Tax Brackets</h2>
          <Button size="sm" onClick={openBracketCreate}>Add Bracket</Button>
        </div>
        <Table columns={bracketCols} data={brackets ?? []} loading={bracketsLoading} emptyText="No tax brackets" keyExtractor={(b) => b.id} />
      </Card>

      {/* Statutory Deductions */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Statutory Deductions</h2>
          <Button size="sm" onClick={openDeductionCreate}>Add Deduction</Button>
        </div>
        <Table columns={deductionCols} data={deductions ?? []} loading={deductionsLoading} emptyText="No deductions" keyExtractor={(d) => d.id} />
      </Card>

      {/* Bracket Modal */}
      <Modal open={showBracketModal} onClose={() => setShowBracketModal(false)} title={editBracket ? 'Edit Tax Bracket' : 'Add Tax Bracket'}>
        <div className="space-y-4">
          <Input label="Name" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="e.g. Band 1 (10%)" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Amount" type="number" value={bMin} onChange={(e) => setBMin(e.target.value)} />
            <Input label="Max Amount (optional)" type="number" value={bMax} onChange={(e) => setBMax(e.target.value)} />
          </div>
          <Input label="Rate (decimal, e.g. 0.10 = 10%)" type="number" step="0.0001" value={bRate} onChange={(e) => setBRate(e.target.value)} />
          <Input label="Effective From" type="date" value={bFrom} onChange={(e) => setBFrom(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowBracketModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveBracket} loading={createBracket.isPending || updateBracket.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Deduction Modal */}
      <Modal open={showDeductionModal} onClose={() => setShowDeductionModal(false)} title={editDeduction ? 'Edit Deduction' : 'Add Deduction'}>
        <div className="space-y-4">
          <Input label="Name" value={dName} onChange={(e) => setDName(e.target.value)} placeholder="e.g. NHIF" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Calculation Type</label>
            <select className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" value={dType} onChange={(e) => setDType(e.target.value as 'percentage' | 'fixed')}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>
          <Input label={dType === 'percentage' ? 'Rate (decimal, e.g. 0.06 = 6%)' : 'Fixed Amount'} type="number" step="0.0001" value={dValue} onChange={(e) => setDValue(e.target.value)} />
          <Input label="Max Amount (optional)" type="number" value={dMax} onChange={(e) => setDMax(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDeductionModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveDeduction} loading={createDeduction.isPending || updateDeduction.isPending}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
