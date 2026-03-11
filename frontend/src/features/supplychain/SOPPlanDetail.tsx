import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  cn, Button, Spinner, Badge, Card, Modal, Input, toast,
} from '../../components/ui'
import {
  useSOPPlan, useUpdateSOPPlan,
  type UpdateSOPPlanPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  in_review: 'warning',
  approved: 'success',
  closed: 'info',
}

type TabId = 'info' | 'demand' | 'supply' | 'capacity'

export default function SOPPlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [showEdit, setShowEdit] = useState(false)

  const { data: plan, isLoading } = useSOPPlan(id ?? '')
  const updateMutation = useUpdateSOPPlan()

  const [editForm, setEditForm] = useState({
    title: '',
    notes: '',
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">S&OP Plan not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/supply-chain/sop-plans')}>
          Back to S&OP Plans
        </Button>
      </div>
    )
  }

  const openEdit = () => {
    setEditForm({
      title: plan.title,
      notes: plan.notes || '',
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    if (!editForm.title.trim()) {
      toast('warning', 'Title is required')
      return
    }
    const payload: UpdateSOPPlanPayload = {
      id: plan.id,
      title: editForm.title.trim(),
      notes: editForm.notes.trim() || undefined,
    }
    try {
      await updateMutation.mutateAsync(payload)
      toast('success', 'Plan updated')
      setShowEdit(false)
    } catch {
      toast('error', 'Failed to update plan')
    }
  }

  const handleApprove = async () => {
    try {
      await updateMutation.mutateAsync({ id: plan.id, status: 'approved' })
      toast('success', 'Plan approved')
    } catch {
      toast('error', 'Failed to approve plan')
    }
  }

  const handleSubmitForReview = async () => {
    try {
      await updateMutation.mutateAsync({ id: plan.id, status: 'in_review' })
      toast('success', 'Plan submitted for review')
    } catch {
      toast('error', 'Failed to submit plan')
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Information' },
    { id: 'demand', label: 'Demand Summary' },
    { id: 'supply', label: 'Supply Summary' },
    { id: 'capacity', label: 'Capacity' },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/supply-chain/sop-plans')}
            className="p-2 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{plan.title}</h1>
              <Badge variant={STATUS_BADGE[plan.status] ?? 'default'}>
                {plan.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {plan.cycle_type} cycle &middot; {formatDate(plan.period_start)} - {formatDate(plan.period_end)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'draft' && (
            <Button variant="outline" onClick={handleSubmitForReview} loading={updateMutation.isPending}>
              Submit for Review
            </Button>
          )}
          {(plan.status === 'draft' || plan.status === 'in_review') && (
            <Button
              onClick={handleApprove}
              loading={updateMutation.isPending}
              className="bg-[#6fd943] hover:bg-[#5ec736] text-white"
            >
              Approve
            </Button>
          )}
          <Button onClick={openEdit}>Edit Plan</Button>
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

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Plan Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Title', value: plan.title },
                { label: 'Cycle Type', value: plan.cycle_type },
                { label: 'Period Start', value: formatDate(plan.period_start) },
                { label: 'Period End', value: formatDate(plan.period_end) },
                { label: 'Status', value: plan.status.replace(/_/g, ' ') },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {plan.notes && (
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{plan.notes}</p>
            </Card>
          )}
          <Card className="lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Meta</h2>
            <dl className="flex gap-8">
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(plan.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Updated</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(plan.updated_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'demand' && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Demand Summary</h2>
          {plan.demand_summary && Object.keys(plan.demand_summary).length > 0 ? (
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-[10px] p-4 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-[500px]">
              {JSON.stringify(plan.demand_summary, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-500">No demand summary data available.</p>
          )}
        </Card>
      )}

      {activeTab === 'supply' && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Supply Summary</h2>
          {plan.supply_summary && Object.keys(plan.supply_summary).length > 0 ? (
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-[10px] p-4 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-[500px]">
              {JSON.stringify(plan.supply_summary, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-500">No supply summary data available.</p>
          )}
        </Card>
      )}

      {activeTab === 'capacity' && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Linked Capacity Plans</h2>
          <p className="text-sm text-gray-500 mb-4">
            Capacity plans linked to this S&OP cycle will appear here.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/supply-chain/supply-plans')}>
            Go to Supply Plans
          </Button>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit S&OP Plan" size="lg">
        <div className="space-y-4">
          <Input
            label="Title *"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button size="sm" onClick={handleUpdate} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
