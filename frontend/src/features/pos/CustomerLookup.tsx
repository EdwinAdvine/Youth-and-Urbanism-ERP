import { useState, useRef, useEffect } from 'react'
import { Button, Badge, Modal, Input, Spinner } from '../../components/ui'
import { useEcomCustomers, type EcomCustomer } from '../../api/ecommerce'
import { usePOSTransactions } from '../../api/pos'

// ─── CustomerLookup ──────────────────────────────────────────────────────────
// Search dialog for looking up customers by name/phone/email.
// Shows purchase history and loyalty points.

interface CustomerLookupProps {
  open: boolean
  onClose: () => void
  onSelectCustomer: (customer: SelectedCustomer) => void
}

export interface SelectedCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  loyalty_points: number
}

export default function CustomerLookup({ open, onClose, onSelectCustomer }: CustomerLookupProps) {
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<EcomCustomer | null>(null)
  const [tab, setTab] = useState<'search' | 'detail'>('search')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: customersData, isLoading } = useEcomCustomers({
    search: search || undefined,
    limit: 20,
  })

  // Load customer transactions when viewing detail
  const { data: txData, isLoading: txLoading } = usePOSTransactions({
    limit: 10,
  })

  useEffect(() => {
    if (open) {
      setSearch('')
      setSelectedCustomer(null)
      setTab('search')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  function handleSelectFromList(customer: EcomCustomer) {
    setSelectedCustomer(customer)
    setTab('detail')
  }

  function handleConfirmSelection() {
    if (!selectedCustomer) return
    const fullName = [selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') || selectedCustomer.email
    onSelectCustomer({
      id: selectedCustomer.id,
      name: fullName,
      email: selectedCustomer.email,
      phone: selectedCustomer.phone,
      loyalty_points: calculateLoyaltyPoints(selectedCustomer),
    })
    onClose()
  }

  // Simple loyalty points calculation (1 point per order)
  function calculateLoyaltyPoints(customer: EcomCustomer): number {
    return customer.order_count ?? 0
  }

  const customers = customersData?.customers ?? []

  return (
    <Modal open={open} onClose={onClose} title="Customer Lookup" size="xl">
      <div className="min-h-[400px]">
        {tab === 'search' ? (
          <>
            {/* Search Input */}
            <div className="mb-4">
              <Input
                ref={inputRef}
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>

            {/* Results */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="md" />
              </div>
            ) : customers.length > 0 ? (
              <div className="space-y-1 max-h-[350px] overflow-y-auto">
                {customers.map((customer) => {
                  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(' ')
                  const loyaltyPoints = calculateLoyaltyPoints(customer)

                  return (
                    <button
                      key={customer.id}
                      onClick={() => handleSelectFromList(customer)}
                      className="w-full text-left px-3 py-3 rounded-[10px] hover:bg-gray-50 transition-colors flex items-center gap-3 group"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                        {(fullName || customer.email).charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {fullName || 'No name'}
                          </span>
                          {!customer.is_active && <Badge variant="default" className="text-[9px]">Inactive</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-500 truncate">{customer.email}</span>
                          {customer.phone && (
                            <span className="text-xs text-gray-400">{customer.phone}</span>
                          )}
                        </div>
                      </div>

                      {/* Loyalty Points */}
                      {loyaltyPoints > 0 && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          {loyaltyPoints} pts
                        </div>
                      )}

                      {/* Order count */}
                      {customer.order_count !== undefined && customer.order_count > 0 && (
                        <span className="text-xs text-gray-400">
                          {customer.order_count} order{customer.order_count !== 1 ? 's' : ''}
                        </span>
                      )}

                      {/* Arrow */}
                      <svg className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            ) : search ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-gray-500">No customers found for "{search}"</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="h-12 w-12 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm text-gray-500">Start typing to search customers</p>
              </div>
            )}
          </>
        ) : selectedCustomer ? (
          <>
            {/* Customer Detail View */}
            <button
              onClick={() => setTab('search')}
              className="flex items-center gap-1 text-xs text-primary hover:underline mb-4"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to search
            </button>

            {/* Customer Info */}
            <div className="flex items-start gap-4 mb-6 p-4 bg-gray-50 rounded-[10px]">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold shrink-0">
                {([selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') || selectedCustomer.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900">
                  {[selectedCustomer.first_name, selectedCustomer.last_name].filter(Boolean).join(' ') || 'No name'}
                </h3>
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {selectedCustomer.email}
                  </p>
                  {selectedCustomer.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {selectedCustomer.phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Loyalty Card */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-[10px] p-3 text-center shrink-0">
                <svg className="h-6 w-6 text-yellow-500 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <p className="text-xl font-bold text-yellow-700">{calculateLoyaltyPoints(selectedCustomer)}</p>
                <p className="text-[10px] text-yellow-600 font-medium">Loyalty Points</p>
              </div>
            </div>

            {/* Addresses */}
            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Addresses</h4>
                <div className="space-y-2">
                  {selectedCustomer.addresses.map((addr) => (
                    <div key={addr.id} className="text-xs text-gray-600 p-2 bg-gray-50 rounded-lg flex items-start gap-2">
                      <svg className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        {addr.label && <span className="font-medium">{addr.label}: </span>}
                        {addr.address_line1}, {addr.city}, {addr.country}
                        {addr.is_default && <Badge variant="primary" className="text-[8px] ml-1">Default</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Transactions */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Transactions</h4>
              {txLoading ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : txData && txData.transactions.length > 0 ? (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {txData.transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500">{tx.transaction_number}</span>
                        <Badge
                          variant={tx.status === 'completed' ? 'success' : tx.status === 'refunded' ? 'danger' : 'default'}
                          className="text-[9px]"
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">${tx.total.toFixed(2)}</span>
                        <span className="text-gray-400">
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">No recent transactions</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button variant="secondary" size="sm" onClick={() => setTab('search')}>
                Back
              </Button>
              <Button size="sm" onClick={handleConfirmSelection}>
                Select Customer
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  )
}

