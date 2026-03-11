import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import { useMeetingTemplates, useCreateMeetingTemplate, type MeetingTemplate } from '../../api/meetings_ext'

export default function MeetingTemplatesPage() {
  const { data: templates, isLoading } = useMeetingTemplates()
  const createTemplate = useCreateMeetingTemplate()

  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState('30')
  const [agenda, setAgenda] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    createTemplate.mutate(
      {
        name,
        description: description || undefined,
        duration_minutes: parseInt(duration) || 30,
        default_agenda: agenda || undefined,
      },
      {
        onSuccess: () => {
          toast('success', 'Template created')
          setShowModal(false)
          setName('')
          setDescription('')
          setDuration('30')
          setAgenda('')
        },
        onError: () => toast('error', 'Failed to create template'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meeting Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Create reusable meeting setups</p>
        </div>
        <Button onClick={() => setShowModal(true)}>New Template</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">No meeting templates. Create one for common meeting types.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{tmpl.name}</h3>
                  {tmpl.description && <p className="text-xs text-gray-500 mt-0.5">{tmpl.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="info">{tmpl.duration_minutes} min</Badge>
                {tmpl.default_attendees.length > 0 && (
                  <Badge variant="default">{tmpl.default_attendees.length} attendees</Badge>
                )}
              </div>
              {tmpl.default_agenda && (
                <p className="text-xs text-gray-400 line-clamp-2 mb-3">{tmpl.default_agenda}</p>
              )}
              <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">{new Date(tmpl.created_at).toLocaleDateString()}</span>
                <Button size="sm" variant="outline">Use Template</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Meeting Template">
        <div className="space-y-4">
          <Input label="Template Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Daily Standup" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          <Input label="Duration (minutes)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Agenda</label>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="1. Updates\n2. Blockers\n3. Action items"
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createTemplate.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
