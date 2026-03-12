import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Spinner, Modal, toast } from '../../../components/ui'
import {
  useRequisitionPipeline,
  useUpdateApplicationStage,
  useCreateApplication,
  useCandidates,
  type CandidateApplication,
} from '@/api/hr_ats'

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES: CandidateApplication['stage'][] = [
  'applied', 'screening', 'interview', 'offer', 'hired', 'rejected',
]

const STAGE_LABELS: Record<CandidateApplication['stage'], string> = {
  applied:   'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer:     'Offer',
  hired:     'Hired',
  rejected:  'Rejected',
}

const STAGE_COLORS: Record<CandidateApplication['stage'], string> = {
  applied:   'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
  screening: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  interview: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
  offer:     'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  hired:     'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
  rejected:  'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
}

const STAGE_HEADER_COLORS: Record<CandidateApplication['stage'], string> = {
  applied:   'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  screening: 'bg-[#3ec9d6]/20 text-[#3ec9d6]',
  interview: 'bg-[#51459d]/20 text-[#51459d]',
  offer:     'bg-[#ffa21d]/20 text-[#ffa21d]',
  hired:     'bg-[#6fd943]/20 text-[#6fd943]',
  rejected:  'bg-[#ff3a6e]/20 text-[#ff3a6e]',
}

// ─── Match score badge ────────────────────────────────────────────────────────

function MatchScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-gray-400">No score</span>
  const color =
    score >= 70 ? 'bg-[#6fd943]/20 text-[#6fd943]'
    : score >= 50 ? 'bg-[#ffa21d]/20 text-[#ffa21d]'
    : 'bg-[#ff3a6e]/20 text-[#ff3a6e]'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}%
    </span>
  )
}

// ─── Application card ─────────────────────────────────────────────────────────

interface AppCardProps {
  app: CandidateApplication
  currentStage: CandidateApplication['stage']
  onViewDetail: (app: CandidateApplication) => void
  onMoveUp: (app: CandidateApplication) => void
  onMoveDown: (app: CandidateApplication) => void
}

function AppCard({ app, currentStage, onViewDetail, onMoveUp, onMoveDown }: AppCardProps) {
  const stageIndex = STAGES.indexOf(currentStage)
  const canMoveUp = stageIndex > 0
  const canMoveDown = stageIndex < STAGES.length - 1

  const name = app.candidate
    ? `${app.candidate.first_name} ${app.candidate.last_name}`
    : `Candidate ${app.candidate_id.slice(0, 6)}`
  const email = app.candidate?.email ?? ''
  const appliedDate = new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            onClick={() => onViewDetail(app)}
            className="font-medium text-sm text-gray-900 dark:text-gray-100 hover:text-[#51459d] dark:hover:text-[#51459d] text-left leading-tight truncate max-w-[140px] block"
          >
            {name}
          </button>
          <p className="text-xs text-gray-400 truncate mt-0.5">{email}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMoveUp(app)}
            disabled={!canMoveUp}
            title={canMoveUp ? `Move to ${STAGE_LABELS[STAGES[stageIndex - 1]]}` : 'Already at first stage'}
            className="text-gray-400 hover:text-[#51459d] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-1 py-0.5 rounded hover:bg-[#51459d]/10 transition-colors"
          >
            ▲
          </button>
          <button
            onClick={() => onMoveDown(app)}
            disabled={!canMoveDown}
            title={canMoveDown ? `Move to ${STAGE_LABELS[STAGES[stageIndex + 1]]}` : 'Already at last stage'}
            className="text-gray-400 hover:text-[#51459d] disabled:opacity-20 disabled:cursor-not-allowed text-xs leading-none px-1 py-0.5 rounded hover:bg-[#51459d]/10 transition-colors"
          >
            ▼
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
        <MatchScoreBadge score={app.ai_match_score} />
        <span className="text-xs text-gray-400">{appliedDate}</span>
      </div>
    </div>
  )
}

// ─── Application detail dialog ────────────────────────────────────────────────

function AppDetailDialog({
  app,
  onClose,
}: {
  app: CandidateApplication | null
  onClose: () => void
}) {
  if (!app) return null
  const name = app.candidate
    ? `${app.candidate.first_name} ${app.candidate.last_name}`
    : `Candidate ${app.candidate_id.slice(0, 8)}`
  return (
    <Modal open={!!app} onClose={onClose} title="Application Detail" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#51459d]/10 flex items-center justify-center font-bold text-[#51459d] text-sm">
            {name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{name}</p>
            <p className="text-sm text-gray-500">{app.candidate?.email}</p>
          </div>
          <div className="ml-auto">
            <Badge variant={app.stage === 'hired' ? 'success' : app.stage === 'rejected' ? 'danger' : 'primary'}>
              {STAGE_LABELS[app.stage]}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">AI Match Score</p>
            <MatchScoreBadge score={app.ai_match_score} />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Applied</p>
            <p className="text-gray-700 dark:text-gray-300">
              {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {app.ai_match_notes && (
          <div className="rounded-[10px] bg-[#3ec9d6]/10 border border-[#3ec9d6]/20 p-3">
            <p className="text-xs font-semibold text-[#3ec9d6] mb-1">AI Match Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{app.ai_match_notes}</p>
          </div>
        )}

        {app.notes && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{app.notes}</p>
          </div>
        )}

        {app.offer_amount && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Offer Amount</p>
            <p className="text-base font-bold text-[#6fd943]">{app.offer_amount.toLocaleString()}</p>
          </div>
        )}

        {app.rejection_reason && (
          <div className="rounded-[10px] bg-[#ff3a6e]/10 border border-[#ff3a6e]/20 p-3">
            <p className="text-xs font-semibold text-[#ff3a6e] mb-1">Rejection Reason</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{app.rejection_reason}</p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Candidate Dialog ─────────────────────────────────────────────────────

function AddCandidateDialog({
  open,
  onClose,
  requisitionId,
}: {
  open: boolean
  onClose: () => void
  requisitionId: string
}) {
  const [candidateSearch, setCandidateSearch] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState('')
  const { data: candidates } = useCandidates({ search: candidateSearch || undefined, limit: 20 })
  const createApp = useCreateApplication()

  async function handleAdd() {
    if (!selectedCandidateId) return
    try {
      await createApp.mutateAsync({ candidate_id: selectedCandidateId, requisition_id: requisitionId, stage: 'applied' })
      toast('success', 'Application created')
      onClose()
    } catch {
      toast('error', 'Failed to add candidate to pipeline')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Candidate to Pipeline" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Candidates</label>
          <input
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            placeholder="Type name or email..."
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
          />
        </div>
        <div className="max-h-48 overflow-y-auto rounded-[10px] border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
          {candidates?.items.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCandidateId(c.id)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                selectedCandidateId === c.id
                  ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {c.first_name} {c.last_name} <span className="text-gray-400">· {c.email}</span>
            </button>
          ))}
          {candidates?.items.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-gray-400">No candidates found</p>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} loading={createApp.isPending} disabled={!selectedCandidateId}>
            Add to Pipeline
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Pipeline Board ───────────────────────────────────────────────────────────

interface PipelineBoardProps {
  requisitionId?: string
}

export default function PipelineBoard({ requisitionId: propRequisitionId }: PipelineBoardProps) {
  const { id: routeId } = useParams<{ id: string }>()
  const requisitionId = propRequisitionId ?? routeId ?? ''
  const [detailApp, setDetailApp] = useState<CandidateApplication | null>(null)
  const [showAddCandidate, setShowAddCandidate] = useState(false)

  const { data, isLoading, isError, refetch } = useRequisitionPipeline(requisitionId)
  const moveMut = useUpdateApplicationStage()

  async function moveApp(app: CandidateApplication, targetStage: CandidateApplication['stage']) {
    try {
      await moveMut.mutateAsync({ id: app.id, stage: targetStage })
      toast('success', `Moved to ${STAGE_LABELS[targetStage]}`)
    } catch {
      toast('error', 'Failed to move application')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-[#ff3a6e]">Failed to load pipeline.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    )
  }

  const stages = data?.stages ?? {}

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {STAGES.reduce((sum, s) => sum + (stages[s]?.length ?? 0), 0)} total applications
        </p>
        <Button size="sm" onClick={() => setShowAddCandidate(true)}>+ Add Candidate</Button>
      </div>

      {/* Columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const apps = stages[stage] ?? []
          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-56 rounded-[10px] border ${STAGE_COLORS[stage]} flex flex-col`}
            >
              {/* Column header */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${STAGE_HEADER_COLORS[stage]}`}>
                  {STAGE_LABELS[stage]}
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded-full w-5 h-5 flex items-center justify-center">
                  {apps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="px-2 pb-2 flex flex-col gap-2 min-h-[120px]">
                {apps.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No candidates</p>
                )}
                {apps.map((app) => {
                  const stageIdx = STAGES.indexOf(stage)
                  return (
                    <AppCard
                      key={app.id}
                      app={app}
                      currentStage={stage}
                      onViewDetail={setDetailApp}
                      onMoveUp={() => moveApp(app, STAGES[stageIdx - 1])}
                      onMoveDown={() => moveApp(app, STAGES[stageIdx + 1])}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <AppDetailDialog app={detailApp} onClose={() => setDetailApp(null)} />
      <AddCandidateDialog
        open={showAddCandidate}
        onClose={() => setShowAddCandidate(false)}
        requisitionId={requisitionId}
      />
    </div>
  )
}
