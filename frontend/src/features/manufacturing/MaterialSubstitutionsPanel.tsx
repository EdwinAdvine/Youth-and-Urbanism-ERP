import { useState } from 'react'
import { Button, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useBOMSubstitutions,
  useAddSubstitution,
  useDeleteSubstitution,
  type MaterialSubstitution,
  type SubstitutionCreate,
} from '../../api/manufacturing_eco'
import { useInventoryItems } from '../../api/inventory'

interface Props {
  bomId: string
}

export default function MaterialSubstitutionsPanel({ bomId }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<SubstitutionCreate & { bomItemId: string }>({
    bomItemId: '',
    substitute_item_id: '',
    priority: 1,
    conversion_factor: 1,
  })

  const { data: substitutions, isLoading } = useBOMSubstitutions(bomId)
  const { data: items } = useInventoryItems({ limit: 200 })
  const addSub = useAddSubstitution()
  const deleteSub = useDeleteSubstitution()

  const handleAdd = async () => {
    if (!form.bomItemId || !form.substitute_item_id) return
    try {
      await addSub.mutateAsync(form)
      toast({ title: 'Substitution added' })
      setModalOpen(false)
    } catch {
      toast({ title: 'Failed to add substitution', variant: 'destructive' })
    }
  }

  const handleDelete = async (subId: string) => {
    try {
      await deleteSub.mutateAsync(subId)
      toast({ title: 'Substitution removed' })
    } catch {
      toast({ title: 'Failed to remove', variant: 'destructive' })
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Material Substitutions</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>+ Add</Button>
      </div>

      <Table>
        <thead>
          <tr>
            <th>BOM Item</th>
            <th>Substitute</th>
            <th>Priority</th>
            <th>Conversion</th>
            <th>Valid</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr>
          ) : substitutions?.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-4 text-gray-500">No substitutions</td></tr>
          ) : substitutions?.map((sub: MaterialSubstitution) => (
            <tr key={sub.id}>
              <td className="text-sm">{sub.bom_item_id.slice(0, 8)}...</td>
              <td className="text-sm">{sub.substitute_item_id.slice(0, 8)}...</td>
              <td>{sub.priority}</td>
              <td>{sub.conversion_factor}x</td>
              <td className="text-xs">{sub.valid_from || '∞'} → {sub.valid_until || '∞'}</td>
              <td>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(sub.id)}>×</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Material Substitution">
        <div className="space-y-4">
          <Input label="BOM Item ID" value={form.bomItemId} onChange={e => setForm({ ...form, bomItemId: e.target.value })} placeholder="BOM Item UUID" />
          <Input label="Substitute Item ID" value={form.substitute_item_id} onChange={e => setForm({ ...form, substitute_item_id: e.target.value })} placeholder="Inventory Item UUID" />
          <Input label="Priority" type="number" value={String(form.priority)} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} />
          <Input label="Conversion Factor" type="number" step="0.01" value={String(form.conversion_factor)} onChange={e => setForm({ ...form, conversion_factor: Number(e.target.value) })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={addSub.isPending}>Add</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
