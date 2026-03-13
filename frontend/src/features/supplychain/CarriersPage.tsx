import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import apiClient from '@/api/client'

interface Carrier {
  id: string
  name: string
  code: string
  carrier_type: string
  rating: number | null
  is_active: boolean
  contact_email: string | null
  contact_phone: string | null
}

const carrierTypeVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  road: 'info',
  air: 'warning',
  sea: 'default',
  rail: 'success',
}

const emptyForm = {
  name: '',
  code: '',
  carrier_type: 'road',
  contact_email: '',
  contact_phone: '',
  rating: '',
}

function StarRating({ rating }: { rating: number | null }) {
  const stars = Math.round(rating ?? 0)
  return (
    <span className="text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < stars ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      ))}
      {rating != null && (
        <span className="ml-1 text-gray-500 text-xs">({rating.toFixed(1)})</span>
      )}
    </span>
  )
}

export default function CarriersPage() {
  const qc = useQueryClient()
  const [editCarrier, setEditCarrier] = useState<Carrier | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'carriers'],
    queryFn: () => apiClient.get('/supply-chain/logistics/carriers').then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      apiClient.post('/supply-chain/logistics/carriers', {
        ...payload,
        rating: payload.rating ? parseFloat(payload.rating) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sc', 'carriers'] })
      toast('success', 'Carrier created')
      setShowCreate(false)
      setForm(emptyForm)
    },
    onError: () => toast('error', 'Failed to create carrier'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Carrier> }) =>
      apiClient.patch(`/supply-chain/logistics/carriers/${id}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sc', 'carriers'] })
      toast('success', 'Carrier updated')
      setEditCarrier(null)
    },
    onError: () => toast('error', 'Failed to update carrier'),
  })

  const toggleActive = (carrier: Carrier) => {
    updateMutation.mutate({ id: carrier.id, payload: { is_active: !carrier.is_active } })
  }

  const carriers: Carrier[] = data?.items ?? data ?? []

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (r: Carrier) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.name}</span>
      ),
    },
    {
      key: 'code',
      label: 'Code',
      render: (r: Carrier) => (
        <span className="font-mono text-sm text-gray-500">{r.code}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      render: (r: Carrier) => (
        <Badge variant={carrierTypeVariant[r.carrier_type] ?? 'default'}>
          {r.carrier_type}
        </Badge>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r: Carrier) => <StarRating rating={r.rating} />,
    },
    {
      key: 'active',
      label: 'Active',
      render: (r: Carrier) => (
        <button
          onClick={() => toggleActive(r)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            r.is_active ? 'bg-success' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              r.is_active ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: Carrier) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditCarrier(r)
            setForm({
              name: r.name,
              code: r.code,
              carrier_type: r.carrier_type,
              contact_email: r.contact_email ?? '',
              contact_phone: r.contact_phone ?? '',
              rating: r.rating?.toString() ?? '',
            })
          }}
        >
          Edit
        </Button>
      ),
    },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editCarrier) {
      updateMutation.mutate({
        id: editCarrier.id,
        payload: {
          name: form.name,
          code: form.code,
          carrier_type: form.carrier_type,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          rating: form.rating ? parseFloat(form.rating) : null,
        },
      })
    } else {
      createMutation.mutate(form)
    }
  }

  const closeModal = () => {
    setShowCreate(false)
    setEditCarrier(null)
    setForm(emptyForm)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Carriers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage freight and transport carriers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add Carrier</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={carriers}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No carriers found"
        />
      </Card>

      <Modal
        open={showCreate || !!editCarrier}
        onClose={closeModal}
        title={editCarrier ? 'Edit Carrier' : 'Add Carrier'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>
          <Select
            label="Carrier Type"
            value={form.carrier_type}
            onChange={(e) => setForm({ ...form, carrier_type: e.target.value })}
            options={[
              { value: 'road', label: 'Road' },
              { value: 'air', label: 'Air' },
              { value: 'sea', label: 'Sea' },
              { value: 'rail', label: 'Rail' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
            />
            <Input
              label="Contact Phone"
              value={form.contact_phone}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
            />
          </div>
          <Input
            label="Rating (0-5)"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={form.rating}
            onChange={(e) => setForm({ ...form, rating: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editCarrier ? 'Save Changes' : 'Create Carrier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
