import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Spinner, Card } from '../../components/ui'
import {
  useEcomProduct,
  useEcomStores,
  useCreateProduct,
  useUpdateProduct,
  type CreateProductPayload,
} from '../../api/ecommerce'

export default function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const { data: existingProduct, isLoading: loadingProduct } = useEcomProduct(id || '')
  const { data: stores } = useEcomStores()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const [form, setForm] = useState<CreateProductPayload>({
    store_id: '',
    display_name: '',
    slug: '',
    description: '',
    price: 0,
    compare_at_price: undefined,
    is_published: false,
    seo_title: '',
    seo_description: '',
  })

  useEffect(() => {
    if (isEdit && existingProduct) {
      setForm({
        store_id: existingProduct.store_id,
        display_name: existingProduct.display_name,
        slug: existingProduct.slug,
        description: existingProduct.description || '',
        price: existingProduct.price,
        compare_at_price: existingProduct.compare_at_price || undefined,
        is_published: existingProduct.is_published,
        seo_title: existingProduct.seo_title || '',
        seo_description: existingProduct.seo_description || '',
        inventory_item_id: existingProduct.inventory_item_id || undefined,
      })
    }
  }, [isEdit, existingProduct])

  // Auto-generate slug from display name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setForm({ ...form, display_name: name, slug: isEdit ? form.slug : slug })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit && id) {
      const { store_id, ...updateData } = form
      await updateProduct.mutateAsync({ id, ...updateData })
    } else {
      await createProduct.mutateAsync(form)
    }
    navigate('/ecommerce/products')
  }

  if (isEdit && loadingProduct) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Product' : 'New Product'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isEdit ? `Editing ${existingProduct?.display_name}` : 'Add a new product to your store'}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/ecommerce/products')}>
          Back to Products
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isEdit && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Store</label>
                <select
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={form.store_id}
                  onChange={(e) => setForm({ ...form, store_id: e.target.value })}
                  required
                >
                  <option value="">Select a store...</option>
                  {(stores ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.display_name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input
                type="text"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[100px]"
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compare at Price (optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.compare_at_price || ''}
                onChange={(e) =>
                  setForm({ ...form, compare_at_price: e.target.value ? parseFloat(e.target.value) : undefined })
                }
              />
            </div>
          </div>
        </Card>

        {/* SEO */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">SEO</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Title</label>
              <input
                type="text"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={form.seo_title || ''}
                onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Description</label>
              <textarea
                className="w-full border border-gray-200 dark:border-gray-700 rounded-[10px] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[80px]"
                value={form.seo_description || ''}
                onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Publish */}
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Publish</h2>
              <p className="text-sm text-gray-500 mt-1">Make this product visible on the storefront</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" type="button" onClick={() => navigate('/ecommerce/products')}>
            Cancel
          </Button>
          <Button type="submit" loading={createProduct.isPending || updateProduct.isPending}>
            {isEdit ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
