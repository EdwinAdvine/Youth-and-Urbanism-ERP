/**
 * MobileBottomTabBar — bottom navigation bar for phone viewports (≤ 767px).
 *
 * Renders a fixed 5-tab bar at the bottom of the screen: a subset of primary
 * modules (Home, Mail, Calendar, AI, and a "More" tab that opens the
 * `MobileDrawer` for the full module list).
 *
 * The active tab is highlighted based on the current route's first URL segment.
 * The AI tab toggles the Urban Bad AI right sidebar via `useAISidebarStore`.
 *
 * Hidden on tablet and desktop viewports; visibility controlled by the
 * parent `AppShell` which conditionally renders this component.
 */
import { useLocation, useNavigate } from 'react-router-dom'
import { useAISidebarStore } from '../../store/aiSidebar'
import { useNavigationStore } from '../../store/navigation'

function getActiveApp(pathname: string): string {
  if (pathname === '/') return 'home'
  return pathname.split('/')[1] || 'home'
}

const APP_LABELS: Record<string, string> = {
  home: 'Home', finance: 'Finance', hr: 'HR', crm: 'CRM', projects: 'Projects',
  inventory: 'Inventory', 'supply-chain': 'Supply', manufacturing: 'Mfg', pos: 'POS',
  kds: 'KDS', loyalty: 'Loyalty', ecommerce: 'Shop', support: 'Support',
  mail: 'Mail', calendar: 'Calendar', teams: 'Teams', docs: 'Docs',
  drive: 'Drive', notes: 'Notes', analytics: 'Analytics', forms: 'Forms',
  handbook: 'Handbook', settings: 'Settings', admin: 'Admin',
}

interface MobileBottomTabBarProps {
  onSearchOpen: () => void
}

export default function MobileBottomTabBar({ onSearchOpen }: MobileBottomTabBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const activeApp = getActiveApp(location.pathname)
  const aiToggle = useAISidebarStore((s) => s.toggle)
  const aiIsOpen = useAISidebarStore((s) => s.isOpen)
  const toggleDrawer = useNavigationStore((s) => s.toggleDrawer)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-bottom">
      <div className="flex items-center justify-around h-14">
        {/* Home */}
        <TabButton
          active={activeApp === 'home'}
          label="Home"
          onClick={() => navigate('/')}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </TabButton>

        {/* Current App (dynamic) — only show if not home */}
        {activeApp !== 'home' ? (
          <TabButton
            active={true}
            label={APP_LABELS[activeApp] || activeApp}
            onClick={() => navigate(`/${activeApp}`)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </TabButton>
        ) : (
          <TabButton
            active={false}
            label="Search"
            onClick={onSearchOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </TabButton>
        )}

        {/* Search (when not home, replaces the dedicated slot) */}
        {activeApp !== 'home' && (
          <TabButton
            active={false}
            label="Search"
            onClick={onSearchOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </TabButton>
        )}

        {/* AI */}
        <TabButton
          active={aiIsOpen}
          label="AI"
          onClick={aiToggle}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </TabButton>

        {/* More (opens drawer) */}
        <TabButton
          active={false}
          label="More"
          onClick={toggleDrawer}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </TabButton>
      </div>
    </nav>
  )
}

/* ── Tab button ─────────────────────────────────────────────────────── */

function TabButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
        active
          ? 'text-primary'
          : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
      }`}
    >
      {children}
      <span className="text-[10px] font-medium leading-none">{label}</span>
      {active && (
        <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
      )}
    </button>
  )
}
