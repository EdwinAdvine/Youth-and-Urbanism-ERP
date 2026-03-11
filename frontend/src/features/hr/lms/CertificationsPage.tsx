import { useState } from 'react'
import { Card, Badge, Button, Spinner, Table, Modal, Input } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useCertifications,
  useExpiringCertifications,
  useCreateCertification,
  useUpdateCertification,
  useDeleteCertification,
  type Certification,
  type CreateCertificationPayload,
} from '@/api/hr_lms'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilExpiry(expiry: string): number {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000)
}

function isExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false
  const d = daysUntilExpiry(expiry)
  return d >= 0 && d < 30
}

function isExpired(expiry: string | null): boolean {
  if (!expiry) return false
  return daysUntilExpiry(expiry) < 0
}

// ─── Expiry cell ──────────────────────────────────────────────────────────────

function ExpiryCell({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="text-gray-400 text-sm">—</span>

  const expired = isExpired(expiry)
  const soon = isExpiringSoon(expiry)
  const days = daysUntilExpiry(expiry)

  return (
    <span
      className={`text-sm font-medium ${
        expired
          ? 'text-[#ff3a6e]'
          : soon
          ? 'text-[#ffa21d]'
          : 'text-gray-700 dark:text-gray-300'
      }`}
    >
      {new Date(expiry).toLocaleDateString()}
      {expired && ' · Expired'}
      {soon && !expired && ` · ${days}d left`}
    </span>
  )
}

// ─── Default form values ──────────────────────────────────────────────────────

const defaultForm: CreateCertificationPayload = {
  employee_id: '',
  name: '',
  issuer: '',
  credential_id: '',
  issue_date: new Date().toISOString().split('T')[0],
  expiry_date: '',
}

// ─── Create / Edit dialog ─────────────────────────────────────────────────────

interface CertDialogProps {
  open: boolean
  onClose: () => void
  editing: Certification | null
}

function CertDialog({ open, onClose, editing }: CertDialogProps) {
  const [form, setForm] = useState<CreateCertificationPayload>(() => {
    if (editing) {
      return {
        employee_id: editing.employee_id,
        name: editing.name,
        issuer: editing.issuer ?? '',
        credential_id: editing.credential_id ?? '',
        issue_date: editing.issue_date,
        expiry_date: editing.expiry_date ?? '',
      }
    }
    return { ...defaultForm }
  })

  // Re-init when editing changes
  const [prevEditing, setPrevEditing] = useState(editing)
  if (prevEditing !== editing) {
    setPrevEditing(editing)
    setForm(
      editing
        ? {
            employee_id: editing.employee_id,
            name: editing.name,
            issuer: editing.issuer ?? '',
            credential_id: editing.credential_id ?? '',
            issue_date: editing.issue_date,
            expiry_date: editing.expiry_date ?? '',
          }
        : { ...defaultForm },
    )
  }

  const createCert = useCreateCertification()
  const updateCert = useUpdateCertification()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      issuer: form.issuer || null,
      credential_id: form.credential_id || null,
      expiry_date: form.expiry_date || null,
    }

    if (editing) {
      updateCert.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('success', 'Certification updated')
            onClose()
          },
          onError: () => toast('error', 'Failed to update certification'),
        },
      )
    } else {
      createCert.mutate(payload, {
        onSuccess: () => {
          toast('success', 'Certification added')
          onClose()
        },
        onError: () => toast('error', 'Failed to add certification'),
      })
    }
  }

  const isSaving = createCert.isPending || updateCert.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Certification' : 'Add Certification'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Employee ID"
          required
          placeholder="e.g. emp-uuid or employee number"
          value={form.employee_id}
          onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))}
        />
        <Input
          label="Certification Name"
          required
          placeholder="e.g. AWS Solutions Architect"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Issuer / Authority"
            placeholder="e.g. Amazon Web Services"
            value={form.issuer ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, issuer: e.target.value }))}
          />
          <Input
            label="Credential ID"
            placeholder="e.g. AWS-SAA-12345"
            value={form.credential_id ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, credential_id: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Issue Date"
            type="date"
            required
            value={form.issue_date}
            onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))}
          />
          <Input
            label="Expiry Date"
            type="date"
            value={form.expiry_date ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
          />
        </div>

        {/* File upload hint */}
        <div className="rounded-[10px] border border-dashed border-gray-200 dark:border-gray-700 px-4 py-5 text-center bg-gray-50 dark:bg-gray-800/40">
          <p className="text-sm text-gray-400">📎 Certificate file upload</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload via the Drive module and paste the share link if needed.
            <br />
            (File upload integration available once Drive is linked.)
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSaving}>
            {editing ? 'Update' : 'Add Certification'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CertificationsPage() {
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [expiringSoon, setExpiringSoon] = useState(false)
  const [page, setPage] = useState(1)

  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Certification | null>(null)

  const { data, isLoading } = useCertifications({
    employee_id: employeeFilter || undefined,
    expiring_soon: expiringSoon || undefined,
    page,
    limit: 20,
  })

  const { data: expiring } = useExpiringCertifications()
  const deleteCert = useDeleteCertification()
  const updateCert = useUpdateCertification()

  const certs = data?.items ?? []
  const expiringCount = expiring?.length ?? 0

  function openCreate() {
    setEditing(null)
    setShowDialog(true)
  }

  function openEdit(cert: Certification) {
    setEditing(cert)
    setShowDialog(true)
  }

  function handleDelete(cert: Certification) {
    if (!confirm(`Delete certification "${cert.name}"?`)) return
    deleteCert.mutate(cert.id, {
      onSuccess: () => toast('success', 'Certification deleted'),
      onError: () => toast('error', 'Failed to delete certification'),
    })
  }

  function handleVerify(cert: Certification) {
    updateCert.mutate(
      { id: cert.id },
      {
        onSuccess: () => toast('success', 'Certification verified'),
        onError: () => toast('error', 'Failed to verify certification'),
      },
    )
  }

  const columns = [
    {
      key: 'employee',
      label: 'Employee',
      render: (c: Certification) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.employee_id}</span>
      ),
    },
    {
      key: 'name',
      label: 'Certification',
      render: (c: Certification) => (
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
          {c.credential_id && (
            <p className="text-xs text-gray-400">ID: {c.credential_id}</p>
          )}
        </div>
      ),
    },
    {
      key: 'issuer',
      label: 'Issuer',
      render: (c: Certification) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{c.issuer ?? '—'}</span>
      ),
    },
    {
      key: 'issue_date',
      label: 'Issued',
      render: (c: Certification) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(c.issue_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expires',
      render: (c: Certification) => <ExpiryCell expiry={c.expiry_date} />,
    },
    {
      key: 'is_verified',
      label: 'Verified',
      render: (c: Certification) => (
        c.is_verified ? (
          <Badge variant="success">✓ Verified</Badge>
        ) : (
          <Badge variant="default">Unverified</Badge>
        )
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (c: Certification) => (
        <div className="flex items-center justify-end gap-1.5">
          {!c.is_verified && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[#6fd943]"
              onClick={() => handleVerify(c)}
              loading={updateCert.isPending}
            >
              Verify
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => handleDelete(c)}
            loading={deleteCert.isPending}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Certifications</h1>
          <p className="text-sm text-gray-500 mt-1">Track employee licenses and certifications</p>
        </div>
        <Button onClick={openCreate}>+ Add Certification</Button>
      </div>

      {/* Expiring Soon alert banner */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-3 bg-[#ffa21d]/10 border border-[#ffa21d]/30 rounded-[10px] px-4 py-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#ffa21d]">
              {expiringCount} certification{expiringCount !== 1 ? 's' : ''} expiring within 30 days
            </p>
            <p className="text-xs text-[#ffa21d]/80 mt-0.5">
              Review and renew affected certifications to stay compliant.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-[#ffa21d]/40 text-[#ffa21d] hover:bg-[#ffa21d]/10 shrink-0"
            onClick={() => setExpiringSoon(true)}
          >
            Show Expiring
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Filter by employee ID..."
            value={employeeFilter}
            onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/30"
            checked={expiringSoon}
            onChange={(e) => { setExpiringSoon(e.target.checked); setPage(1) }}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Expiring soon only</span>
        </label>
        {(employeeFilter || expiringSoon) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEmployeeFilter(''); setExpiringSoon(false); setPage(1) }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <span className="text-sm text-gray-500">
            {data?.total ?? 0} total certifications
          </span>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={certs}
            keyExtractor={(c) => c.id}
            emptyText={
              expiringSoon
                ? 'No certifications expiring soon.'
                : 'No certifications found. Click "+ Add Certification" to get started.'
            }
          />

          {/* Pagination */}
          {(data?.total ?? 0) > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500">
              <span>{data!.total} total</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="px-2">Page {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= (data?.total ?? 0)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Expiring certs detail section */}
      {expiringCount > 0 && expiring && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Expiring Soon ({expiringCount})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiring.map((c) => {
              const days = daysUntilExpiry(c.expiry_date!)
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-3 border border-[#ffa21d]/30 bg-[#ffa21d]/5 rounded-[10px] px-4 py-3"
                >
                  <span className="text-xl shrink-0">🔔</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.employee_id}</p>
                    <p className="text-xs font-semibold text-[#ffa21d] mt-0.5">
                      {days === 0 ? 'Expires today' : `Expires in ${days} day${days !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="shrink-0">
                    Edit
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Create / Edit dialog */}
      <CertDialog
        open={showDialog}
        onClose={() => { setShowDialog(false); setEditing(null) }}
        editing={editing}
      />
    </div>
  )
}
