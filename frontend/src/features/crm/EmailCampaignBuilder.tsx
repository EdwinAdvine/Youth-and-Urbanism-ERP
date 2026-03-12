import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useCreateABTest,
  useABTestResults,
  type ABTestCreatePayload,
  type EmailCampaignConfig,
} from '../../api/crm_marketing'
import { Button, Badge, Card, Spinner, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'

const defaultForm: Omit<ABTestCreatePayload, 'campaign_id'> = {
  subject_line_a: '',
  subject_line_b: '',
  ab_test_ratio: 50,
  ab_winner_metric: 'open_rate',
  ab_winner_auto_send: false,
}

function WinnerBadge({ config }: { config: EmailCampaignConfig }) {
  if (!config.subject_line_b) return null

  const totalA = config.sent_count > 0 ? Math.round(config.sent_count * (config.ab_test_ratio / 100)) : 0
  const totalB = config.sent_count - totalA
  const openRateA = totalA > 0 ? (config.open_count * (config.ab_test_ratio / 100)) / totalA : 0
  const openRateB = totalB > 0 ? (config.open_count * (1 - config.ab_test_ratio / 100)) / totalB : 0

  if (config.winner_determined_at) {
    const winner = openRateA >= openRateB ? 'A' : 'B'
    return <Badge variant="success">Winner: Variant {winner}</Badge>
  }
  return <Badge variant="warning">Test in progress</Badge>
}

export default function EmailCampaignBuilder() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const resolvedCampaignId = campaignId ?? ''

  const { data: results, isLoading } = useABTestResults(resolvedCampaignId)
  const createABTest = useCreateABTest()

  const [form, setForm] = useState(defaultForm)
  const [showForm, setShowForm] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resolvedCampaignId) {
      toast('error', 'No campaign selected')
      return
    }
    createABTest.mutate(
      { campaign_id: resolvedCampaignId, ...form },
      {
        onSuccess: () => {
          toast('success', 'A/B test created')
          setShowForm(false)
        },
        onError: () => toast('error', 'Failed to create A/B test'),
      }
    )
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Email Campaign A/B Testing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Campaign ID: <span className="font-mono text-xs">{resolvedCampaignId || 'None'}</span>
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>New A/B Test</Button>
        )}
      </div>

      {/* ── Results Section ──────────────────────────────────────────────── */}
      {results && (
        <Card>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Test Results
              </h2>
              <WinnerBadge config={results} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-xs uppercase text-gray-500 tracking-wide">Sent</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#51459d' }}>
                  {results.sent_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-xs uppercase text-gray-500 tracking-wide">Opens</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#3ec9d6' }}>
                  {results.open_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-xs uppercase text-gray-500 tracking-wide">Clicks</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#6fd943' }}>
                  {results.click_count.toLocaleString()}
                </p>
              </div>
              <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 text-center">
                <p className="text-xs uppercase text-gray-500 tracking-wide">Unsubscribes</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#ff3a6e' }}>
                  {results.unsubscribe_count.toLocaleString()}
                </p>
              </div>
            </div>

            {results.subject_line_b && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="rounded-[10px] border-2 p-4" style={{ borderColor: '#51459d' }}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="primary">Variant A</Badge>
                    <span className="text-xs text-gray-500">
                      {results.ab_test_ratio}% of audience
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {results.subject_line_a}
                  </p>
                </div>
                <div className="rounded-[10px] border-2 p-4" style={{ borderColor: '#3ec9d6' }}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="info">Variant B</Badge>
                    <span className="text-xs text-gray-500">
                      {100 - results.ab_test_ratio}% of audience
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {results.subject_line_b}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>
                Winner metric: <span className="font-medium">{results.ab_winner_metric}</span>
              </span>
              <span>
                Auto-send winner:{' '}
                <Badge variant={results.ab_winner_auto_send ? 'success' : 'default'}>
                  {results.ab_winner_auto_send ? 'Yes' : 'No'}
                </Badge>
              </span>
              {results.send_at && (
                <span>
                  Scheduled: {new Date(results.send_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Create Form ──────────────────────────────────────────────────── */}
      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Create A/B Test
            </h2>

            <Input
              label="Subject Line A"
              required
              placeholder="Your main subject line"
              value={form.subject_line_a}
              onChange={(e) => setForm((p) => ({ ...p, subject_line_a: e.target.value }))}
            />

            <Input
              label="Subject Line B"
              placeholder="Alternate subject line to test"
              value={form.subject_line_b ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, subject_line_b: e.target.value }))}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                A/B Split Ratio: {form.ab_test_ratio ?? 50}% / {100 - (form.ab_test_ratio ?? 50)}%
              </label>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={form.ab_test_ratio}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ab_test_ratio: Number(e.target.value) }))
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#51459d' }}
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>Variant A: {form.ab_test_ratio ?? 50}%</span>
                <span>Variant B: {100 - (form.ab_test_ratio ?? 50)}%</span>
              </div>
            </div>

            <Select
              label="Winner Metric"
              options={[
                { value: 'open_rate', label: 'Open Rate' },
                { value: 'click_rate', label: 'Click Rate' },
              ]}
              value={form.ab_winner_metric}
              onChange={(e) => setForm((p) => ({ ...p, ab_winner_metric: e.target.value }))}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ab_winner_auto_send}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ab_winner_auto_send: e.target.checked }))
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: '#51459d' }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Automatically send winning variant to remaining audience
              </span>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createABTest.isPending}>
                Create A/B Test
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!results && !showForm && (
        <Card>
          <div className="p-12 text-center">
            <p className="text-gray-500">No A/B test configured for this campaign yet.</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              Set Up A/B Test
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
