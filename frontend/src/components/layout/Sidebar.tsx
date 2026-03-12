import { useState, useEffect, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../ui'
import { useAuthStore } from '../../store/auth'
import { preloadRoute } from '../../utils/routePreloads'
import { APP_SUBMENUS, type MenuGroup } from './sidebarMenus'

const STORAGE_KEY = 'urban-erp-sidebar-groups'

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveGroupState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 shrink-0 transition-transform duration-200', open ? 'rotate-90' : '')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function getActiveApp(pathname: string): string {
  if (pathname === '/') return ''
  const segment = pathname.split('/')[1]
  return segment || ''
}

function groupHasActiveItem(group: MenuGroup, pathname: string): boolean {
  return group.items.some((item) =>
    item.href === pathname ||
    (item.href !== '/' && pathname.startsWith(item.href + '/')) ||
    (item.href !== '/' && pathname === item.href)
  )
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const activeApp = getActiveApp(location.pathname)
  const menu = activeApp ? APP_SUBMENUS[activeApp] : null

  // Role check for restricted menus (e.g. admin)
  const canAccess = !menu?.roles || (user && menu.roles.includes(user.role))

  // Persisted open/closed state per group key
  const [groupState, setGroupState] = useState<Record<string, boolean>>(loadGroupState)

  // Reset saved state when switching apps so defaults apply freshly
  const [lastApp, setLastApp] = useState(activeApp)
  useEffect(() => {
    if (activeApp !== lastApp) {
      setLastApp(activeApp)
      // Don't wipe saved state — just let the active-group auto-expand handle it
    }
  }, [activeApp, lastApp])

  const toggleGroup = useCallback((key: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      saveGroupState(next)
      return next
    })
  }, [])

  if (!menu || !canAccess) return null

  return (
    <aside
      className={cn(
        'h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-200 shrink-0 z-20',
        open ? 'w-52' : 'w-0 overflow-hidden'
      )}
    >
      {/* App label header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{menu.label}</p>
        <button
          onClick={onToggle}
          className="p-1 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Collapse sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Sub-navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {menu.groups.map((group) => {
          const hasActive = groupHasActiveItem(group, location.pathname)
          // Determine open state: if user has toggled it, use their preference;
          // otherwise fall back to defaultOpen or auto-open if it has the active route.
          const groupKey = `${activeApp}::${group.label}`
          const userOverride = groupState[groupKey]
          const isOpen = userOverride !== undefined
            ? userOverride
            : (group.defaultOpen ?? false) || hasActive

          // Single-group menus (mail, calendar, etc.) skip the collapsible header
          const singleGroup = menu.groups.length === 1

          return (
            <div key={group.label} className="mb-1">
              {!singleGroup && (
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="flex items-center justify-between w-full px-3 py-1.5 rounded-[6px] text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronIcon open={isOpen} />
                </button>
              )}

              {(singleGroup || isOpen) && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    // Exact match for module root, prefix match for sub-pages
                    const isActive = item.href === `/${activeApp}`
                      ? location.pathname === item.href || location.pathname === `/${activeApp}`
                      : location.pathname === item.href ||
                        location.pathname.startsWith(item.href + '/')

                    return (
                      <NavLink
                        key={item.href}
                        to={item.href}
                        end={item.href === `/${activeApp}`}
                        onMouseEnter={() => preloadRoute(item.href)}
                        onFocus={() => preloadRoute(item.href)}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom user info */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
