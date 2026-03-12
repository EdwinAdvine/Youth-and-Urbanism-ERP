import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useDashboardStats, useDashboardActivity } from '../../api/dashboard'
import AIChat from './AIChat'

interface AppTile {
  id: string
  label: string
  icon: string
  href: string
  color: string
  description: string
}

const APP_TILES: AppTile[] = [
  { id: 'finance',       label: 'Finance',       icon: '💰', href: '/finance',       color: 'from-emerald-400 to-emerald-600',  description: 'Invoices & accounting' },
  { id: 'hr',            label: 'HR',            icon: '👥', href: '/hr',            color: 'from-blue-400 to-blue-600',        description: 'People management' },
  { id: 'crm',           label: 'CRM',           icon: '🤝', href: '/crm',           color: 'from-purple-400 to-purple-600',    description: 'Leads & deals' },
  { id: 'projects',      label: 'Projects',      icon: '📋', href: '/projects',      color: 'from-orange-400 to-orange-600',    description: 'Tasks & timelines' },
  { id: 'inventory',     label: 'Inventory',     icon: '📦', href: '/inventory',     color: 'from-pink-400 to-pink-600',        description: 'Stock & products' },
  { id: 'analytics',     label: 'Analytics',     icon: '📊', href: '/analytics',     color: 'from-indigo-400 to-indigo-600',    description: 'Reports & insights' },
  { id: 'mail',          label: 'Mail',          icon: '✉️',  href: '/mail',          color: 'from-sky-400 to-sky-600',          description: 'Email & messages' },
  { id: 'calendar',      label: 'Calendar',      icon: '📅', href: '/calendar',      color: 'from-rose-400 to-rose-600',        description: 'Schedule & events' },
  { id: 'teams',         label: 'Teams',         icon: '🎥', href: '/teams',         color: 'from-violet-400 to-violet-600',    description: 'Video meetings' },
  { id: 'docs',          label: 'Docs',          icon: '📄', href: '/docs',          color: 'from-teal-400 to-teal-600',        description: 'Documents & files' },
  { id: 'notes',         label: 'Notes',         icon: '📝', href: '/notes',         color: 'from-yellow-400 to-yellow-500',    description: 'Quick notes' },
  { id: 'drive',         label: 'Drive',         icon: '💾', href: '/drive',         color: 'from-cyan-400 to-cyan-600',        description: 'File storage' },
  { id: 'pos',           label: 'POS',           icon: '🛒', href: '/pos',           color: 'from-lime-400 to-lime-600',        description: 'Point of sale' },
  { id: 'ecommerce',     label: 'E-Commerce',    icon: '🛍️', href: '/ecommerce',     color: 'from-fuchsia-400 to-fuchsia-600', description: 'Online store & orders' },
  { id: 'supplychain',   label: 'Supply Chain',  icon: '🚚', href: '/supply-chain',  color: 'from-amber-400 to-amber-600',     description: 'Procurement & vendors' },
  { id: 'manufacturing', label: 'Manufacturing', icon: '🏭', href: '/manufacturing', color: 'from-stone-400 to-stone-600',     description: 'Production & BOM' },
  { id: 'support',       label: 'Support',       icon: '🎧', href: '/support',       color: 'from-red-400 to-red-600',         description: 'Help desk & tickets' },
  { id: 'forms',         label: 'Forms',         icon: '📋', href: '/forms',         color: 'from-green-400 to-green-600',     description: 'Surveys & forms' },
  { id: 'handbook',      label: 'Handbook',      icon: '📖', href: '/handbook',      color: 'from-blue-300 to-blue-500',       description: 'Company wiki' },
  { id: 'loyalty',       label: 'Loyalty',       icon: '⭐', href: '/loyalty',       color: 'from-yellow-500 to-orange-500',   description: 'Rewards & loyalty' },
  { id: 'kds',           label: 'KDS',           icon: '🖥️', href: '/kds',           color: 'from-gray-500 to-gray-700',       description: 'Kitchen display' },
  { id: 'settings',      label: 'Settings',      icon: '⚙️',  href: '/settings',      color: 'from-gray-400 to-gray-600',       description: 'Configuration' },
]

const MODULE_ICONS: Record<string, { icon: string; color: string }> = {
  finance: { icon: '💰', color: 'text-emerald-600 bg-emerald-50' },
  hr: { icon: '👥', color: 'text-blue-600 bg-blue-50' },
  crm: { icon: '🤝', color: 'text-purple-600 bg-purple-50' },
  projects: { icon: '📋', color: 'text-orange-600 bg-orange-50' },
  drive: { icon: '💾', color: 'text-cyan-600 bg-cyan-50' },
  calendar: { icon: '📅', color: 'text-rose-600 bg-rose-50' },
  meetings: { icon: '🎥', color: 'text-violet-600 bg-violet-50' },
  mail: { icon: '✉️', color: 'text-sky-600 bg-sky-50' },
  inventory: { icon: '📦', color: 'text-pink-600 bg-pink-50' },
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [chatMode, setChatMode] = useState(false)
  const [initialQuestion, setInitialQuestion] = useState('')
  const [quickInput, setQuickInput] = useState('')
  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  const { data: stats } = useDashboardStats()
  const { data: activity } = useDashboardActivity(8)

  const liveStats = [
    { label: 'Revenue MTD', value: stats?.finance?.revenue_mtd != null ? formatCurrency(stats.finance.revenue_mtd) : '—' },
    { label: 'Open Invoices', value: stats?.finance?.outstanding_invoices != null ? String(stats.finance.outstanding_invoices) : '—' },
    { label: 'Active Projects', value: stats?.projects?.active_projects != null ? String(stats.projects.active_projects) : '—' },
    { label: 'Staff Present', value: stats?.hr?.headcount != null ? `${stats.hr.headcount - (stats.hr.on_leave_today ?? 0)}/${stats.hr.headcount}` : '—' },
  ]

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (quickInput.trim()) {
      setInitialQuestion(quickInput)
      setChatMode(true)
    }
  }

  if (chatMode) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
          <button
            onClick={() => { setChatMode(false); setInitialQuestion(''); setQuickInput('') }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Urban AI Assistant</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <AIChat
            fullPage
            initialMessage={initialQuestion}
            onClose={() => { setChatMode(false); setInitialQuestion(''); setQuickInput('') }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-[#51459d] via-[#3d3480] to-[#2a2560] px-6 py-12 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/60 text-sm font-medium mb-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-white/70 mb-8">What would you like to accomplish today?</p>

          {/* AI input */}
          <form onSubmit={handleQuickSubmit} className="relative max-w-2xl mx-auto">
            <div className="flex items-center bg-white/10 backdrop-blur rounded-2xl border border-white/20 focus-within:bg-white/15 focus-within:border-white/40 transition-all">
              <div className="pl-5 text-white/50 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder="Ask the AI anything — 'Show me this month's revenue' or 'Who's on leave today?'"
                className="flex-1 bg-transparent px-4 py-4 text-sm text-white placeholder:text-white/50 focus:outline-none"
              />
              <button
                type="submit"
                onClick={() => { if (quickInput.trim()) { setInitialQuestion(quickInput); setChatMode(true) } }}
                className="mr-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-white text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Ask
              </button>
            </div>
          </form>

          {/* Quick suggestions */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {['Revenue this month?', 'Staff on leave today', 'Low stock alerts', 'Overdue invoices'].map((s) => (
              <button
                key={s}
                onClick={() => { setInitialQuestion(s); setChatMode(true) }}
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-xs transition-colors border border-white/15"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {liveStats.map((stat) => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* App grid */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Applications</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {APP_TILES.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => navigate(tile.href)}
                  className="flex flex-col items-center gap-2 p-3 rounded-[10px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group text-center"
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tile.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform`}>
                    {tile.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tile.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{tile.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Activity</h2>
            </div>
            <div className="space-y-3">
              {activity && activity.length > 0 ? (
                activity.map((item) => {
                  const mod = MODULE_ICONS[item.module] || { icon: '📌', color: 'text-gray-600 bg-gray-50' }
                  return (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${mod.color}`}>
                        {mod.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{item.message}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(item.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No recent activity yet. Start using the ERP modules!</p>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
