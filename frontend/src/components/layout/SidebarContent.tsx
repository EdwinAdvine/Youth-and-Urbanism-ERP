/**
 * SidebarContent — collapsible nav-group renderer for the module sidebar.
 *
 * Accepts an `AppMenu` (from `sidebarMenus.tsx`) and renders its groups as
 * collapsible sections with `NavLink` items. Group expanded/collapsed state
 * is persisted in `localStorage` under the key `urban-vibes-dynamics-sidebar-groups`
 * so the sidebar remembers which groups were open across page refreshes.
 *
 * Highlights the active route using React Router's `NavLink` `isActive` prop.
 * Preloads the target route chunk on mouse-enter via `utils/routePreloads`
 * for near-instant navigation on hover.
 *
 * Wrapped in `React.memo` to prevent re-renders when the parent re-renders
 * for unrelated reasons (e.g. notification badge updates in the header).
 */
import { useState, useCallback, memo } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../ui'
import { preloadRoute } from '../../utils/routePreloads'
import type { AppMenu, MenuGroup } from './sidebarMenus'

const STORAGE_KEY = 'urban-vibes-dynamics-sidebar-groups'

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

function groupHasActiveItem(group: MenuGroup, pathname: string): boolean {
  return group.items.some((item) =>
    item.href === pathname ||
    (item.href !== '/' && pathname.startsWith(item.href + '/')) ||
    (item.href !== '/' && pathname === item.href)
  )
}

interface SidebarContentProps {
  menu: AppMenu
  activeApp: string
  pathname: string
}

function SidebarContentInner({ menu, activeApp, pathname }: SidebarContentProps) {
  const [groupState, setGroupState] = useState<Record<string, boolean>>(loadGroupState)

  const toggleGroup = useCallback((key: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      saveGroupState(next)
      return next
    })
  }, [])

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2">
      {menu.groups.map((group) => {
        const hasActive = groupHasActiveItem(group, pathname)
        const groupKey = `${activeApp}::${group.label}`
        const userOverride = groupState[groupKey]
        const isOpen = userOverride !== undefined
          ? userOverride
          : (group.defaultOpen ?? false) || hasActive

        const singleGroup = menu.groups.length === 1

        return (
          <div key={group.label} className="mb-1">
            {!singleGroup && (
              <button
                onClick={() => toggleGroup(groupKey)}
                className="flex items-center justify-between w-full px-3 py-1.5 min-h-[44px] rounded-[6px] text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
              >
                <span>{group.label}</span>
                <ChevronIcon open={isOpen} />
              </button>
            )}

            {(singleGroup || isOpen) && (
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === `/${activeApp}`
                    ? pathname === item.href || pathname === `/${activeApp}`
                    : pathname === item.href ||
                      pathname.startsWith(item.href + '/')

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      end={item.href === `/${activeApp}`}
                      onMouseEnter={() => preloadRoute(item.href)}
                      onFocus={() => preloadRoute(item.href)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-[8px] text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 active:bg-gray-200 dark:active:bg-gray-700'
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
  )
}

export default memo(SidebarContentInner)
