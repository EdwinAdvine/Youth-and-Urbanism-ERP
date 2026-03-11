import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useSequenceDetail,
  useUpdateSequence,
  useEnrollContacts,
  useActivateSequence,
  usePauseSequence,
} from '@/api/crm_v2'
import { Button, Badge, Card, Spinner, Modal, cn, toast } from '@/components/ui'
import SequenceStepEditor from './components/SequenceStepEditor'

interface StepFormData {
  step_order: number
  step_type: string
  delay_days: number
  delay_hours: number
  config: Record<string, any> | null
}

const EMPTY_STEP: StepFormData = {
  step_order: 1,
  step_type: 'email',
  delay_days: 0,
  delay_hours: 0,
  config: null,
}

export default function SequenceBuilderPage() {
  const { sequenceId } = useParams<{ sequenceId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error } = useSequenceDetail(sequenceId ?? '')
  const updateSequence = useUpdateSequence()
  const enrollContacts = useEnrollContacts(sequenceId ?? '')
  const activateSequence = useActivateSequence()
  const pauseSequence = usePauseSequence()

  const [addStepOpen, setAddStepOpen] = useState(false)
  const [stepForm, setStepForm] = useState<StepFormData>(EMPTY_STEP)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [enrollIds, setEnrollIds] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load sequence.
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/crm/sequences')}>
          Back to Sequences
        </Button>
      </div>
    )
  }

  const { sequence, steps, stats } = data

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault()
    const newSteps = [
      ...steps.map((s) => ({
        step_order: s.step_order,
        step_type: s.step_type,
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        config: s.config,
      })),
      { ...stepForm, step_order: steps.length + 1 },
    ]
    try {
      await updateSequence.mutateAsync({ id: sequence.id, steps: newSteps })
      toast('success', 'Step added')
      setAddStepOpen(false)
      setStepForm({ ...EMPTY_STEP, step_order: steps.length + 2 })
    } catch {
      toast('error', 'Failed to add step')
    }
  }

  const handleRemoveStep = async (stepOrder: number) => {
    if (!window.confirm('Remove this step?')) return
    const newSteps = steps
      .filter((s) => s.step_order !== stepOrder)
      .map((s, i) => ({
        step_order: i + 1,
        step_type: s.step_type,
        delay_days: s.delay_days,
        delay_hours: s.delay_hours,
        config: s.config,
      }))
    try {
      await updateSequence.mutateAsync({ id: sequence.id, steps: newSteps })
      toast('success', 'Step removed')
    } catch {
      toast('error', 'Failed to remove step')
    }
  }

  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...steps].sort((a, b) => a.step_order - b.step_order)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return
    ;[sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]]
    const newSteps = sorted.map((s, i) => ({
      step_order: i + 1,
      step_type: s.step_type,
      delay_days: s.delay_days,
      delay_hours: s.delay_hours,
      config: s.config,
    }))
    try {
      await updateSequence.mutateAsync({ id: sequence.id, steps: newSteps })
      toast('success', 'Steps reordered')
    } catch {
      toast('error', 'Failed to reorder steps')
    }
  }

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    const ids = enrollIds.split(',').map((s) => s.trim()).filter(Boolean)
    if (ids.length === 0) return
    try {
      await enrollContacts.mutateAsync(ids)
      toast('success', `Enrolled ${ids.length} contact(s)`)
      setEnrollOpen(false)
      setEnrollIds('')
    } catch {
      toast('error', 'Failed to enroll contacts')
    }
  }

  const handleToggleStatus = async () => {
    try {
      if (sequence.status === 'active') {
        await pauseSequence.mutateAsync(sequence.id)
        toast('info', 'Sequence paused')
      } else {
        await activateSequence.mutateAsync(sequence.id)
        toast('success', 'Sequence activated')
      }
    } catch {
      toast('error', 'Failed to update sequence status')
    }
  }

  const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order)

  const stepTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return 'M'
      case 'wait': return 'W'
      case 'task': return 'T'
      case 'condition': return 'C'
      default: return '?'
    }
  }

  const stepTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700'
      case 'wait': return 'bg-gray-100 text-gray-700'
      case 'task': return 'bg-orange-100 text-orange-700'
      case 'condition': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate('/crm/sequences')}
            className="text-sm text-gray-500 hover:text-primary mb-1 flex items-center gap-1"
          >
            &larr; Back to Sequences
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {sequence.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={sequence.status === 'active' ? 'success' : sequence.status === 'paused' ? 'warning' : 'default'}>
              {sequence.status}
            </Badge>
            <Badge variant="info">{sequence.trigger_type.replace(/_/g, ' ')}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEnrollOpen(true)}>
            Enroll Contacts
          </Button>
          <Button
            variant={sequence.status === 'active' ? 'outline' : 'primary'}
            onClick={handleToggleStatus}
            loading={activateSequence.isPending || pauseSequence.isPending}
          >
            {sequence.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-primary">{stats.total_enrollments}</p>
          <p className="text-xs text-gray-500">Total Enrolled</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-500">Active</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </Card>
      </div>

      {/* Steps Builder */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            Steps ({sortedSteps.length})
          </h2>
          <Button size="sm" onClick={() => setAddStepOpen(true)}>+ Add Step</Button>
        </div>

        {sortedSteps.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
            <p className="text-gray-400 text-sm mb-3">No steps yet. Add your first step to get started.</p>
            <Button size="sm" onClick={() => setAddStepOpen(true)}>+ Add Step</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSteps.map((step, index) => (
              <div key={step.id} className="relative">
                {/* Connector line */}
                {index < sortedSteps.length - 1 && (
                  <div className="absolute left-6 top-full h-3 w-0.5 bg-gray-200 dark:bg-gray-700" />
                )}
                <div className="flex items-start gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-[10px] hover:border-primary/30 transition-colors">
                  {/* Step number + type icon */}
                  <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold', stepTypeColor(step.step_type))}>
                    {stepTypeIcon(step.step_type)}
                  </div>

                  {/* Step details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">Step {step.step_order}</span>
                      <Badge variant="primary">{step.step_type}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {step.delay_days > 0 || step.delay_hours > 0 ? (
                        <span>
                          Wait {step.delay_days > 0 ? `${step.delay_days}d ` : ''}{step.delay_hours > 0 ? `${step.delay_hours}h` : ''} then execute
                        </span>
                      ) : (
                        <span>Execute immediately</span>
                      )}
                    </div>
                    {step.config && Object.keys(step.config).length > 0 && (
                      <div className="mt-1 text-xs text-gray-400">
                        Config: {JSON.stringify(step.config)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => handleMoveStep(index, 'up')}
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={index === sortedSteps.length - 1}
                      onClick={() => handleMoveStep(index, 'down')}
                    >
                      Down
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveStep(step.step_order)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Step Modal */}
      <Modal open={addStepOpen} onClose={() => setAddStepOpen(false)} title="Add Step">
        <form onSubmit={handleAddStep} className="space-y-4">
          <SequenceStepEditor
            value={stepForm}
            onChange={setStepForm}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAddStepOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateSequence.isPending}>
              Add Step
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enroll Contacts Modal */}
      <Modal open={enrollOpen} onClose={() => setEnrollOpen(false)} title="Enroll Contacts">
        <form onSubmit={handleEnroll} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contact IDs (comma-separated)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
              value={enrollIds}
              onChange={(e) => setEnrollIds(e.target.value)}
              placeholder="id1, id2, id3..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEnrollOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={enrollContacts.isPending}>
              Enroll
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
