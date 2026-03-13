/**
 * ModuleBadge — color-coded badge showing the source module of a Drive file.
 *
 * Used in DrivePage (grid/list), SearchPage, and FilePreviewPanel to indicate
 * which ERP module generated or owns a file.
 */

const MODULE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  finance: { label: 'Finance', color: '#51459d', bg: '#51459d1a' },
  notes: { label: 'Notes', color: '#3b82f6', bg: '#3b82f61a' },
  mail: { label: 'Mail', color: '#6b7280', bg: '#6b72801a' },
  pos: { label: 'POS', color: '#6fd943', bg: '#6fd9431a' },
  hr: { label: 'HR', color: '#f97316', bg: '#f973161a' },
  support: { label: 'Support', color: '#ff3a6e', bg: '#ff3a6e1a' },
  manufacturing: { label: 'Mfg', color: '#6366f1', bg: '#6366f11a' },
  supplychain: { label: 'Supply Chain', color: '#0891b2', bg: '#0891b21a' },
  calendar: { label: 'Calendar', color: '#3ec9d6', bg: '#3ec9d61a' },
  projects: { label: 'Projects', color: '#8b5cf6', bg: '#8b5cf61a' },
  crm: { label: 'CRM', color: '#ec4899', bg: '#ec48991a' },
  ecommerce: { label: 'E-Commerce', color: '#ffa21d', bg: '#ffa21d1a' },
  inventory: { label: 'Inventory', color: '#14b8a6', bg: '#14b8a61a' },
}

interface ModuleBadgeProps {
  module: string | null | undefined
  size?: 'sm' | 'md'
}

export default function ModuleBadge({ module, size = 'sm' }: ModuleBadgeProps) {
  if (!module) return null

  const config = MODULE_CONFIG[module] || {
    label: module.charAt(0).toUpperCase() + module.slice(1),
    color: '#6b7280',
    bg: '#6b72801a',
  }

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5'
    : 'text-xs px-2 py-0.5'

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses}`}
      style={{ color: config.color, backgroundColor: config.bg }}
      title={`Source: ${config.label}`}
    >
      {config.label}
    </span>
  )
}
