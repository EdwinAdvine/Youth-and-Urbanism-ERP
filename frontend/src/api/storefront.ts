import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// Storefront uses a separate client — customer JWT is stored in sessionStorage
const sfClient = axios.create({
  baseURL: '/api/v1/storefront',
  headers: { 'Content-Type': 'application/json' },
})

sfClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('sf_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StorefrontProduct {
  id: string
  display_name: string
  slug: string
  description: string | null
  images: string[] | null
  price: number
  compare_at_price: number | null
  is_published: boolean
}

export interface PaginatedCatalog {
  total: number
  products: StorefrontProduct[]
}

export interface CartItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

export interface Cart {
  id: string
  items: CartItem[]
  subtotal: number
  item_count: number
}

export interface StorefrontOrder {
  id: string
  order_number: string
  status: string
  subtotal: number
  tax: number
  shipping_cost: number
  total: number
  created_at: string
  lines?: { product_name: string; quantity: number; unit_price: number; total: number }[]
}

export interface CustomerAuthResponse {
  access_token: string
  token_type: string
}

// ─── Catalog (public) ─────────────────────────────────────────────────────────

export function useCatalogProducts(storeSlug: string, params: { page?: number; limit?: number; search?: string } = {}) {
  return useQuery({
    queryKey: ['storefront', storeSlug, 'products', params],
    queryFn: async () => {
      const { data } = await sfClient.get<PaginatedCatalog>(`/${storeSlug}/products`, { params })
      return data
    },
    enabled: !!storeSlug,
  })
}

export function useCatalogProduct(storeSlug: string, productId: string) {
  return useQuery({
    queryKey: ['storefront', storeSlug, 'products', productId],
    queryFn: async () => {
      const { data } = await sfClient.get<StorefrontProduct>(`/${storeSlug}/products/${productId}`)
      return data
    },
    enabled: !!storeSlug && !!productId,
  })
}

// ─── Customer Auth ────────────────────────────────────────────────────────────

export function useStorefrontRegister(storeSlug: string) {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string; first_name?: string; last_name?: string }) => {
      const { data } = await sfClient.post<CustomerAuthResponse>(`/${storeSlug}/auth/register`, payload)
      sessionStorage.setItem('sf_token', data.access_token)
      return data
    },
  })
}

export function useStorefrontLogin(storeSlug: string) {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await sfClient.post<CustomerAuthResponse>(`/${storeSlug}/auth/login`, payload)
      sessionStorage.setItem('sf_token', data.access_token)
      return data
    },
  })
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export function useCart() {
  return useQuery({
    queryKey: ['storefront', 'cart'],
    queryFn: async () => {
      const { data } = await sfClient.get<Cart>('/cart')
      return data
    },
    enabled: !!sessionStorage.getItem('sf_token'),
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { product_id: string; quantity: number }) => {
      const { data } = await sfClient.post<Cart>('/cart/items', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storefront', 'cart'] }),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) => {
      const { data } = await sfClient.patch<Cart>(`/cart/items/${cartItemId}`, { quantity })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storefront', 'cart'] }),
  })
}

export function useRemoveFromCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cartItemId: string) => {
      await sfClient.delete(`/cart/items/${cartItemId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storefront', 'cart'] }),
  })
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      shipping_address: {
        address_line1: string
        city: string
        state?: string
        postal_code?: string
        country: string
      }
      notes?: string
    }) => {
      const { data } = await sfClient.post<StorefrontOrder>('/checkout', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storefront', 'cart'] })
      qc.invalidateQueries({ queryKey: ['storefront', 'orders'] })
    },
  })
}

// ─── Customer Orders ──────────────────────────────────────────────────────────

export function useCustomerOrders() {
  return useQuery({
    queryKey: ['storefront', 'orders'],
    queryFn: async () => {
      const { data } = await sfClient.get<{ total: number; orders: StorefrontOrder[] }>('/orders')
      return data
    },
    enabled: !!sessionStorage.getItem('sf_token'),
  })
}

export function useCustomerOrder(orderId: string) {
  return useQuery({
    queryKey: ['storefront', 'orders', orderId],
    queryFn: async () => {
      const { data } = await sfClient.get<StorefrontOrder>(`/orders/${orderId}`)
      return data
    },
    enabled: !!orderId && !!sessionStorage.getItem('sf_token'),
  })
}
