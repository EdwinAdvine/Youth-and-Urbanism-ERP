/**
 * E-Commerce Extended API client — cart, coupons, shipping, reviews, wishlists,
 * sales analytics.
 *
 * Exports TanStack Query hooks and Axios helper functions for the E-Commerce
 * module's extended features. All requests go through `client.ts` (Axios
 * instance with auth interceptors). Backend prefix: `/api/v1/ecommerce`.
 *
 * Key exports:
 *   - useCart() / useAddToCart() / useRemoveCartItem() — shopping cart management
 *   - useCoupons() / useCreateCoupon() — discount code CRUD
 *   - useShippingMethods() / useCreateShippingMethod() — shipping configuration
 *   - useReviews() / useApproveReview() — product review moderation
 *   - useWishlist() / useAddToWishlist() — customer wishlist management
 *   - useSalesReport() / useTopProducts() / useConversionFunnel() — analytics
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: string
  cart_id: string
  product_id: string
  product_name: string
  product_image: string | null
  quantity: number
  unit_price: number
  total: number
}

export interface Cart {
  id: string
  customer_id: string | null
  session_id: string | null
  items: CartItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  coupon_code: string | null
  created_at: string
  updated_at: string
}

export interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_order_amount: number | null
  max_discount_amount: number | null
  usage_limit: number | null
  used_count: number
  valid_from: string
  valid_until: string | null
  is_active: boolean
  store_id: string | null
  created_at: string
  updated_at: string
}

export interface ShippingMethod {
  id: string
  name: string
  code: string
  description: string | null
  base_cost: number
  cost_per_kg: number | null
  estimated_days_min: number
  estimated_days_max: number
  is_active: boolean
  store_id: string | null
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  product_id: string
  product_name: string | null
  customer_id: string | null
  customer_name: string | null
  rating: number
  title: string | null
  content: string | null
  is_verified_purchase: boolean
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

export interface WishlistItem {
  id: string
  product_id: string
  product_name: string
  product_image: string | null
  price: number
  added_at: string
}

export interface SalesReportData {
  period: string
  orders_count: number
  revenue: number
  avg_order_value: number
  units_sold: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  units_sold: number
  revenue: number
  image: string | null
}

export interface ConversionFunnelStep {
  step: string
  count: number
  percentage: number
}

export interface CouponValidation {
  valid: boolean
  discount_amount: number
  message: string
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedCoupons {
  total: number
  coupons: Coupon[]
}

export interface PaginatedReviews {
  total: number
  reviews: Review[]
}

// ─── Payload types ────────────────────────────────────────────────────────────

export interface AddToCartPayload {
  product_id: string
  quantity: number
}

export interface UpdateCartItemPayload {
  item_id: string
  quantity: number
}

export interface CheckoutPayload {
  shipping_address_id: string
  shipping_method_id: string
  payment_method: string
  coupon_code?: string
  notes?: string
}

export interface CreateCouponPayload {
  code: string
  description?: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_order_amount?: number
  max_discount_amount?: number
  usage_limit?: number
  valid_from: string
  valid_until?: string
  is_active?: boolean
  store_id?: string
}

export interface CreateShippingMethodPayload {
  name: string
  code: string
  description?: string
  base_cost: number
  cost_per_kg?: number
  estimated_days_min: number
  estimated_days_max: number
  is_active?: boolean
  store_id?: string
}

export interface CreateReviewPayload {
  product_id: string
  rating: number
  title?: string
  content?: string
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export function useCart() {
  return useQuery({
    queryKey: ['ecommerce', 'cart'],
    queryFn: async () => {
      const { data } = await apiClient.get<Cart>('/ecommerce/cart')
      return data
    },
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: AddToCartPayload) => {
      const { data } = await apiClient.post<Cart>('/ecommerce/cart/items', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'cart'] }),
  })
}

export function useUpdateCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item_id, quantity }: UpdateCartItemPayload) => {
      const { data } = await apiClient.put<Cart>(`/ecommerce/cart/items/${item_id}`, { quantity })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'cart'] }),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data } = await apiClient.delete<Cart>(`/ecommerce/cart/items/${itemId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'cart'] }),
  })
}

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const { data } = await apiClient.post('/ecommerce/cart/checkout', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ecommerce', 'cart'] })
      qc.invalidateQueries({ queryKey: ['ecommerce', 'orders'] })
    },
  })
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

export function useCoupons(params: { search?: string; is_active?: boolean; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'coupons', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedCoupons>('/ecommerce/coupons', { params })
      return data
    },
  })
}

export function useCreateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateCouponPayload) => {
      const { data } = await apiClient.post<Coupon>('/ecommerce/coupons', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'coupons'] }),
  })
}

export function useUpdateCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateCouponPayload> & { id: string }) => {
      const { data } = await apiClient.put<Coupon>(`/ecommerce/coupons/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'coupons'] }),
  })
}

export function useDeleteCoupon() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ecommerce/coupons/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'coupons'] }),
  })
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post<CouponValidation>('/ecommerce/coupons/validate', { code })
      return data
    },
  })
}

// ─── Shipping Methods ─────────────────────────────────────────────────────────

export function useShippingMethods(params: { is_active?: boolean } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'shipping-methods', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ShippingMethod[]>('/ecommerce/shipping-methods', { params })
      return data
    },
  })
}

export function useCreateShippingMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateShippingMethodPayload) => {
      const { data } = await apiClient.post<ShippingMethod>('/ecommerce/shipping-methods', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'shipping-methods'] }),
  })
}

export function useUpdateShippingMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateShippingMethodPayload> & { id: string }) => {
      const { data } = await apiClient.put<ShippingMethod>(`/ecommerce/shipping-methods/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'shipping-methods'] }),
  })
}

export function useDeleteShippingMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ecommerce/shipping-methods/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'shipping-methods'] }),
  })
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export function useProductReviews(params: { product_id?: string; status?: string; skip?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'reviews', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedReviews>('/ecommerce/reviews', { params })
      return data
    },
  })
}

export function useCreateReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateReviewPayload) => {
      const { data } = await apiClient.post<Review>('/ecommerce/reviews', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'reviews'] }),
  })
}

export function useApproveReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approved' | 'rejected' }) => {
      const { data } = await apiClient.put<Review>(`/ecommerce/reviews/${id}/status`, { status: action })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'reviews'] }),
  })
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export function useWishlist() {
  return useQuery({
    queryKey: ['ecommerce', 'wishlist'],
    queryFn: async () => {
      const { data } = await apiClient.get<WishlistItem[]>('/ecommerce/wishlist')
      return data
    },
  })
}

export function useAddToWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (productId: string) => {
      const { data } = await apiClient.post<WishlistItem>('/ecommerce/wishlist', { product_id: productId })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'wishlist'] }),
  })
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (productId: string) => {
      await apiClient.delete(`/ecommerce/wishlist/${productId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ecommerce', 'wishlist'] }),
  })
}

// ─── Sales Reports ────────────────────────────────────────────────────────────

export function useSalesReport(params: { period?: 'daily' | 'weekly' | 'monthly'; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'reports', 'sales', params],
    queryFn: async () => {
      const { data } = await apiClient.get<SalesReportData[]>('/ecommerce/reports/sales', { params })
      return data
    },
  })
}

export function useTopProducts(params: { limit?: number; start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'reports', 'top-products', params],
    queryFn: async () => {
      const { data } = await apiClient.get<TopProduct[]>('/ecommerce/reports/top-products', { params })
      return data
    },
  })
}

export function useConversionFunnel(params: { start_date?: string; end_date?: string } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'reports', 'conversion-funnel', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ConversionFunnelStep[]>('/ecommerce/reports/conversion-funnel', { params })
      return data
    },
  })
}

// ─── POS Sync ────────────────────────────────────────────────────────────────

export interface POSSyncProduct {
  ecommerce_product_id: string
  name: string
  sku: string
  description: string | null
  unit_price: number
  category: string | null
  image_url: string | null
  is_active: boolean
}

export function usePOSSyncProducts(params: { store_id?: string } = {}) {
  return useQuery({
    queryKey: ['ecommerce', 'products', 'pos-sync', params],
    queryFn: async () => {
      const { data } = await apiClient.get<POSSyncProduct[]>('/ecommerce/products/pos-sync', { params })
      return data
    },
  })
}
