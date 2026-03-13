/**
 * Manufacturing AI API client — AI-powered production intelligence: bottleneck
 * detection, SPC risk scoring, and QC failure prediction.
 *
 * Exports TanStack Query hooks for the Manufacturing module's AI analytics
 * features. All requests go through `client.ts` (Axios instance with auth
 * interceptors). Backend prefix: `/api/v1/manufacturing`.
 *
 * Key exports:
 *   - useBottleneckAnalysis() — identifies critical workstation bottlenecks
 *     and utilisation scores over a configurable look-back window
 *   - useSPCRisk() — Statistical Process Control out-of-control rate per
 *     inspection plan item
 *   - useQCRisk() — per-workstation quality pass-rate and defect-risk ranking
 */
import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export interface BottleneckItem {
  workstation_id: string
  utilization_percent: number
  avg_queue_minutes: number
  work_order_count: number
  downtime_events: number
  bottleneck_score: number
  is_critical: boolean
}

export interface BottleneckAnalysis {
  analysis_days: number
  bottlenecks: BottleneckItem[]
}

export interface SPCRiskItem {
  inspection_plan_item_id: string
  total_measurements: number
  out_of_control: number
  ooc_rate_percent: number
  risk_level: string
}

export interface QCRiskItem {
  workstation_id: string
  pass_rate_percent: number
  inspected: number
  failed: number
  risk_level: string
}

export interface QualityRiskAnalysis {
  analysis_days: number
  overall_risk: string
  ncr_by_severity: Record<string, number>
  total_ncrs: number
  spc_at_risk_items: SPCRiskItem[]
  low_pass_rate_workstations: QCRiskItem[]
  recommendations: string[]
}

export interface ScheduleSuggestion {
  type: string
  severity: string
  message: string
  action: string | null
  workstation_id?: string
}

export interface ScheduleSuggestions {
  suggestions: ScheduleSuggestion[]
  generated_at: string
}

export interface ExecutiveDashboard {
  period: { from: string; to: string }
  work_orders: {
    by_status: Record<string, number>
    total: number
    active: number
    completed_this_month: number
  }
  output: {
    units_produced: number
    manufacturing_cost: number
    cost_per_unit: number
  }
  quality: {
    ncr_by_severity: Record<string, number>
    total_open_ncrs: number
  }
  equipment: {
    downtime_hours_this_month: number
  }
}

export interface ExecutiveSummary {
  summary: string
  kpis: ExecutiveDashboard
  generated_at: string
}

export const useBottleneckAnalysis = (days = 30) =>
  useQuery({
    queryKey: ['mfg-bottlenecks', days],
    queryFn: () =>
      apiClient.get<BottleneckAnalysis>('/manufacturing/ai/bottlenecks', { params: { days } }).then(r => r.data),
  })

export const useQualityRiskAnalysis = (days = 30) =>
  useQuery({
    queryKey: ['mfg-quality-risk', days],
    queryFn: () =>
      apiClient.get<QualityRiskAnalysis>('/manufacturing/ai/quality-risk', { params: { days } }).then(r => r.data),
  })

export const useScheduleSuggestions = () =>
  useQuery({
    queryKey: ['mfg-schedule-suggestions'],
    queryFn: () =>
      apiClient.get<ScheduleSuggestions>('/manufacturing/ai/schedule-suggestions').then(r => r.data),
  })

export const useExecutiveDashboard = () =>
  useQuery({
    queryKey: ['mfg-executive-dashboard'],
    queryFn: () =>
      apiClient.get<ExecutiveDashboard>('/manufacturing/ai/executive-dashboard').then(r => r.data),
  })

export const useExecutiveSummary = () =>
  useQuery({
    queryKey: ['mfg-executive-summary'],
    queryFn: () =>
      apiClient.get<ExecutiveSummary>('/manufacturing/ai/executive-summary').then(r => r.data),
    staleTime: 5 * 60 * 1000, // 5 min cache — Ollama call is expensive
  })
