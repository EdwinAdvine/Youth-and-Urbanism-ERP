import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import {
  useProjectTemplates,
  useCreateTemplate,
  useCreateFromTemplate,
  type ProjectTemplate,
} from '../../api/projects_ext'
import { useProjects } from '../../api/projects'
import { Select } from '../../components/ui'

export default function TemplatesPage() {
  const { data: templates, isLoading } = useProjectTemplates()
  const { data: projects } = useProjects()
  const createTemplate = useCreateTemplate()
  const createFromTemplate = useCreateFromTemplate()

  const [showCreate, setShowCreate] = useState(false)
  const [showUse, setShowUse] = useState<ProjectTemplate | null>(null)

  // Create form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceProject, setSourceProject] = useState('')

  // Use template form
  const [newProjectName, setNewProjectName] = useState('')
  const [startDate, setStartDate] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    createTemplate.mutate(
      { name, description: description || undefined, source_project_id: sourceProject || undefined },
      {
        onSuccess: () => {
          toast('success', 'Template created')
          setShowCreate(false)
          setName('')
          setDescription('')
          setSourceProject('')
        },
        onError: () => toast('error', 'Failed to create template'),
      }
    )
  }

  const handleUseTemplate = () => {
    if (!showUse || !newProjectName.trim()) return toast('error', 'Project name is required')
    createFromTemplate.mutate(
      { template_id: showUse.id, name: newProjectName, start_date: startDate || undefined },
      {
        onSuccess: () => {
          toast('success', 'Project created from template')
          setShowUse(null)
          setNewProjectName('')
          setStartDate('')
        },
        onError: () => toast('error', 'Failed to create project'),
      }
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Reuse project structures to speed up setup</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Template</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-gray-400">No templates yet. Create one from an existing project or from scratch.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-base font-semibold text-gray-900">{tmpl.name}</h3>
              {tmpl.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{tmpl.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="info">{tmpl.task_templates.length} tasks</Badge>
                <Badge variant="primary">{tmpl.milestone_templates.length} milestones</Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {new Date(tmpl.created_at).toLocaleDateString()}
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowUse(tmpl)
                    setNewProjectName('')
                    setStartDate('')
                  }}
                >
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Template">
        <div className="space-y-4">
          <Input label="Template Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Sprint Template" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          {projects && projects.length > 0 && (
            <Select
              label="Copy from Project (optional)"
              value={sourceProject}
              onChange={(e) => setSourceProject(e.target.value)}
              options={[{ value: '', label: 'None - blank template' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createTemplate.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Use Template Modal */}
      <Modal open={!!showUse} onClose={() => setShowUse(null)} title={`Create from "${showUse?.name}"`}>
        <div className="space-y-4">
          <Input label="Project Name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="New project name" />
          <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowUse(null)}>Cancel</Button>
            <Button onClick={handleUseTemplate} loading={createFromTemplate.isPending}>Create Project</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
