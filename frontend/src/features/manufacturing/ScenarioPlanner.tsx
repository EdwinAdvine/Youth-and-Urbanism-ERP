import { useState } from 'react'
import { Button, Badge, Card, Table, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useScenarios, useCreateScenario, useRunScenario, useDeleteScenario } from '../../api/manufacturing_planning'

const statusColors: Record<string, string> = {
  draft: 'gray',
  running: 'yellow',
  completed: 'green',
  failed: 'red',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ScenarioPlanner() {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  const { data: scenarios, isLoading } = useScenarios()
  const createScenario = useCreateScenario()
  const runScenario = useRunScenario()
  const deleteScenario = useDeleteScenario()

  const handleCreate = async () => {
    if (!form.name) return toast({ title: 'Name required', variant: 'destructive' })
    try {
      await createScenario.mutateAsync({ name: form.name, description: form.description || undefined })
      toast({ title: 'Scenario created' })
      setModalOpen(false)
      setForm({ name: '', description: '' })
    } catch {
      toast({ title: 'Failed to create', variant: 'destructive' })
    }
  }

  const handleRun = async (id: string) => {
    try {
      const result = await runScenario.mutateAsync(id)
      toast({ title: `Scenario ran — ${result.scheduled} operations scheduled` })
    } catch {
      toast({ title: 'Scenario run failed', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteScenario.mutateAsync(id)
      toast({ title: 'Scenario deleted' })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scenario Planner</h1>
        <Button onClick={() => setModalOpen(true)}>+ New Scenario</Button>
      </div>

      <Card>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Results</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : scenarios?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No scenarios</td></tr>
            ) : scenarios?.map(s => (
              <tr key={s.id}>
                <td>
                  <div className="font-medium">{s.name}</div>
                  {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
                </td>
                <td><Badge variant={statusColors[s.status] || 'gray'}>{s.status}</Badge></td>
                <td className="text-sm text-gray-500">
                  {s.results ? `${(s.results as { scheduled_entries?: number }).scheduled_entries ?? 0} entries` : '—'}
                </td>
                <td className="text-sm">{formatDate(s.created_at)}</td>
                <td>
                  <div className="flex gap-2">
                    {s.status === 'draft' && (
                      <Button size="sm" onClick={() => handleRun(s.id)} loading={runScenario.isPending}>
                        Run
                      </Button>
                    )}
                    {s.status === 'completed' && (
                      <Button size="sm" variant="outline" onClick={() => handleRun(s.id)}>
                        Re-run
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(s.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Scenario">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q2 High-Demand Plan" />
          <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createScenario.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
