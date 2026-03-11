import { useState } from 'react'
import { useLinkedItems, useLinkItem, useUnlinkItem, type LinkedItem } from '../../api/notes'

const MODULE_ICONS: Record<string, { icon: string; color: string }> = {
  task: { icon: '✓', color: 'bg-blue-100 text-blue-700' },
  file: { icon: '📄', color: 'bg-teal-100 text-teal-700' },
  drive: { icon: '📄', color: 'bg-teal-100 text-teal-700' },
  calendar: { icon: '📅', color: 'bg-violet-100 text-violet-700' },
  contact: { icon: '👤', color: 'bg-green-100 text-green-700' },
  invoice: { icon: '💰', color: 'bg-yellow-100 text-yellow-700' },
  lead: { icon: '🎯', color: 'bg-purple-100 text-purple-700' },
  deal: { icon: '🤝', color: 'bg-orange-100 text-orange-700' },
  project: { icon: '📊', color: 'bg-cyan-100 text-cyan-700' },
  projects: { icon: '📊', color: 'bg-cyan-100 text-cyan-700' },
  employee: { icon: '👥', color: 'bg-indigo-100 text-indigo-700' },
  ticket: { icon: '🎫', color: 'bg-red-100 text-red-700' },
  default: { icon: '🔗', color: 'bg-gray-100 text-gray-700' },
}

const LINKABLE_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'file', label: 'Drive File' },
  { value: 'calendar', label: 'Calendar Event' },
  { value: 'contact', label: 'Contact' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'project', label: 'Project' },
  { value: 'employee', label: 'Employee' },
  { value: 'ticket', label: 'Support Ticket' },
]

interface Props {
  noteId: string
  onClose: () => void
}

export default function LinkedItemsSidebar({ noteId, onClose }: Props) {
  const { data: items, isLoading } = useLinkedItems(noteId)
  const linkItem = useLinkItem()
  const unlinkItem = useUnlinkItem()

  const [showAddForm, setShowAddForm] = useState(false)
  const [linkType, setLinkType] = useState('task')
  const [linkId, setLinkId] = useState('')

  const handleLink = () => {
    if (!linkId.trim()) return
    linkItem.mutate(
      { noteId, item_type: linkType, item_id: linkId.trim() },
      {
        onSuccess: () => {
          setLinkId('')
          setShowAddForm(false)
        },
      },
    )
  }

  const handleUnlink = (item: LinkedItem) => {
    if (!confirm(`Remove link to "${item.title}"?`)) return
    unlinkItem.mutate({ noteId, linkId: item.id })
  }

  const getModuleConfig = (module: string) => MODULE_ICONS[module] ?? MODULE_ICONS.default

  return (
    <div className="w-72 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Linked Items</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-1 hover:bg-[#51459d]/10 rounded-[6px] text-[#51459d] transition-colors"
            title="Add link"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add link form */}
      {showAddForm && (
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2 bg-gray-50 dark:bg-gray-950">
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
          >
            {LINKABLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            placeholder="Item ID or search..."
            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
            onKeyDown={(e) => e.key === 'Enter' && handleLink()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleLink}
              disabled={!linkId.trim() || linkItem.isPending}
              className="flex-1 text-xs bg-[#51459d] text-white py-1.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {linkItem.isPending ? 'Linking...' : 'Add Link'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <svg className="h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-xs text-gray-400">No linked items</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Link tasks, contacts, invoices and more
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const cfg = getModuleConfig(item.module)
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-2.5 p-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className={`w-7 h-7 rounded-[6px] ${cfg.color} flex items-center justify-center text-xs font-bold shrink-0`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{item.module}</p>
                  </div>
                  <button
                    onClick={() => handleUnlink(item)}
                    className="p-1 text-gray-300 hover:text-red-500 rounded-[4px] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Remove link"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
