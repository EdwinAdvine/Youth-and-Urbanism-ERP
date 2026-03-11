import { useState, useEffect } from 'react'
import apiClient from '../../api/client'

interface Project {
  id: string
  name: string
}

interface Task {
  id: string
  title: string
  status: string
}

interface DocLinkerProps {
  fileId: string
  fileName: string
  onLinked?: () => void
}

export default function DocLinker({ fileId, fileName, onLinked }: DocLinkerProps) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch projects when dropdown opens
  useEffect(() => {
    if (!open) return
    apiClient
      .get('/projects', { params: { limit: 100 } })
      .then((res) => setProjects(res.data.projects || []))
      .catch(() => setError('Failed to load projects'))
  }, [open])

  // Fetch tasks when project changes
  useEffect(() => {
    if (!selectedProject) {
      setTasks([])
      setSelectedTask('')
      return
    }
    apiClient
      .get(`/projects/${selectedProject}/tasks`, { params: { limit: 100 } })
      .then((res) => setTasks(res.data.tasks || []))
      .catch(() => setError('Failed to load tasks'))
  }, [selectedProject])

  const handleLink = async () => {
    if (!selectedProject || !selectedTask) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await apiClient.post('/docs/link', {
        file_id: fileId,
        task_id: selectedTask,
        project_id: selectedProject,
      })
      setSuccess(`"${fileName}" linked successfully`)
      setSelectedProject('')
      setSelectedTask('')
      onLinked?.()
      setTimeout(() => {
        setOpen(false)
        setSuccess('')
      }, 1500)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to link document'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-[#51459d] hover:text-[#51459d]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        Link to Project
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-[10px] border border-gray-200 bg-white p-4 shadow-lg">
          <h4 className="mb-3 text-sm font-semibold text-gray-900">
            Link Document to Task
          </h4>

          {/* Project selector */}
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Project
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="mb-3 w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:border-[#51459d] focus:outline-none focus:ring-1 focus:ring-[#51459d]"
          >
            <option value="">Select a project...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Task selector */}
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Task
          </label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            disabled={!selectedProject}
            className="mb-3 w-full rounded-[10px] border border-gray-300 px-3 py-2 text-sm focus:border-[#51459d] focus:outline-none focus:ring-1 focus:ring-[#51459d] disabled:cursor-not-allowed disabled:bg-gray-50"
          >
            <option value="">
              {selectedProject ? 'Select a task...' : 'Choose a project first'}
            </option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} [{t.status}]
              </option>
            ))}
          </select>

          {/* Error / Success messages */}
          {error && (
            <p className="mb-2 rounded-[10px] bg-red-50 px-3 py-1.5 text-xs text-red-600">
              {error}
            </p>
          )}
          {success && (
            <p className="mb-2 rounded-[10px] bg-green-50 px-3 py-1.5 text-xs text-[#6fd943]">
              {success}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setOpen(false)
                setError('')
                setSuccess('')
              }}
              className="rounded-[10px] px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleLink}
              disabled={!selectedProject || !selectedTask || loading}
              className="rounded-[10px] bg-[#51459d] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#433a82] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Linking...' : 'Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
