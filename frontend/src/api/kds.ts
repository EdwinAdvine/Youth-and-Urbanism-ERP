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

// ─── Station Detail ─────────────────────────────────────────────────────────

export function useKDSStation(stationId: string) {
  return useQuery({
    queryKey: ['kds', 'stations', stationId],
    queryFn: async () => {
      const { data } = await apiClient.get<KDSStation>(`/kds/stations/${stationId}`)
      return data
    },
    enabled: !!stationId,
  })
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export function useCreateKDSOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { transaction_id: string; station_id: string; items: { line_id?: string; item_name: string; quantity: number; modifiers?: Record<string, unknown>; notes?: string }[] }) => {
      const { data } = await apiClient.post<KDSOrder>('/kds/orders', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

export function useKDSOrder(orderId: string) {
  return useQuery({
    queryKey: ['kds', 'order', orderId],
    queryFn: async () => {
      const { data } = await apiClient.get<KDSOrder>(`/kds/orders/${orderId}`)
      return data
    },
    enabled: !!orderId,
  })
}

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

// ─── Item-Level Actions ─────────────────────────────────────────────────────

export function useItemCooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/items/${itemId}/cooking`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

export function useItemReady() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      const { data } = await apiClient.post(`/kds/orders/${orderId}/items/${itemId}/ready`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kds', 'orders'] }),
  })
}

// ─── KDS WebSocket Hook ──────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'

type KDSWSStatus = 'connecting' | 'connected' | 'disconnected'

export function useKDSWebSocket(stationId: string, onMessage: (data: KDSOrder[]) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()
  const reconnectAttempt = useRef(0)
  const [status, setStatus] = useState<KDSWSStatus>('disconnected')
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!stationId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/api/v1/kds/ws/${stationId}`

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttempt.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const orders: KDSOrder[] = JSON.parse(e.data)
        onMessageRef.current(orders)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      wsRef.current = null
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000)
      reconnectAttempt.current += 1
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [stationId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { status, stationId }
}
