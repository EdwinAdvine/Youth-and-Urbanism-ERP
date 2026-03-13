import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import DOMPurify from 'dompurify'
import {
  X, Send, Mic, MicOff, Plus, Copy, Check, RefreshCw,
  DollarSign, Users, Target, FolderOpen, Package,
  Headphones, Truck, Factory, ShoppingCart, BarChart3,
  Mail, Calendar, BookOpen, Bot, Zap, AlertCircle,
} from 'lucide-react'
import { cn } from '../ui'
import { useAISidebarStore } from '../../store/aiSidebar'
import { useAuthStore } from '../../store/auth'
import { useAgentWebSocket } from '../../hooks/useAgentWebSocket'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import AgentThinkingIndicator from './AgentThinkingIndicator'
import PlanStepCard from './PlanStepCard'
import ApprovalCard from './ApprovalCard'

// ── Markdown renderer ──────────────────────────────────────────────────────

function renderMarkdown(text: string): { __html: string } {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // fenced code blocks
    .replace(
      /```[\w]*\n?([\s\S]*?)```/g,
      '<pre class="mt-1.5 mb-1.5 p-2 bg-gray-900 text-green-400 rounded-lg text-[10px] overflow-x-auto leading-relaxed font-mono whitespace-pre">$1</pre>',
    )
    // inline code
    .replace(
      /`([^`\n]+)`/g,
      '<code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[11px] font-mono text-[#ff3a6e]">$1</code>',
    )
    // bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-gray-100">$1</strong>')
    // italic
    .replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>')
    // h3
    .replace(
      /^### (.+)$/gm,
      '<p class="font-bold text-xs mt-2 mb-0.5 text-gray-800 dark:text-gray-200">$1</p>',
    )
    // h2
    .replace(
      /^## (.+)$/gm,
      '<p class="font-semibold text-[13px] mt-2 mb-1 text-gray-800 dark:text-gray-200">$1</p>',
    )
    // bullet list items
    .replace(
      /^[•\-\*] (.+)$/gm,
      '<div class="flex items-start gap-1.5 my-0.5 leading-snug"><span class="text-[#51459d] shrink-0 mt-0.5 font-bold">•</span><span>$1</span></div>',
    )
    // numbered list items
    .replace(
      /^(\d+)\. (.+)$/gm,
      '<div class="flex items-start gap-1.5 my-0.5 leading-snug"><span class="text-[#51459d] font-bold shrink-0 w-4 text-[11px]">$1.</span><span>$2</span></div>',
    )
    // paragraph breaks
    .replace(/\n\n/g, '<br />')
    // line breaks
    .replace(/\n/g, '<br />')

  return { __html: DOMPurify.sanitize(html, { ADD_ATTR: ['class'] }) }
}

// ── Suggested prompts ──────────────────────────────────────────────────────

const MODULE_SUGGESTIONS: Record<string, { prompts: string[]; Icon: React.ElementType; color: string }> = {
  finance: {
    prompts: ['Show revenue this month', 'Create an invoice for...', 'List overdue payments'],
    Icon: DollarSign, color: 'text-success',
  },
  hr: {
    prompts: ['Check leave balance for...', 'Look up employee...', 'Show department summary'],
    Icon: Users, color: 'text-info',
  },
  crm: {
    prompts: ['Get pipeline summary', 'Score my top leads', 'Create a follow-up task'],
    Icon: Target, color: 'text-warning',
  },
  projects: {
    prompts: ['Show my active tasks', 'Log time for...', 'Analyze project risk'],
    Icon: FolderOpen, color: 'text-primary',
  },
  inventory: {
    prompts: ['Check stock levels', 'Look up item by SKU', 'Forecast demand'],
    Icon: Package, color: 'text-danger',
  },
  support: {
    prompts: ['Show open tickets', 'Classify a ticket', 'Search knowledge base'],
    Icon: Headphones, color: 'text-info',
  },
  'supply-chain': {
    prompts: ['Get procurement status', 'Look up supplier', 'Check BOM cost'],
    Icon: Truck, color: 'text-warning',
  },
  manufacturing: {
    prompts: ['Get production summary', 'Check material availability', 'Optimize production'],
    Icon: Factory, color: 'text-danger',
  },
  pos: {
    prompts: ["Show today's POS sales", 'Look up transaction', 'Revenue summary'],
    Icon: ShoppingCart, color: 'text-success',
  },
  ecommerce: {
    prompts: ['Get e-commerce sales', 'Look up order', 'Recommend products'],
    Icon: ShoppingCart, color: 'text-primary',
  },
  analytics: {
    prompts: ['Generate a report', 'Query data', 'Revenue breakdown'],
    Icon: BarChart3, color: 'text-info',
  },
  mail: {
    prompts: ['Summarize email thread', 'Compose an email', 'Categorize emails'],
    Icon: Mail, color: 'text-primary',
  },
  calendar: {
    prompts: ['Show my meetings today', 'Schedule a meeting', 'Check availability'],
    Icon: Calendar, color: 'text-warning',
  },
  handbook: {
    prompts: ['How do I create an invoice?', 'Show the HR onboarding guide', 'What modules are available?'],
    Icon: BookOpen, color: 'text-info',
  },
  default: {
    prompts: ['What can you help with?', 'Show my meetings today', 'Get revenue summary'],
    Icon: Zap, color: 'text-primary',
  },
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
      title="Copy message"
    >
      {copied
        ? <Check className="h-3 w-3 text-success" />
        : <Copy className="h-3 w-3" />
      }
    </button>
  )
}

// ── User avatar ────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div className="h-6 w-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
      {initials || 'U'}
    </div>
  )
}

// ── AI avatar ──────────────────────────────────────────────────────────────

function AIAvatar({ isActive = false }: { isActive?: boolean }) {
  return (
    <div
      className={cn(
        'h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-all',
        isActive
          ? 'bg-primary shadow-md shadow-primary/30 ring-2 ring-primary/20'
          : 'bg-primary/10',
      )}
    >
      <Bot className={cn('h-3.5 w-3.5', isActive ? 'text-white' : 'text-primary')} />
    </div>
  )
}

// ── Active run progress bar ────────────────────────────────────────────────

function RunProgressBar({ isActive }: { isActive: boolean }) {
  if (!isActive) return null
  return (
    <div className="h-0.5 w-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
      <div
        className="h-full bg-gradient-to-r from-primary via-info to-success animate-[progress_2s_ease-in-out_infinite]"
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}

// ── Offline banner ─────────────────────────────────────────────────────────

function OfflineBanner({ onReconnect }: { onReconnect: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-danger/5 border-b border-danger/20 shrink-0">
      <AlertCircle className="h-3.5 w-3.5 text-danger shrink-0" />
      <span className="text-[11px] text-danger flex-1">Disconnected from server</span>
      <button
        onClick={onReconnect}
        className="flex items-center gap-1 text-[11px] font-medium text-danger hover:text-danger/80 transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Reconnect
      </button>
    </div>
  )
}

// ── Main AISidebar ─────────────────────────────────────────────────────────

export default function AISidebar() {
  const { isOpen, close } = useAISidebarStore()
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const [input, setInput] = useState('')
  const [sessionId, setSessionId] = useState(
    () => `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  )
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
    connect,
  } = useAgentWebSocket(sessionId)

  const { isListening, transcript, startListening, stopListening, isSupported: voiceSupported } =
    useVoiceInput()

  // Sync voice transcript to input
  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript).trim())
    }
  }, [transcript])

  // Detect current module from route
  const currentModule = useMemo(() => {
    const path = location.pathname.split('/')[1] || 'default'
    return path in MODULE_SUGGESTIONS ? path : 'default'
  }, [location.pathname])

  const moduleConfig = MODULE_SUGGESTIONS[currentModule] || MODULE_SUGGESTIONS.default

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

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300)
  }, [isOpen])

  const isProcessing = thinkingAgent !== null || (currentRun?.status !== 'completed' && currentRun !== null)

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || wsStatus !== 'connected') return
    sendPrompt(text, pageContext)
    setInput('')
    // reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }, [input, sendPrompt, pageContext, wsStatus])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleNewChat = useCallback(() => {
    setSessionId(`agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    setInput('')
  }, [])

  const handleApprove = useCallback(
    (stepId: string) => {
      if (!currentRun) return
      sendApproval(currentRun.id, [stepId], 'approve')
    },
    [currentRun, sendApproval],
  )

  const handleReject = useCallback(
    (stepId: string) => {
      if (!currentRun) return
      sendApproval(currentRun.id, [stepId], 'reject')
    },
    [currentRun, sendApproval],
  )

  const awaitingApprovalSteps = currentRun?.steps.filter((s) => s.status === 'awaiting_approval') || []

  const completedSteps = currentRun?.steps.filter((s) => s.status === 'completed').length ?? 0
  const totalSteps = currentRun?.steps.length ?? 0

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm" onClick={close} />
      )}

      <div
        className={cn(
          'bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out',
          // Full-screen on mobile, fixed sidebar on desktop
          'max-md:fixed max-md:inset-0 max-md:w-full max-md:h-full max-md:z-40 max-md:border-l-0',
          'md:w-[360px] lg:w-[400px] md:max-md:fixed md:max-md:top-0 md:max-md:right-0 md:max-md:h-screen md:max-md:z-40 md:max-md:shadow-2xl',
          isOpen
            ? 'max-md:translate-x-0'
            : 'w-0 lg:w-0 overflow-hidden border-l-0 max-md:translate-x-full',
        )}
      >
        {/* ── Header ── */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-2.5">
            {/* Animated logo */}
            <div
              className={cn(
                'h-8 w-8 rounded-[10px] flex items-center justify-center transition-all duration-300',
                isProcessing
                  ? 'bg-primary shadow-lg shadow-primary/30 animate-pulse'
                  : 'bg-primary/10',
              )}
            >
              <Bot className={cn('h-4.5 w-4.5', isProcessing ? 'text-white' : 'text-primary')} />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">Urban Bad AI</h2>
                {/* Connection status dot */}
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    wsStatus === 'connected' ? 'bg-success' : wsStatus === 'connecting' ? 'bg-warning animate-pulse' : 'bg-gray-300 dark:bg-gray-600',
                  )}
                  title={wsStatus}
                />
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">
                {wsStatus === 'connected'
                  ? isProcessing
                    ? 'Working...'
                    : 'Your ERP Co-Worker'
                  : wsStatus === 'connecting'
                    ? 'Connecting...'
                    : 'Offline'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* New conversation */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                title="New conversation"
                className="p-1.5 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {/* Close */}
            <button
              type="button"
              onClick={close}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <RunProgressBar isActive={isProcessing} />

        {/* ── Offline banner ── */}
        {wsStatus === 'disconnected' && (
          <OfflineBanner onReconnect={connect} />
        )}

        {/* ── Plan progress counter ── */}
        {currentRun && totalSteps > 0 && currentRun.status !== 'completed' && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-primary/10 shrink-0">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${totalSteps ? (completedSteps / totalSteps) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-primary shrink-0">
              {completedSteps}/{totalSteps} steps
            </span>
          </div>
        )}

        {/* ── Messages area ── */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 scroll-smooth">

          {/* Empty state */}
          {messages.length === 0 && !thinkingAgent && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-3">
              {/* Animated AI logo */}
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-white dark:border-gray-900 flex items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Hi{user ? `, ${user.full_name.split(' ')[0]}` : ''}!</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  I can execute real actions across your ERP.<br />
                  What would you like to do?
                </p>
              </div>

              {/* Suggestions */}
              <div className="space-y-1.5 w-full">
                {moduleConfig.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setInput(prompt)
                      inputRef.current?.focus()
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 dark:text-gray-400 rounded-[10px] border border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:bg-primary/5 transition-all hover:shadow-sm flex items-center gap-2"
                  >
                    <moduleConfig.Icon className={cn('h-3.5 w-3.5 shrink-0', moduleConfig.color)} />
                    {prompt}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-gray-300 mt-2">
                Powered by Urban Board AI
              </p>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              {/* Avatar */}
              {msg.role === 'user'
                ? <UserAvatar name={user?.full_name || 'User'} />
                : <AIAvatar />
              }

              <div className={cn('flex flex-col gap-0.5 max-w-[80%]', msg.role === 'user' ? 'items-end' : 'items-start')}>
                {/* Bubble */}
                {msg.role === 'assistant' && msg.run?.status === 'completed' ? (
                  // Success summary card
                  <div className="group rounded-[12px] border border-success/30 bg-success/5 p-3 text-xs">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Check className="h-3.5 w-3.5 text-success" />
                      <span className="font-semibold text-success text-[11px]">Done</span>
                      <span className="ml-auto flex items-center gap-1">
                        <CopyButton text={msg.content} />
                      </span>
                    </div>
                    <div
                      className="text-gray-700 dark:text-gray-300 leading-relaxed text-[12px]"
                      dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                    />
                  </div>
                ) : msg.role === 'assistant' ? (
                  <div className="group flex items-start gap-1 w-full">
                    <div className="flex-1 rounded-[12px] rounded-bl-sm bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                      <div dangerouslySetInnerHTML={renderMarkdown(msg.content)} />
                    </div>
                    <CopyButton text={msg.content} />
                  </div>
                ) : (
                  // User message
                  <div className="group flex items-start gap-1">
                    <CopyButton text={msg.content} />
                    <div className="rounded-[12px] rounded-br-sm bg-primary text-white px-3 py-2 text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <span className="text-[10px] text-gray-300 px-1">
                  {formatDistanceToNow(msg.timestamp, { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}

          {/* ── Plan steps ── */}
          {currentRun && currentRun.steps.length > 0 && (
            <div className="space-y-1.5 pl-8">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Plan · {completedSteps}/{totalSteps}
                </p>
              </div>
              {currentRun.steps.map((step, i) => (
                <PlanStepCard
                  key={step.id}
                  step={step}
                  stepNumber={i + 1}
                  onApprove={() => handleApprove(step.id)}
                  onReject={() => handleReject(step.id)}
                />
              ))}
            </div>
          )}

          {/* ── Approval cards ── */}
          {awaitingApprovalSteps.length > 0 && (
            <div className="space-y-2 pl-8">
              <p className="text-[10px] font-semibold text-warning uppercase tracking-wider">
                Action Required
              </p>
              {awaitingApprovalSteps.map((step) => (
                <ApprovalCard
                  key={`approval-${step.id}`}
                  action={step.action}
                  description={step.description || `Execute ${step.action} with provided arguments`}
                  riskLevel={step.risk_level || 'warn'}
                  args={step.args}
                  onApprove={() => handleApprove(step.id)}
                  onReject={() => handleReject(step.id)}
                />
              ))}
            </div>
          )}

          {/* ── Thinking indicator ── */}
          {thinkingAgent && thinkingMessage && (
            <div className="pl-8">
              <AgentThinkingIndicator agent={thinkingAgent} message={thinkingMessage} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input area ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-3 shrink-0 bg-white dark:bg-gray-900">
          {/* Voice error */}
          {isListening && (
            <div className="mb-2 flex items-center gap-1.5 px-2 py-1 bg-danger/5 rounded-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
              </span>
              <span className="text-[11px] text-danger font-medium">Listening... speak now</span>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Voice button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? 'Stop recording' : 'Voice input'}
                className={cn(
                  'shrink-0 h-[38px] w-[38px] rounded-[10px] flex items-center justify-center transition-all',
                  isListening
                    ? 'bg-danger text-white shadow-md shadow-danger/30 animate-pulse'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}

            {/* Textarea */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={wsStatus === 'connected' ? 'Ask Urban Bad AI...' : 'Reconnecting...'}
              disabled={wsStatus !== 'connected'}
              rows={1}
              className="flex-1 resize-none rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400"
              style={{ minHeight: '38px', maxHeight: '120px' }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`
              }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || wsStatus !== 'connected'}
              className="shrink-0 h-[38px] w-[38px] rounded-[10px] bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isProcessing
                ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )
                : <Send className="h-4 w-4" />
              }
            </button>
          </div>

          {/* Keyboard hint */}
          <p className="text-[10px] text-gray-300 mt-1.5 text-center">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-[9px] font-mono bg-gray-50 dark:bg-gray-800 dark:text-gray-400">⌘ Enter</kbd>
            {' '}to send
            {voiceSupported && (
              <> · <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-[9px] font-mono bg-gray-50 dark:bg-gray-800 dark:text-gray-400">mic</kbd> for voice</>
            )}
          </p>
        </div>
      </div>
    </>
  )
}
