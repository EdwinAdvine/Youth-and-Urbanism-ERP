import { useState } from 'react'
import { Button, Badge, Card, Table, Input, Select, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useUoM, useCreateUoM, useUoMConversions, type UnitOfMeasure, type UoMConversion } from '../../api/inventory'
import apiClient from '../../api/client'

const CATEGORY_OPTIONS = [
  { value: 'count', label: 'Count' },
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length' },
  { value: 'volume', label: 'Volume' },
  { value: 'area', label: 'Area' },
]

export default function UoMSettingsPage() {
  const [uomModal, setUomModal] = useState(false)
  const [convModal, setConvModal] = useState(false)
  const [uomForm, setUomForm] = useState({ name: '', abbreviation: '', category: 'count', is_base: false })
  const [convForm, setConvForm] = useState({ from_uom_id: '', to_uom_id: '', factor: '', item_id: '' })

  const { data: uoms, isLoading } = useUoM()
  const { data: conversions } = useUoMConversions()
  const createUoM = useCreateUoM()

  async function handleCreateConversion() {
    if (!convForm.from_uom_id || !convForm.to_uom_id || !convForm.factor) {
      toast('warning', 'From UoM, To UoM, and Factor are required')
      return
    }
    try {
      await apiClient.post('/inventory/uom/conversions', {
        from_uom_id: convForm.from_uom_id,
        to_uom_id: convForm.to_uom_id,
        factor: parseFloat(convForm.factor),
        item_id: convForm.item_id || null,
      })
      toast('success', 'Conversion created')
      setConvModal(false)
    } catch {
      toast('error', 'Failed to create conversion')
    }
  }

  async function handleCreateUoM() {
    if (!uomForm.name || !uomForm.abbreviation) {
      toast('warning', 'Name and abbreviation are required')
      return
    }
    try {
      await createUoM.mutateAsync(uomForm as Omit<UnitOfMeasure, 'id'>)
      toast('success', 'Unit of measure created')
      setUomModal(false)
      setUomForm({ name: '', abbreviation: '', category: 'count', is_base: false })
    } catch {
      toast('error', 'Failed to create unit of measure')
    }
  }

  const uomOptions = (uoms ?? []).map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))

  const uomColumns = [
    { key: 'name', label: 'Name', render: (row: UnitOfMeasure) => <span className="font-medium">{row.name}</span> },
    { key: 'abbreviation', label: 'Abbreviation' },
    { key: 'category', label: 'Category', render: (row: UnitOfMeasure) => <Badge variant="info">{row.category}</Badge> },
    { key: 'is_base', label: 'Base Unit', render: (row: UnitOfMeasure) => row.is_base ? <Badge variant="success">Yes</Badge> : <span className="text-gray-400">No</span> },
  ]

  const convColumns = [
    { key: 'from_uom_name', label: 'From', render: (row: UoMConversion) => row.from_uom_name ?? row.from_uom_id },
    { key: 'to_uom_name', label: 'To', render: (row: UoMConversion) => row.to_uom_name ?? row.to_uom_id },
    { key: 'factor', label: 'Factor', render: (row: UoMConversion) => <span className="font-mono">{row.factor}</span> },
    { key: 'scope', label: 'Scope', render: (row: UoMConversion) => row.item_id ? <Badge variant="warning">Item-specific</Badge> : <Badge variant="default">Global</Badge> },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Units of Measure</h1>
          <p className="text-sm text-gray-500 mt-1">Configure units and conversion factors</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConvModal(true)}>Add Conversion</Button>
          <Button onClick={() => setUomModal(true)}>New UoM</Button>
        </div>
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Units</h2>
        </div>
        <Table<UnitOfMeasure>
          columns={uomColumns}
          data={uoms ?? []}
          loading={isLoading}
          emptyText="No units of measure defined."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Conversions</h2>
        </div>
        <Table<UoMConversion>
          columns={convColumns}
          data={conversions ?? []}
          loading={false}
          emptyText="No conversions defined."
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={uomModal} onClose={() => setUomModal(false)} title="New Unit of Measure" size="sm">
        <div className="space-y-4">
          <Input label="Name *" value={uomForm.name} onChange={(e) => setUomForm({ ...uomForm, name: e.target.value })} placeholder="Each" />
          <Input label="Abbreviation *" value={uomForm.abbreviation} onChange={(e) => setUomForm({ ...uomForm, abbreviation: e.target.value })} placeholder="ea" />
          <Select label="Category" options={CATEGORY_OPTIONS} value={uomForm.category} onChange={(e) => setUomForm({ ...uomForm, category: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setUomModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateUoM} loading={createUoM.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={convModal} onClose={() => setConvModal(false)} title="Add UoM Conversion" size="sm">
        <div className="space-y-4">
          <Select label="From UoM *" options={[{ value: '', label: 'Select...' }, ...uomOptions]} value={convForm.from_uom_id} onChange={(e) => setConvForm({ ...convForm, from_uom_id: e.target.value })} />
          <Select label="To UoM *" options={[{ value: '', label: 'Select...' }, ...uomOptions]} value={convForm.to_uom_id} onChange={(e) => setConvForm({ ...convForm, to_uom_id: e.target.value })} />
          <Input label="Factor *" type="number" value={convForm.factor} onChange={(e) => setConvForm({ ...convForm, factor: e.target.value })} placeholder="12" />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setConvModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateConversion}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
