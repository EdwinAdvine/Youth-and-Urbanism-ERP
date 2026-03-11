import { useState } from 'react'
import { Button, Card, Input, Modal, Spinner, Table, Badge, toast } from '../../components/ui'
import {
  useCurrencies,
  useCreateCurrency,
  useUpdateCurrency,
  useDeleteCurrency,
  useExchangeRates,
  useCreateExchangeRate,
  type Currency,
  type ExchangeRateEntry,
} from '../../api/finance'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function CurrencyPage() {
  const { data: currencies, isLoading } = useCurrencies()
  const { data: rates, isLoading: ratesLoading } = useExchangeRates()
  const createCurrency = useCreateCurrency()
  const updateCurrency = useUpdateCurrency()
  const deleteCurrency = useDeleteCurrency()
  const createRate = useCreateExchangeRate()

  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [isBase, setIsBase] = useState(false)

  const [showRateModal, setShowRateModal] = useState(false)
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [rate, setRate] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')

  function openCreateCurrency() {
    setEditCurrency(null)
    setCode('')
    setName('')
    setSymbol('')
    setIsBase(false)
    setShowCurrencyModal(true)
  }

  function openEditCurrency(c: Currency) {
    setEditCurrency(c)
    setCode(c.code)
    setName(c.name)
    setSymbol(c.symbol)
    setIsBase(c.is_base)
    setShowCurrencyModal(true)
  }

  async function handleSaveCurrency() {
    if (!code.trim() || !name.trim() || !symbol.trim()) {
      toast('warning', 'All fields are required')
      return
    }
    try {
      if (editCurrency) {
        await updateCurrency.mutateAsync({ id: editCurrency.id, code, name, symbol, is_base: isBase })
        toast('success', 'Currency updated')
      } else {
        await createCurrency.mutateAsync({ code, name, symbol, is_base: isBase })
        toast('success', 'Currency created')
      }
      setShowCurrencyModal(false)
    } catch {
      toast('error', 'Failed to save currency')
    }
  }

  async function handleDeleteCurrency(id: string) {
    if (!confirm('Delete this currency?')) return
    try {
      await deleteCurrency.mutateAsync(id)
      toast('success', 'Currency deleted')
    } catch {
      toast('error', 'Failed to delete currency')
    }
  }

  async function handleCreateRate() {
    if (!fromId || !toId || !rate || !effectiveDate) {
      toast('warning', 'All fields are required')
      return
    }
    try {
      await createRate.mutateAsync({
        from_currency_id: fromId,
        to_currency_id: toId,
        rate: parseFloat(rate),
        effective_date: effectiveDate,
      })
      toast('success', 'Exchange rate added')
      setShowRateModal(false)
    } catch {
      toast('error', 'Failed to create exchange rate')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const currencyColumns = [
    { key: 'code', label: 'Code', render: (c: Currency) => <span className="font-mono font-semibold">{c.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'symbol', label: 'Symbol', render: (c: Currency) => <span className="text-lg">{c.symbol}</span> },
    {
      key: 'is_base',
      label: 'Base',
      render: (c: Currency) => c.is_base ? <Badge variant="success">Base</Badge> : <span className="text-gray-400">-</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (c: Currency) => (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEditCurrency(c)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteCurrency(c.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  const rateColumns = [
    { key: 'from', label: 'From', render: (r: ExchangeRateEntry) => <span className="font-mono">{r.from_currency_code}</span> },
    { key: 'to', label: 'To', render: (r: ExchangeRateEntry) => <span className="font-mono">{r.to_currency_code}</span> },
    { key: 'rate', label: 'Rate', render: (r: ExchangeRateEntry) => <span className="font-medium">{r.rate}</span> },
    { key: 'effective_date', label: 'Effective Date', render: (r: ExchangeRateEntry) => formatDate(r.effective_date) },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Currencies & Exchange Rates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage currencies and conversion rates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setFromId(''); setToId(''); setRate(''); setEffectiveDate(''); setShowRateModal(true) }}>
            Add Exchange Rate
          </Button>
          <Button size="sm" onClick={openCreateCurrency}>Add Currency</Button>
        </div>
      </div>

      {/* Currencies */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Currencies</h2>
        </div>
        <Table columns={currencyColumns} data={currencies ?? []} loading={isLoading} emptyText="No currencies defined" keyExtractor={(c) => c.id} />
      </Card>

      {/* Exchange Rates */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Exchange Rates</h2>
        </div>
        <Table columns={rateColumns} data={rates ?? []} loading={ratesLoading} emptyText="No exchange rates" keyExtractor={(r) => r.id} />
      </Card>

      {/* Currency Modal */}
      <Modal open={showCurrencyModal} onClose={() => setShowCurrencyModal(false)} title={editCurrency ? 'Edit Currency' : 'Add Currency'}>
        <div className="space-y-4">
          <Input label="Code (3 chars)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="US Dollar" />
          <Input label="Symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="$" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isBase} onChange={(e) => setIsBase(e.target.checked)} className="rounded" />
            Base currency
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCurrencyModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveCurrency} loading={createCurrency.isPending || updateCurrency.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Exchange Rate Modal */}
      <Modal open={showRateModal} onClose={() => setShowRateModal(false)} title="Add Exchange Rate">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Currency</label>
            <select className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">Select...</option>
              {(currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Currency</label>
            <select className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">Select...</option>
              {(currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <Input label="Rate" type="number" step="0.00000001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1.00000000" />
          <Input label="Effective Date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowRateModal(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateRate} loading={createRate.isPending}>Add Rate</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
