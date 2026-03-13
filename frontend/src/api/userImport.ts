/**
 * User Import API client — bulk user provisioning via CSV/spreadsheet upload.
 *
 * Exports TanStack Query mutation hooks. All requests go through `client.ts`
 * (Axios instance with auth interceptors). Super Admin access required.
 * Backend prefix: `/api/v1/admin`.
 *
 * Key exports:
 *   - usePreviewImport()   — upload a CSV and receive a parsed preview (valid + error rows)
 *                            before committing; returns ImportPreviewResponse
 *   - useConfirmImport()   — commit a previewed import batch; returns created/skipped counts
 */
import { useMutation } from '@tanstack/react-query'
import apiClient from './client'

export interface ImportPreviewRow {
  row: number
  email: string
  full_name: string
  role?: string
  password?: string
  department?: string
}

export interface ImportErrorRow {
  row: number
  email: string
  full_name: string
  errors: string
}

export interface ImportPreviewResponse {
  total_rows: number
  valid_count: number
  error_count: number
  valid_rows: ImportPreviewRow[]
  error_rows: ImportErrorRow[]
}

export interface ImportConfirmResponse {
  created_count: number
  skipped_count: number
  created_users: Array<{
    id: string
    email: string
    full_name: string
    generated_password: string
  }>
  skipped: Array<{
    email: string
    reason: string
  }>
}

export function useImportPreview() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.post<ImportPreviewResponse>(
        '/admin/users/import/preview',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
  })
}

export function useImportConfirm() {
  return useMutation({
    mutationFn: async (rows: ImportPreviewRow[]) => {
      const { data } = await apiClient.post<ImportConfirmResponse>(
        '/admin/users/import/confirm',
        { rows }
      )
      return data
    },
  })
}
