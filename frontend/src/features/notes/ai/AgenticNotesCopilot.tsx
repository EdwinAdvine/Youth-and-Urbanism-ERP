import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import apiClient from '../../../api/client'

interface AgenticNotesCopilotProps {
  noteId?: string
  onClose: () => void
  onNoteCreated?: (noteId: string) => void
}

type WorkflowKey = 'status-report' | 'meeting-notes' | 'deal-proposal' | null

interface AgentResult {
  note_id: string
  title: string
  summary: string
  task_id?: string
}

interface TaskStatus {
  status: 'pending' | 'running' | 'complete' | 'error'
  step?: number
  note_id?: string
  title?: string
  summary?: string
  error?: string
}

const STEPS = [
  'Gathering ERP context...',
  'Analyzing data...',
  'Generating content...',
]

type FormState = {
  projectId: string
  dealId: string
}

export default function AgenticNotesCopilot({ noteId, onClose, onNoteCreated }: AgenticNotesCopilotProps) {
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<FormState>({ projectId: '', dealId: '' })
  const [taskId, setTaskId] = useState<string | null>(null)
  const [result, setResult] = useState<AgentResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Poll task status
  const { data: taskStatus } = useQuery<TaskStatus>({
    queryKey: ['agent-task', taskId],
    queryFn: async () => {
      const { data } = await apiClient.get<TaskStatus>(`/notes/agent/status/${taskId}`)
      return data
    },
    enabled: !!taskId,
    refetchInterval: taskId ? 2000 : false,
  })

  useEffect(() => {
    if (!taskStatus) return
    if (taskStatus.step !== undefined) {
      setCurrentStep(Math.min(taskStatus.step, STEPS.length - 1))
    }
    if (taskStatus.status === 'complete') {
      setTaskId(null)
      setCurrentStep(STEPS.length)
      setResult({
        note_id: taskStatus.note_id ?? '',
        title: taskStatus.title ?? '',
        summary: taskStatus.summary ?? '',
      })
    }
    if (taskStatus.status === 'error') {
      setTaskId(null)
      setErrorMsg(taskStatus.error ?? 'An error occurred during processing.')
      setActiveWorkflow(null)
    }
  }, [taskStatus])

  const handleMutationSuccess = (data: AgentResult) => {
    if (data.task_id) {
      setTaskId(data.task_id)
      setCurrentStep(0)
    } else {
      setCurrentStep(STEPS.length)
      setResult(data)
    }
  }

  const handleMutationError = () => {
    setErrorMsg('Request failed. Please try again.')
    setActiveWorkflow(null)
  }

  const statusReportMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { data } = await apiClient.post<AgentResult>('/notes/agent/status-report', { project_id: projectId })
      return data
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  })

  const meetingNotesMutation = useMutation({
    mutationFn: async (nId: string) => {
      const { data } = await apiClient.post<AgentResult>(`/notes/agent/process-meeting/${nId}`)
      return data
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  })

  const dealProposalMutation = useMutation({
    mutationFn: async (dealId: string) => {
      const { data } = await apiClient.post<AgentResult>('/notes/agent/deal-proposal', { deal_id: dealId })
      return data
    },
    onSuccess: handleMutationSuccess,
    onError: handleMutationError,
  })

  const isRunning = activeWorkflow !== null && currentStep < STEPS.length && !result

  const startWorkflow = (key: WorkflowKey) => {
    setActiveWorkflow(key)
    setCurrentStep(0)
    setResult(null)
    setErrorMsg(null)
    setTaskId(null)
  }

  const handleRun = () => {
    if (activeWorkflow === 'status-report') {
      if (!form.projectId.trim()) return
      statusReportMutation.mutate(form.projectId.trim())
    } else if (activeWorkflow === 'meeting-notes') {
      if (!noteId) return
      meetingNotesMutation.mutate(noteId)
    } else if (activeWorkflow === 'deal-proposal') {
      if (!form.dealId.trim()) return
      dealProposalMutation.mutate(form.dealId.trim())
    }
  }

  const handleReset = () => {
    setActiveWorkflow(null)
    setCurrentStep(0)
    setResult(null)
    setErrorMsg(null)
    setTaskId(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        zIndex: 50,
        background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Open Sans, sans-serif',
        animation: 'slideInRight 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#51459d',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#fff" opacity="0.9" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Notes Copilot</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {!activeWorkflow && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              Choose an agentic workflow to automatically generate notes from ERP data.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <WorkflowCard
                icon="📊"
                title="Project Status Report"
                description="Generate a status report for any project from ERP data"
                onClick={() => startWorkflow('status-report')}
              />
              <WorkflowCard
                icon="🗂️"
                title="Process Meeting Notes"
                description="Extract action items, decisions, and summaries from current note"
                onClick={() => startWorkflow('meeting-notes')}
                disabled={!noteId}
                disabledReason="Open a note first"
              />
              <WorkflowCard
                icon="🤝"
                title="Deal Proposal"
                description="Generate a deal proposal document from CRM deal data"
                onClick={() => startWorkflow('deal-proposal')}
              />
            </div>

            {errorMsg && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#fff0f3', border: '1px solid #ff3a6e', borderRadius: 8, fontSize: 13, color: '#ff3a6e' }}>
                {errorMsg}
              </div>
            )}
          </>
        )}

        {activeWorkflow && !isRunning && !result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button onClick={handleReset} style={backBtnStyle}>← Back</button>

            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {activeWorkflow === 'status-report' && 'Project Status Report'}
              {activeWorkflow === 'meeting-notes' && 'Process Meeting Notes'}
              {activeWorkflow === 'deal-proposal' && 'Deal Proposal'}
            </div>

            {activeWorkflow === 'status-report' && (
              <div>
                <label style={labelStyle}>Project ID or Name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. proj_123 or My Project"
                  value={form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                />
              </div>
            )}

            {activeWorkflow === 'meeting-notes' && (
              <div style={{ padding: '12px 14px', background: '#f3f4f6', borderRadius: 8, fontSize: 13, color: '#374151' }}>
                Will process note: <strong>{noteId}</strong>
              </div>
            )}

            {activeWorkflow === 'deal-proposal' && (
              <div>
                <label style={labelStyle}>Deal ID</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. deal_456"
                  value={form.dealId}
                  onChange={(e) => setForm((f) => ({ ...f, dealId: e.target.value }))}
                />
              </div>
            )}

            <button
              onClick={handleRun}
              style={primaryBtnStyle}
            >
              Run Workflow
            </button>
          </div>
        )}

        {isRunning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 24 }}>
              Working on it...
            </div>
            {STEPS.map((step, idx) => (
              <StepRow
                key={idx}
                label={step}
                status={idx < currentStep ? 'done' : idx === currentStep ? 'running' : 'pending'}
              />
            ))}
          </div>
        )}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Done!</div>
            </div>

            <div style={{ padding: '14px', background: '#f3f4f6', borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                {result.title}
              </div>
              {result.summary && (
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  {result.summary}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (onNoteCreated) onNoteCreated(result.note_id)
                }}
                style={primaryBtnStyle}
              >
                Open Note
              </button>
              <button onClick={handleReset} style={secondaryBtnStyle}>
                New Workflow
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function WorkflowCard({
  icon, title, description, onClick, disabled, disabledReason,
}: {
  icon: string
  title: string
  description: string
  onClick: () => void
  disabled?: boolean
  disabledReason?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        background: disabled ? '#f9fafb' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.borderColor = '#51459d' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb' }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{description}</div>
      </div>
    </button>
  )
}

function StepRow({ label, status }: { label: string; status: 'done' | 'running' | 'pending' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {status === 'done' && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#6fd943" />
            <path d="M7 12l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {status === 'running' && (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '2.5px solid #e5e7eb',
              borderTop: '2.5px solid #51459d',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}
        {status === 'pending' && (
          <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #d1d5db' }} />
        )}
      </div>
      <span
        style={{
          fontSize: 14,
          color: status === 'pending' ? '#9ca3af' : '#111827',
          fontWeight: status === 'running' ? 600 : 400,
        }}
      >
        {label}
      </span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'Open Sans, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  background: '#51459d',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Open Sans, sans-serif',
}

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  background: '#f3f4f6',
  color: '#374151',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Open Sans, sans-serif',
}

const backBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#6b7280',
  fontSize: 13,
  padding: 0,
  textAlign: 'left',
  fontFamily: 'Open Sans, sans-serif',
}
