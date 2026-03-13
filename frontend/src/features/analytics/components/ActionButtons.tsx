/**
 * ActionButtons — contextual ERP action shortcuts on analytics widgets.
 * Shows relevant action buttons based on the widget's data source.
 */
import { useNavigate } from 'react-router-dom'

interface ActionButtonsProps {
  dataSource: string
  className?: string
}

const ACTION_MAP: Record<string, { label: string; icon: string; route: string }[]> = {
  'finance.invoices': [{ label: 'Send Reminders', icon: '📤', route: '/finance/invoices?action=send_reminders' }],
  'finance.revenue': [{ label: 'View Invoices', icon: '📋', route: '/finance/invoices' }],
  'finance.expenses': [{ label: 'Add Expense', icon: '➕', route: '/finance/expenses/new' }],
  'inventory.stock': [{ label: 'Create PO', icon: '📦', route: '/inventory/purchase-orders/new' }],
  'support.tickets': [{ label: 'View Open', icon: '🎫', route: '/support/tickets?status=open' }],
  'hr.headcount': [{ label: 'HR Dashboard', icon: '👥', route: '/hr' }],
  'crm.pipeline': [{ label: 'View Pipeline', icon: '💼', route: '/crm/deals' }],
  'crm.deals': [{ label: 'New Deal', icon: '🤝', route: '/crm/deals/new' }],
  'pos.transactions': [{ label: 'Sales History', icon: '🧾', route: '/pos/history' }],
  'ecommerce.orders': [{ label: 'Pending Orders', icon: '🛒', route: '/ecommerce/orders?status=pending' }],
  'manufacturing.work_orders': [{ label: 'Production', icon: '🏭', route: '/manufacturing' }],
  'projects.tasks': [{ label: 'View Tasks', icon: '✅', route: '/projects' }],
}

export default function ActionButtons({ dataSource, className = '' }: ActionButtonsProps) {
  const navigate = useNavigate()
  const actions = ACTION_MAP[dataSource]

  if (!actions || actions.length === 0) return null

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {actions.map((action) => (
        <button
          key={action.route}
          type="button"
          onClick={() => navigate(action.route)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-gray-200 dark:border-gray-700 hover:border-[#51459d]/50 hover:bg-[#51459d]/5 transition-colors text-gray-600 dark:text-gray-400 cursor-pointer"
        >
          <span>{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}
