import { useState } from 'react'
import { Button, Spinner, Modal, Input, Badge, Card, Table, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  type Account,
  type AccountType,
  type CreateAccountPayload,
} from '../../api/finance'

const ACCOUNT_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
]

const ACCOUNT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
]

const TYPE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary'> = {
  asset: 'info',
  liability: 'danger',
  equity: 'primary',
  revenue: 'success',
  expense: 'warning',
}

export default function AccountsPage() {
  const [filterType, setFilterType] = useState<AccountType | undefined>(undefined)
  const { data: accounts, isLoading } = useAccounts(filterType)
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const deleteAccount = useDeleteAccount()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [form, setForm] = useState<CreateAccountPayload>({
    code: '',
    name: '',
    type: 'asset',
    currency: 'USD',
    description: '',
  })

  function resetForm() {
    setForm({ code: '', name: '', type: 'asset', currency: 'USD', description: '' })
    setEditingAccount(null)
  }

  function openCreate() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(account: Account) {
    setEditingAccount(account)
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      currency: account.currency,
      description: account.description,
    })
    setModalOpen(true)
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      toast('warning', 'Code and name are required')
      return
    }
    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({ id: editingAccount.id, ...form })
        toast('success', 'Account updated')
      } else {
        await createAccount.mutateAsync(form)
        toast('success', 'Account created')
      }
      resetForm()
      setModalOpen(false)
    } catch {
      toast('error', editingAccount ? 'Failed to update account' : 'Failed to create account')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to deactivate this account?')) return
    try {
      await deleteAccount.mutateAsync(id)
      toast('success', 'Account deactivated')
    } catch {
      toast('error', 'Failed to deactivate account')
    }
  }

  const columns = [
    { key: 'code', label: 'Code', className: 'w-24' },
    { key: 'name', label: 'Name' },
    {
      key: 'type',
      label: 'Type',
      render: (row: Account) => (
        <Badge variant={TYPE_BADGE[row.type] ?? 'default'}>{row.type}</Badge>
      ),
    },
    { key: 'currency', label: 'Currency', className: 'w-24' },
    {
      key: 'balance',
      label: 'Balance',
      render: (row: Account) => (
        <span className="font-medium">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency || 'USD' }).format(row.balance)}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: Account) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-24',
      render: (row: Account) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-gray-50 transition-colors"
            title="Edit"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Deactivate"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
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
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your financial accounts</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Account
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-48">
          <Select
            options={ACCOUNT_TYPES}
            value={filterType ?? ''}
            onChange={(e) => setFilterType((e.target.value || undefined) as AccountType | undefined)}
          />
        </div>
        <span className="text-sm text-gray-500">{accounts?.length ?? 0} accounts</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<Account>
          columns={columns}
          data={accounts ?? []}
          loading={isLoading}
          emptyText="No accounts found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm() }}
        title={editingAccount ? 'Edit Account' : 'New Account'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Account Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. 1000"
              autoFocus
            />
            <Select
              label="Type"
              options={ACCOUNT_TYPE_OPTIONS}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
            />
          </div>
          <Input
            label="Account Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Cash & Bank"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Currency"
              value={form.currency ?? 'USD'}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="USD"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional description..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setModalOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              loading={createAccount.isPending || updateAccount.isPending}
            >
              {editingAccount ? 'Update' : 'Create'} Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
