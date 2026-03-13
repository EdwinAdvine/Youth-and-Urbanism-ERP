import { useState } from 'react'
import { Card, Button, Input, Spinner, Badge } from '../../components/ui'
import {
  useFileRequests,
  useCreateFileRequest,
  useDeactivateFileRequest,
  useFileRequestSubmissions,
  type FileRequest,
} from '../../api/drive_phase2'

export default function FileRequestsPanel() {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<FileRequest | null>(null)

  const { data, isLoading } = useFileRequests()
  const createRequest = useCreateFileRequest()
  const deactivate = useDeactivateFileRequest()

  const [form, setForm] = useState({
    title: '',
    description: '',
    deadline: '',
    max_files: '',
  })

  const handleCreate = async () => {
    if (!form.title.trim()) return
    await createRequest.mutateAsync({
      title: form.title,
      description: form.description || undefined,
      deadline: form.deadline || undefined,
      max_files: form.max_files ? parseInt(form.max_files) : undefined,
    })
    setForm({ title: '', description: '', deadline: '', max_files: '' })
    setShowCreate(false)
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/drive/upload-request/${token}`
    navigator.clipboard.writeText(url)
    alert('Upload link copied!')
  }

  if (selectedRequest) {
    return <SubmissionsView request={selectedRequest} onBack={() => setSelectedRequest(null)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">File Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">Request files from anyone — no account needed</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">New Request</Button>
      </div>

      {showCreate && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Create File Request</h3>
          <div className="space-y-3">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Q1 Report Submissions"
            />
            <Input
              label="Description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Instructions for submitters"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Deadline (optional)"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
              <Input
                label="Max Files"
                type="number"
                value={form.max_files}
                onChange={(e) => setForm({ ...form, max_files: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleCreate} loading={createRequest.isPending} size="sm">Create & Get Link</Button>
              <Button variant="outline" onClick={() => setShowCreate(false)} size="sm">Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.requests.length ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-4xl mb-3">📥</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No file requests yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a request to collect files from anyone</p>
            <Button onClick={() => setShowCreate(true)} size="sm" className="mt-4">Create First Request</Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.requests.map((req) => (
            <Card key={req.id}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center text-xl shrink-0">📥</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{req.title}</p>
                    <Badge variant={req.is_active ? 'success' : 'default'} className="shrink-0">
                      {req.is_active ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                  {req.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{req.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span>{req.submission_count} submission{req.submission_count !== 1 ? 's' : ''}</span>
                    {req.deadline && <span>Due: {new Date(req.deadline).toLocaleDateString()}</span>}
                    <span>{new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(req.token)}
                    title="Copy upload link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </Button>
                  {req.submission_count > 0 && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(req)}>
                      View
                    </Button>
                  )}
                  {req.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Close this file request?')) deactivate.mutate(req.id)
                      }}
                      className="text-red-500 hover:bg-red-50"
                    >
                      Close
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SubmissionsView({ request, onBack }: { request: FileRequest; onBack: () => void }) {
  const { data, isLoading } = useFileRequestSubmissions(request.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{request.title}</h2>
          <p className="text-sm text-gray-500">{request.submission_count} submission{request.submission_count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.submissions.length ? (
        <p className="text-sm text-gray-400 text-center py-12">No submissions yet</p>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {data.submissions.map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-[8px] bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-500">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{sub.file_name || 'Unknown file'}</p>
                  <p className="text-xs text-gray-400">
                    {sub.submitted_by_name || 'Anonymous'}
                    {sub.submitted_by_email && ` · ${sub.submitted_by_email}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={sub.status === 'accepted' ? 'success' : sub.status === 'rejected' ? 'danger' : 'default'}>
                    {sub.status}
                  </Badge>
                  <span className="text-[11px] text-gray-400">{new Date(sub.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
