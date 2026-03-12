/**
 * Financial Context Ribbon — shows real-time financial/CRM context for the email sender.
 * Appears at the top of the message detail view for known contacts.
 */
import { useFinancialRibbon } from '../../api/mail'

interface FinancialRibbonProps {
  senderEmail: string
}

export default function FinancialRibbon({ senderEmail }: FinancialRibbonProps) {
  const { data, isLoading } = useFinancialRibbon(senderEmail)

  if (isLoading || !data || !data.is_known) return null

  const { crm, finance, support } = data

  const items: Array<{ label: string; value: string; color: string }> = []

  if (crm.deal_stage) {
    items.push({
      label: 'Deal',
      value: `${crm.deal_stage}${crm.deal_value ? ` ($${(crm.deal_value / 1000).toFixed(0)}K)` : ''}`,
      color: 'text-[#51459d]',
    })
  }
  if (crm.lifetime_revenue && crm.lifetime_revenue > 0) {
    items.push({
      label: 'Revenue',
      value: `$${crm.lifetime_revenue.toLocaleString()}`,
      color: 'text-[#6fd943]',
    })
  }
  if (finance.open_po_count && finance.open_po_count > 0) {
    items.push({
      label: 'Open POs',
      value: `${finance.open_po_count} ($${((finance.open_po_value ?? 0) / 1000).toFixed(0)}K)`,
      color: 'text-[#3ec9d6]',
    })
  }
  if (finance.overdue_invoice_count && finance.overdue_invoice_count > 0) {
    items.push({
      label: 'Overdue',
      value: `${finance.overdue_invoice_count} inv ($${((finance.overdue_invoice_value ?? 0) / 1000).toFixed(0)}K)`,
      color: 'text-[#ff3a6e]',
    })
  }
  if (finance.last_payment_date) {
    items.push({
      label: 'Last Payment',
      value: new Date(finance.last_payment_date).toLocaleDateString(),
      color: 'text-gray-500',
    })
  }
  if (support.open_ticket_count && support.open_ticket_count > 0) {
    items.push({
      label: 'Tickets',
      value: `${support.open_ticket_count} open`,
      color: 'text-[#ffa21d]',
    })
  }

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-[#51459d]/5 to-transparent border-b border-[#51459d]/10">
      <div className="flex items-center gap-1">
        <svg className="w-3.5 h-3.5 text-[#51459d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-[10px] font-semibold text-[#51459d] uppercase tracking-wide">
          {crm.contact_name || senderEmail.split('@')[0]}
        </span>
      </div>
      <div className="flex items-center gap-3 overflow-x-auto">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1 whitespace-nowrap">
            <span className="text-[10px] text-gray-400">{item.label}:</span>
            <span className={`text-[11px] font-semibold ${item.color}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
