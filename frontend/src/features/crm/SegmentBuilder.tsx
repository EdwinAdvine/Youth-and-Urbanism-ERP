import { useState } from 'react'
import {
  useSegments,
  useCreateSegment,
  useUpdateSegment,
  useDeleteSegment,
  useComputeSegment,
  useAddSegmentContacts,
  type Segment,
  type SegmentCreatePayload,
} from '../../api/crm_marketing'
import { Button, Badge, Card, Spinner, Modal, Input, Select, Table } from '../../components/ui'
import { toast } from '../../components/ui'

const typeVariant: Record<string, 'primary' | 'info'> = {
  static: 'primary',
  dynamic: 'info',
}

const defaultForm: SegmentCreatePayload = {
  name: '',
  description: '',
  segment_type: 'static',
  rules: null,
  ai_suggested: false,
}

export default function SegmentBuilder() {
  const [typeFilter, setTypeFilter] = useState('')
  const { data: segments, isLoading } = useSegments({
    segment_type: typeFilter || undefined,
  })
  const createSegment = useCreateSegment()
  const updateSegment = useUpdateSegment()
  const deleteSegment = useDeleteSegment()
  const computeSegment = useComputeSegment()
  const addContacts = useAddSegmentContacts()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Segment | null>(null)
  const [form, setForm] = useState<SegmentCreatePayload>(defaultForm)
  const [rulesJson, setRulesJson] = useState('')

  // Add Contacts dialog
  const [showAddContacts, setShowAddContacts] = useState(false)
  const [addContactsTarget, setAddContactsTarget] = useState<Segment | null>(null)
  const [contactIdsInput, setContactIdsInput] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setRulesJson('')
    setShowModal(true)
  }

  function openEdit(seg: Segment) {
    setEditing(seg)
    setForm({
      name: seg.name,
      description: seg.description ?? '',
      segment_type: seg.segment_type,
      rules: seg.rules,
      ai_suggested: seg.ai_suggested,
    })
    setRulesJson(seg.rules ? JSON.stringify(seg.rules, null, 2) : '')
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    let parsedRules: Record<string, any> | null = null
    if (form.segment_type === 'dynamic' && rulesJson.trim()) {
      try {
        parsedRules = JSON.parse(rulesJson)
      } catch {
        toast('error', 'Invalid JSON in rules field')
        return
      }
    }

    const payload: SegmentCreatePayload = { ...form, rules: parsedRules }

    if (editing) {
      updateSegment.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('success', 'Segment updated')
            setShowModal(false)
          },
          onError: () => toast('error', 'Failed to update segment'),
        }
      )
    } else {
      createSegment.mutate(payload, {
        onSuccess: () => {
          toast('success', 'Segment created')
          setShowModal(false)
        },
        onError: () => toast('error', 'Failed to create segment'),
      })
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Delete this segment?')) return
    deleteSegment.mutate(id, {
      onSuccess: () => toast('success', 'Segment deleted'),
      onError: () => toast('error', 'Failed to delete segment'),
    })
  }

  function handleCompute(id: string) {
    computeSegment.mutate(id, {
      onSuccess: () => toast('success', 'Segment recomputed'),
      onError: () => toast('error', 'Failed to compute segment'),
    })
  }

  function openAddContacts(seg: Segment) {
    setAddContactsTarget(seg)
    setContactIdsInput('')
    setShowAddContacts(true)
  }

  function handleAddContacts(e: React.FormEvent) {
    e.preventDefault()
    if (!addContactsTarget) return
    const ids = contactIdsInput
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      toast('error', 'Enter at least one contact ID')
      return
    }
    addContacts.mutate(
      { segmentId: addContactsTarget.id, contactIds: ids },
      {
        onSuccess: () => {
          toast('success', `${ids.length} contact(s) added to segment`)
          setShowAddContacts(false)
        },
        onError: () => toast('error', 'Failed to add contacts'),
      }
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'Segment',
      render: (seg: Segment) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">{seg.name}</p>
            {seg.ai_suggested && (
              <Badge variant="warning">AI Suggested</Badge>
            )}
          </div>
          {seg.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{seg.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'segment_type',
      label: 'Type',
      render: (seg: Segment) => (
        <Badge variant={typeVariant[seg.segment_type] ?? 'default'}>{seg.segment_type}</Badge>
      ),
    },
    {
      key: 'contact_count',
      label: 'Contacts',
      render: (seg: Segment) => (
        <span className="font-medium">{seg.contact_count.toLocaleString()}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (seg: Segment) => new Date(seg.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (seg: Segment) => (
        <div className="flex items-center justify-end gap-2">
          {seg.segment_type === 'dynamic' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCompute(seg.id)}
              loading={computeSegment.isPending}
            >
              Compute
            </Button>
          )}
          {seg.segment_type === 'static' && (
            <Button variant="ghost" size="sm" onClick={() => openAddContacts(seg)}>
              Add Contacts
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => openEdit(seg)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            onClick={() => handleDelete(seg.id)}
          >
            Delete
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Segments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage contact segments for targeted campaigns
          </p>
        </div>
        <Button onClick={openCreate}>Create Segment</Button>
      </div>

      <div className="flex gap-3">
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: 'static', label: 'Static' },
            { value: 'dynamic', label: 'Dynamic' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={segments ?? []}
          keyExtractor={(seg: Segment) => seg.id}
          emptyText="No segments found. Create one to get started."
        />
      </Card>

      {/* ── Create / Edit Modal ──────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Segment' : 'Create Segment'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <Select
            label="Segment Type"
            options={[
              { value: 'static', label: 'Static (manually add contacts)' },
              { value: 'dynamic', label: 'Dynamic (rule-based, auto-computed)' },
            ]}
            value={form.segment_type}
            onChange={(e) => setForm((p) => ({ ...p, segment_type: e.target.value }))}
          />

          {form.segment_type === 'dynamic' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Rules (JSON)
              </label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                rows={6}
                placeholder='{"field": "company_size", "operator": "gte", "value": 50}'
                value={rulesJson}
                onChange={(e) => setRulesJson(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Enter filter rules as valid JSON. Dynamic segments are recomputed on demand.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createSegment.isPending || updateSegment.isPending}
            >
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Add Contacts Modal ───────────────────────────────────────────── */}
      <Modal
        open={showAddContacts}
        onClose={() => setShowAddContacts(false)}
        title={`Add Contacts to "${addContactsTarget?.name ?? ''}"`}
      >
        <form onSubmit={handleAddContacts} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contact IDs
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={5}
              placeholder="Enter contact IDs, one per line or comma-separated"
              value={contactIdsInput}
              onChange={(e) => setContactIdsInput(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Paste contact IDs separated by commas or newlines.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowAddContacts(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addContacts.isPending}>
              Add Contacts
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
