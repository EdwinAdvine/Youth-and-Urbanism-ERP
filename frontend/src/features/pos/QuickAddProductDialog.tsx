import { useState } from 'react'
import { Button, Input, Modal, toast } from '../../components/ui'
import { useQuickAddProduct, type QuickAddProductPayload } from '../../api/pos'

interface QuickAddProductDialogProps {
  open: boolean
  onClose: () => void
}

const INITIAL: QuickAddProductPayload = {
  name: '',
  selling_price: 0,
  cost_price: undefined,
  category: undefined,
  initial_stock: undefined,
}

export function QuickAddProductDialog({ open, onClose }: QuickAddProductDialogProps) {
  const [form, setForm] = useState<QuickAddProductPayload>({ ...INITIAL })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const quickAdd = useQuickAddProduct()

  const update = <K extends keyof QuickAddProductPayload>(field: K, value: QuickAddProductPayload[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Product name is required'
    if (!form.selling_price || form.selling_price <= 0) errs.selling_price = 'Selling price must be greater than 0'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    try {
      const product = await quickAdd.mutateAsync({
        ...form,
        name: form.name.trim(),
        category: form.category?.trim() || undefined,
      })
      toast('success', `Product "${product.name}" created successfully`)
      setForm({ ...INITIAL })
      setErrors({})
      onClose()
    } catch {
      toast('error', 'Failed to create product')
    }
  }

  const handleClose = () => {
    setForm({ ...INITIAL })
    setErrors({})
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Quick Add Product" size="md">
      <div className="space-y-4">
        <Input
          label="Product Name"
          placeholder="e.g. Espresso Shot"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          error={errors.name}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Selling Price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.selling_price || ''}
            onChange={(e) => update('selling_price', parseFloat(e.target.value) || 0)}
            error={errors.selling_price}
          />

          <Input
            label="Cost Price (optional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.cost_price ?? ''}
            onChange={(e) => {
              const val = e.target.value
              update('cost_price', val ? parseFloat(val) : undefined)
            }}
          />
        </div>

        <Input
          label="Category"
          placeholder="e.g. Beverages"
          value={form.category ?? ''}
          onChange={(e) => update('category', e.target.value || undefined)}
        />

        <Input
          label="Initial Stock"
          type="number"
          min="0"
          step="1"
          placeholder="0"
          value={form.initial_stock ?? ''}
          onChange={(e) => {
            const val = e.target.value
            update('initial_stock', val ? parseInt(val, 10) : undefined)
          }}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={quickAdd.isPending}
            onClick={handleSubmit}
          >
            Add Product
          </Button>
        </div>
      </div>
    </Modal>
  )
}
