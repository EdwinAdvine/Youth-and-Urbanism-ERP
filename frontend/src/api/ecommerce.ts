import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EcomStore {
  id: string
  name: string
  slug: string
  currency: string
  settings_json: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EcomProduct {
  id: string
  store_id: string
  inventory_item_id: string | null
  display_name: string
  slug: string
  description: string | null
  images: string[] | null
  price: number
  compare_at_price: number | null
  is_published: boolean
  seo_title: string | null
  seo_description: string | null
  created_at: string
  updated_at: string
}

export interface EcomCustomer {
  id: string
  store_id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  is_active: boolean
  crm_contact_id: string | null
  created_at: string
  updated_at: string
  addresses?: EcomAddress[]
  order_count?: number
}

export interface EcomAddress {
  id: string
  customer_id: string
  label: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string | null
  postal_code: string | null
  country: string
  is_default: boolean
  created_at: string
}

export interface EcomOrderLine {
  id: string
  order_id?: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface EcomOrder {
  id: string
  store_id: string
  order_number: string
  customer_id: string
  customer_name: string | null
  customer_email: string | null
  status: string
  subtotal: number
  tax: number
  shipping_cost: number
  total: number
  tracking_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  lines?: EcomOrderLine[]
  shipping_address?: EcomAddress | null
}

export interface EcomDashboardStats {
  total_orders: number
  total_revenue: number
  pending_orders: number
  shipped_orders: number
  total_customers: number
  total_products: number
  published_products: number
  recent_orders: EcomOrder[]
  top_products: { name: string; sold: number }[]
}

export interface PaginatedProducts {
  total: number
  products: EcomProduct[]
}

export interface PaginatedOrders {
  total: number
  orders: EcomOrder[]
}

export interface PaginatedCustomers {
  total: number
  customers: EcomCustomer[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface CreateStorePayload {
  name: string
  slug: string
  currency?: string
  settings_json?: Record<string, unknown>
  is_active?: boolean
}

export interface UpdateStorePayload extends Partial<CreateStorePayload> {
  id: string
}

export interface CreateProductPayload {
  store_id: string
  inventory_item_id?: string
  display_name: string
  slug: string
  description?: string
  images?: string[]
  price: number
  compare_at_price?: number
  is_published?: boolean
  seo_title?: string
  seo_description?: string
}

export interface UpdateProductPayload extends Partial<Omit<CreateProductPayload, 'store_id'>> {
  id: string
}

export interface UpdateOrderStatusPayload {
  id: string
  status: string
  tracking_number?: string
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export function useEcomStores() {
  return useQuery({
    queryKey: ['ecommerce', 'stores'],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomStore[]>('/ecommerce/stores')
      return data
    },
  })
}

export function useEcomStore(id: string) {
  return useQuery({
    queryKey: ['ecommerce', 'stores', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomStore>(`/ecommerce/stores/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateStorePayload) => {
      const { data } = await apiClient.post<EcomStore>('/ecommerce/stores', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'stores'] }),
  })
}

export function useUpdateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateStorePayload) => {
      const { data } = await apiClient.put<EcomStore>(`/ecommerce/stores/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'stores'] }),
  })
}

// ─── Products ─────────────────────────────────────────────────────────────────

export function useEcomProducts(params: {
  store_id?: string
  search?: string
  is_published?: boolean
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedProducts>('/ecommerce/products', { params })
      return data
    },
  })
}

export function useEcomProduct(id: string) {
  return useQuery({
    queryKey: ['ecommerce', 'products', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomProduct>(`/ecommerce/products/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateProductPayload) => {
      const { data } = await apiClient.post<EcomProduct>('/ecommerce/products', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecommerce', 'products'] })
      qc.invalidateQueries({ queryKey: ['ecommerce', 'dashboard'] })
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProductPayload) => {
      const { data } = await apiClient.put<EcomProduct>(`/ecommerce/products/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecommerce', 'products'] })
      qc.invalidateQueries({ queryKey: ['ecommerce', 'dashboard'] })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ecommerce/products/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecommerce', 'products'] })
      qc.invalidateQueries({ queryKey: ['ecommerce', 'dashboard'] })
    },
  })
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export function useEcomOrders(params: {
  store_id?: string
  status?: string
  search?: string
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'orders', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedOrders>('/ecommerce/orders', { params })
      return data
    },
  })
}

export function useEcomOrder(id: string) {
  return useQuery({
    queryKey: ['ecommerce', 'orders', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomOrder>(`/ecommerce/orders/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateOrderStatusPayload) => {
      const { data } = await apiClient.put<EcomOrder>(`/ecommerce/orders/${id}/status`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecommerce', 'orders'] })
      qc.invalidateQueries({ queryKey: ['ecommerce', 'dashboard'] })
    },
  })
}

// ─── Customers ────────────────────────────────────────────────────────────────

export function useEcomCustomers(params: {
  store_id?: string
  search?: string
  page?: number
  limit?: number
} = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'customers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCustomers>('/ecommerce/customers', { params })
      return data
    },
  })
}

export function useEcomCustomer(id: string) {
  return useQuery({
    queryKey: ['ecommerce', 'customers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomCustomer>(`/ecommerce/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useEcomDashboard() {
  return useQuery({
    queryKey: ['ecommerce', 'dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get<EcomDashboardStats>('/ecommerce/dashboard')
      return data
    },
  })
}
