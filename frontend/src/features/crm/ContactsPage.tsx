import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
  type ContactType,
  type CreateContactPayload,
} from '../../api/crm'
import {
  Button,
  Modal,
  Input,
  Badge,
  Card,
  Table,
  Pagination,
  Select,
} from '../../components/ui'
import { toast } from '../../components/ui'
import apiClient from '../../api/client'

const EMPTY_FORM: CreateContactPayload = {
  name: '',
  email: '',
  phone: '',
  company: '',
  contact_type: 'person',
  notes: '',
}

async function handleExport(endpoint: string, filename: string) {
  try {
    const response = await apiClient.get(endpoint, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch {
    toast('error', 'Export failed')
  }
}

export default function ContactsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContactType | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<CreateContactPayload>(EMPTY_FORM)

  const limit = 20
  const { data, isLoading } = useContacts({ page, limit, search, contact_type: typeFilter })
  const createMutation = useCreateContact()
  const updateMutation = useUpdateContact()
  const deleteMutation = useDeleteContact()

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditing(contact)
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone ?? '',
      company: contact.company ?? '',
      contact_type: contact.contact_type,
      notes: contact.notes ?? '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Contact updated')
      } else {
        await createMutation.mutateAsync(form)
        toast('success', 'Contact created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save contact')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this contact?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('success', 'Contact deleted')
    } catch {
      toast('error', 'Failed to delete contact')
    }
  }

  const totalPages = Math.ceil((data?.total ?? 0) / limit)

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: Contact) => (
        <button
          className="text-primary font-medium hover:underline text-left"
          onClick={() => navigate(`/crm/contacts/${row.id}`)}
        >
          {row.name}
        </button>
      ),
    },
    { key: 'email', label: 'Email' },
    { key: 'company', label: 'Company', render: (row: Contact) => row.company || '---' },
    { key: 'phone', label: 'Phone', render: (row: Contact) => row.phone || '---' },
    {
      key: 'contact_type',
      label: 'Type',
      render: (row: Contact) => (
        <Badge variant={row.contact_type === 'company' ? 'primary' : 'info'}>
          {row.contact_type}
        </Badge>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: Contact) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (row: Contact) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => handleDelete(row.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your CRM contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport('/crm/contacts/export', 'contacts.csv')}>
            Export CSV
          </Button>
          <Button onClick={openCreate}>+ New Contact</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="w-40">
            <Select
              options={[
                { value: '', label: 'All Types' },
                { value: 'person', label: 'Person' },
                { value: 'company', label: 'Company' },
              ]}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as ContactType | '')
                setPage(1)
              }}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.items ?? []}
          loading={isLoading}
          emptyText="No contacts found"
          keyExtractor={(row) => row.id}
        />
        <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Contact' : 'New Contact'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone"
              value={form.phone ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Company"
              value={form.company ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
          </div>
          <Select
            label="Contact Type"
            options={[
              { value: 'person', label: 'Person' },
              { value: 'company', label: 'Company' },
            ]}
            value={form.contact_type}
            onChange={(e) => setForm((f) => ({ ...f, contact_type: e.target.value as ContactType }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save Changes' : 'Create Contact'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
