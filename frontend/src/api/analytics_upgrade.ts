/**
 * Analytics Upgrade API client — schema introspection, AI Copilot, and semantic models.
 *
 * Exports TanStack Query hooks and Axios helper functions. All requests go
 * through `client.ts` (Axios instance with auth interceptors).
 * Backend prefix: `/api/v1/analytics`.
 *
 * Key exports:
 *   - useSchemaIntrospection()  — list all DB tables with column/FK metadata
 *   - useTableInfo()            — detailed info for a single table
 *   - useAnalyticsCopilot()     — AI-powered natural-language query generation
 *   - useSemanticModels()       — list/create named semantic model definitions
 *   - useRunSemanticQuery()     — execute a semantic model query against Postgres
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnInfo {
  name: string
  data_type: string
  is_nullable: boolean
  column_default: string | null
  is_primary_key: boolean
}

export interface ForeignKeyInfo {
  column: string
  references_table: string
  references_column: string
}

export interface TableInfo {
  table_name: string
  module: string
  row_count_estimate: number
  columns: ColumnInfo[]
  foreign_keys: ForeignKeyInfo[]
  primary_keys: string[]
}

export interface SchemaOverview {
  total_tables: number
  total_columns: number
  modules: Record<string, string[]>
}

export interface SchemaResponse {
  overview: SchemaOverview
  tables: TableInfo[]
}

export interface RelationshipInfo {
  from_table: string
  from_column: string
  to_table: string
  to_column: string
  relationship_type: string
}

export interface SemanticModel {
  id: string
  name: string
  description: string | null
  module: string
  table_count: number
  measure_count: number
  is_system: boolean
  created_at: string
  tables?: Record<string, unknown>
  relationships?: Record<string, unknown>
  measures?: Record<string, unknown>[]
  calculated_columns?: Record<string, unknown>[]
}

export interface CopilotResult {
  question: string
  sql: string
  columns: string[]
  data: Record<string, unknown>[]
  total_rows: number
  execution_time_ms: number
  narrative: string
  suggested_visuals: { type: string; title: string; confidence: number }[]
  error?: string
}

export interface ModuleInfo {
  module: string
  table_count: number
}

export interface SchemaSearchResult {
  tables: { type: string; name: string; module: string }[]
  columns: { type: string; table: string; name: string; data_type: string; module: string }[]
  total: number
}

// ─── API functions ────────────────────────────────────────────────────────────

async function fetchSchema(module?: string): Promise<SchemaResponse> {
  const params = module ? { module } : {}
  const { data } = await apiClient.get('/analytics/schema', { params })
  return data
}

async function fetchTableNames(module?: string): Promise<string[]> {
  const params = module ? { module } : {}
  const { data } = await apiClient.get('/analytics/schema/tables', { params })
  return data
}

async function fetchTableColumns(tableName: string) {
  const { data } = await apiClient.get(`/analytics/schema/tables/${tableName}/columns`)
  return data
}

async function fetchRelationships(module?: string): Promise<{ relationships: RelationshipInfo[]; total: number }> {
  const params = module ? { module } : {}
  const { data } = await apiClient.get('/analytics/schema/relationships', { params })
  return data
}

async function fetchModules(): Promise<ModuleInfo[]> {
  const { data } = await apiClient.get('/analytics/schema/modules')
  return data
}

async function searchSchema(q: string): Promise<SchemaSearchResult> {
  const { data } = await apiClient.get('/analytics/schema/search', { params: { q } })
  return data
}

async function askCopilot(question: string, module?: string): Promise<CopilotResult> {
  const { data } = await apiClient.post('/analytics/copilot/query', { question, module })
  return data
}

async function fetchSemanticModels(module?: string): Promise<SemanticModel[]> {
  const params = module ? { module } : {}
  const { data } = await apiClient.get('/analytics/semantic-models', { params })
  return data
}

async function fetchSemanticModel(modelId: string): Promise<SemanticModel> {
  const { data } = await apiClient.get(`/analytics/semantic-models/${modelId}`)
  return data
}

async function generateSemanticModels(): Promise<{ generated: number; modules: string[] }> {
  const { data } = await apiClient.post('/analytics/semantic-models/generate')
  return data
}

async function refreshSemanticModel(module: string): Promise<SemanticModel> {
  const { data } = await apiClient.post(`/analytics/semantic-models/${module}/refresh`)
  return data
}

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useSchema(module?: string) {
  return useQuery({
    queryKey: ['analytics', 'schema', module],
    queryFn: () => fetchSchema(module),
    staleTime: 300_000, // 5 minutes — schema doesn't change often
  })
}

export function useTableNames(module?: string) {
  return useQuery({
    queryKey: ['analytics', 'tables', module],
    queryFn: () => fetchTableNames(module),
    staleTime: 300_000,
  })
}

export function useTableColumns(tableName: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'table-columns', tableName],
    queryFn: () => fetchTableColumns(tableName!),
    enabled: !!tableName,
    staleTime: 300_000,
  })
}

export function useRelationships(module?: string) {
  return useQuery({
    queryKey: ['analytics', 'relationships', module],
    queryFn: () => fetchRelationships(module),
    staleTime: 300_000,
  })
}

export function useModules() {
  return useQuery({
    queryKey: ['analytics', 'modules'],
    queryFn: fetchModules,
    staleTime: 300_000,
  })
}

export function useSchemaSearch(q: string) {
  return useQuery({
    queryKey: ['analytics', 'schema-search', q],
    queryFn: () => searchSchema(q),
    enabled: q.length >= 1,
    staleTime: 60_000,
  })
}

export function useCopilotQuery() {
  return useMutation({
    mutationFn: ({ question, module }: { question: string; module?: string }) =>
      askCopilot(question, module),
  })
}

export function useSemanticModels(module?: string) {
  return useQuery({
    queryKey: ['analytics', 'semantic-models', module],
    queryFn: () => fetchSemanticModels(module),
    staleTime: 300_000,
  })
}

export function useSemanticModel(modelId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'semantic-model', modelId],
    queryFn: () => fetchSemanticModel(modelId!),
    enabled: !!modelId,
    staleTime: 300_000,
  })
}

export function useGenerateSemanticModels() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: generateSemanticModels,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics', 'semantic-models'] })
    },
  })
}

export function useRefreshSemanticModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (module: string) => refreshSemanticModel(module),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analytics', 'semantic-models'] })
    },
  })
}
