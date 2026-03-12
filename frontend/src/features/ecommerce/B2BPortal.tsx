import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Card, Badge, Modal, Input, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  product_id: string
  product_name: string
  quantity: number
  requested_price: number
}

interface B2BQuote {
  id: string
  company_name: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'converted'
  items: QuoteItem[]
  po_number: string | null
  created_at: string
  total_value: number
}

interface CompanyForm {
  name: string
  tax_id: string
  contact_email: string
  contact_phone: string
  address: string
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const QUOTE_STATUS_BADGE: Record<B2BQuote['status'], 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  draft: 'default',
  submitted: 'info',
  reviewed: 'warning',
  approved: 'success',
  rejected: 'danger',
  converted: 'primary',
}

const emptyCompanyForm: CompanyForm = {
  name: '', tax_id: '', contact_email: '', contact_phone: '', address: '', notes: '',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function B2BPortal() {
  const [activeTab, setActiveTab] = useState<'register' | 'quotes'>('register')
  const [form, setForm] = useState<CompanyForm>(emptyCompanyForm)
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [newItem, setNewItem] = useState<Omit<QuoteItem, 'product_id'>>({ product_name: '', quantity: 1, requested_price: 0 })

  const { data: quotes = [], isLoading: quotesLoading } = useQuery<B2BQuote[]>({
    queryKey: ['b2b-my-quotes'],
    queryFn: async () => [],
  })

  const registerMutation = useMutation({
    mutationFn: async (_payload: CompanyForm) => {
      // POST /api/v1/ecommerce/b2b/companies
      return {}
    },
    onSuccess: () => {
      toast('success', 'Company registration submitted for review')
      setForm(emptyCompanyForm)
    },
    onError: () => toast('error', 'Failed to submit registration'),
  })

  const submitQuoteMutation = useMutation({
    mutationFn: async (_payload: { items: QuoteItem[] }) => {
      // POST /api/v1/ecommerce/b2b/quotes
      return {}
    },
    onSuccess: () => {
      toast('success', 'Quote request submitted')
      setQuoteItems([])
      setShowQuoteModal(false)
    },
    onError: () => toast('error', 'Failed to submit quote'),
  })

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    registerMutation.mutate(form)
  }

  const handleAddItem = () => {
    if (!newItem.product_name || newItem.quantity < 1) return
    setQuoteItems([...quoteItems, { ...newItem, product_id: crypto.randomUUID() }])
    setNewItem({ product_name: '', quantity: 1, requested_price: 0 })
  }

  const handleRemoveItem = (idx: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== idx))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">B2B Portal</h1>
        <p className="text-sm text-gray-500 mt-1">Register your company and request bulk pricing quotes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['register', 'quotes'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'register' ? 'Company Registration' : 'My Quotes'}
          </button>
        ))}
      </div>

      {activeTab === 'register' && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Register Your Company</h2>
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Company Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Acme Corporation" />
              <Input label="Tax ID / KRA PIN" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} required placeholder="A123456789Z" />
              <Input label="Contact Email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} required placeholder="procurement@company.com" />
              <Input label="Contact Phone" type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+254 700 000 000" />
            </div>
            <Input label="Business Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Business Park, Nairobi" />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Additional Notes</label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 min-h-[80px]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional information about your business..."
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={registerMutation.isPending}>Submit Registration</Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowQuoteModal(true)}>Request Quote</Button>
          </div>
          {quotesLoading ? (
            <Card><p className="text-sm text-gray-400 text-center py-4">Loading quotes...</p></Card>
          ) : quotes.length === 0 ? (
            <Card><p className="text-sm text-gray-400 text-center py-8">No quotes yet. Click "Request Quote" to get started.</p></Card>
          ) : (
            <Card padding={false}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Company', 'Status', 'Items', 'PO Number', 'Date'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-gray-900">{q.company_name}</td>
                      <td className="py-3 px-4"><Badge variant={QUOTE_STATUS_BADGE[q.status]}>{q.status}</Badge></td>
                      <td className="py-3 px-4 text-gray-600">{q.items.length}</td>
                      <td className="py-3 px-4 text-gray-500">{q.po_number ?? '-'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{formatDate(q.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Quote Request Modal */}
      <Modal open={showQuoteModal} onClose={() => setShowQuoteModal(false)} title="Request a Quote" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Input label="Product Name" value={newItem.product_name} onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })} placeholder="Product name" />
            </div>
            <Input label="Quantity" type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })} />
            <Input label="Requested Price (KES)" type="number" min="0" step="0.01" value={newItem.requested_price || ''} onChange={(e) => setNewItem({ ...newItem, requested_price: parseFloat(e.target.value) || 0 })} />
          </div>
          <Button variant="outline" size="sm" onClick={handleAddItem}>Add Item</Button>

          {quoteItems.length > 0 && (
            <div className="border border-gray-100 rounded-[10px] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Product</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Qty</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Req. Price</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-900">{item.product_name}</td>
                      <td className="py-2 px-3 text-gray-600">{item.quantity}</td>
                      <td className="py-2 px-3 text-gray-600">{formatCurrency(item.requested_price)}</td>
                      <td className="py-2 px-3">
                        <button onClick={() => handleRemoveItem(idx)} className="text-danger text-xs hover:underline">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowQuoteModal(false)}>Cancel</Button>
            <Button
              disabled={quoteItems.length === 0}
              loading={submitQuoteMutation.isPending}
              onClick={() => submitQuoteMutation.mutate({ items: quoteItems })}
            >
              Submit Quote Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
