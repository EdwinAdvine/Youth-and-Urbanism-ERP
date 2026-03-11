import { useState } from 'react'
import {
  usePipelines,
  useCreatePipeline,
  useUpdatePipeline,
  useDeletePipeline,
  type Pipeline,
  type PipelineCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Spinner, Modal, Input, toast } from '@/components/ui'

interface StageForm {
  name: string
  probability: number
  color: string
  position: number
}

const DEFAULT_COLORS = ['#3ec9d6', '#51459d', '#ffa21d', '#6fd943', '#ff3a6e', '#6366f1', '#f59e0b', '#10b981']

const EMPTY_STAGE: StageForm = { name: '', probability: 0, color: '#51459d', position: 0 }

const EMPTY_FORM: PipelineCreatePayload & { stages: StageForm[] } = {
  name: '',
  description: '',
  is_default: false,
  stages: [
    { name: 'Prospecting', probability: 10, color: '#3ec9d6', position: 0 },
    { name: 'Qualification', probability: 25, color: '#51459d', position: 1 },
    { name: 'Proposal', probability: 50, color: '#ffa21d', position: 2 },
    { name: 'Negotiation', probability: 75, color: '#6fd943', position: 3 },
    { name: 'Closed Won', probability: 100, color: '#6fd943', position: 4 },
    { name: 'Closed Lost', probability: 0, color: '#ff3a6e', position: 5 },
  ],
}

export default function PipelinesSettingsPage() {
  const { data, isLoading } = usePipelines(false)
  const createPipeline = useCreatePipeline()
  const updatePipeline = useUpdatePipeline()
  const deletePipeline = useDeletePipeline()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Pipeline | null>(null)
  const [form, setForm] = useState<PipelineCreatePayload & { stages: StageForm[] }>(EMPTY_FORM)

  const pipelines: Pipeline[] = data?.items ?? data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, stages: EMPTY_FORM.stages.map((s) => ({ ...s })) })
    setModalOpen(true)
  }

  const openEdit = (pipeline: Pipeline) => {
    setEditing(pipeline)
    setForm({
      name: pipeline.name,
      description: pipeline.description ?? '',
      is_default: pipeline.is_default,
      stages: pipeline.stages?.map((s, i) => ({ ...s, position: s.position ?? i })) ?? [],
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description || null,
      is_default: form.is_default,
      stages: form.stages.map((s, i) => ({ ...s, position: i })),
    }
    try {
      if (editing) {
        await updatePipeline.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Pipeline updated')
      } else {
        await createPipeline.mutateAsync(payload)
        toast('success', 'Pipeline created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save pipeline')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this pipeline? All associated data may be affected.')) return
    try {
      await deletePipeline.mutateAsync(id)
      toast('success', 'Pipeline deleted')
    } catch {
      toast('error', 'Failed to delete pipeline')
    }
  }

  const handleSetDefault = async (pipeline: Pipeline) => {
    try {
      await updatePipeline.mutateAsync({ id: pipeline.id, is_default: true })
      toast('success', `"${pipeline.name}" set as default pipeline`)
    } catch {
      toast('error', 'Failed to set default pipeline')
    }
  }

  const addStage = () => {
    setForm((f) => ({
      ...f,
      stages: [...f.stages, { ...EMPTY_STAGE, position: f.stages.length, color: DEFAULT_COLORS[f.stages.length % DEFAULT_COLORS.length] }],
    }))
  }

  const removeStage = (index: number) => {
    setForm((f) => ({
      ...f,
      stages: f.stages.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })),
    }))
  }

  const updateStage = (index: number, updates: Partial<StageForm>) => {
    setForm((f) => ({
      ...f,
      stages: f.stages.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }))
  }

  const moveStage = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    setForm((f) => {
      const stages = [...f.stages]
      if (swapIndex < 0 || swapIndex >= stages.length) return f
      ;[stages[index], stages[swapIndex]] = [stages[swapIndex], stages[index]]
      return { ...f, stages: stages.map((s, i) => ({ ...s, position: i })) }
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Pipelines Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure sales pipelines and their stages
          </p>
        </div>
        <Button onClick={openCreate}>+ New Pipeline</Button>
      </div>

      {/* Pipelines List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : pipelines.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No pipelines configured.</p>
          <Button variant="secondary" className="mt-4" onClick={openCreate}>
            Create Your First Pipeline
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">{pipeline.name}</h2>
                    {pipeline.is_default && <Badge variant="primary">Default</Badge>}
                    <Badge variant={pipeline.is_active ? 'success' : 'default'}>
                      {pipeline.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {pipeline.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{pipeline.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!pipeline.is_default && (
                    <Button size="sm" variant="ghost" onClick={() => handleSetDefault(pipeline)}>
                      Set Default
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(pipeline)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(pipeline.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              {/* Stages preview */}
              {pipeline.stages && pipeline.stages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {[...pipeline.stages]
                    .sort((a, b) => a.position - b.position)
                    .map((stage, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-sm"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-gray-700 dark:text-gray-300">{stage.name}</span>
                        <span className="text-xs text-gray-400">{stage.probability}%</span>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Pipeline' : 'New Pipeline'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Pipeline Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Enterprise Sales"
          />
          <Input
            label="Description"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_default ?? false}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
              className="rounded"
            />
            Set as default pipeline
          </label>

          {/* Stages Editor */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Stages ({form.stages.length})
              </label>
              <Button type="button" size="sm" variant="secondary" onClick={addStage}>
                + Add Stage
              </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {form.stages.map((stage, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-[10px]"
                >
                  {/* Color picker */}
                  <input
                    type="color"
                    value={stage.color}
                    onChange={(e) => updateStage(index, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  {/* Name */}
                  <input
                    className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    value={stage.name}
                    onChange={(e) => updateStage(index, { name: e.target.value })}
                    placeholder="Stage name"
                    required
                  />
                  {/* Probability */}
                  <input
                    className="w-20 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability}
                    onChange={(e) => updateStage(index, { probability: parseInt(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-gray-400">%</span>
                  {/* Reorder */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => moveStage(index, 'up')}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === form.stages.length - 1}
                    onClick={() => moveStage(index, 'down')}
                  >
                    Dn
                  </Button>
                  {/* Remove */}
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => removeStage(index)}
                  >
                    X
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createPipeline.isPending || updatePipeline.isPending}>
              {editing ? 'Save Changes' : 'Create Pipeline'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
