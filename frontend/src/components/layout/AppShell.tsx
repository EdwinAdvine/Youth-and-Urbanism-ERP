import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useAISidebarStore } from '../../store/aiSidebar'
import { useThemeStore } from '../../store/theme'
import { useLogout } from '../../api/auth'
import Sidebar from './Sidebar'
import { NotificationsDropdown } from './NotificationsDropdown'
import SearchModal from './SearchModal'
import AISidebar from '../ai/AISidebar'

// All apps in the primary rail — grouped for visual clarity in source
const BASE_MODULES = [
  // Core
  { id: 'home', label: 'Home', href: '/', icon: <HomeIcon /> },
  // Business
  { id: 'finance', label: 'Finance', href: '/finance', icon: <FinanceIcon /> },
  { id: 'hr', label: 'HR', href: '/hr', icon: <HRIcon /> },
  { id: 'crm', label: 'CRM', href: '/crm', icon: <CRMIcon /> },
  { id: 'projects', label: 'Projects', href: '/projects', icon: <ProjectsIcon /> },
  { id: 'inventory', label: 'Inventory', href: '/inventory', icon: <InventoryIcon /> },
  { id: 'supply-chain', label: 'Supply Chain', href: '/supply-chain', icon: <SupplyChainIcon /> },
  { id: 'manufacturing', label: 'Manufacturing', href: '/manufacturing', icon: <ManufacturingIcon /> },
  { id: 'pos', label: 'POS', href: '/pos', icon: <POSIcon /> },
  { id: 'kds', label: 'KDS', href: '/kds', icon: <KDSIcon /> },
  { id: 'loyalty', label: 'Loyalty', href: '/loyalty', icon: <LoyaltyIcon /> },
  { id: 'ecommerce', label: 'E-Commerce', href: '/ecommerce', icon: <ECommerceIcon /> },
  { id: 'support', label: 'Support', href: '/support', icon: <SupportIcon /> },
  // Workspace
  { id: 'mail', label: 'Mail', href: '/mail', icon: <MailIcon /> },
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  { id: 'teams', label: 'Teams', href: '/teams', icon: <TeamsIcon /> },
  { id: 'docs', label: 'Docs', href: '/docs', icon: <DocsIcon /> },
  { id: 'drive', label: 'Drive', href: '/drive', icon: <DriveIcon /> },
  { id: 'notes', label: 'Notes', href: '/notes', icon: <NotesIcon /> },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: <AnalyticsIcon /> },
  { id: 'forms', label: 'Forms', href: '/forms', icon: <FormsIcon /> },
  { id: 'handbook', label: 'Handbook', href: '/handbook', icon: <HandbookIcon /> },
  // System
  { id: 'settings', label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
  { id: 'admin', label: 'Admin', href: '/admin', icon: <AdminIcon />, roles: ['superadmin', 'admin'] },
]

function getVisibleModules(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return BASE_MODULES.filter((mod) => {
    if (mod.roles) return user && mod.roles.includes(user.role)
    return true
  }).map((mod) => {
    if (mod.id === 'admin' && user) {
      if (user.role === 'superadmin') return mod
      if (user.role === 'admin') {
        if (user.app_admin_scopes?.length === 1) return { ...mod, href: `/admin/apps/${user.app_admin_scopes[0]}` }
        return { ...mod, href: '/admin/my-modules' }
      }
    }
    return mod
  })
}

function getActiveApp(pathname: string): string {
  if (pathname === '/') return 'home'
  return pathname.split('/')[1] || 'home'
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const aiSidebarIsOpen = useAISidebarStore((s) => s.isOpen)
  const aiSidebarToggle = useAISidebarStore((s) => s.toggle)
  const setTheme = useThemeStore((s) => s.setTheme)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)

  // Cmd+K / Ctrl+K opens the search modal; Cmd+Shift+A toggles AI sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        aiSidebarToggle()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [aiSidebarToggle])

  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const location = useLocation()

  const MODULES = getVisibleModules(user)
  const activeApp = getActiveApp(location.pathname)

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  // Auto-open secondary sidebar when entering an app (if it was manually closed)
  useEffect(() => {
    if (activeApp !== 'home') {
      setSidebarOpen(true)
    }
  }, [activeApp])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Primary rail ─────────────────────────────────────────── */}
      <div className="w-14 bg-[#51459d] flex flex-col items-center py-3 gap-0.5 z-30 shrink-0 overflow-y-auto overflow-x-hidden scrollbar-none">
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-[8px] flex items-center justify-center text-white font-bold text-xs transition-colors mb-3 shrink-0"
          title="Home"
        >
          Y&U
        </button>

        {/* Module icons */}
        {MODULES.map((mod) => {
          const isActive = mod.id === 'home'
            ? activeApp === 'home'
            : activeApp === mod.id

          return (
            <div key={mod.id} className="relative group w-full flex justify-center shrink-0">
              <button
                onClick={() => navigate(mod.href)}
                className={`w-9 h-9 flex items-center justify-center rounded-[8px] transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/15'
                }`}
              >
                {mod.icon}
              </button>
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-[6px] whitespace-nowrap shadow-lg">
                  {mod.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Secondary contextual sidebar ─────────────────────────── */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* ── Main area ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-4 gap-3 shrink-0 z-20">
          {/* Global search */}
          <div className="flex-1 max-w-md">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 pl-3 pr-4 py-1.5 text-sm rounded-[10px] border border-gray-200 bg-gray-50 text-gray-400 hover:bg-white hover:border-primary/40 transition-all text-left dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search anything...</span>
              <span className="ml-auto text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 hidden sm:inline">⌘K</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* AI assistant quick button */}
            <button
              onClick={() => aiSidebarToggle()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-colors ${
                aiSidebarIsOpen
                  ? 'bg-primary text-white'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
              title="Toggle Urban Bad AI (Cmd+Shift+A)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-[8px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={resolvedTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme() === 'dark' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Notifications */}
            <NotificationsDropdown
              open={notifOpen}
              onToggle={() => setNotifOpen(!notifOpen)}
              onClose={() => setNotifOpen(false)}
            />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block max-w-[120px] truncate">
                  {user?.full_name}
                </span>
                <svg className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-[10px] shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-1">
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.full_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                      <span className="inline-flex mt-1 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {user?.role}
                      </span>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      onClick={() => { navigate('/profile'); setUserMenuOpen(false) }}
                    >
                      My Profile
                    </button>
                    {(user?.role === 'superadmin' || user?.role === 'admin') && (
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => {
                          const adminHref = user?.role === 'superadmin'
                            ? '/admin'
                            : user?.app_admin_scopes?.length === 1
                              ? `/admin/apps/${user.app_admin_scopes[0]}`
                              : '/admin/my-modules'
                          navigate(adminHref)
                          setUserMenuOpen(false)
                        }}
                      >
                        Admin Panel
                      </button>
                    )}
                    <hr className="my-1 border-gray-100 dark:border-gray-800" />
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      onClick={() => logout.mutate()}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Urban Bad AI sidebar */}
      <AISidebar />

      {/* WhatsApp floating button */}
      <a
        href="https://web.whatsapp.com"
        target="_blank"
        rel="noopener noreferrer"
        title="Open WhatsApp"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* Global search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

// ─── Rail icon components ──────────────────────────────────────────────────────

function RailIcon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={path} />
    </svg>
  )
}

function HomeIcon() {
  return <RailIcon path="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
}
function FinanceIcon() {
  return <RailIcon path="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
}
function HRIcon() {
  return <RailIcon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
}
function CRMIcon() {
  return <RailIcon path="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
}
function ProjectsIcon() {
  return <RailIcon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
}
function InventoryIcon() {
  return <RailIcon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
}
function SupplyChainIcon() {
  return <RailIcon path="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
}
function ManufacturingIcon() {
  return <RailIcon path="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
}
function POSIcon() {
  return <RailIcon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
}
function ECommerceIcon() {
  return <RailIcon path="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
}
function SupportIcon() {
  return <RailIcon path="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
}
function MailIcon() {
  return <RailIcon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
}
function CalendarIcon() {
  return <RailIcon path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
}
function TeamsIcon() {
  return <RailIcon path="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
}
function DocsIcon() {
  return <RailIcon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
}
function DriveIcon() {
  return <RailIcon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
}
function NotesIcon() {
  return <RailIcon path="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
}
function AnalyticsIcon() {
  return <RailIcon path="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
}
function FormsIcon() {
  return <RailIcon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
}
function HandbookIcon() {
  return <RailIcon path="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
}
function SettingsIcon() {
  return <RailIcon path="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
}
function AdminIcon() {
  return <RailIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
}
function KDSIcon() {
  return <RailIcon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
}
function LoyaltyIcon() {
  return <RailIcon path="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
}
