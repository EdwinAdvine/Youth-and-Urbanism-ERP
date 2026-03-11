import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  cn, Button, Spinner, Badge, Card, Table, Modal, Input, toast,
} from '../../components/ui'
import {
  useRFx, useRFxResponses, useAwardRFx, useScoreRFxResponse,
  type RFxResponseItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  published: 'info',
  closed: 'warning',
  awarded: 'success',
  cancelled: 'danger',
  submitted: 'info',
  rejected: 'danger',
  under_review: 'warning',
}

type TabId = 'info' | 'responses'

export default function RFxDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('responses')
  const [showScore, setShowScore] = useState<RFxResponseItem | null>(null)
  const [scoreValue, setScoreValue] = useState('')
  const [confirmAward, setConfirmAward] = useState<RFxResponseItem | null>(null)

  const { data: rfx, isLoading } = useRFx(id ?? '')
  const { data: responses, isLoading: responsesLoading } = useRFxResponses(id ?? '')
  const awardMutation = useAwardRFx()
  const scoreMutation = useScoreRFxResponse()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!rfx) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">RFx not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/supply-chain/rfx')}>
          Back to RFx
        </Button>
      </div>
    )
  }

  const handleScore = async () => {
    if (!showScore || !scoreValue) {
      toast('warning', 'Enter a score value')
      return
    }
    try {
      await scoreMutation.mutateAsync({
        id: showScore.id,
        rfxId: rfx.id,
        score: Number(scoreValue),
      })
      toast('success', 'Response scored')
      setShowScore(null)
      setScoreValue('')
    } catch {
      toast('error', 'Failed to score response')
    }
  }

  const handleAward = async () => {
    if (!confirmAward) return
    try {
      await awardMutation.mutateAsync({ rfxId: rfx.id, responseId: confirmAward.id })
      toast('success', 'RFx awarded successfully')
      setConfirmAward(null)
    } catch {
      toast('error', 'Failed to award RFx')
    }
  }

  const allResponses = rfx.responses ?? responses ?? []

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Information' },
    { id: 'responses', label: `Responses (${allResponses.length})` },
  ]

  const responseColumns = [
    {
      key: 'supplier_id',
      label: 'Supplier',
      render: (row: RFxResponseItem) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.supplier_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'total_value',
      label: 'Total Value',
      render: (row: RFxResponseItem) => (
        <span className="text-gray-700 dark:text-gray-300">{formatCurrency(row.total_value)}</span>
      ),
    },
    {
      key: 'lead_time_days',
      label: 'Lead Time',
      render: (row: RFxResponseItem) => (
        <span className="text-gray-600 dark:text-gray-400">{row.lead_time_days ? `${row.lead_time_days} days` : '-'}</span>
      ),
    },
    {
      key: 'score',
      label: 'Score',
      render: (row: RFxResponseItem) => (
        row.score != null ? (
          <span className="font-semibold text-[#51459d]">{row.score}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: RFxResponseItem) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status.replace(/_/g, ' ')}</Badge>
      ),
    },
    {
      key: 'submitted_at',
      label: 'Submitted',
      render: (row: RFxResponseItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.submitted_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: RFxResponseItem) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setShowScore(row); setScoreValue(row.score != null ? String(row.score) : '') }}>
            Score
          </Button>
          {rfx.status !== 'awarded' && row.status !== 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#6fd943] hover:text-green-700"
              onClick={() => setConfirmAward(row)}
            >
              Award
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/supply-chain/rfx')}
            className="p-2 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rfx.title}</h1>
              <Badge variant={STATUS_BADGE[rfx.status] ?? 'default'}>
                {rfx.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">{rfx.rfx_number} &middot; {rfx.rfx_type.toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-[#51459d] border-[#51459d]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'RFx Number', value: rfx.rfx_number },
                { label: 'Type', value: rfx.rfx_type.toUpperCase() },
                { label: 'Status', value: rfx.status },
                { label: 'Deadline', value: rfx.deadline ? formatDate(rfx.deadline) : 'No deadline' },
                { label: 'Created', value: formatDate(rfx.created_at) },
                { label: 'Updated', value: formatDate(rfx.updated_at) },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.value || '-'}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Description</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {rfx.description || 'No description provided.'}
            </p>
            {rfx.invited_suppliers && rfx.invited_suppliers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invited Suppliers</h3>
                <div className="flex flex-wrap gap-1">
                  {rfx.invited_suppliers.map((s) => (
                    <Badge key={s} variant="default">{s.slice(0, 8)}...</Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Supplier Responses ({allResponses.length})
            </h2>
          </div>
          <Table<RFxResponseItem>
            columns={responseColumns}
            data={allResponses}
            loading={responsesLoading}
            emptyText="No responses submitted yet"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      {/* Score Modal */}
      <Modal open={!!showScore} onClose={() => setShowScore(null)} title="Score Response" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Set a score for this supplier response. Higher is better.
          </p>
          <Input
            label="Score"
            type="number"
            min="0"
            max="100"
            value={scoreValue}
            onChange={(e) => setScoreValue(e.target.value)}
            placeholder="0-100"
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowScore(null)}>Cancel</Button>
            <Button size="sm" onClick={handleScore} loading={scoreMutation.isPending}>
              Save Score
            </Button>
          </div>
        </div>
      </Modal>

      {/* Award Confirmation */}
      <Modal open={!!confirmAward} onClose={() => setConfirmAward(null)} title="Award RFx" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Award this RFx to the selected supplier? All other responses will be rejected.
          </p>
          {confirmAward && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-[10px] p-3">
              <p className="text-sm"><span className="text-gray-500">Value:</span> <span className="font-medium">{formatCurrency(confirmAward.total_value)}</span></p>
              <p className="text-sm"><span className="text-gray-500">Lead Time:</span> <span className="font-medium">{confirmAward.lead_time_days ?? '-'} days</span></p>
              {confirmAward.score != null && (
                <p className="text-sm"><span className="text-gray-500">Score:</span> <span className="font-semibold text-[#51459d]">{confirmAward.score}</span></p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmAward(null)}>Cancel</Button>
            <Button size="sm" loading={awardMutation.isPending} onClick={handleAward}>
              Confirm Award
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
