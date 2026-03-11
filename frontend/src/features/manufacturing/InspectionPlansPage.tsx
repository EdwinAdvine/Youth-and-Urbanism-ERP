import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import { useInspectionPlans, useCreateInspectionPlan, type InspectionPlan, type InspectionPlanCreate } from '../../api/manufacturing_quality'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function InspectionPlansPage() {
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<InspectionPlanCreate>({ name: '' })

  const { data: plans, isLoading } = useInspectionPlans()
  const createPlan = useCreateInspectionPlan()

  const handleCreate = async () => {
    if (!form.name) return toast({ title: 'Name is required', variant: 'destructive' })
    try {
      const plan = await createPlan.mutateAsync(form)
      toast({ title: `Inspection plan ${plan.plan_number} created` })
      setModalOpen(false)
      setForm({ name: '' })
      navigate(`/manufacturing/inspection-plans/${plan.id}`)
    } catch {
      toast({ title: 'Failed to create plan', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inspection Plans</h1>
        <Button onClick={() => setModalOpen(true)}>+ New Plan</Button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Plan #</th>
              <th>Name</th>
              <th>Status</th>
              <th>Version</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : plans?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No inspection plans</td></tr>
            ) : plans?.map((plan: InspectionPlan) => (
              <tr key={plan.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/inspection-plans/${plan.id}`)}>
                <td className="font-mono text-sm">{plan.plan_number}</td>
                <td>{plan.name}</td>
                <td><Badge variant={plan.is_active ? 'green' : 'gray'}>{plan.is_active ? 'Active' : 'Inactive'}</Badge></td>
                <td>v{plan.version}</td>
                <td>{formatDate(plan.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Inspection Plan">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Inspection plan name" />
          <Input label="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createPlan.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
