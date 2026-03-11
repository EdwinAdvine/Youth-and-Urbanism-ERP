import { useState } from 'react'
import { Button, Spinner, Badge, Modal, Input, Card, Table, Select, Pagination } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useJournalEntries,
  useCreateJournalEntry,
  usePostJournalEntry,
  useAccounts,
  type JournalEntry,
  type CreateJournalEntryPayload,
} from '../../api/finance'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

interface JournalLineForm {
  account_id: string
  debit: number
  credit: number
  description: string
}

export default function JournalPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const limit = 10

  const { data, isLoading } = useJournalEntries({
    page,
    limit,
    status: statusFilter || undefined,
  })
  const { data: accounts } = useAccounts()
  const createEntry = useCreateJournalEntry()
  const postEntry = usePostJournalEntry()

  const [modalOpen, setModalOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [lines, setLines] = useState<JournalLineForm[]>([
    { account_id: '', debit: 0, credit: 0, description: '' },
    { account_id: '', debit: 0, credit: 0, description: '' },
  ])

  const accountOptions = (accounts ?? []).map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }))
  const accountOptionsWithEmpty = [{ value: '', label: 'Select account' }, ...accountOptions]

  function resetForm() {
    setDescription('')
    setEntryDate(new Date().toISOString().split('T')[0])
    setLines([
      { account_id: '', debit: 0, credit: 0, description: '' },
      { account_id: '', debit: 0, credit: 0, description: '' },
    ])
  }

  function addLine() {
    setLines([...lines, { account_id: '', debit: 0, credit: 0, description: '' }])
  }

  function removeLine(index: number) {
    if (lines.length <= 2) return
    setLines(lines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof JournalLineForm, value: string | number) {
    const updated = [...lines]
    updated[index] = { ...updated[index], [field]: value }
    // If debit is entered, clear credit and vice versa
    if (field === 'debit' && Number(value) > 0) {
      updated[index].credit = 0
    } else if (field === 'credit' && Number(value) > 0) {
      updated[index].debit = 0
    }
    setLines(updated)
  }

  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0)
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0

  async function handleCreate() {
    if (!description.trim()) {
      toast('warning', 'Description is required')
      return
    }
    if (lines.some((l) => !l.account_id)) {
      toast('warning', 'All lines must have an account selected')
      return
    }
    if (!isBalanced) {
      toast('error', 'Total debits must equal total credits')
      return
    }

    const payload: CreateJournalEntryPayload = {
      entry_date: entryDate,
      description: description.trim(),
      lines: lines.map((l) => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
        description: l.description,
      })),
    }

    try {
      await createEntry.mutateAsync(payload)
      toast('success', 'Journal entry created')
      resetForm()
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to create journal entry')
    }
  }

  async function handlePost(id: string) {
    if (!window.confirm('Post this journal entry? This cannot be undone.')) return
    try {
      await postEntry.mutateAsync(id)
      toast('success', 'Journal entry posted')
    } catch {
      toast('error', 'Failed to post journal entry')
    }
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const columns = [
    { key: 'entry_number', label: 'Entry #' },
    {
      key: 'entry_date',
      label: 'Date',
      render: (row: JournalEntry) =>
        new Date(row.entry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    },
    { key: 'description', label: 'Description' },
    {
      key: 'total_debit',
      label: 'Debit',
      render: (row: JournalEntry) => <span className="font-medium">{formatCurrency(row.total_debit)}</span>,
    },
    {
      key: 'total_credit',
      label: 'Credit',
      render: (row: JournalEntry) => <span className="font-medium">{formatCurrency(row.total_credit)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: JournalEntry) => (
        <Badge variant={row.status === 'posted' ? 'success' : 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (row: JournalEntry) =>
        row.status === 'draft' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePost(row.id)}
            loading={postEntry.isPending}
          >
            Post
          </Button>
        ) : null,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-1">Record and manage journal entries</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Entry
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-40">
          <Select
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          />
        </div>
        <span className="text-sm text-gray-500">{data?.total ?? 0} entries</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<JournalEntry>
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          emptyText="No journal entries"
          keyExtractor={(row) => row.id}
        />
        <Pagination
          page={page}
          pages={totalPages}
          total={data?.total ?? 0}
          onChange={setPage}
        />
      </Card>

      {/* Create Entry Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetForm() }} title="New Journal Entry" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Entry description"
              autoFocus
            />
          </div>

          {/* Journal Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-900">Lines</label>
              <Button variant="ghost" size="sm" onClick={addLine}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Line
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Account</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-28">Debit</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-28">Credit</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Memo</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-2">
                        <select
                          value={line.account_id}
                          onChange={(e) => updateLine(i, 'account_id', e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        >
                          {accountOptionsWithEmpty.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(i, 'debit', Number(e.target.value))}
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(i, 'credit', Number(e.target.value))}
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(i, 'description', e.target.value)}
                          placeholder="Line memo"
                          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                      </td>
                      <td className="py-2 px-1">
                        {lines.length > 2 && (
                          <button
                            onClick={() => removeLine(i)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="py-2 px-2 text-right font-semibold text-sm">Totals</td>
                    <td className="py-2 px-2 text-right font-semibold text-sm">{formatCurrency(totalDebits)}</td>
                    <td className="py-2 px-2 text-right font-semibold text-sm">{formatCurrency(totalCredits)}</td>
                    <td colSpan={2} className="py-2 px-2">
                      {totalDebits > 0 || totalCredits > 0 ? (
                        isBalanced ? (
                          <span className="text-xs text-green-600 font-medium">Balanced</span>
                        ) : (
                          <span className="text-xs text-red-600 font-medium">
                            Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}
                          </span>
                        )
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              loading={createEntry.isPending}
              disabled={!isBalanced}
            >
              Create Entry
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
