import React from 'react'

export interface SubItem {
  label: string
  href: string
  icon: React.ReactNode
}

export interface MenuGroup {
  label: string
  items: SubItem[]
  defaultOpen?: boolean
}

export interface AppMenu {
  label: string
  groups: MenuGroup[]
  roles?: string[]
}

function Icon({ path }: { path: string }) {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
    </svg>
  )
}

// ─── SVG icon path constants ────────────────────────────────────────────────
const P = {
  home:       'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  invoice:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  money:      'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  card:       'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  bank:       'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  chart:      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  trending:   'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  users:      'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  user:       'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  clipboard:  'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  doc:        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  shield:     'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  grid:       'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  tag:        'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
  box:        'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  building:   'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  alert:      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  refresh:    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  lightning:  'M13 10V3L4 14h7v7l9-11h-7z',
  cog:        'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  share:      'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  star:       'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  check:      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  mail:       'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  chat:       'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  play:       'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  wrench:     'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  globe:      'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  cpu:        'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  scan:       'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4zm-6.5 0a2 2 0 100 4 2 2 0 000-4z',
  truck:      'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  template:   'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  book:       'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  archive:    'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  pencil:     'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  link:       'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  brain:      'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  search:     'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  pie:        'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z',
  upload:     'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  code:       'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  smile:      'M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  office:     'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  adjust:     'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  shopbag:    'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
  video:      'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
  display:    'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  gift:       'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7',
  cursor:     'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122',
}

// ─── FINANCE ────────────────────────────────────────────────────────────────
const financeMenu: AppMenu = {
  label: 'Finance',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/finance', icon: <Icon path={P.home} /> },
        { label: 'Invoices', href: '/finance/invoices', icon: <Icon path={P.invoice} /> },
        { label: 'Expenses', href: '/finance/expenses', icon: <Icon path={P.money} /> },
        { label: 'Payments', href: '/finance/payments', icon: <Icon path={P.card} /> },
        { label: 'Vendor Bills', href: '/finance/vendor-bills', icon: <Icon path={P.invoice} /> },
        { label: 'Estimates', href: '/finance/estimates', icon: <Icon path={P.doc} /> },
      ],
    },
    {
      label: 'Accounting',
      items: [
        { label: 'Accounts', href: '/finance/accounts', icon: <Icon path={P.clipboard} /> },
        { label: 'Journal Entries', href: '/finance/journal', icon: <Icon path={P.pencil} /> },
        { label: 'Bank Reconciliation', href: '/finance/bank-reconciliation', icon: <Icon path={P.bank} /> },
        { label: 'Recurring Invoices', href: '/finance/recurring-invoices', icon: <Icon path={P.refresh} /> },
        { label: 'Fixed Assets', href: '/finance/fixed-assets', icon: <Icon path={P.building} /> },
        { label: 'Budgets', href: '/finance/budgets', icon: <Icon path={P.chart} /> },
        { label: 'Tax Config', href: '/finance/tax-config', icon: <Icon path={P.shield} /> },
        { label: 'Currencies', href: '/finance/currencies', icon: <Icon path={P.globe} /> },
      ],
    },
    {
      label: 'Advanced',
      items: [
        { label: 'Revenue Streams', href: '/finance/revenue-streams', icon: <Icon path={P.trending} /> },
        { label: 'Job Costing', href: '/finance/job-costing', icon: <Icon path={P.clipboard} /> },
        { label: 'Compliance Calendar', href: '/finance/compliance-calendar', icon: <Icon path={P.calendar} /> },
        { label: 'Dimensions', href: '/finance/dimensions', icon: <Icon path={P.grid} /> },
        { label: 'Custom Fields', href: '/finance/custom-fields', icon: <Icon path={P.adjust} /> },
        { label: 'Workflow Rules', href: '/finance/workflow-rules', icon: <Icon path={P.lightning} /> },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'Finance AI', href: '/finance/ai', icon: <Icon path={P.brain} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Reports', href: '/finance/reports', icon: <Icon path={P.chart} /> },
        { label: 'P&L', href: '/finance/pnl', icon: <Icon path={P.trending} /> },
        { label: 'Balance Sheet', href: '/finance/balance-sheet', icon: <Icon path={P.clipboard} /> },
        { label: 'Cash Flow', href: '/finance/cash-flow', icon: <Icon path={P.bank} /> },
        { label: 'Aged Report', href: '/finance/aged-report', icon: <Icon path={P.chart} /> },
        { label: 'KPIs', href: '/finance/kpis', icon: <Icon path={P.trending} /> },
        { label: 'Dashboard Builder', href: '/finance/dashboard-builder', icon: <Icon path={P.grid} /> },
        { label: 'Report Builder', href: '/finance/report-builder', icon: <Icon path={P.pencil} /> },
      ],
    },
  ],
}

// ─── HR ─────────────────────────────────────────────────────────────────────
const hrMenu: AppMenu = {
  label: 'HR',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/hr', icon: <Icon path={P.home} /> },
        { label: 'Employees', href: '/hr/employees', icon: <Icon path={P.users} /> },
        { label: 'Departments', href: '/hr/departments', icon: <Icon path={P.building} /> },
        { label: 'Org Chart', href: '/hr/org-chart', icon: <Icon path={P.share} /> },
        { label: 'Documents', href: '/hr/documents', icon: <Icon path={P.doc} /> },
        { label: 'Manager Dashboard', href: '/hr/manager-dashboard', icon: <Icon path={P.grid} /> },
      ],
    },
    {
      label: 'Leave & Attendance',
      items: [
        { label: 'Leave', href: '/hr/leave', icon: <Icon path={P.calendar} /> },
        { label: 'Leave Calendar', href: '/hr/leave-calendar', icon: <Icon path={P.calendar} /> },
        { label: 'Attendance', href: '/hr/attendance', icon: <Icon path={P.clipboard} /> },
        { label: 'Shift Scheduling', href: '/hr/shift-scheduling', icon: <Icon path={P.template} /> },
        { label: 'Holiday Calendar', href: '/hr/holiday-calendar', icon: <Icon path={P.star} /> },
      ],
    },
    {
      label: 'Payroll',
      items: [
        { label: 'Payroll', href: '/hr/payroll', icon: <Icon path={P.money} /> },
        { label: 'Pay Runs', href: '/hr/pay-runs', icon: <Icon path={P.refresh} /> },
        { label: 'Tax Brackets', href: '/hr/tax-brackets', icon: <Icon path={P.shield} /> },
        { label: 'Payroll Reports', href: '/hr/payroll-reports', icon: <Icon path={P.chart} /> },
      ],
    },
    {
      label: 'Compensation',
      items: [
        { label: 'Compensation Bands', href: '/hr/compensation-bands', icon: <Icon path={P.adjust} /> },
        { label: 'Merit Planning', href: '/hr/merit-planning', icon: <Icon path={P.trending} /> },
        { label: 'Bonuses', href: '/hr/bonuses', icon: <Icon path={P.gift} /> },
        { label: 'Equity Grants', href: '/hr/equity-grants', icon: <Icon path={P.star} /> },
      ],
    },
    {
      label: 'Performance',
      items: [
        { label: 'Performance Reviews', href: '/hr/performance-reviews', icon: <Icon path={P.trending} /> },
        { label: 'Goals', href: '/hr/goals', icon: <Icon path={P.check} /> },
        { label: 'Feedback', href: '/hr/feedback', icon: <Icon path={P.chat} /> },
        { label: 'Review Cycles', href: '/hr/review-cycles', icon: <Icon path={P.refresh} /> },
        { label: 'Skills Matrix', href: '/hr/skills-matrix', icon: <Icon path={P.grid} /> },
        { label: 'Succession Planning', href: '/hr/succession-planning', icon: <Icon path={P.users} /> },
      ],
    },
    {
      label: 'Onboarding',
      items: [
        { label: 'Onboarding', href: '/hr/onboarding', icon: <Icon path={P.users} /> },
        { label: 'Offboarding', href: '/hr/offboarding', icon: <Icon path={P.archive} /> },
        { label: 'Templates', href: '/hr/onboarding-templates', icon: <Icon path={P.template} /> },
        { label: 'Tracker', href: '/hr/onboarding-tracker', icon: <Icon path={P.clipboard} /> },
        { label: 'Training', href: '/hr/training', icon: <Icon path={P.book} /> },
        { label: 'Bulk Import', href: '/hr/import', icon: <Icon path={P.upload} /> },
      ],
    },
    {
      label: 'Recruitment (ATS)',
      items: [
        { label: 'ATS Dashboard', href: '/hr/ats', icon: <Icon path={P.home} /> },
        { label: 'Requisitions', href: '/hr/ats/requisitions', icon: <Icon path={P.doc} /> },
        { label: 'Candidates', href: '/hr/ats/candidates', icon: <Icon path={P.user} /> },
        { label: 'Interviews', href: '/hr/ats/interviews', icon: <Icon path={P.calendar} /> },
      ],
    },
    {
      label: 'Learning (LMS)',
      items: [
        { label: 'Learning Dashboard', href: '/hr/learning', icon: <Icon path={P.home} /> },
        { label: 'Courses', href: '/hr/courses', icon: <Icon path={P.book} /> },
        { label: 'Certifications', href: '/hr/certifications', icon: <Icon path={P.shield} /> },
      ],
    },
    {
      label: 'Engagement',
      items: [
        { label: 'Engagement Dashboard', href: '/hr/engagement', icon: <Icon path={P.smile} /> },
        { label: 'Recognition', href: '/hr/recognition', icon: <Icon path={P.star} /> },
      ],
    },
    {
      label: 'AI Intelligence',
      items: [
        { label: 'Flight Risk', href: '/hr/ai/flight-risk', icon: <Icon path={P.alert} /> },
        { label: 'Burnout Alerts', href: '/hr/ai/burnout', icon: <Icon path={P.brain} /> },
        { label: 'Skills Ontology', href: '/hr/ai/skills-ontology', icon: <Icon path={P.globe} /> },
        { label: 'HR Chatbot', href: '/hr/ai/chatbot', icon: <Icon path={P.chat} /> },
        { label: 'Workforce Planning', href: '/hr/ai/workforce-planning', icon: <Icon path={P.chart} /> },
      ],
    },
    {
      label: 'Workflows',
      items: [
        { label: 'Workflows', href: '/hr/workflows', icon: <Icon path={P.lightning} /> },
        { label: 'Approvals', href: '/hr/workflows/approvals', icon: <Icon path={P.check} /> },
        { label: 'Executions', href: '/hr/workflows/executions', icon: <Icon path={P.play} /> },
      ],
    },
    {
      label: 'People Analytics',
      items: [
        { label: 'HR Analytics', href: '/hr/analytics', icon: <Icon path={P.chart} /> },
        { label: 'DEI Dashboard', href: '/hr/analytics/dei', icon: <Icon path={P.users} /> },
        { label: 'Predictive Reports', href: '/hr/analytics/predictive', icon: <Icon path={P.brain} /> },
        { label: 'Cost Modeling', href: '/hr/analytics/cost', icon: <Icon path={P.money} /> },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Audit Log', href: '/hr/audit-log', icon: <Icon path={P.clipboard} /> },
      ],
    },
  ],
}

// ─── CRM ────────────────────────────────────────────────────────────────────
const crmMenu: AppMenu = {
  label: 'CRM',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/crm', icon: <Icon path={P.home} /> },
        { label: 'Contacts', href: '/crm/contacts', icon: <Icon path={P.user} /> },
        { label: 'Leads', href: '/crm/leads', icon: <Icon path={P.trending} /> },
        { label: 'Deals', href: '/crm/deals', icon: <Icon path={P.check} /> },
        { label: 'Pipeline', href: '/crm/pipeline', icon: <Icon path={P.template} /> },
        { label: 'Activities', href: '/crm/activities', icon: <Icon path={P.calendar} /> },
        { label: 'Tickets', href: '/crm/tickets', icon: <Icon path={P.doc} /> },
      ],
    },
    {
      label: 'Sales',
      items: [
        { label: 'Quotes', href: '/crm/quotes', icon: <Icon path={P.invoice} /> },
        { label: 'Sales Forecast', href: '/crm/sales-forecast', icon: <Icon path={P.chart} /> },
        { label: 'Pipeline Analytics', href: '/crm/pipeline-analytics', icon: <Icon path={P.pie} /> },
        { label: 'Lead Scoring', href: '/crm/lead-scoring', icon: <Icon path={P.star} /> },
        { label: 'Sequences', href: '/crm/sequences', icon: <Icon path={P.lightning} /> },
        { label: 'Leaderboard', href: '/crm/leaderboard', icon: <Icon path={P.trending} /> },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { label: 'Campaigns', href: '/crm/campaigns', icon: <Icon path={P.mail} /> },
        { label: 'Segments', href: '/crm/segments', icon: <Icon path={P.users} /> },
        { label: 'Content Calendar', href: '/crm/content-calendar', icon: <Icon path={P.calendar} /> },
        { label: 'A/B Testing', href: '/crm/ab-test', icon: <Icon path={P.adjust} /> },
        { label: 'Templates', href: '/crm/templates', icon: <Icon path={P.template} /> },
      ],
    },
    {
      label: 'Service Hub',
      items: [
        { label: 'Conversations', href: '/crm/conversations', icon: <Icon path={P.chat} /> },
        { label: 'Knowledge Base', href: '/crm/knowledge-base', icon: <Icon path={P.book} /> },
        { label: 'SLA Policies', href: '/crm/sla-policies', icon: <Icon path={P.shield} /> },
      ],
    },
    {
      label: 'Automations',
      items: [
        { label: 'Workflows', href: '/crm/workflows', icon: <Icon path={P.lightning} /> },
        { label: 'AI Agents', href: '/crm/ai-agents', icon: <Icon path={P.brain} /> },
        { label: 'Custom Objects', href: '/crm/custom-objects', icon: <Icon path={P.grid} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Dashboard Builder', href: '/crm/dashboard-builder', icon: <Icon path={P.template} /> },
        { label: 'Funnel Report', href: '/crm/reports/funnel', icon: <Icon path={P.chart} /> },
        { label: 'Cohort Report', href: '/crm/reports/cohort', icon: <Icon path={P.pie} /> },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Pipeline Settings', href: '/crm/pipelines/settings', icon: <Icon path={P.cog} /> },
        { label: 'Custom Fields', href: '/crm/custom-fields', icon: <Icon path={P.adjust} /> },
        { label: 'Duplicates', href: '/crm/duplicates', icon: <Icon path={P.users} /> },
        { label: 'Import Contacts', href: '/crm/contacts/import', icon: <Icon path={P.upload} /> },
        { label: 'Audit Log', href: '/crm/audit-log', icon: <Icon path={P.clipboard} /> },
      ],
    },
  ],
}

// ─── PROJECTS ───────────────────────────────────────────────────────────────
const projectsMenu: AppMenu = {
  label: 'Projects',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'All Projects', href: '/projects', icon: <Icon path={P.clipboard} /> },
        { label: 'Workload', href: '/projects/workload', icon: <Icon path={P.users} /> },
        { label: 'Templates', href: '/projects/templates', icon: <Icon path={P.template} /> },
      ],
    },
  ],
}

// ─── INVENTORY ──────────────────────────────────────────────────────────────
const inventoryMenu: AppMenu = {
  label: 'Inventory',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/inventory', icon: <Icon path={P.home} /> },
        { label: 'Items', href: '/inventory/items', icon: <Icon path={P.box} /> },
        { label: 'Warehouses', href: '/inventory/warehouses', icon: <Icon path={P.building} /> },
        { label: 'Suppliers', href: '/inventory/suppliers', icon: <Icon path={P.users} /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Stock Movements', href: '/inventory/stock-movements', icon: <Icon path={P.truck} /> },
        { label: 'Stock Adjustments', href: '/inventory/stock-adjustments', icon: <Icon path={P.adjust} /> },
        { label: 'Purchase Orders', href: '/inventory/purchase-orders', icon: <Icon path={P.doc} /> },
        { label: 'Physical Count', href: '/inventory/physical-count', icon: <Icon path={P.clipboard} /> },
        { label: 'Batch Tracking', href: '/inventory/batch-tracking', icon: <Icon path={P.tag} /> },
        { label: 'Reorder Alerts', href: '/inventory/reorder-alerts', icon: <Icon path={P.alert} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Valuation Report', href: '/inventory/valuation', icon: <Icon path={P.chart} /> },
        { label: 'Turnover Report', href: '/inventory/turnover', icon: <Icon path={P.trending} /> },
      ],
    },
  ],
}

// ─── SUPPLY CHAIN ───────────────────────────────────────────────────────────
const supplyChainMenu: AppMenu = {
  label: 'Supply Chain',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/supply-chain', icon: <Icon path={P.home} /> },
        { label: 'Requisitions', href: '/supply-chain/requisitions', icon: <Icon path={P.doc} /> },
        { label: 'Suppliers', href: '/supply-chain/suppliers', icon: <Icon path={P.building} /> },
        { label: 'Contracts', href: '/supply-chain/contracts', icon: <Icon path={P.shield} /> },
        { label: 'Control Tower', href: '/supply-chain/control-tower', icon: <Icon path={P.globe} /> },
        { label: 'Alerts', href: '/supply-chain/alerts', icon: <Icon path={P.alert} /> },
      ],
    },
    {
      label: 'Procurement',
      items: [
        { label: 'RFx Procurement', href: '/supply-chain/rfx', icon: <Icon path={P.calendar} /> },
        { label: 'Goods Receipt', href: '/supply-chain/grn', icon: <Icon path={P.archive} /> },
        { label: 'Returns', href: '/supply-chain/returns', icon: <Icon path={P.refresh} /> },
        { label: 'Quality Inspections', href: '/supply-chain/quality-inspections', icon: <Icon path={P.check} /> },
      ],
    },
    {
      label: 'Planning',
      items: [
        { label: 'Demand Planning', href: '/supply-chain/demand-forecasts', icon: <Icon path={P.chart} /> },
        { label: 'Forecast Scenarios', href: '/supply-chain/forecast-scenarios', icon: <Icon path={P.brain} /> },
        { label: 'S&OP', href: '/supply-chain/sop', icon: <Icon path={P.template} /> },
        { label: 'Supply Plans', href: '/supply-chain/supply-plans', icon: <Icon path={P.clipboard} /> },
        { label: 'Replenishment', href: '/supply-chain/replenishment', icon: <Icon path={P.refresh} /> },
        { label: 'Stock Health', href: '/supply-chain/stock-health', icon: <Icon path={P.check} /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Shipments', href: '/supply-chain/shipments', icon: <Icon path={P.truck} /> },
        { label: 'Supplier Ratings', href: '/supply-chain/ratings', icon: <Icon path={P.star} /> },
        { label: 'Supplier Risks', href: '/supply-chain/supplier-risks', icon: <Icon path={P.alert} /> },
        { label: 'Performance', href: '/supply-chain/performance', icon: <Icon path={P.trending} /> },
        { label: 'Workflows', href: '/supply-chain/workflows', icon: <Icon path={P.lightning} /> },
      ],
    },
    {
      label: 'Compliance & Analytics',
      items: [
        { label: 'Compliance & ESG', href: '/supply-chain/compliance', icon: <Icon path={P.shield} /> },
        { label: 'SC Analytics', href: '/supply-chain/analytics', icon: <Icon path={P.pie} /> },
      ],
    },
  ],
}

// ─── MANUFACTURING ──────────────────────────────────────────────────────────
const manufacturingMenu: AppMenu = {
  label: 'Manufacturing',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/manufacturing', icon: <Icon path={P.home} /> },
        { label: 'Work Orders', href: '/manufacturing/work-orders', icon: <Icon path={P.office} /> },
        { label: 'Bill of Materials', href: '/manufacturing/bom', icon: <Icon path={P.doc} /> },
        { label: 'Work Stations', href: '/manufacturing/workstations', icon: <Icon path={P.template} /> },
        { label: 'Routing', href: '/manufacturing/routing', icon: <Icon path={P.link} /> },
        { label: 'Production Plan', href: '/manufacturing/production-plan', icon: <Icon path={P.calendar} /> },
        { label: 'Production Tracking', href: '/manufacturing/production-tracking', icon: <Icon path={P.play} /> },
        { label: 'Scrap', href: '/manufacturing/scrap', icon: <Icon path={P.trash} /> },
      ],
    },
    {
      label: 'Quality',
      items: [
        { label: 'Quality Checks', href: '/manufacturing/quality-checks', icon: <Icon path={P.check} /> },
        { label: 'Inspection Plans', href: '/manufacturing/inspection-plans', icon: <Icon path={P.clipboard} /> },
        { label: 'NCR', href: '/manufacturing/ncr', icon: <Icon path={P.alert} /> },
        { label: 'CAPA', href: '/manufacturing/capa', icon: <Icon path={P.shield} /> },
        { label: 'Lot Tracking', href: '/manufacturing/lots', icon: <Icon path={P.tag} /> },
        { label: 'Batch Records', href: '/manufacturing/batch-records', icon: <Icon path={P.doc} /> },
        { label: 'Rework Orders', href: '/manufacturing/rework-orders', icon: <Icon path={P.refresh} /> },
        { label: 'ECO', href: '/manufacturing/eco', icon: <Icon path={P.pencil} /> },
      ],
    },
    {
      label: 'Planning & Scheduling',
      items: [
        { label: 'Gantt Scheduler', href: '/manufacturing/schedule', icon: <Icon path={P.template} /> },
        { label: 'Capacity', href: '/manufacturing/capacity', icon: <Icon path={P.chart} /> },
        { label: 'Scenario Planner', href: '/manufacturing/scenarios', icon: <Icon path={P.brain} /> },
      ],
    },
    {
      label: 'Equipment',
      items: [
        { label: 'Assets', href: '/manufacturing/assets', icon: <Icon path={P.building} /> },
        { label: 'Maintenance', href: '/manufacturing/maintenance', icon: <Icon path={P.wrench} /> },
        { label: 'Maintenance WO', href: '/manufacturing/maintenance-work-orders', icon: <Icon path={P.office} /> },
        { label: 'Downtime Tracker', href: '/manufacturing/downtime', icon: <Icon path={P.alert} /> },
        { label: 'Downtime Analysis', href: '/manufacturing/downtime/analysis', icon: <Icon path={P.chart} /> },
        { label: 'OEE Report', href: '/manufacturing/oee', icon: <Icon path={P.trending} /> },
      ],
    },
    {
      label: 'Labor',
      items: [
        { label: 'Skills Matrix', href: '/manufacturing/skills', icon: <Icon path={P.grid} /> },
        { label: 'Certifications', href: '/manufacturing/certifications', icon: <Icon path={P.shield} /> },
        { label: 'Crew Scheduling', href: '/manufacturing/crew', icon: <Icon path={P.users} /> },
      ],
    },
    {
      label: 'MES & IoT',
      items: [
        { label: 'Production Board', href: '/manufacturing/production-board', icon: <Icon path={P.display} /> },
        { label: 'IoT Dashboard', href: '/manufacturing/iot', icon: <Icon path={P.cpu} /> },
      ],
    },
    {
      label: 'AI',
      items: [
        { label: 'Bottleneck Analysis', href: '/manufacturing/ai/bottlenecks', icon: <Icon path={P.brain} /> },
        { label: 'Quality Risk', href: '/manufacturing/ai/quality-risk', icon: <Icon path={P.alert} /> },
        { label: 'Schedule Suggestions', href: '/manufacturing/ai/suggestions', icon: <Icon path={P.lightning} /> },
        { label: 'Executive Summary', href: '/manufacturing/ai/executive', icon: <Icon path={P.chart} /> },
      ],
    },
    {
      label: 'Configurator',
      items: [
        { label: 'Product Configurator', href: '/manufacturing/configurator', icon: <Icon path={P.wrench} /> },
        { label: 'Configurator Rules', href: '/manufacturing/configurator/rules', icon: <Icon path={P.cog} /> },
      ],
    },
    {
      label: 'KPIs',
      items: [
        { label: 'KPIs', href: '/manufacturing/kpis', icon: <Icon path={P.trending} /> },
      ],
    },
  ],
}

// ─── POS ────────────────────────────────────────────────────────────────────
const posMenu: AppMenu = {
  label: 'POS',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/pos', icon: <Icon path={P.home} /> },
        { label: 'Terminal', href: '/pos/terminal', icon: <Icon path={P.display} /> },
        { label: 'Register', href: '/pos/register', icon: <Icon path={P.card} /> },
        { label: 'Sessions', href: '/pos/sessions', icon: <Icon path={P.shopbag} /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Cash Management', href: '/pos/cash-management', icon: <Icon path={P.money} /> },
        { label: 'Held Transactions', href: '/pos/held-transactions', icon: <Icon path={P.archive} /> },
        { label: 'Pickup Orders', href: '/pos/pickup-orders', icon: <Icon path={P.box} /> },
        { label: 'Gift Cards', href: '/pos/gift-cards', icon: <Icon path={P.gift} /> },
        { label: 'Store Credit', href: '/pos/store-credit', icon: <Icon path={P.card} /> },
      ],
    },
    {
      label: 'Products',
      items: [
        { label: 'Discounts', href: '/pos/discounts', icon: <Icon path={P.tag} /> },
        { label: 'Bundles', href: '/pos/bundles', icon: <Icon path={P.box} /> },
        { label: 'Modifier Groups', href: '/pos/modifier-groups', icon: <Icon path={P.adjust} /> },
        { label: 'Terminals', href: '/pos/terminals', icon: <Icon path={P.display} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Daily Sales', href: '/pos/daily-sales', icon: <Icon path={P.chart} /> },
        { label: 'Cashier Report', href: '/pos/cashier-report', icon: <Icon path={P.users} /> },
        { label: 'X/Z Readings', href: '/pos/xz-readings', icon: <Icon path={P.clipboard} /> },
        { label: 'Profitability', href: '/pos/profitability', icon: <Icon path={P.trending} /> },
        { label: 'Commission Rules', href: '/pos/commission-rules', icon: <Icon path={P.invoice} /> },
        { label: 'Commission Report', href: '/pos/commission-report', icon: <Icon path={P.chart} /> },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Hardware Settings', href: '/pos/hardware-settings', icon: <Icon path={P.cog} /> },
      ],
    },
  ],
}

// ─── E-COMMERCE ─────────────────────────────────────────────────────────────
const ecommerceMenu: AppMenu = {
  label: 'E-Commerce',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/ecommerce', icon: <Icon path={P.home} /> },
        { label: 'Stores', href: '/ecommerce/stores', icon: <Icon path={P.building} /> },
        { label: 'Products', href: '/ecommerce/products', icon: <Icon path={P.shopbag} /> },
        { label: 'Orders', href: '/ecommerce/orders', icon: <Icon path={P.doc} /> },
        { label: 'Customers', href: '/ecommerce/customers', icon: <Icon path={P.user} /> },
        { label: 'Categories', href: '/ecommerce/categories', icon: <Icon path={P.template} /> },
      ],
    },
    {
      label: 'Marketing',
      items: [
        { label: 'Coupons', href: '/ecommerce/coupons', icon: <Icon path={P.tag} /> },
        { label: 'Bundles', href: '/ecommerce/bundles', icon: <Icon path={P.box} /> },
        { label: 'Loyalty Program', href: '/ecommerce/loyalty-program', icon: <Icon path={P.star} /> },
        { label: 'Abandoned Carts', href: '/ecommerce/abandoned-carts', icon: <Icon path={P.shopbag} /> },
        { label: 'Reviews', href: '/ecommerce/reviews', icon: <Icon path={P.chat} /> },
      ],
    },
    {
      label: 'B2B',
      items: [
        { label: 'B2B Portal', href: '/ecommerce/b2b', icon: <Icon path={P.building} /> },
        { label: 'B2B Dashboard', href: '/ecommerce/b2b/dashboard', icon: <Icon path={P.chart} /> },
      ],
    },
    {
      label: 'Subscriptions',
      items: [
        { label: 'Subscriptions', href: '/ecommerce/subscriptions', icon: <Icon path={P.refresh} /> },
        { label: 'Subscriptions Admin', href: '/ecommerce/subscriptions/admin', icon: <Icon path={P.cog} /> },
      ],
    },
    {
      label: 'Content',
      items: [
        { label: 'Blog', href: '/ecommerce/blog', icon: <Icon path={P.pencil} /> },
        { label: 'Theme Editor', href: '/ecommerce/theme-editor', icon: <Icon path={P.adjust} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Sales Report', href: '/ecommerce/sales-report', icon: <Icon path={P.chart} /> },
        { label: 'Analytics', href: '/ecommerce/analytics', icon: <Icon path={P.pie} /> },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'Shipping', href: '/ecommerce/shipping', icon: <Icon path={P.truck} /> },
        { label: 'Import', href: '/ecommerce/import', icon: <Icon path={P.upload} /> },
      ],
    },
  ],
}

// ─── SUPPORT ────────────────────────────────────────────────────────────────
const supportMenu: AppMenu = {
  label: 'Support',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/support', icon: <Icon path={P.home} /> },
        { label: 'Tickets', href: '/support/tickets', icon: <Icon path={P.doc} /> },
        { label: 'Categories', href: '/support/categories', icon: <Icon path={P.template} /> },
        { label: 'Saved Views', href: '/support/views', icon: <Icon path={P.archive} /> },
      ],
    },
    {
      label: 'Communication',
      items: [
        { label: 'Live Chat', href: '/support/live-chat', icon: <Icon path={P.chat} /> },
        { label: 'Canned Responses', href: '/support/canned-responses', icon: <Icon path={P.lightning} /> },
        { label: 'Ticket Templates', href: '/support/templates', icon: <Icon path={P.template} /> },
        { label: 'Inbound Email', href: '/support/inbound-email', icon: <Icon path={P.mail} /> },
      ],
    },
    {
      label: 'Knowledge Base',
      items: [
        { label: 'Public KB', href: '/support/kb', icon: <Icon path={P.book} /> },
        { label: 'KB Editor', href: '/support/kb/editor', icon: <Icon path={P.pencil} /> },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'SLA Config', href: '/support/sla', icon: <Icon path={P.shield} /> },
        { label: 'Routing Rules', href: '/support/routing-rules', icon: <Icon path={P.link} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Satisfaction', href: '/support/satisfaction', icon: <Icon path={P.smile} /> },
        { label: 'KPIs', href: '/support/kpis', icon: <Icon path={P.chart} /> },
      ],
    },
  ],
}

// ─── MAIL ───────────────────────────────────────────────────────────────────
const mailMenu: AppMenu = {
  label: 'Mail',
  groups: [
    {
      label: 'Mail',
      defaultOpen: true,
      items: [
        { label: 'Inbox', href: '/mail', icon: <Icon path={P.mail} /> },
        { label: 'Sent', href: '/mail/sent', icon: <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /> },
        { label: 'Drafts', href: '/mail/drafts', icon: <Icon path={P.pencil} /> },
        { label: 'Starred', href: '/mail/starred', icon: <Icon path={P.star} /> },
        { label: 'Spam', href: '/mail/spam', icon: <Icon path={P.alert} /> },
        { label: 'Trash', href: '/mail/trash', icon: <Icon path={P.trash} /> },
      ],
    },
  ],
}

// ─── CALENDAR ───────────────────────────────────────────────────────────────
const calendarMenu: AppMenu = {
  label: 'Calendar',
  groups: [
    {
      label: 'Calendar',
      defaultOpen: true,
      items: [
        { label: 'My Calendar', href: '/calendar', icon: <Icon path={P.calendar} /> },
        { label: 'Team Calendar', href: '/calendar/team', icon: <Icon path={P.users} /> },
        { label: 'Upcoming Events', href: '/calendar/upcoming', icon: <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { label: 'Recurring', href: '/calendar/recurring', icon: <Icon path={P.refresh} /> },
      ],
    },
  ],
}

// ─── TEAMS ──────────────────────────────────────────────────────────────────
const teamsMenu: AppMenu = {
  label: 'Teams',
  groups: [
    {
      label: 'Teams',
      defaultOpen: true,
      items: [
        { label: 'My Teams', href: '/teams', icon: <Icon path={P.users} /> },
        { label: 'Meetings', href: '/teams/meetings', icon: <Icon path={P.video} /> },
        { label: 'Webinars', href: '/teams/webinars', icon: <Icon path={P.display} /> },
        { label: 'Pending Invites', href: '/teams/invites', icon: <Icon path={P.mail} /> },
        { label: 'Recordings', href: '/teams/recordings', icon: <Icon path={P.play} /> },
      ],
    },
  ],
}

// ─── DOCS ───────────────────────────────────────────────────────────────────
const docsMenu: AppMenu = {
  label: 'Docs',
  groups: [
    {
      label: 'Docs',
      defaultOpen: true,
      items: [
        { label: 'All Docs', href: '/docs', icon: <Icon path={P.doc} /> },
        { label: 'My Docs', href: '/docs/mine', icon: <Icon path={P.user} /> },
        { label: 'Shared', href: '/docs/shared', icon: <Icon path={P.share} /> },
        { label: 'Recent', href: '/docs/recent', icon: <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { label: 'Templates', href: '/docs/templates', icon: <Icon path={P.template} /> },
      ],
    },
  ],
}

// ─── DRIVE ──────────────────────────────────────────────────────────────────
const driveMenu: AppMenu = {
  label: 'Drive',
  groups: [
    {
      label: 'Drive',
      defaultOpen: true,
      items: [
        { label: 'My Files', href: '/drive', icon: <Icon path={P.upload} /> },
        { label: 'Shared with Me', href: '/drive/shared', icon: <Icon path={P.share} /> },
        { label: 'Starred', href: '/drive/starred', icon: <Icon path={P.star} /> },
        { label: 'Recent', href: '/drive/recent', icon: <Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /> },
        { label: 'Recycle Bin', href: '/drive/trash', icon: <Icon path={P.trash} /> },
      ],
    },
  ],
}

// ─── NOTES ──────────────────────────────────────────────────────────────────
const notesMenu: AppMenu = {
  label: 'Notes',
  groups: [
    {
      label: 'Notes',
      defaultOpen: true,
      items: [
        { label: 'All Notes', href: '/notes', icon: <Icon path={P.pencil} /> },
        { label: 'My Notes', href: '/notes/mine', icon: <Icon path={P.user} /> },
        { label: 'Shared', href: '/notes/shared', icon: <Icon path={P.share} /> },
        { label: 'Archived', href: '/notes/archived', icon: <Icon path={P.archive} /> },
      ],
    },
  ],
}

// ─── ANALYTICS ──────────────────────────────────────────────────────────────
const analyticsMenu: AppMenu = {
  label: 'Analytics',
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Overview', href: '/analytics', icon: <Icon path={P.home} /> },
        { label: 'Dashboards', href: '/analytics/dashboards', icon: <Icon path={P.grid} /> },
        { label: 'Query Builder', href: '/analytics/query-builder', icon: <Icon path={P.search} /> },
        { label: 'SQL Editor', href: '/analytics/sql-editor', icon: <Icon path={P.code} /> },
        { label: 'Executive', href: '/analytics/executive', icon: <Icon path={P.trending} /> },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Reports', href: '/analytics/reports', icon: <Icon path={P.chart} /> },
        { label: 'Alerts', href: '/analytics/alerts', icon: <Icon path={P.alert} /> },
      ],
    },
    {
      label: 'Prebuilt Dashboards',
      items: [
        { label: 'All Prebuilt', href: '/analytics/prebuilt', icon: <Icon path={P.template} /> },
        { label: 'Finance', href: '/analytics/prebuilt/finance', icon: <Icon path={P.money} /> },
        { label: 'CRM', href: '/analytics/prebuilt/crm', icon: <Icon path={P.user} /> },
        { label: 'HR', href: '/analytics/prebuilt/hr', icon: <Icon path={P.users} /> },
        { label: 'Inventory', href: '/analytics/prebuilt/inventory', icon: <Icon path={P.box} /> },
        { label: 'E-Commerce', href: '/analytics/prebuilt/ecommerce', icon: <Icon path={P.shopbag} /> },
        { label: 'Support', href: '/analytics/prebuilt/support', icon: <Icon path={P.chat} /> },
        { label: 'Manufacturing', href: '/analytics/prebuilt/manufacturing', icon: <Icon path={P.office} /> },
      ],
    },
  ],
}

// ─── FORMS ──────────────────────────────────────────────────────────────────
const formsMenu: AppMenu = {
  label: 'Forms',
  groups: [
    {
      label: 'Forms',
      defaultOpen: true,
      items: [
        { label: 'All Forms', href: '/forms', icon: <Icon path={P.clipboard} /> },
      ],
    },
  ],
}

// ─── HANDBOOK ───────────────────────────────────────────────────────────────
const handbookMenu: AppMenu = {
  label: 'Handbook',
  groups: [
    {
      label: 'Handbook',
      defaultOpen: true,
      items: [
        { label: 'Browse', href: '/handbook', icon: <Icon path={P.book} /> },
        { label: 'Getting Started', href: '/handbook/getting-started', icon: <Icon path={P.lightning} /> },
        { label: 'Search', href: '/handbook/search', icon: <Icon path={P.search} /> },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Handbook Admin', href: '/handbook/admin', icon: <Icon path={P.cog} /> },
        { label: 'Categories', href: '/handbook/admin/categories', icon: <Icon path={P.template} /> },
        { label: 'Analytics', href: '/handbook/admin/analytics', icon: <Icon path={P.chart} /> },
      ],
    },
  ],
}

// ─── SETTINGS ───────────────────────────────────────────────────────────────
const settingsMenu: AppMenu = {
  label: 'Settings',
  groups: [
    {
      label: 'Settings',
      defaultOpen: true,
      items: [
        { label: 'Profile', href: '/settings', icon: <Icon path={P.user} /> },
        { label: 'Security', href: '/settings/security', icon: <Icon path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> },
        { label: 'Notifications', href: '/settings/notifications', icon: <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> },
        { label: 'Integrations', href: '/settings/integrations', icon: <Icon path={P.link} /> },
        { label: 'Appearance', href: '/settings/appearance', icon: <Icon path="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /> },
      ],
    },
  ],
}

// ─── ADMIN ──────────────────────────────────────────────────────────────────
const adminMenu: AppMenu = {
  label: 'Admin',
  roles: ['superadmin', 'admin'],
  groups: [
    {
      label: 'Core',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/admin', icon: <Icon path={P.home} /> },
        { label: 'Users', href: '/admin/users', icon: <Icon path={P.users} /> },
        { label: 'Roles & Permissions', href: '/admin/roles', icon: <Icon path={P.shield} /> },
        { label: 'App Admins', href: '/admin/app-admins', icon: <Icon path={P.user} /> },
      ],
    },
    {
      label: 'Configuration',
      items: [
        { label: 'AI Config', href: '/admin/ai-config', icon: <Icon path={P.brain} /> },
        { label: 'SSO Config', href: '/admin/sso', icon: <Icon path={P.shield} /> },
        { label: 'License', href: '/admin/license', icon: <Icon path={P.doc} /> },
        { label: 'Mail Config', href: '/admin/mail-config', icon: <Icon path={P.mail} /> },
        { label: 'Drive Config', href: '/admin/drive-config', icon: <Icon path={P.upload} /> },
        { label: 'Docs Config', href: '/admin/docs-config', icon: <Icon path={P.doc} /> },
        { label: 'Meetings Config', href: '/admin/meetings-config', icon: <Icon path={P.video} /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Audit Logs', href: '/admin/audit-logs', icon: <Icon path={P.clipboard} /> },
        { label: 'Backups', href: '/admin/backups', icon: <Icon path={P.archive} /> },
        { label: 'Bulk Import', href: '/admin/users/import', icon: <Icon path={P.upload} /> },
      ],
    },
  ],
}

// ─── KDS ────────────────────────────────────────────────────────────────────
const kdsMenu: AppMenu = {
  label: 'KDS',
  groups: [
    {
      label: 'Kitchen Display',
      defaultOpen: true,
      items: [
        { label: 'Display', href: '/kds', icon: <Icon path={P.display} /> },
        { label: 'Station Manager', href: '/kds/stations', icon: <Icon path={P.cog} /> },
      ],
    },
  ],
}

// ─── LOYALTY ────────────────────────────────────────────────────────────────
const loyaltyMenu: AppMenu = {
  label: 'Loyalty',
  groups: [
    {
      label: 'Loyalty',
      defaultOpen: true,
      items: [
        { label: 'Dashboard', href: '/loyalty', icon: <Icon path={P.home} /> },
        { label: 'Member Lookup', href: '/loyalty/members', icon: <Icon path={P.search} /> },
      ],
    },
  ],
}

// ─── Master export ───────────────────────────────────────────────────────────
export const APP_SUBMENUS: Record<string, AppMenu> = {
  finance:          financeMenu,
  hr:               hrMenu,
  crm:              crmMenu,
  projects:         projectsMenu,
  inventory:        inventoryMenu,
  'supply-chain':   supplyChainMenu,
  manufacturing:    manufacturingMenu,
  pos:              posMenu,
  ecommerce:        ecommerceMenu,
  support:          supportMenu,
  mail:             mailMenu,
  calendar:         calendarMenu,
  teams:            teamsMenu,
  docs:             docsMenu,
  drive:            driveMenu,
  notes:            notesMenu,
  analytics:        analyticsMenu,
  forms:            formsMenu,
  handbook:         handbookMenu,
  settings:         settingsMenu,
  admin:            adminMenu,
  kds:              kdsMenu,
  loyalty:          loyaltyMenu,
}
