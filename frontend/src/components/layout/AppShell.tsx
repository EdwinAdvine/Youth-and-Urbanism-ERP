import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useLogout } from '../../api/auth'
import Sidebar from './Sidebar'
import { NotificationsDropdown } from './NotificationsDropdown'
import SearchModal from './SearchModal'

const BASE_MODULES = [
  { id: 'home', label: 'Home', icon: '⊞', href: '/' },
  { id: 'finance', label: 'Finance', icon: '💰', href: '/finance' },
  { id: 'hr', label: 'HR', icon: '👥', href: '/hr' },
  { id: 'crm', label: 'CRM', icon: '🤝', href: '/crm' },
  { id: 'projects', label: 'Projects', icon: '📋', href: '/projects' },
  { id: 'inventory', label: 'Inventory', icon: '📦', href: '/inventory' },
  { id: 'supply-chain', label: 'Supply Chain', icon: '🔗', href: '/supply-chain' },
  { id: 'manufacturing', label: 'Manufacturing', icon: '🏭', href: '/manufacturing' },
  { id: 'pos', label: 'POS', icon: '🛒', href: '/pos' },
  { id: 'ecommerce', label: 'E-Commerce', icon: '🛍', href: '/ecommerce' },
  { id: 'support', label: 'Support', icon: '🎫', href: '/support' },
  { id: 'analytics', label: 'Analytics', icon: '📊', href: '/analytics' },
  { id: 'admin', label: 'Admin', icon: '⚙', href: '/admin' },
]

function getVisibleModules(user: ReturnType<typeof useAuthStore.getState>['user']) {
  return BASE_MODULES.filter((mod) => {
    if (mod.id === 'admin') {
      return user?.role === 'superadmin' || user?.role === 'admin'
    }
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

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // Cmd+K / Ctrl+K opens the search modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const navigate = useNavigate()
  const MODULES = getVisibleModules(user)

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* App launcher rail */}
      <div className="w-14 bg-[#51459d] flex flex-col items-center py-3 gap-1 z-30 shrink-0">
        {/* Logo */}
        <button
          onClick={() => setLauncherOpen(!launcherOpen)}
          className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-[8px] flex items-center justify-center text-white font-bold text-xs transition-colors mb-2"
          title="App launcher"
        >
          Y&U
        </button>

        {/* Module quick-launch icons */}
        {MODULES.map((mod) => (
          <button
            key={mod.id}
            onClick={() => navigate(mod.href)}
            className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 rounded-[8px] transition-colors text-base"
            title={mod.label}
          >
            {mod.icon}
          </button>
        ))}
      </div>

      {/* App launcher overlay */}
      {launcherOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setLauncherOpen(false)} />
          <div className="fixed left-14 top-0 h-screen w-72 bg-[#51459d] z-50 p-5 shadow-2xl overflow-y-auto">
            <h3 className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-4">Applications</h3>
            <div className="grid grid-cols-3 gap-2">
              {MODULES.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => { navigate(mod.href); setLauncherOpen(false) }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-[10px] hover:bg-white/15 transition-colors text-white"
                >
                  <span className="text-2xl">{mod.icon}</span>
                  <span className="text-xs font-medium">{mod.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-3 shrink-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-[8px] hover:bg-gray-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Search trigger */}
          <div className="flex-1 max-w-md">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full flex items-center gap-2 pl-3 pr-4 py-1.5 text-sm rounded-[10px] border border-gray-200 bg-gray-50 text-gray-400 hover:bg-white hover:border-primary/40 transition-all text-left"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Search anything...</span>
              <span className="ml-auto text-xs border border-gray-200 rounded px-1.5 py-0.5 hidden sm:inline">⌘K</span>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* AI assistant quick button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI
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
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[10px] hover:bg-gray-100 transition-colors"
              >
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
                  {user?.full_name}
                </span>
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-[10px] shadow-xl border border-gray-100 z-50 py-1">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <span className="inline-flex mt-1 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                        {user?.role}
                      </span>
                    </div>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => { navigate('/profile'); setUserMenuOpen(false) }}
                    >
                      My Profile
                    </button>
                    {(user?.role === 'superadmin' || user?.role === 'admin') && (
                      <button
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
                    <hr className="my-1 border-gray-100" />
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-50 transition-colors"
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

      {/* Global search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
