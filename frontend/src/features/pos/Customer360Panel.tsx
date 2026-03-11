import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Card, Spinner, toast } from '../../components/ui'
import apiClient from '../../api/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerContact {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  created_at: string
}

interface PurchaseSummary {
  total_transactions: number
  total_spent: string
  average_transaction: string
  last_purchase_date: string | null
}

interface LoyaltyInfo {
  enrolled: boolean
  program_name: string | null
  points_balance: number
  lifetime_points: number
  tier_name: string | null
  member_id: string | null
}

interface StoreCreditInfo {
  balance: string
}

interface GiftCardInfo {
  id: string
  code: string
  balance: string
  expires_at: string | null
  is_active: boolean
}

interface SupportTicketInfo {
  id: string
  subject: string
  status: string
  created_at: string
}

interface Customer360Data {
  contact: CustomerContact
  purchases: PurchaseSummary
  loyalty: LoyaltyInfo
  store_credit: StoreCreditInfo
  gift_cards: GiftCardInfo[]
  support_tickets: SupportTicketInfo[]
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCustomer360(customerId: string) {
  return useQuery({
    queryKey: ['pos', 'customer360', customerId],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer360Data>(`/pos/customers/${customerId}/360`)
      return data
    },
    enabled: !!customerId,
  })
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Customer360PanelProps {
  customerId: string
  open: boolean
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Customer360Panel({ customerId, open, onClose }: Customer360PanelProps) {
  const { data, isLoading, error } = useCustomer360(customerId)

  // Lock body scroll when panel is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const statusColor: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
    open: 'info',
    in_progress: 'warning',
    resolved: 'success',
    closed: 'default',
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-out Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto"
        style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer 360</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Failed to load customer data. The customer may not exist or the server is unavailable.
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => toast('info', 'Retrying...')}>
                Retry
              </Button>
            </div>
          )}

          {data && (
            <>
              {/* Contact Details */}
              <Card>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Contact
                  </h3>
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{data.contact.name}</p>
                    {data.contact.company && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{data.contact.company}</p>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    {data.contact.email && (
                      <p className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {data.contact.email}
                      </p>
                    )}
                    {data.contact.phone && (
                      <p className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {data.contact.phone}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Customer since {new Date(data.contact.created_at).toLocaleDateString()}</p>
                </div>
              </Card>

              {/* Purchase History Summary */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Purchase History
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.purchases.total_transactions}</p>
                    <p className="text-xs text-gray-500">Total Orders</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.purchases.total_spent}</p>
                    <p className="text-xs text-gray-500">Total Spent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.purchases.average_transaction}</p>
                    <p className="text-xs text-gray-500">Avg Transaction</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {data.purchases.last_purchase_date
                        ? new Date(data.purchases.last_purchase_date).toLocaleDateString()
                        : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500">Last Purchase</p>
                  </div>
                </div>
              </Card>

              {/* Loyalty */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Loyalty
                </h3>
                {data.loyalty.enrolled ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Program</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.loyalty.program_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Tier</span>
                      <Badge variant="primary">{data.loyalty.tier_name ?? 'Base'}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Points Balance</span>
                      <span className="text-lg font-bold text-[#51459d]">{data.loyalty.points_balance.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">Lifetime Points</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{data.loyalty.lifetime_points.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Not enrolled in any loyalty program.</p>
                )}
              </Card>

              {/* Store Credit */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Store Credit
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.store_credit.balance}</p>
                <p className="text-xs text-gray-500">Available balance</p>
              </Card>

              {/* Gift Cards */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Active Gift Cards
                </h3>
                {data.gift_cards.length > 0 ? (
                  <div className="space-y-2">
                    {data.gift_cards.map((gc) => (
                      <div key={gc.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{gc.code}</p>
                          {gc.expires_at && (
                            <p className="text-xs text-gray-400">Expires {new Date(gc.expires_at).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{gc.balance}</p>
                          <Badge variant={gc.is_active ? 'success' : 'default'} className="text-[10px]">
                            {gc.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No active gift cards.</p>
                )}
              </Card>

              {/* Support Tickets */}
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Recent Support Tickets
                </h3>
                {data.support_tickets.length > 0 ? (
                  <div className="space-y-2">
                    {data.support_tickets.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.subject}</p>
                          <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={statusColor[t.status] ?? 'default'}>{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No support tickets.</p>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Customer360Panel
