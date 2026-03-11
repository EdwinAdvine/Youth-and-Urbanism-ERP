import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampaigns } from '../../api/crm'
import {
  useCreateABTest,
  type ABTestCreatePayload,
} from '../../api/crm_marketing'
import { Button, Card, Spinner, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'

type Step = 1 | 2 | 3

const stepLabels: Record<Step, string> = {
  1: 'Choose Campaign',
  2: 'Configure Test',
  3: 'Review & Create',
}

export default function ABTestSetup() {
  const navigate = useNavigate()
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns()
  const createABTest = useCreateABTest()

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<ABTestCreatePayload>({
    campaign_id: '',
    subject_line_a: '',
    subject_line_b: '',
    ab_test_ratio: 50,
    ab_winner_metric: 'open_rate',
    ab_winner_auto_send: false,
  })

  function canNext(): boolean {
    if (step === 1) return !!form.campaign_id
    if (step === 2) return !!form.subject_line_a
    return true
  }

  function handleCreate() {
    createABTest.mutate(form, {
      onSuccess: () => {
        toast('success', 'A/B test created successfully')
        navigate(`/crm/campaigns/${form.campaign_id}/ab-test`)
      },
      onError: () => toast('error', 'Failed to create A/B test'),
    })
  }

  const selectedCampaign = campaigns?.find((c: { id: string }) => c.id === form.campaign_id)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">A/B Test Wizard</h1>
        <p className="text-sm text-gray-500 mt-1">Set up an A/B test in three simple steps</p>
      </div>

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-colors"
              style={{
                backgroundColor: step >= s ? '#51459d' : '#e5e7eb',
                color: step >= s ? '#fff' : '#6b7280',
              }}
            >
              {s}
            </div>
            <span
              className={`text-sm font-medium ${
                step >= s ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
              }`}
            >
              {stepLabels[s]}
            </span>
            {s < 3 && (
              <div
                className="w-12 h-0.5 mx-1"
                style={{ backgroundColor: step > s ? '#51459d' : '#e5e7eb' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Choose Campaign ──────────────────────────────────────── */}
      {step === 1 && (
        <Card>
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Select a Campaign
            </h2>
            {loadingCampaigns ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : (
              <Select
                label="Campaign"
                options={[
                  { value: '', label: '-- Select a campaign --' },
                  ...(campaigns ?? []).map((c: { id: string; name: string; status: string }) => ({
                    value: c.id,
                    label: `${c.name} (${c.status})`,
                  })),
                ]}
                value={form.campaign_id}
                onChange={(e) => setForm((p) => ({ ...p, campaign_id: e.target.value }))}
              />
            )}
          </div>
        </Card>
      )}

      {/* ── Step 2: Configure ────────────────────────────────────────────── */}
      {step === 2 && (
        <Card>
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Configure Subject Lines & Ratio
            </h2>

            <Input
              label="Subject Line A (Control)"
              required
              placeholder="Your main subject line"
              value={form.subject_line_a}
              onChange={(e) => setForm((p) => ({ ...p, subject_line_a: e.target.value }))}
            />

            <Input
              label="Subject Line B (Variant)"
              placeholder="Alternate subject line to test"
              value={form.subject_line_b ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, subject_line_b: e.target.value }))}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Split Ratio: {form.ab_test_ratio}% A / {100 - (form.ab_test_ratio ?? 50)}% B
              </label>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={form.ab_test_ratio ?? 50}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ab_test_ratio: Number(e.target.value) }))
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#51459d' }}
              />
            </div>

            <Select
              label="Winner Metric"
              options={[
                { value: 'open_rate', label: 'Open Rate' },
                { value: 'click_rate', label: 'Click Rate' },
              ]}
              value={form.ab_winner_metric ?? 'open_rate'}
              onChange={(e) => setForm((p) => ({ ...p, ab_winner_metric: e.target.value }))}
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ab_winner_auto_send ?? false}
                onChange={(e) =>
                  setForm((p) => ({ ...p, ab_winner_auto_send: e.target.checked }))
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: '#51459d' }}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-send winning variant to remaining audience
              </span>
            </label>
          </div>
        </Card>
      )}

      {/* ── Step 3: Review ───────────────────────────────────────────────── */}
      {step === 3 && (
        <Card>
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Review & Create
            </h2>

            <div className="rounded-[10px] border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Campaign</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedCampaign?.name ?? form.campaign_id}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Subject A</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {form.subject_line_a}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Subject B</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {form.subject_line_b || '(none)'}
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Split Ratio</span>
                <span className="text-sm font-medium">
                  <Badge variant="primary">{form.ab_test_ratio}% A</Badge>{' '}
                  <Badge variant="info">{100 - (form.ab_test_ratio ?? 50)}% B</Badge>
                </span>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Winner Metric</span>
                <Badge variant="default">{form.ab_winner_metric}</Badge>
              </div>
              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-gray-500">Auto-send Winner</span>
                <Badge variant={form.ab_winner_auto_send ? 'success' : 'default'}>
                  {form.ab_winner_auto_send ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <div className="flex justify-between">
        <div>
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as Step)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          {step < 3 ? (
            <Button disabled={!canNext()} onClick={() => setStep((s) => (s + 1) as Step)}>
              Next
            </Button>
          ) : (
            <Button loading={createABTest.isPending} onClick={handleCreate} disabled={!canNext()}>
              Create A/B Test
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
