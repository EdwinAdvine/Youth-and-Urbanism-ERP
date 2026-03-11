import { useState } from 'react'
import { Card, Button, Modal, Input, Badge, Table, toast } from '../../components/ui'
import { useMailLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, type MailLabel } from '../../api/mail_ext'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6', '#f43f5e',
]

export default function LabelsPage() {
  const { data: labels, isLoading } = useMailLabels()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MailLabel | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  const openCreate = () => {
    setEditing(null)
    setName('')
    setColor('#3b82f6')
    setShowModal(true)
  }

  const openEdit = (label: MailLabel) => {
    setEditing(label)
    setName(label.name)
    setColor(label.color)
    setShowModal(true)
  }

  const handleSave = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    if (editing) {
      updateLabel.mutate(
        { id: editing.id, name, color },
        {
          onSuccess: () => { toast('success', 'Label updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update label'),
        }
      )
    } else {
      createLabel.mutate(
        { name, color },
        {
          onSuccess: () => { toast('success', 'Label created'); setShowModal(false) },
          onError: () => toast('error', 'Failed to create label'),
        }
      )
    }
  }

  const handleDelete = (label: MailLabel) => {
    if (!confirm(`Delete label "${label.name}"?`)) return
    deleteLabel.mutate(label.id, {
      onSuccess: () => toast('success', 'Label deleted'),
      onError: () => toast('error', 'Failed to delete label'),
    })
  }

  const columns = [
    {
      key: 'color',
      label: '',
      className: 'w-8',
      render: (label: MailLabel) => (
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: label.color }} />
      ),
    },
    {
      key: 'name',
      label: 'Label',
      render: (label: MailLabel) => <span className="font-medium text-gray-700">{label.name}</span>,
    },
    {
      key: 'message_count',
      label: 'Messages',
      render: (label: MailLabel) => <Badge variant="default">{label.message_count}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (label: MailLabel) => (
        <span className="text-sm text-gray-400">{new Date(label.created_at).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (label: MailLabel) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => openEdit(label)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(label)}>
            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mail Labels</h1>
          <p className="text-sm text-gray-500 mt-1">Organize your emails with custom labels</p>
        </div>
        <Button onClick={openCreate}>New Label</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={labels ?? []}
          loading={isLoading}
          emptyText="No labels. Create one to organize your emails."
          keyExtractor={(l) => l.id}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Label' : 'New Label'}>
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Label name" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">Preview:</span>
              <Badge className="text-white" style={{ backgroundColor: color } as React.CSSProperties}>
                {name || 'Label'}
              </Badge>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={createLabel.isPending || updateLabel.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
