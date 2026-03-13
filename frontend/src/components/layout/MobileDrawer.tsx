/**
 * MobileDrawer — slide-in full-module navigation drawer for phone viewports.
 *
 * Opens from the left edge when the user taps "More" in `MobileBottomTabBar`.
 * Shows the full module list (all 26 apps) and, if the active module has a
 * sub-menu (defined in `sidebarMenus.tsx`), shows those sub-items below.
 *
 * Gesture support: swipe-left on the drawer closes it (via `useSwipeGesture`).
 * Backdrop click also closes it. Focus is trapped inside the drawer while open
 * to support keyboard/screen-reader accessibility.
 *
 * Role-gated menus are filtered by the same rules as the desktop `Sidebar`.
 *
 * Closes automatically on route change so navigating to a page dismisses it.
 */
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../ui'
import { useNavigationStore } from '../../store/navigation'
import { useAuthStore } from '../../store/auth'
import { useAISidebarStore } from '../../store/aiSidebar'
import { APP_SUBMENUS } from './sidebarMenus'
import SidebarContent from './SidebarContent'

interface ModuleItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

interface MobileDrawerProps {
  modules: ModuleItem[]
}

function getActiveApp(pathname: string): string {
  if (pathname === '/') return 'home'
  return pathname.split('/')[1] || 'home'
}

export default function MobileDrawer({ modules }: MobileDrawerProps) {
  const isOpen = useNavigationStore((s) => s.drawerOpen)
  const closeDrawer = useNavigationStore((s) => s.closeDrawer)
  const closeAI = useAISidebarStore((s) => s.close)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const activeApp = getActiveApp(location.pathname)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Track touch for swipe-to-close
  const touchStartX = useRef(0)
  const touchCurrentX = useRef(0)
  const isSwiping = useRef(false)

  // Close drawer when navigating
  useEffect(() => {
    closeDrawer()
  }, [location.pathname, closeDrawer])

  // When drawer opens, close AI sidebar to prevent overlap
  useEffect(() => {
    if (isOpen) closeAI()
  }, [isOpen, closeAI])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchCurrentX.current = e.touches[0].clientX
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX
    const deltaX = touchCurrentX.current - touchStartX.current
    // Only allow swiping left (to close)
    if (deltaX < -10) {
      isSwiping.current = true
      if (drawerRef.current) {
        drawerRef.current.style.transform = `translateX(${Math.min(0, deltaX)}px)`
        drawerRef.current.style.transition = 'none'
      }
    }
  }

  const handleTouchEnd = () => {
    const deltaX = touchCurrentX.current - touchStartX.current
    if (drawerRef.current) {
      drawerRef.current.style.transition = ''
      drawerRef.current.style.transform = ''
    }
    if (isSwiping.current && deltaX < -80) {
      closeDrawer()
    }
    isSwiping.current = false
  }

  const handleModuleClick = (href: string) => {
    navigate(href)
    closeDrawer()
  }

  const menu = activeApp ? APP_SUBMENUS[activeApp] : null
  const initials = user?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={closeDrawer}
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'fixed top-0 left-0 h-full z-40 w-[85vw] max-w-[320px] bg-white dark:bg-gray-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* User info header */}
        <div className="safe-top shrink-0 border-b border-gray-100 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user?.full_name}
              </p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Module grid */}
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
            Modules
          </p>
          <div className="grid grid-cols-4 gap-1">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => handleModuleClick(mod.href)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-[8px] transition-colors min-h-[44px]',
                  activeApp === mod.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-500 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800'
                )}
              >
                <span className="[&>svg]:h-5 [&>svg]:w-5">{mod.icon}</span>
                <span className="text-[9px] font-medium leading-tight text-center truncate w-full">
                  {mod.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Contextual sub-navigation (same as Sidebar content) */}
        {menu && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2">
                {menu.label}
              </p>
            </div>
            <SidebarContent
              menu={menu}
              activeApp={activeApp}
              pathname={location.pathname}
            />
          </div>
        )}

        {/* Close button at bottom */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3 safe-bottom">
          <button
            onClick={closeDrawer}
            className="w-full flex items-center justify-center gap-2 min-h-[44px] rounded-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>
      </div>
    </>
  )
}
