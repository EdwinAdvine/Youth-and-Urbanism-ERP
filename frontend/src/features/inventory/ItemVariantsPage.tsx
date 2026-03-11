import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useInventoryItems,
  useItemVariants,
  useCreateItemVariant,
  useUpdateItemVariant,
  useDeleteItemVariant,
  type ItemVariant,
  type CreateItemVariantPayload,
} from '../../api/inventory'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function ItemVariantsPage() {
  const { data: itemsData, isLoading: itemsLoading } = useInventoryItems({ limit: 500 })
  const [selectedItemId, setSelectedItemId] = useState('')
  const { data: variants, isLoading: variantsLoading } = useItemVariants(selectedItemId)
  const createVariant = useCreateItemVariant()
  const updateVariant = useUpdateItemVariant()
  const deleteVariant = useDeleteItemVariant()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ItemVariant | null>(null)
  const [form, setForm] = useState<{ variant_name: string; sku: string; price_adjustment: number; attributes: { key: string; value: string }[] }>({
    variant_name: '',
    sku: '',
    price_adjustment: 0,
    attributes: [{ key: '', value: '' }],
  })

  function openCreate() {
    setEditing(null)
    setForm({ variant_name: '', sku: '', price_adjustment: 0, attributes: [{ key: '', value: '' }] })
    setShowModal(true)
  }

  function openEdit(v: ItemVariant) {
    setEditing(v)
    const attrs = Object.entries(v.attributes ?? {}).map(([key, value]) => ({ key, value }))
    setForm({
      variant_name: v.variant_name,
      sku: v.sku,
      price_adjustment: v.price_adjustment,
      attributes: attrs.length > 0 ? attrs : [{ key: '', value: '' }],
    })
    setShowModal(true)
  }

  function addAttribute() {
    setForm((p) => ({ ...p, attributes: [...p.attributes, { key: '', value: '' }] }))
  }

  function removeAttribute(idx: number) {
    setForm((p) => ({ ...p, attributes: p.attributes.filter((_, i) => i !== idx) }))
  }

  function updateAttribute(idx: number, field: 'key' | 'value', val: string) {
    setForm((p) => ({
      ...p,
      attributes: p.attributes.map((a, i) => (i === idx ? { ...a, [field]: val } : a)),
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const attributes: Record<string, string> = {}
    form.attributes.forEach((a) => { if (a.key) attributes[a.key] = a.value })

    if (editing) {
      updateVariant.mutate(
        { id: editing.id, item_id: selectedItemId, variant_name: form.variant_name, sku: form.sku, price_adjustment: form.price_adjustment, attributes },
        {
          onSuccess: () => { toast('success', 'Variant updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update variant'),
        }
      )
    } else {
      const payload: CreateItemVariantPayload = {
        item_id: selectedItemId,
        variant_name: form.variant_name,
        sku: form.sku || undefined,
        price_adjustment: form.price_adjustment,
        attributes,
      }
      createVariant.mutate(payload, {
        onSuccess: () => { toast('success', 'Variant created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create variant'),
      })
    }
  }

  function handleDelete(v: ItemVariant) {
    if (!window.confirm(`Delete variant "${v.variant_name}"?`)) return
    deleteVariant.mutate(
      { itemId: selectedItemId, variantId: v.id },
      {
        onSuccess: () => toast('success', 'Variant deleted'),
        onError: () => toast('error', 'Failed to delete variant'),
      }
    )
  }

  const columns = [
    {
      key: 'variant_name',
      label: 'Variant',
      render: (v: ItemVariant) => (
        <div>
          <p className="font-medium text-gray-900">{v.variant_name}</p>
          <p className="text-xs text-gray-400">SKU: {v.sku}</p>
        </div>
      ),
    },
    {
      key: 'attributes',
      label: 'Attributes',
      render: (v: ItemVariant) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(v.attributes ?? {}).map(([key, val]) => (
            <Badge key={key} variant="primary">{key}: {val}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'price_adjustment',
      label: 'Price Adj.',
      render: (v: ItemVariant) => (
        <span className={v.price_adjustment >= 0 ? 'text-green-600' : 'text-red-600'}>
          {v.price_adjustment >= 0 ? '+' : ''}{formatCurrency(v.price_adjustment)}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (v: ItemVariant) => <Badge variant={v.is_active ? 'success' : 'default'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (v: ItemVariant) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>Edit</Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(v)}>Delete</Button>
        </div>
      ),
    },
  ]

  if (itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Variants</h1>
          <p className="text-sm text-gray-500 mt-1">Manage product variants (size, color, etc.)</p>
        </div>
        <Button onClick={openCreate} disabled={!selectedItemId}>Add Variant</Button>
      </div>

      <Select
        label="Select Item"
        options={[
          { value: '', label: 'Choose an item...' },
          ...(itemsData?.items?.map((i) => ({ value: i.id, label: `${i.sku} - ${i.name}` })) ?? []),
        ]}
        value={selectedItemId}
        onChange={(e) => setSelectedItemId(e.target.value)}
        className="w-80"
      />

      {!selectedItemId ? (
        <Card>
          <div className="text-center py-12 text-gray-400">Select an item to manage its variants</div>
        </Card>
      ) : variantsLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]"><Spinner size="lg" /></div>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={variants ?? []}
            keyExtractor={(v) => v.id}
            emptyText="No variants for this item."
          />
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Variant' : 'Add Variant'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Variant Name" required value={form.variant_name} onChange={(e) => setForm((p) => ({ ...p, variant_name: e.target.value }))} placeholder="e.g., Large Red" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} />
            <Input label="Price Adjustment" type="number" step="0.01" value={form.price_adjustment} onChange={(e) => setForm((p) => ({ ...p, price_adjustment: Number(e.target.value) }))} placeholder="e.g., 5.00 or -2.50" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Attributes</label>
              <Button variant="ghost" size="sm" type="button" onClick={addAttribute}>+ Add</Button>
            </div>
            {form.attributes.map((attr, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input placeholder="Key (e.g., Color)" value={attr.key} onChange={(e) => updateAttribute(idx, 'key', e.target.value)} className="flex-1" />
                <Input placeholder="Value (e.g., Red)" value={attr.value} onChange={(e) => updateAttribute(idx, 'value', e.target.value)} className="flex-1" />
                {form.attributes.length > 1 && (
                  <Button variant="ghost" size="sm" type="button" className="text-danger" onClick={() => removeAttribute(idx)}>X</Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createVariant.isPending || updateVariant.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
