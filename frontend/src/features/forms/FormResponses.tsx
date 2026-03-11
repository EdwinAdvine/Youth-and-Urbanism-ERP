import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useFormResponses, useCreateTaskFromResponse, formsApi } from '../../api/forms'
import { Button, Card, Spinner, toast } from '../../components/ui'
import apiClient from '../../api/client'

export default function FormResponses() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: form, isLoading: formLoading } = useForm(id ?? '')
  const { data: responses, isLoading: responsesLoading } = useFormResponses(id ?? '')
  const createTaskFromResponse = useCreateTaskFromResponse()
  const [taskDialog, setTaskDialog] = useState<{ responseId: string } | null>(null)
  const [taskProjectId, setTaskProjectId] = useState('')
  const [taskTitle, setTaskTitle] = useState('')

  const isLoading = formLoading || responsesLoading

  async function handleExport() {
    try {
      const data = await formsApi.exportForm(id ?? '')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${form?.title ?? 'form'}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('success', 'Exported successfully')
    } catch {
      toast('error', 'Export failed')
    }
  }

  async function handleExportFile(format: 'csv' | 'xlsx') {
    try {
      const response = await apiClient.get(`/forms/${id}/export`, {
        params: { format },
        responseType: 'blob',
      })
      const ext = format
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'
      const blob = new Blob([response.data], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${form?.title ?? 'form'}_responses.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast('success', `Exported as ${format.toUpperCase()}`)
    } catch {
      toast('error', `${format.toUpperCase()} export failed`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-lg font-semibold text-gray-900">Form not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/forms')}>Back to Forms</Button>
      </div>
    )
  }

  const fields = form.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/forms/${id}/edit`)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {responses?.length ?? 0} response{(responses?.length ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportFile('csv')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportFile('xlsx')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            JSON
          </Button>
        </div>
      </div>

      {/* Responses Table */}
      <Card padding={false}>
        {!responses || responses.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="h-10 w-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No responses yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    #
                  </th>
                  {fields.map((f) => (
                    <th
                      key={f.id}
                      className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Submitted
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {responses.map((resp, idx) => (
                  <tr key={resp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                    {fields.map((f) => {
                      const val = resp.answers?.[f.id] ?? resp.answers?.[f.label] ?? ''
                      return (
                        <td key={f.id} className="py-3 px-4 text-gray-700 max-w-[200px] truncate">
                          {Array.isArray(val) ? val.join(', ') : String(val)}
                        </td>
                      )
                    })}
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(resp.submitted_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => { setTaskDialog({ responseId: resp.id }); setTaskTitle(`[Form] ${form?.title} - #${(idx + 1)}`) }}
                        className="text-xs text-[#51459d] hover:underline"
                        title="Create project task from this response"
                      >
                        Create Task
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Task from Response dialog */}
      {taskDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setTaskDialog(null); setTaskProjectId(''); setTaskTitle('') }}>
          <div className="bg-white rounded-[10px] shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Create Task from Response</h3>
            <p className="text-xs text-gray-400 mb-3">Create a project task from this form response.</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Project ID</label>
                <input
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  placeholder="Enter project UUID"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Task Title</label>
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!taskProjectId.trim() || !taskDialog) return
                  try {
                    await createTaskFromResponse.mutateAsync({
                      formId: id ?? '',
                      responseId: taskDialog.responseId,
                      projectId: taskProjectId.trim(),
                      title: taskTitle || undefined,
                    })
                    toast('success', 'Task created successfully')
                    setTaskDialog(null)
                    setTaskProjectId('')
                    setTaskTitle('')
                  } catch {
                    toast('error', 'Failed to create task')
                  }
                }}
                disabled={createTaskFromResponse.isPending || !taskProjectId.trim()}
                className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
              >
                {createTaskFromResponse.isPending ? 'Creating...' : 'Create Task'}
              </button>
              <button
                onClick={() => { setTaskDialog(null); setTaskProjectId(''); setTaskTitle('') }}
                className="text-xs text-gray-400 hover:text-gray-600 px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
