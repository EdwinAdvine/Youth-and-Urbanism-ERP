import { useState } from 'react'
import { Card, Button, Spinner, Modal, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useFeedbackReceived,
  useFeedbackGiven,
  useGiveFeedback,
  useFeedbackSummary,
  type ContinuousFeedback,
  type FeedbackCreatePayload,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const feedbackTypeVariant: Record<string, 'success' | 'warning' | 'info'> = {
  praise: 'success',
  improvement: 'warning',
  general: 'info',
}

const visibilityVariant: Record<string, 'default' | 'info' | 'success'> = {
  private: 'default',
  team: 'info',
  public: 'success',
}

const defaultForm: FeedbackCreatePayload = {
  to_employee_id: '',
  feedback_type: 'general',
  content: '',
  is_anonymous: false,
  visibility: 'private',
  related_goal_id: '',
}

export default function FeedbackPage() {
  const [tab, setTab] = useState<'received' | 'given'>('received')

  const { data: received, isLoading: receivedLoading } = useFeedbackReceived()
  const { data: given, isLoading: givenLoading } = useFeedbackGiven()
  const { data: empData } = useEmployees({ limit: 500 })
  const { data: summary } = useFeedbackSummary('')
  const giveFeedback = useGiveFeedback()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<FeedbackCreatePayload>(defaultForm)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      related_goal_id: form.related_goal_id || undefined,
    }
    giveFeedback.mutate(payload, {
      onSuccess: () => { toast('success', 'Feedback sent'); setShowModal(false); setForm(defaultForm) },
      onError: () => toast('error', 'Failed to send feedback'),
    })
  }

  function FeedbackCard({ feedback, showTo }: { feedback: ContinuousFeedback; showTo?: boolean }) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                {feedback.is_anonymous ? '?' : (showTo ? feedback.to_employee_id : feedback.from_employee_id).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {showTo ? `To: ${feedback.to_employee_id}` : (feedback.is_anonymous ? 'Anonymous' : `From: ${feedback.from_employee_id}`)}
                </p>
                <p className="text-xs text-gray-400">{new Date(feedback.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={feedbackTypeVariant[feedback.feedback_type] ?? 'info'}>
                {feedback.feedback_type}
              </Badge>
              <Badge variant={visibilityVariant[feedback.visibility] ?? 'default'}>
                {feedback.visibility}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{feedback.content}</p>
          {feedback.related_goal_id && (
            <p className="text-xs text-gray-400">Related goal: {feedback.related_goal_id}</p>
          )}
        </div>
      </Card>
    )
  }

  const isLoading = tab === 'received' ? receivedLoading : givenLoading
  const feedbackList = tab === 'received'
    ? (received as ContinuousFeedback[] | undefined)
    : (given as ContinuousFeedback[] | undefined)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Continuous Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">Give and receive feedback to foster growth</p>
        </div>
        <Button onClick={() => { setForm(defaultForm); setShowModal(true) }}>Give Feedback</Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Received</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(summary as Record<string, number>).total_received ?? 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Praise</p>
            <p className="text-2xl font-bold text-green-600">{(summary as Record<string, number>).praise_count ?? 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Improvement</p>
            <p className="text-2xl font-bold text-yellow-600">{(summary as Record<string, number>).improvement_count ?? 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">General</p>
            <p className="text-2xl font-bold text-blue-600">{(summary as Record<string, number>).general_count ?? 0}</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'received' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          onClick={() => setTab('received')}
        >
          Received
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'given' ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          onClick={() => setTab('given')}
        >
          Given
        </button>
      </div>

      {/* Feedback list */}
      <div className="space-y-4">
        {feedbackList && feedbackList.length > 0 ? (
          feedbackList.map((fb) => (
            <FeedbackCard key={fb.id} feedback={fb} showTo={tab === 'given'} />
          ))
        ) : (
          <Card>
            <p className="text-center py-8 text-gray-400 text-sm">
              {tab === 'received' ? 'No feedback received yet.' : 'No feedback given yet.'}
            </p>
          </Card>
        )}
      </div>

      {/* Give Feedback Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Give Feedback" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="To Employee"
            required
            options={[
              { value: '', label: 'Select employee...' },
              ...(empData?.items?.map((e: { id: string; first_name: string; last_name: string }) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
            ]}
            value={form.to_employee_id}
            onChange={(e) => setForm((p) => ({ ...p, to_employee_id: e.target.value }))}
          />
          <Select
            label="Feedback Type"
            required
            options={[
              { value: 'praise', label: 'Praise' },
              { value: 'improvement', label: 'Improvement' },
              { value: 'general', label: 'General' },
            ]}
            value={form.feedback_type}
            onChange={(e) => setForm((p) => ({ ...p, feedback_type: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
              required
              placeholder="Write your feedback..."
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_anonymous ?? false}
                onChange={(e) => setForm((p) => ({ ...p, is_anonymous: e.target.checked }))}
                className="rounded border-gray-300"
              />
              Anonymous
            </label>
          </div>
          <Select
            label="Visibility"
            options={[
              { value: 'private', label: 'Private' },
              { value: 'team', label: 'Team' },
              { value: 'public', label: 'Public' },
            ]}
            value={form.visibility ?? 'private'}
            onChange={(e) => setForm((p) => ({ ...p, visibility: e.target.value }))}
          />
          <Select
            label="Related Goal (optional)"
            options={[
              { value: '', label: 'None' },
            ]}
            value={form.related_goal_id ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, related_goal_id: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={giveFeedback.isPending}>Send Feedback</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
