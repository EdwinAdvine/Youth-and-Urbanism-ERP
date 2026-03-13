/**
 * ERPWidgetCard — Embeddable live ERP data widget for Y&U Notes.
 *
 * Shows real-time data for: Invoice | Project | Deal | Employee | Ticket
 * Used inline inside notes to display contextual ERP information.
 */
import { useState } from 'react'
import { useERPWidget, type ERPWidgetType } from '../../api/notebooks'

// ── Icons ─────────────────────────────────────────────────────────────────────

const WIDGET_META: Record<ERPWidgetType, { label: string; icon: string; color: string }> = {
  invoice: { label: 'Invoice', icon: '🧾', color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900' },
  project: { label: 'Project', icon: '📋', color: 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900' },
  deal: { label: 'Deal', icon: '🤝', color: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900' },
  employee: { label: 'Employee', icon: '👤', color: 'bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900' },
  ticket: { label: 'Support Ticket', icon: '🎫', color: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900' },
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    sent: 'bg-blue-100 text-blue-700',
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
    open: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
    escalated: 'bg-red-100 text-red-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-red-100 text-red-700',
  }
  const cls = colors[status?.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${cls}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

// ── Widget body renderers ─────────────────────────────────────────────────────

function InvoiceWidget({ data }: { data: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{data.invoice_number}</span>
        <StatusBadge status={data.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-gray-400">Client</span>
        <span className="text-gray-700 dark:text-gray-300 truncate">{data.client_name}</span>
        <span className="text-gray-400">Amount</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{data.currency} {Number(data.total_amount).toLocaleString()}</span>
        {data.amount_due > 0 && <>
          <span className="text-gray-400">Amount Due</span>
          <span className="text-red-600 font-medium">{data.currency} {Number(data.amount_due).toLocaleString()}</span>
        </>}
        {data.due_date && <>
          <span className="text-gray-400">Due Date</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(data.due_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </>}
      </div>
    </div>
  )
}

function ProjectWidget({ data }: { data: any }) {
  const pct = data.total_tasks > 0 ? Math.round((data.completed_tasks / data.total_tasks) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate flex-1">{data.name}</span>
        <StatusBadge status={data.status} />
      </div>
      {data.description && (
        <p className="text-[10px] text-gray-500 line-clamp-1">{data.description}</p>
      )}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Progress</span>
          <span>{pct}% ({data.completed_tasks}/{data.total_tasks} tasks)</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#51459d] rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {data.start_date && <>
          <span className="text-gray-400">Start</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(data.start_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
        </>}
        {data.end_date && <>
          <span className="text-gray-400">End</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(data.end_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
        </>}
        {data.in_progress_tasks > 0 && <>
          <span className="text-gray-400">In Progress</span>
          <span className="text-blue-600">{data.in_progress_tasks}</span>
        </>}
      </div>
    </div>
  )
}

function DealWidget({ data }: { data: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate flex-1">{data.title}</span>
        <StatusBadge status={data.status} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {data.value > 0 && <>
          <span className="text-gray-400">Value</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">{Number(data.value).toLocaleString()}</span>
        </>}
        <span className="text-gray-400">Stage</span>
        <span className="text-gray-700 dark:text-gray-300 capitalize">{data.stage?.replace(/_/g, ' ')}</span>
        {data.score !== undefined && <>
          <span className="text-gray-400">Lead Score</span>
          <span className="text-gray-700 dark:text-gray-300">{data.score}</span>
        </>}
        {data.expected_close && <>
          <span className="text-gray-400">Close Date</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(data.expected_close).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
        </>}
      </div>
    </div>
  )
}

function EmployeeWidget({ data }: { data: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-[#51459d]/10 flex items-center justify-center text-sm font-bold text-[#51459d] shrink-0">
          {data.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{data.name}</p>
          {data.job_title && <p className="text-[10px] text-gray-400 truncate">{data.job_title}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {data.department && <>
          <span className="text-gray-400">Department</span>
          <span className="text-gray-700 dark:text-gray-300">{data.department}</span>
        </>}
        {data.email && <>
          <span className="text-gray-400">Email</span>
          <a href={`mailto:${data.email}`} className="text-[#51459d] hover:underline truncate">{data.email}</a>
        </>}
        {data.phone && <>
          <span className="text-gray-400">Phone</span>
          <span className="text-gray-700 dark:text-gray-300">{data.phone}</span>
        </>}
        {data.status && <>
          <span className="text-gray-400">Status</span>
          <StatusBadge status={data.employment_status ?? data.status} />
        </>}
      </div>
    </div>
  )
}

function TicketWidget({ data }: { data: any }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate flex-1">{data.title}</span>
        <StatusBadge status={data.status} />
      </div>
      {data.ticket_number && (
        <p className="text-[10px] text-gray-400">#{data.ticket_number}</p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-gray-400">Priority</span>
        <StatusBadge status={data.priority} />
        {data.customer_name && <>
          <span className="text-gray-400">Customer</span>
          <span className="text-gray-700 dark:text-gray-300 truncate">{data.customer_name}</span>
        </>}
        {data.category && <>
          <span className="text-gray-400">Category</span>
          <span className="text-gray-700 dark:text-gray-300 capitalize">{data.category}</span>
        </>}
        {data.created_at && <>
          <span className="text-gray-400">Created</span>
          <span className="text-gray-700 dark:text-gray-300">{new Date(data.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
        </>}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-2 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-2 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-2 w-3/4 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ERPWidgetCardProps {
  type: ERPWidgetType
  entityId: string
  onRemove?: () => void
}

export default function ERPWidgetCard({ type, entityId, onRemove }: ERPWidgetCardProps) {
  const { data, isLoading, isError } = useERPWidget(type, entityId)
  const meta = WIDGET_META[type]

  return (
    <div className={`rounded-[10px] border p-3 ${meta.color} relative group`}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{meta.label}</span>
        <div className="flex-1" />
        {onRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all rounded"
            title="Remove widget"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      {isLoading && <WidgetSkeleton />}
      {isError && (
        <p className="text-[11px] text-red-500">Failed to load {meta.label.toLowerCase()} data.</p>
      )}
      {data && !isLoading && (
        <>
          {type === 'invoice' && <InvoiceWidget data={data} />}
          {type === 'project' && <ProjectWidget data={data} />}
          {type === 'deal' && <DealWidget data={data} />}
          {type === 'employee' && <EmployeeWidget data={data} />}
          {type === 'ticket' && <TicketWidget data={data} />}
        </>
      )}
    </div>
  )
}

// ── ERPWidgetPicker — inline dialog to add a widget ──────────────────────────

interface ERPWidgetPickerProps {
  onAdd: (type: ERPWidgetType, entityId: string) => void
  onClose: () => void
}

export function ERPWidgetPicker({ onAdd, onClose }: ERPWidgetPickerProps) {
  const [selectedType, setSelectedType] = useState<ERPWidgetType>('invoice')
  const [entityId, setEntityId] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-[12px] shadow-xl w-80 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Add ERP Widget</h3>
        <p className="text-[11px] text-gray-400 mb-4">Embed live ERP data directly in your note.</p>

        {/* Type selector */}
        <div className="grid grid-cols-5 gap-1 mb-4">
          {(Object.entries(WIDGET_META) as [ERPWidgetType, typeof WIDGET_META[ERPWidgetType]][]).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-[8px] border transition-colors ${
                selectedType === type
                  ? 'border-[#51459d] bg-[#51459d]/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
              title={meta.label}
            >
              <span className="text-lg">{meta.icon}</span>
              <span className="text-[8px] text-gray-500">{meta.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Entity ID input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {WIDGET_META[selectedType].label} ID
          </label>
          <input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Paste UUID..."
            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { if (entityId.trim()) { onAdd(selectedType, entityId.trim()); onClose() } }}
            disabled={!entityId.trim()}
            className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            Add Widget
          </button>
          <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
        </div>
      </div>
    </div>
  )
}

