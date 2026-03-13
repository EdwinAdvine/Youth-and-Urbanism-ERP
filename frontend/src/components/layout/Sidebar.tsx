/**
 * Sidebar — secondary per-module navigation panel for Urban Vibes Dynamics.
 *
 * Renders a collapsible sidebar showing the sub-navigation menu for whichever
 * module is currently active (derived from the first URL segment). Menu
 * definitions live in `sidebarMenus.tsx` — one `AppMenu` per module.
 *
 * Role-gating: menus that declare a `roles` array are hidden from users whose
 * role is not in the list (e.g. the Admin menu requires `super_admin`).
 *
 * Returns `null` (hides completely) when:
 * - The current route has no matching menu (e.g. `/` home)
 * - The user's role does not satisfy the menu's role requirement
 *
 * Delegates the actual nav-link rendering to `SidebarContent` which handles
 * group collapsing and route pre-loading on hover.
 */
import { memo } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../ui'
import { useAuthStore } from '../../store/auth'
import { APP_SUBMENUS } from './sidebarMenus'
import SidebarContent from './SidebarContent'

function getActiveApp(pathname: string): string {
  if (pathname === '/') return ''
  const segment = pathname.split('/')[1]
  return segment || ''
}

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

function SidebarInner({ open, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  const activeApp = getActiveApp(location.pathname)
  const menu = activeApp ? APP_SUBMENUS[activeApp] : null

  // Role check for restricted menus (e.g. admin)
  const canAccess = !menu?.roles || (user && menu.roles.includes(user.role))

  if (!menu || !canAccess) return null

  return (
    <aside
      className={cn(
        'h-full bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col transition-all duration-200 shrink-0 z-20',
        // Hidden on mobile — MobileDrawer handles navigation there
        'hidden lg:flex',
        open ? 'w-52' : 'w-0 overflow-hidden'
      )}
    >
      {/* App label header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{menu.label}</p>
        <button
          onClick={onToggle}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Collapse sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Sub-navigation — shared component with MobileDrawer */}
      <SidebarContent
        menu={menu}
        activeApp={activeApp}
        pathname={location.pathname}
      />

      {/* Bottom user info */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U'}
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

export default memo(SidebarInner)
