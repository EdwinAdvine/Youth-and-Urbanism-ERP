import { useState, useMemo } from 'react'
import {
  usePipeline,
  useCreateOpportunity,
  useUpdateOpportunity,
  useCloseWon,
  useCloseLost,
  useContacts,
  type Opportunity,
  type OpportunityStage,
  type CreateOpportunityPayload,
} from '../../api/crm'
import {
  usePipelines,
  usePipelineBoard,
  type Pipeline,
} from '../../api/crm_v2'
import { cn, Button, Spinner, Modal, Input, Badge, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import QuickActivityLog from './QuickActivityLog'

const STAGES: OpportunityStage[] = ['prospecting', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_COLORS: Record<OpportunityStage, string> = {
  prospecting: 'border-t-info',
  proposal: 'border-t-primary',
  negotiation: 'border-t-warning',
  closed_won: 'border-t-success',
  closed_lost: 'border-t-danger',
}

const STAGE_BG: Record<OpportunityStage, string> = {
  prospecting: 'bg-info/5',
  proposal: 'bg-primary/5',
  negotiation: 'bg-orange-50',
  closed_won: 'bg-green-50',
  closed_lost: 'bg-red-50',
}

// Design token colors for swimlane owner bands
const OWNER_BAND_COLORS = [
  '#f0eefb', // primary tint
  '#eafbf5', // success tint
  '#eafafd', // info tint
  '#fff8ee', // warning tint
  '#fff0f4', // danger tint
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const EMPTY_FORM: CreateOpportunityPayload = {
  title: '',
  contact_id: '',
  value: 0,
  probability: 50,
  stage: 'prospecting',
  expected_close_date: null,
  notes: '',
}

// ─── Deal Card ────────────────────────────────────────────────────────────────

interface DealCardProps {
  opp: Opportunity
  stage: OpportunityStage
  onEdit: (opp: Opportunity) => void
  onWon: (opp: Opportunity) => void
  onLost: (opp: Opportunity) => void
  wonPending: boolean
  lostPending: boolean
}

function DealCard({ opp, stage, onEdit, onWon, onLost, wonPending, lostPending }: DealCardProps) {
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
      onClick={() => onEdit(opp)}
    >
      <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 leading-tight">{opp.title}</h3>
      {opp.contact_name && (
        <p className="text-xs text-gray-500 mt-1">{opp.contact_name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <p className="text-sm font-semibold text-primary">
          {formatCurrency(opp.value)}
        </p>
        <Badge variant="default">{opp.probability}%</Badge>
      </div>
      {opp.expected_close_date && (
        <p className="text-xs text-gray-400 mt-1">
          Close: {new Date(opp.expected_close_date).toLocaleDateString()}
        </p>
      )}
      {stage !== 'closed_won' && stage !== 'closed_lost' && (
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            className="flex-1 bg-success text-white hover:opacity-90 min-h-[44px]"
            onClick={(e) => { e.stopPropagation(); onWon(opp) }}
            loading={wonPending}
          >
            Won
          </Button>
          <Button
            size="sm"
            variant="danger"
            className="flex-1 min-h-[44px]"
            onClick={(e) => { e.stopPropagation(); onLost(opp) }}
            loading={lostPending}
          >
            Lost
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  // ── Legacy pipeline (all-pipelines view) ──
  const { data: pipeline, isLoading: legacyLoading } = usePipeline()

  // ── Pipeline selector ──
  const { data: pipelinesData, isLoading: pipelinesLoading } = usePipelines(true)
  const pipelines: Pipeline[] = Array.isArray(pipelinesData) ? pipelinesData : (pipelinesData?.items ?? [])
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('')

  // Once pipelines load, auto-select the default (or first)
  const resolvedPipelineId = useMemo(() => {
    if (selectedPipelineId) return selectedPipelineId
    if (pipelines.length === 0) return ''
    const def = pipelines.find((p) => p.is_default)
    return def ? def.id : pipelines[0].id
  }, [selectedPipelineId, pipelines])

  // ── Swimlane toggle ──
  const [swimlaneActive, setSwimlaneActive] = useState(false)

  // ── Pipeline board (used when a specific pipeline is selected) ──
  const { data: boardData, isLoading: boardLoading } = usePipelineBoard(
    resolvedPipelineId,
    swimlaneActive ? 'owner' : undefined
  )

  // ── CRM mutations ──
  const { data: contactsData } = useContacts({ page: 1, limit: 200 })
  const createMutation = useCreateOpportunity()
  const updateMutation = useUpdateOpportunity()
  const closeWonMutation = useCloseWon()
  const closeLostMutation = useCloseLost()

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Opportunity | null>(null)
  const [form, setForm] = useState<CreateOpportunityPayload>(EMPTY_FORM)

  const contacts = contactsData?.items ?? []

  // ── Build stage map ──
  // Prefer board data from the selected pipeline; fall back to legacy usePipeline()
  const stageMap: Record<string, { count: number; total_value: number; items: Opportunity[] }> = useMemo(() => {
    if (boardData) {
      // boardData.board is Record<stageName, Opportunity[]>
      const result: Record<string, { count: number; total_value: number; items: Opportunity[] }> = {}
      STAGES.forEach((stage) => {
        const items: Opportunity[] = boardData.board[stage] ?? []
        result[stage] = {
          items,
          count: items.length,
          total_value: items.reduce((sum, o) => sum + (o.value ?? 0), 0),
        }
      })
      return result
    }
    // Legacy fallback
    const result: Record<string, { count: number; total_value: number; items: Opportunity[] }> = {}
    const stages = pipeline?.stages ?? []
    stages.forEach((s) => {
      result[s.stage] = s
    })
    return result
  }, [boardData, pipeline])

  // ── Build swimlane owner index: owner_id → display label ──
  const ownerIndex = useMemo(() => {
    if (!swimlaneActive || !boardData?.swimlanes) return {}
    // swimlanes: Record<owner_id, Record<stage, Opportunity[]>>
    const idx: Record<string, string> = {}
    Object.keys(boardData.swimlanes).forEach((ownerId) => {
      idx[ownerId] = ownerId // backend sends id; label shown as truncated id unless contact_name available
    })
    return idx
  }, [swimlaneActive, boardData])

  const ownerIds = Object.keys(ownerIndex)

  // ── Handlers ──
  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (opp: Opportunity) => {
    setEditing(opp)
    setForm({
      title: opp.title,
      contact_id: opp.contact_id,
      value: opp.value,
      probability: opp.probability,
      stage: opp.stage,
      expected_close_date: opp.expected_close_date,
      notes: opp.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        const { contact_id, ...rest } = form
        await updateMutation.mutateAsync({ id: editing.id, ...rest })
        toast('success', 'Opportunity updated')
      } else {
        await createMutation.mutateAsync(form)
        toast('success', 'Opportunity created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save opportunity')
    }
  }

  const handleCloseWon = async (opp: Opportunity) => {
    if (!window.confirm(`Mark "${opp.title}" as won?`)) return
    try {
      await closeWonMutation.mutateAsync(opp.id)
      toast('success', 'Deal closed as won!')
    } catch {
      toast('error', 'Failed to close deal')
    }
  }

  const handleCloseLost = async (opp: Opportunity) => {
    if (!window.confirm(`Mark "${opp.title}" as lost?`)) return
    try {
      await closeLostMutation.mutateAsync(opp.id)
      toast('info', 'Opportunity marked as lost')
    } catch {
      toast('error', 'Failed to update opportunity')
    }
  }

  const isLoading = legacyLoading || pipelinesLoading || boardLoading

  if (isLoading && !boardData && !pipeline) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage opportunities through your sales pipeline</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto min-h-[44px] sm:min-h-0">+ New Opportunity</Button>
      </div>

      {/* ── Toolbar: Pipeline selector + Swimlane toggle ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pipeline selector */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="pipeline-select"
            className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
          >
            Pipeline:
          </label>
          <select
            id="pipeline-select"
            value={resolvedPipelineId}
            onChange={(e) => setSelectedPipelineId(e.target.value)}
            style={{
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              padding: '6px 32px 6px 12px',
              fontSize: '0.875rem',
              color: '#374151',
              background: '#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E") no-repeat right 10px center',
              appearance: 'none',
              WebkitAppearance: 'none',
              minWidth: '180px',
              outline: 'none',
              cursor: 'pointer',
            }}
            disabled={pipelinesLoading}
          >
            {pipelines.length === 0 && (
              <option value="">All deals</option>
            )}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.is_default ? ' (Default)' : ''}
              </option>
            ))}
          </select>
          {boardLoading && <Spinner size="sm" />}
        </div>

        {/* Swimlane toggle */}
        <button
          type="button"
          onClick={() => setSwimlaneActive((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '10px',
            border: `1.5px solid ${swimlaneActive ? '#51459d' : '#e5e7eb'}`,
            background: swimlaneActive ? '#51459d' : '#fff',
            color: swimlaneActive ? '#fff' : '#374151',
            padding: '6px 14px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            minHeight: '36px',
          }}
          title={swimlaneActive ? 'Disable owner grouping' : 'Group cards by owner'}
        >
          {/* icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          {swimlaneActive ? 'Group by Owner' : 'No Grouping'}
        </button>
      </div>

      {/* ── Kanban Board ── */}
      <div className="overflow-x-auto pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-4 min-w-0 lg:min-w-[1200px]">
          {STAGES.map((stage) => {
            const stageData = stageMap[stage] ?? { count: 0, total_value: 0, items: [] }

            return (
              <div key={stage} className="flex-shrink-0 w-[280px] sm:w-[300px] lg:flex-1 lg:w-auto lg:min-w-[220px]">
                {/* Column Header */}
                <div
                  className={cn(
                    'rounded-t-[10px] border-t-4 px-4 py-3',
                    STAGE_COLORS[stage],
                    STAGE_BG[stage]
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{STAGE_LABELS[stage]}</span>
                      <span className="text-xs bg-gray-200 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5">
                        {stageData.count}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                    {formatCurrency(stageData.total_value)}
                  </p>
                </div>

                {/* Cards area */}
                <div className="mt-2 min-h-[200px]">
                  {swimlaneActive && boardData?.swimlanes ? (
                    /* ── Swimlane mode: sub-rows grouped by owner ── */
                    ownerIds.length === 0 ? (
                      <div className="text-center text-gray-400 text-xs py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
                        No opportunities
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {ownerIds.map((ownerId, ownerIdx) => {
                          const swimlaneStageItems: Opportunity[] =
                            (boardData.swimlanes![ownerId]?.[stage] as Opportunity[]) ?? []
                          const bandColor = OWNER_BAND_COLORS[ownerIdx % OWNER_BAND_COLORS.length]

                          return (
                            <div
                              key={ownerId}
                              style={{
                                borderRadius: '10px',
                                background: bandColor,
                                border: '1px solid #e5e7eb',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Owner label */}
                              <div
                                style={{
                                  padding: '4px 10px',
                                  borderBottom: '1px solid #e5e7eb',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#51459d',
                                    color: '#fff',
                                    fontSize: '10px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  {ownerId.slice(0, 2).toUpperCase()}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                                  {ownerId.length > 20 ? ownerId.slice(0, 8) + '…' : ownerId}
                                </span>
                                <span
                                  style={{
                                    marginLeft: 'auto',
                                    fontSize: '10px',
                                    background: '#e5e7eb',
                                    borderRadius: '9999px',
                                    padding: '1px 7px',
                                    color: '#6b7280',
                                  }}
                                >
                                  {swimlaneStageItems.length}
                                </span>
                              </div>

                              {/* Cards for this owner in this stage */}
                              <div style={{ padding: '6px' }} className="space-y-2">
                                {swimlaneStageItems.length === 0 ? (
                                  <div
                                    style={{
                                      textAlign: 'center',
                                      color: '#9ca3af',
                                      fontSize: '11px',
                                      padding: '12px 0',
                                    }}
                                  >
                                    —
                                  </div>
                                ) : (
                                  swimlaneStageItems.map((opp) => (
                                    <DealCard
                                      key={opp.id}
                                      opp={opp}
                                      stage={stage}
                                      onEdit={openEdit}
                                      onWon={handleCloseWon}
                                      onLost={handleCloseLost}
                                      wonPending={closeWonMutation.isPending}
                                      lostPending={closeLostMutation.isPending}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  ) : (
                    /* ── Normal mode ── */
                    <div className="space-y-2">
                      {stageData.items.length === 0 ? (
                        <div className="text-center text-gray-400 text-xs py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
                          No opportunities
                        </div>
                      ) : (
                        stageData.items.map((opp) => (
                          <DealCard
                            key={opp.id}
                            opp={opp}
                            stage={stage}
                            onEdit={openEdit}
                            onWon={handleCloseWon}
                            onLost={handleCloseLost}
                            wonPending={closeWonMutation.isPending}
                            lostPending={closeLostMutation.isPending}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile scroll hint */}
      <p className="text-xs text-gray-400 text-center lg:hidden -mt-2">
        Swipe left/right to see all stages
      </p>

      {/* Quick Activity FAB for mobile */}
      <QuickActivityLog />

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Opportunity' : 'New Opportunity'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          {!editing && (
            <Select
              label="Contact"
              options={[
                { value: '', label: 'Select a contact...' },
                ...contacts.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` })),
              ]}
              value={form.contact_id}
              onChange={(e) => setForm((f) => ({ ...f, contact_id: e.target.value }))}
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Value"
              type="number"
              required
              min={0}
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
            />
            <Input
              label="Probability (%)"
              type="number"
              min={0}
              max={100}
              value={form.probability ?? 50}
              onChange={(e) => setForm((f) => ({ ...f, probability: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Stage"
              options={STAGES.filter((s) => s !== 'closed_won' && s !== 'closed_lost').map((s) => ({
                value: s,
                label: STAGE_LABELS[s],
              }))}
              value={form.stage ?? 'prospecting'}
              onChange={(e) => setForm((f) => ({ ...f, stage: e.target.value as OpportunityStage }))}
            />
            <Input
              label="Expected Close Date"
              type="date"
              value={form.expected_close_date ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, expected_close_date: e.target.value || null }))}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Opportunity'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
