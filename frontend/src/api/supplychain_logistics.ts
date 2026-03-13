import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Carrier {
  id: string
  name: string
  code: string
  carrier_type: string
  rating: number | null
  is_active: boolean
  contact_email: string | null
  contact_phone: string | null
  created_at: string
}

export interface CreateCarrierPayload {
  name: string
  code: string
  carrier_type: string
  contact_email?: string | null
  contact_phone?: string | null
  rating?: number | null
}

export interface Route {
  id: string
  name: string
  origin: string
  destination: string
  transport_mode: string
  transit_days: number
  base_cost: number
  currency: string
  carrier_id: string | null
  carrier_name: string | null
  is_active: boolean
}

export interface TransportOrder {
  id: string
  reference: string
  carrier_id: string | null
  carrier_name: string
  route_id: string | null
  status: string
  origin: string
  destination: string
  estimated_delivery: string | null
  actual_delivery: string | null
  total_cost: number | null
  currency: string
  created_at: string
}

export interface TransportOrderEvent {
  id: string
  status: string
  location: string | null
  description: string | null
  timestamp: string
}

export interface FreightCost {
  id: string
  transport_order_id: string
  transport_order_reference: string
  cost_type: string
  amount: number
  currency: string
  is_invoiced: boolean
  invoice_number: string | null
  notes: string | null
  created_at: string
}

export interface DockSchedule {
  id: string
  dock_number: string
  transport_order_id: string | null
  transport_order_reference: string | null
  scheduled_start: string
  scheduled_end: string
  dock_type: string
  status: string
  carrier_name: string | null
}

export interface YardSlot {
  id: string
  slot_code: string
  slot_type: string
  status: string
  transport_order_id: string | null
  transport_order_reference: string | null
  occupied_since: string | null
  expected_release: string | null
}

// ─── API Functions ─────────────────────────────────────────────────────────────

// Carriers
export const getCarriers = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/carriers', { params }).then((r) => r.data)

export const getCarrier = (id: string) =>
  apiClient.get(`/supply-chain/logistics/carriers/${id}`).then((r) => r.data)

export const createCarrier = (payload: CreateCarrierPayload) =>
  apiClient.post('/supply-chain/logistics/carriers', payload).then((r) => r.data)

export const updateCarrier = (id: string, payload: Partial<CreateCarrierPayload & { is_active: boolean }>) =>
  apiClient.patch(`/supply-chain/logistics/carriers/${id}`, payload).then((r) => r.data)

export const deleteCarrier = (id: string) =>
  apiClient.delete(`/supply-chain/logistics/carriers/${id}`).then((r) => r.data)

// Routes
export const getRoutes = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/routes', { params }).then((r) => r.data)

export const findOptimalRoute = (payload: {
  origin: string
  destination: string
  transport_mode?: string
  constraints?: Record<string, unknown>
}) => apiClient.post('/supply-chain/logistics/routes/optimal', payload).then((r) => r.data)

// Transport Orders
export const getTransportOrders = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/transport-orders', { params }).then((r) => r.data)

export const getTransportOrder = (id: string) =>
  apiClient.get(`/supply-chain/logistics/transport-orders/${id}`).then((r) => r.data)

export const getTransportOrderEvents = (id: string) =>
  apiClient.get(`/supply-chain/logistics/transport-orders/${id}/events`).then((r) => r.data)

export const createTransportOrder = (payload: Record<string, unknown>) =>
  apiClient.post('/supply-chain/logistics/transport-orders', payload).then((r) => r.data)

export const updateTransportOrder = (id: string, payload: Record<string, unknown>) =>
  apiClient.patch(`/supply-chain/logistics/transport-orders/${id}`, payload).then((r) => r.data)

// Freight Costs
export const getFreightCosts = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/freight-costs', { params }).then((r) => r.data)

export const createFreightCost = (payload: Record<string, unknown>) =>
  apiClient.post('/supply-chain/logistics/freight-costs', payload).then((r) => r.data)

// Dock Schedules
export const getDockSchedules = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/dock-schedules', { params }).then((r) => r.data)

export const createDockSchedule = (payload: Record<string, unknown>) =>
  apiClient.post('/supply-chain/logistics/dock-schedules', payload).then((r) => r.data)

// Yard Slots
export const getYardSlots = (params?: Record<string, unknown>) =>
  apiClient.get('/supply-chain/logistics/yard-slots', { params }).then((r) => r.data)

export const updateYardSlot = (id: string, payload: Record<string, unknown>) =>
  apiClient.patch(`/supply-chain/logistics/yard-slots/${id}`, payload).then((r) => r.data)

// ─── TanStack Query Hooks ──────────────────────────────────────────────────────

export function useCarriers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'carriers', params],
    queryFn: () => getCarriers(params),
  })
}

export function useCarrier(id: string) {
  return useQuery({
    queryKey: ['sc', 'carrier', id],
    queryFn: () => getCarrier(id),
    enabled: !!id,
  })
}

export function useCreateCarrier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCarrier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'carriers'] }),
  })
}

export function useUpdateCarrier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCarrierPayload & { is_active: boolean }> }) =>
      updateCarrier(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'carriers'] }),
  })
}

export function useDeleteCarrier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCarrier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'carriers'] }),
  })
}

export function useRoutes(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'routes', params],
    queryFn: () => getRoutes(params),
  })
}

export function useFindOptimalRoute() {
  return useMutation({
    mutationFn: findOptimalRoute,
  })
}

export function useTransportOrders(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'transport-orders', params],
    queryFn: () => getTransportOrders(params),
  })
}

export function useTransportOrder(id: string) {
  return useQuery({
    queryKey: ['sc', 'transport-order', id],
    queryFn: () => getTransportOrder(id),
    enabled: !!id,
  })
}

export function useTransportOrderEvents(id: string) {
  return useQuery({
    queryKey: ['sc', 'transport-order-events', id],
    queryFn: () => getTransportOrderEvents(id),
    enabled: !!id,
  })
}

export function useCreateTransportOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createTransportOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'transport-orders'] }),
  })
}

export function useUpdateTransportOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateTransportOrder(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'transport-orders'] }),
  })
}

export function useFreightCosts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'freight-costs', params],
    queryFn: () => getFreightCosts(params),
  })
}

export function useCreateFreightCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createFreightCost,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'freight-costs'] }),
  })
}

export function useDockSchedules(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'dock-schedules', params],
    queryFn: () => getDockSchedules(params),
  })
}

export function useCreateDockSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createDockSchedule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'dock-schedules'] }),
  })
}

export function useYardSlots(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['sc', 'yard-slots', params],
    queryFn: () => getYardSlots(params),
  })
}

export function useUpdateYardSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateYardSlot(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sc', 'yard-slots'] }),
  })
}
