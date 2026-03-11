import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAISidebarStore } from '../../store/aiSidebar'
import { useAgentWebSocket } from '../../hooks/useAgentWebSocket'
import AgentThinkingIndicator from './AgentThinkingIndicator'
import PlanStepCard from './PlanStepCard'
import ApprovalCard from './ApprovalCard'

// ── Suggested prompts per module ────────────────────────────────────────────

const SUGGESTED_PROMPTS: Record<string, string[]> = {
  finance: ['Show revenue this month', 'Create an invoice for...', 'List overdue payments'],
  hr: ['Check leave balance for...', 'Look up employee...', 'Show department summary'],
  crm: ['Get pipeline summary', 'Score my top leads', 'Create a follow-up task'],
  projects: ['Show my active tasks', 'Log time for...', 'Analyze project risk'],
  inventory: ['Check stock levels', 'Look up item by SKU', 'Forecast demand'],
  support: ['Show open tickets', 'Classify a ticket', 'Search knowledge base'],
  'supply-chain': ['Get procurement status', 'Look up supplier', 'Check BOM cost'],
  manufacturing: ['Get production summary', 'Check material availability', 'Optimize production'],
  pos: ['Show today\'s POS sales', 'Look up transaction', 'Revenue summary'],
  ecommerce: ['Get e-commerce sales', 'Look up order', 'Recommend products'],
  analytics: ['Generate a report', 'Query data', 'Revenue breakdown'],
  mail: ['Summarize email thread', 'Compose an email', 'Categorize emails'],
  calendar: ['Show my meetings today', 'Schedule a meeting', 'Check availability'],
  default: ['What can you help with?', 'Show my meetings today', 'Get revenue summary'],
}

// ── Main AISidebar ──────────────────────────────────────────────────────────

export default function AISidebar() {
  const { isOpen, close } = useAISidebarStore()
  const location = useLocation()
  const [input, setInput] = useState('')
  const [sessionId] = useState(() => `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    status: wsStatus,
    messages,
    currentRun,
    thinkingAgent,
    thinkingMessage,
    sendPrompt,
    sendApproval,
  } = useAgentWebSocket(sessionId)

  // Detect current module from route
  const currentModule = useMemo(() => {
    const path = location.pathname.split('/')[1] || 'default'
    return path in SUGGESTED_PROMPTS ? path : 'default'
  }, [location.pathname])

  const suggestions = SUGGESTED_PROMPTS[currentModule] || SUGGESTED_PROMPTS.default

  // Build page context from current route
  const pageContext = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    return {
      module: parts[0] || 'home',
      route: location.pathname,
      selected_id: parts.length > 1 ? parts[parts.length - 1] : null,
    }
  }, [location.pathname])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinkingAgent, currentRun])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    sendPrompt(text, pageContext)
    setInput('')
  }, [input, sendPrompt, pageContext])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleApprove = useCallback(
    (stepId: string) => {
      if (!currentRun) return
      sendApproval(currentRun.id, [stepId], 'approve')
    },
    [currentRun, sendApproval]
  )

  const handleReject = useCallback(
    (stepId: string) => {
      if (!currentRun) return
      sendApproval(currentRun.id, [stepId], 'reject')
    },
    [currentRun, sendApproval]
  )

  // Steps that need approval cards (separate from plan step cards)
  const awaitingApprovalSteps = currentRun?.steps.filter((s) => s.status === 'awaiting_approval') || []

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={close}
        />
      )}
      <div
        className={`w-[340px] lg:w-[380px] bg-white border-l border-gray-100 flex flex-col shrink-0 transition-all duration-300 ease-in-out max-md:fixed max-md:top-0 max-md:right-0 max-md:h-screen max-md:z-40 max-md:shadow-xl ${
          isOpen
            ? 'max-md:translate-x-0'
            : 'w-0 lg:w-0 overflow-hidden border-l-0 max-md:translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-[8px] bg-primary/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Urban Bad AI</h2>
              <p className="text-[10px] text-gray-400">Your ERP Co-Worker</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                wsStatus === 'connected' ? 'bg-success' : wsStatus === 'connecting' ? 'bg-warning animate-pulse' : 'bg-gray-300'
              }`}
              title={wsStatus}
            />
            <button
              onClick={close}
              className="p-1.5 rounded-[8px] hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Empty state with suggestions */}
          {messages.length === 0 && !thinkingAgent && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">How can I help?</p>
                <p className="text-xs text-gray-400 mt-1">I can execute real actions across your ERP</p>
              </div>
              <div className="space-y-1.5 w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                      inputRef.current?.focus()
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 rounded-[10px] border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* Success summary card for completed runs */}
              {msg.role === 'assistant' && msg.run?.status === 'completed' ? (
                <div className="max-w-[85%] rounded-[10px] border border-success/30 bg-success/5 p-3 text-xs">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <svg className="h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-success text-[11px]">Completed</span>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{msg.content}</p>
                </div>
              ) : (
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-[10px] text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 text-gray-700 border border-gray-100'
                  }`}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {/* Plan steps */}
          {currentRun && currentRun.steps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1">Plan</p>
              {currentRun.steps.map((step) => (
                <PlanStepCard
                  key={step.id}
                  step={step}
                  onApprove={() => handleApprove(step.id)}
                  onReject={() => handleReject(step.id)}
                />
              ))}
            </div>
          )}

          {/* Approval cards for steps awaiting approval */}
          {awaitingApprovalSteps.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-warning uppercase tracking-wider px-1">Action Required</p>
              {awaitingApprovalSteps.map((step) => (
                <ApprovalCard
                  key={`approval-${step.id}`}
                  action={step.action}
                  description={step.description || `Execute ${step.action} with provided arguments`}
                  riskLevel={step.risk_level || 'warn'}
                  onApprove={() => handleApprove(step.id)}
                  onReject={() => handleReject(step.id)}
                />
              ))}
            </div>
          )}

          {/* Thinking indicator */}
          {thinkingAgent && thinkingMessage && (
            <AgentThinkingIndicator agent={thinkingAgent} message={thinkingMessage} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-100 px-3 py-3 shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Urban Bad AI..."
              rows={1}
              className="flex-1 resize-none rounded-[10px] border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              style={{ minHeight: '38px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || wsStatus !== 'connected'}
              className="shrink-0 h-[38px] w-[38px] rounded-[10px] bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 text-[9px] font-mono">Cmd+Enter</kbd> to send
          </p>
        </div>
      </div>
    </>
  )
}
