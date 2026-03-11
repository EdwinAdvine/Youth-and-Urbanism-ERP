import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Badge, toast } from '../../components/ui'
import {
  useCompensationBands,
  useCreateCompensationBand,
  useUpdateCompensationBand,
  useDeleteCompensationBand,
  useCompensationBandAnalysis,
  type CompensationBand,
  type CompensationBandCreatePayload,
  type CompensationBandUpdatePayload,
} from '../../api/hr_phase1'

const defaultForm: CompensationBandCreatePayload = {
  job_level: '',
  job_family: '',
  currency: 'USD',
  min_salary: 0,
  mid_salary: 0,
  max_salary: 0,
  country_code: 'US',
  effective_from: new Date().toISOString().split('T')[0],
}

function formatCurrency(amount: number, currency?: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CompensationBandsPage() {
  const [jobLevelFilter, setJobLevelFilter] = useState('')
  const [jobFamilyFilter, setJobFamilyFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  const { data: bands, isLoading } = useCompensationBands({
    job_level: jobLevelFilter || undefined,
    job_family: jobFamilyFilter || undefined,
    country_code: countryFilter || undefined,
  })
  const { data: analysisData, isLoading: analysisLoading } = useCompensationBandAnalysis()

  const createBand = useCreateCompensationBand()
  const updateBand = useUpdateCompensationBand()
  const deleteBand = useDeleteCompensationBand()

  const [showModal, setShowModal] = useState(false)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const [editing, setEditing] = useState<CompensationBand | null>(null)
  const [form, setForm] = useState<CompensationBandCreatePayload>(defaultForm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(band: CompensationBand) {
    setEditing(band)
    setForm({
      job_level: band.job_level,
      job_family: band.job_family,
      currency: band.currency,
      min_salary: band.min_salary,
      mid_salary: band.mid_salary,
      max_salary: band.max_salary,
      country_code: band.country_code,
      effective_from: band.effective_from,
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.min_salary > form.mid_salary || form.mid_salary > form.max_salary) {
      toast('error', 'Salary values must be: Min <= Mid <= Max')
      return
    }
    if (editing) {
      const updateData: CompensationBandUpdatePayload = {
        job_level: form.job_level,
        job_family: form.job_family,
        min_salary: form.min_salary,
        mid_salary: form.mid_salary,
        max_salary: form.max_salary,
      }
      updateBand.mutate(
        { bandId: editing.id, data: updateData },
        {
          onSuccess: () => { toast('success', 'Compensation band updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update compensation band'),
        }
      )
    } else {
      createBand.mutate(form, {
        onSuccess: () => { toast('success', 'Compensation band created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create compensation band'),
      })
    }
  }

  function handleDelete(bandId: string) {
    deleteBand.mutate(bandId, {
      onSuccess: () => { toast('success', 'Band deleted'); setShowDeleteConfirm(null) },
      onError: () => toast('error', 'Failed to delete band'),
    })
  }

  const columns = [
    {
      key: 'job_level',
      label: 'Job Level',
      render: (r: CompensationBand) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.job_level}</span>
      ),
    },
    {
      key: 'job_family',
      label: 'Job Family',
      render: (r: CompensationBand) => (
        <span className="text-gray-700 dark:text-gray-300">{r.job_family}</span>
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      render: (r: CompensationBand) => (
        <Badge variant="default">{r.currency}</Badge>
      ),
    },
    {
      key: 'min_salary',
      label: 'Min',
      render: (r: CompensationBand) => formatCurrency(r.min_salary, r.currency),
    },
    {
      key: 'mid_salary',
      label: 'Mid',
      render: (r: CompensationBand) => (
        <span className="font-medium">{formatCurrency(r.mid_salary, r.currency)}</span>
      ),
    },
    {
      key: 'max_salary',
      label: 'Max',
      render: (r: CompensationBand) => formatCurrency(r.max_salary, r.currency),
    },
    {
      key: 'country_code',
      label: 'Country',
      render: (r: CompensationBand) => r.country_code,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r: CompensationBand) => (
        <Badge variant={r.is_active ? 'success' : 'default'}>
          {r.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: CompensationBand) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(r.id)}>
            <span className="text-red-500">Delete</span>
          </Button>
        </div>
      ),
    },
  ]

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compensation Bands</h1>
          <p className="text-sm text-gray-500 mt-1">Manage salary bands by job level, family, and geography</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAnalysisModal(true)}>Analysis</Button>
          <Button onClick={openCreate}>Add Band</Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Filter by job level..."
          value={jobLevelFilter}
          onChange={(e) => setJobLevelFilter(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Filter by job family..."
          value={jobFamilyFilter}
          onChange={(e) => setJobFamilyFilter(e.target.value)}
          className="w-48"
        />
        <Input
          placeholder="Country code (e.g., US)"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={(bands as CompensationBand[]) ?? []}
          keyExtractor={(r) => r.id}
          emptyText="No compensation bands found."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Compensation Band' : 'Create Compensation Band'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Job Level"
              required
              placeholder="e.g., L5, Senior"
              value={form.job_level}
              onChange={(e) => setForm((p) => ({ ...p, job_level: e.target.value }))}
            />
            <Input
              label="Job Family"
              required
              placeholder="e.g., Engineering, Sales"
              value={form.job_family}
              onChange={(e) => setForm((p) => ({ ...p, job_family: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Min Salary"
              required
              type="number"
              min={0}
              value={form.min_salary}
              onChange={(e) => setForm((p) => ({ ...p, min_salary: Number(e.target.value) }))}
            />
            <Input
              label="Mid Salary"
              required
              type="number"
              min={0}
              value={form.mid_salary}
              onChange={(e) => setForm((p) => ({ ...p, mid_salary: Number(e.target.value) }))}
            />
            <Input
              label="Max Salary"
              required
              type="number"
              min={0}
              value={form.max_salary}
              onChange={(e) => setForm((p) => ({ ...p, max_salary: Number(e.target.value) }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Currency"
              placeholder="USD"
              value={form.currency ?? 'USD'}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
            />
            <Input
              label="Country Code"
              placeholder="US"
              value={form.country_code ?? 'US'}
              onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))}
            />
            <Input
              label="Effective From"
              required
              type="date"
              value={form.effective_from}
              onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createBand.isPending || updateBand.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Analysis Modal */}
      <Modal open={showAnalysisModal} onClose={() => setShowAnalysisModal(false)} title="Compensation Band Analysis" size="xl">
        {analysisLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : analysisData ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Overview of compensation band distribution and metrics across the organization.
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-[10px] p-4">
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(analysisData, null, 2)}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No analysis data available.</p>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Compensation Band" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete this compensation band? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteBand.isPending}
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
