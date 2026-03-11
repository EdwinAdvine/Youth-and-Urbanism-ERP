import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useRFxList, useCreateRFx, useUpdateRFx,
  type RFx, type CreateRFxPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary' | 'danger'> = {
  draft: 'default',
  published: 'info',
  evaluating: 'warning',
  awarded: 'success',
  closed: 'primary',
  cancelled: 'danger',
}

const TYPE_LABEL: Record<string, string> = {
  rfq: 'RFQ',
  rfp: 'RFP',
  rfi: 'RFI',
}

interface RFxFormState {
  type: 'rfq' | 'rfp' | 'rfi'
  title: string
  description: string
  deadline: string
}

const defaultForm: RFxFormState = {
  type: 'rfq',
  title: '',
  description: '',
  deadline: '',
}

export default function RFxPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<RFxFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useRFxList({
    type: filterType || undefined,
    status: filterStatus || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateRFx()
  const updateMutation = useUpdateRFx()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast('warning', 'Title is required')
      return
    }
    const payload: CreateRFxPayload = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      deadline: form.deadline || undefined,
    }
    try {
      await createMutation.mutateAsync(payload)
      toast('success', `${TYPE_LABEL[form.type]} created`)
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create RFx')
    }
  }

  const handlePublish = async (rfx: RFx) => {
    try {
      await updateMutation.mutateAsync({ id: rfx.id, status: 'published' })
      toast('success', `${TYPE_LABEL[rfx.type]} published`)
    } catch {
      toast('error', 'Failed to publish RFx')
    }
  }

  const filteredRFx = (data?.rfx_list ?? []).filter(
    (r) => !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.rfx_number.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      key: 'rfx_number',
      label: 'RFx #',
      render: (row: RFx) => (
        <span className="text-[#51459d] font-medium">{row.rfx_number}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (row: RFx) => (
        <Badge variant="primary">{TYPE_LABEL[row.type] ?? row.type.toUpperCase()}</Badge>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (row: RFx) => (
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs block">{row.title}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: RFx) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'deadline',
      label: 'Deadline',
      render: (row: RFx) => {
        if (!row.deadline) return <span className="text-gray-400">-</span>
        const isOverdue = new Date(row.deadline) < new Date() && row.status !== 'closed' && row.status !== 'awarded' && row.status !== 'cancelled'
        return (
          <span className={isOverdue ? 'text-[#ff3a6e] font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {formatDate(row.deadline)}
          </span>
        )
      },
    },
    {
      key: 'supplier_count',
      label: 'Suppliers',
      render: (row: RFx) => (
        <span className="text-gray-600 dark:text-gray-400">{row.supplier_count}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: RFx) => <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: RFx) => (
        <div className="flex items-center gap-1">
          {row.status === 'draft' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handlePublish(row)}
              loading={updateMutation.isPending}
              className="text-[#51459d] hover:text-[#3d3478]"
            >
              Publish
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">RFx Management</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total RFx</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New RFx
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-72">
          <Input
            placeholder="Search RFx..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Types</option>
          <option value="rfq">RFQ</option>
          <option value="rfp">RFP</option>
          <option value="rfi">RFI</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="evaluating">Evaluating</option>
          <option value="awarded">Awarded</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-gray-500">{filteredRFx.length} items</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<RFx>
          columns={columns}
          data={filteredRFx}
          loading={isLoading}
          emptyText="No RFx found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New RFx" size="lg">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type *</label>
            <div className="flex gap-2">
              {(['rfq', 'rfp', 'rfi'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`px-4 py-2 rounded-[10px] text-sm font-medium transition-colors ${
                    form.type === t
                      ? 'bg-[#51459d] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={`${TYPE_LABEL[form.type]} title`}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Describe what you are requesting..."
            />
          </div>
          <Input
            label="Deadline"
            type="date"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create {TYPE_LABEL[form.type]}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
