import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KDSStation {
  id: string
  name: string
  station_type: string
  warehouse_id: string
  is_active: boolean
  created_at: string
}

export interface KDSOrderItem {
  id: string
  kds_order_id: string
  line_id: string | null
  item_name: string
  quantity: number
  modifiers: Record<string, unknown> | null
  notes: string | null
  status: string
}

export interface KDSOrder {
  id: string
  transaction_id: string
  station_id: string
  status: string
  priority: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  items: KDSOrderItem[]
  transaction_number?: string
}

// ─── Stations ────────────────────────────────────────────────────────────────

export function useKDSStations(warehouseId?: string) {
  return useQuery({
    queryKey: ['kds', 'stations', { warehouseId }],
    queryFn: async () => {
      const params = warehouseId ? { warehouse_id: warehouseId } : {}
      const { data } = await apiClient.get<KDSStation[]>('/kds/stations', { params })
      return data
    },
  })
}

export function useCreateKDSStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; station_type: string; warehouse_id: string }) => {
      const { data } = await apiClient.post<KDSStation>('/kds/stations', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'stations'] }),
  })
}

export function useUpdateKDSStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; station_type: string; warehouse_id: string }) => {
      const { data } = await apiClient.put<KDSStation>(`/kds/stations/${id}`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'stations'] }),
  })
}

export function useDeleteKDSStation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/kds/stations/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'stations'] }),
  })
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function useKDSOrders(stationId: string) {
  return useQuery({
    queryKey: ['kds', 'orders', stationId],
    queryFn: async () => {
      const { data } = await apiClient.get<KDSOrder[]>(`/kds/stations/${stationId}/orders`)
      return data
    },
    enabled: !!stationId,
    refetchInterval: 5000,
  })
}

export function useStartKDSOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/start`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

export function useReadyKDSOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/ready`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

export function useServedKDSOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/served`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

export function useCancelKDSOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/cancel`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

// ─── KDS WebSocket Hook ──────────────────────────────────────────────────────

export function useKDSWebSocket(stationId: string, onMessage: (data: KDSOrder[]) => void) {
  // This is a placeholder — implement with useEffect + WebSocket
  // WebSocket URL: ws://localhost:8000/api/v1/kds/ws/{stationId}
  return { stationId, onMessage }
}
